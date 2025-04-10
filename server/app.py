import os
import subprocess
import json
import time
from pathlib import Path
import shutil

from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import requests
import urllib.request
from pymongo import MongoClient
from botocore.exceptions import ClientError
import oss2
from openai import OpenAI

app = Flask(__name__)
CORS(app)

# Initialize clients using environment variables
qwen_client = OpenAI(
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
)

# ApsaraDB MongoDB connection for semi-structured data
mongo_client = MongoClient(os.getenv("MONGODB_CONNECTION_STRING"))
db = mongo_client[os.getenv("MONGODB_DATABASE", "aphasia_assistant")]
items_collection = db["items"]
categories_collection = db["categories"]

# OSS configuration for media storage
auth = oss2.Auth(
    os.getenv("OSS_ACCESS_KEY_ID"),
    os.getenv("OSS_ACCESS_KEY_SECRET")
)
bucket = oss2.Bucket(
    auth,
    os.getenv("OSS_ENDPOINT"),
    os.getenv("OSS_BUCKET_NAME")
)

# Alibaba Cloud EAS configuration for AI model inference
EAS_URL = os.getenv("EAS_URL")
EAS_TOKEN = os.getenv("EAS_TOKEN")

# Local temporary storage
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
TEMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp')
VIDEOS_DIR = os.path.join(TEMP_DIR, 'videos')
IMAGES_DIR = os.path.join(TEMP_DIR, 'images')

# Create directories if they don't exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(VIDEOS_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)

# Wan2.1 model paths
WAN_T2I_MODEL_PATH = os.getenv("WAN_T2I_MODEL_PATH", "./Wan2.1-T2V-1.3B")
WAN_I2V_MODEL_PATH = os.getenv("WAN_I2V_MODEL_PATH", "./Wan2.1-I2V-1.3B-720P")


class TaskStatus:
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


def save_data_to_mongodb(data):
    """Save categorized data to MongoDB"""
    try:
        # Store items individually
        for item in data["items"]:
            items_collection.update_one(
                {"name": item["name"]},
                {"$set": item},
                upsert=True
            )
        return True
    except Exception as e:
        print(f"Error saving to MongoDB: {str(e)}")
        return False


def load_data_from_mongodb():
    """Load categorized data from MongoDB"""
    try:
        items = list(items_collection.find({}, {"_id": 0}))
        return {"items": items}
    except Exception as e:
        print(f"Error loading from MongoDB: {str(e)}")
        return {"items": []}


def upload_file_to_oss(local_path, oss_key):
    """Upload a file to OSS and return public URL"""
    try:
        bucket.put_object_from_file(oss_key, local_path)
        # Generate URL with appropriate expiration
        url = bucket.sign_url('GET', oss_key, 60 * 60 * 24 * 7)  # 7-day link
        return url
    except ClientError as e:
        print(f"Error uploading to OSS: {str(e)}")
        return None


def generate_and_save_image(prompt, filename):
    """Generate image using Wan2.1 T2I model and save to OSS"""
    try:
        # Create an enhanced prompt for better image quality
        enhanced_prompt = f"A realistic, high-quality photograph of {prompt}. Professional lighting, detailed texture, photorealistic style. No text, no watermarks."

        # Local temporary path
        local_image_path = os.path.join(IMAGES_DIR, filename)

        # Check if image already exists in OSS
        oss_key = f"images/{filename}"
        try:
            bucket.get_object_meta(oss_key)
            print(f"Image already exists in OSS for {prompt}")
            return oss_key
        except:
            # Image doesn't exist, generate it
            print(f"Generating image for: {prompt}")

            # Run Wan2.1 T2I model
            cmd = [
                "python", "generate.py",
                "--task", "t2i-1.3B",
                "--size", "1024*1024",
                "--ckpt_dir", WAN_T2I_MODEL_PATH,
                "--prompt", enhanced_prompt,
                "--output", local_image_path
            ]

            process = subprocess.run(
                cmd,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )

            if os.path.exists(local_image_path):
                # Upload to OSS
                upload_file_to_oss(local_image_path, oss_key)
                print(f"Image generated and uploaded to OSS for {prompt}")
                return oss_key
            else:
                print(f"Failed to generate image for {prompt}")
                return None

    except Exception as e:
        print(f"Error generating image for {prompt}: {str(e)}")
        return None


def generate_video(item_name, action, video_filename):
    """Generate video using Wan2.1 I2V model and save to OSS"""
    try:
        # First generate a reference image for the item
        reference_image = os.path.join(
            IMAGES_DIR, f"{item_name.replace(' ', '_')}_ref.jpg")

        # Generate reference image if it doesn't exist
        if not os.path.exists(reference_image):
            # Use simpler T2I command to generate reference image
            ref_cmd = [
                "python", "generate.py",
                "--task", "t2i-1.3B",
                "--size", "1280*720",
                "--ckpt_dir", WAN_T2I_MODEL_PATH,
                "--prompt", f"a clear view of {item_name}",
                "--output", reference_image
            ]
            subprocess.run(ref_cmd, check=True)

        # Local video path
        local_video_path = os.path.join(VIDEOS_DIR, video_filename)

        # Create prompt with item context
        prompt = f"A person {action} with {item_name}, realistic, natural movement"

        # Run Wan2.1 I2V model
        cmd = [
            "python", "generate.py",
            "--task", "i2v-1.3B",
            "--size", "1280*720",
            "--ckpt_dir", WAN_I2V_MODEL_PATH,
            "--image", reference_image,
            "--prompt", prompt,
            "--output", local_video_path
        ]

        process = subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )

        # Check if video was created successfully
        if os.path.exists(local_video_path):
            # Upload to OSS
            oss_key = f"videos/{video_filename}"
            upload_file_to_oss(local_video_path, oss_key)
            return oss_key
        else:
            return None

    except Exception as e:
        print(f"Error generating video: {str(e)}")
        return None


@app.route('/api/categorize-items', methods=['POST'])
def categorize_items():
    try:
        # Get items from request
        data = request.json
        items = data.get('items', '')

        if not items:
            return jsonify({"error": "No items provided"}), 400

        # Call Qwen for categorization
        completion = qwen_client.chat.completions.create(
            model="qwen-max",
            messages=[
                {'role': 'system',
                 'content': 'Generate a JSON structure that categorizes the following items into appropriate categories and subcategories. Each item should also include up to 4 common requests or assistance needs that an aphasia patient might want to communicate to caregivers regarding this item. Each item should be organized in this format:\n{\n  "items": [\n    {\n      "name": "item name",\n      "category": "main category",\n      "subcategory": "specific subcategory",\n      "requests": ["request 1", "request 2", "request 3", "request 4"]\n    },\n    ...\n  ]\n}\n\nFor example, if the item is "water", the entry would be:\n{\n  "name": "water",\n  "category": "food and drinks",\n  "subcategory": "beverages",\n  "requests": ["need refill", "make warmer", "add ice", "help drinking"]\n}\n\nProcess the following items and strictly output in JSON format only without any explanation:'},
                {'role': 'user', 'content': items}
            ],
            temperature=0
        )

        response = completion.choices[0].message.content

        # Strip the triple backticks and 'json' identifier if present
        if response.startswith("```json"):
            response = response.lstrip("```json").rstrip("```").strip()

        elif response.startswith("```"):
            response = response.lstrip("```").rstrip("```").strip()

        # Validate it's proper JSON
        parsed = json.loads(response)

        # Load existing data from MongoDB
        existing_data = load_data_from_mongodb()
        existing_items = {
            item["name"]: item for item in existing_data.get("items", [])}

        # Track OSS paths for images and videos
        image_mapping = {}
        video_mapping = {}

        # Track unique categories and subcategories for image generation
        categories = set()
        subcategories = set()

        # Process new items
        for item in parsed["items"]:
            item_name = item["name"]

            # Add to category/subcategory sets
            categories.add(item["category"])
            subcategories.add(f"{item['category']}-{item['subcategory']}")

            # Check if this item already exists
            if item_name in existing_items:
                # Use existing item data but update with new data
                existing_item = existing_items[item_name]

                # Keep the existing item's data but update with new fields
                for key, value in item.items():
                    existing_item[key] = value

                # Use this updated item
                item = existing_item

            # Generate image for the item
            item_image_filename = f"item_{item_name.replace(' ', '_').lower()}.png"
            item_image_key = generate_and_save_image(
                item_name, item_image_filename)
            if item_image_key:
                image_mapping[f"item-{item_name}"] = item_image_key

            # Process requests for videos
            if "requests" in item:
                for action in item["requests"]:
                    # Generate a unique key for this video
                    video_key = f"{item_name}-{action}"
                    video_filename = f"{video_key.replace(' ', '_').replace('-', '_')}.mp4"

                    # Check if video exists in OSS
                    oss_video_key = f"videos/{video_filename}"
                    try:
                        bucket.get_object_meta(oss_video_key)
                        print(
                            f"Video already exists in OSS for {item_name} - {action}")
                        video_mapping[video_key] = oss_video_key
                        continue
                    except:
                        # Video doesn't exist, generate it
                        print(
                            f"Generating video for: {item_name} - {action}")

                        # Generate the video
                        video_oss_key = generate_video(
                            item_name, action, video_filename)

                        if video_oss_key:
                            video_mapping[video_key] = video_oss_key
                            print(
                                f"Video generated and uploaded for {item_name} - {action}")
                        else:
                            print(
                                f"Failed to generate video for {item_name} - {action}")

        # Generate images for categories
        for category in categories:
            category_image_filename = f"category_{category.replace(' ', '_').lower()}.png"
            category_image_key = generate_and_save_image(
                category, category_image_filename)
            if category_image_key:
                image_mapping[f"category-{category}"] = category_image_key

        # Generate images for subcategories
        for subcategory_full in subcategories:
            parts = subcategory_full.split('-', 1)
            if len(parts) == 2:
                category, subcategory = parts
                subcategory_image_filename = f"subcategory_{category.replace(' ', '_').lower()}_{subcategory.replace(' ', '_').lower()}.png"
                subcategory_image_key = generate_and_save_image(
                    f"{subcategory} in {category}", subcategory_image_filename)
                if subcategory_image_key:
                    image_mapping[f"subcategory-{category}-{subcategory}"] = subcategory_image_key

        # Combine existing and new items
        combined_items = list(existing_items.values())

        # Add any new items that weren't in existing data
        for item in parsed["items"]:
            if item["name"] not in existing_items:
                combined_items.append(item)

        # Create the final response
        final_data = {
            "items": combined_items,
            "videos": video_mapping,
            "images": image_mapping
        }

        # Save the updated data to MongoDB
        save_data_to_mongodb(final_data)

        return jsonify(final_data)

    except Exception as e:
        print(f"Error during categorization: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/stored-data', methods=['GET'])
def get_stored_data():
    """Return all stored data"""
    try:
        data = load_data_from_mongodb()

        # Get media metadata from MongoDB
        video_mapping = {}
        image_mapping = {}

        # Populate with OSS URLs
        media_files = media_collection.find({}, {"_id": 0})
        for media in media_files:
            if media["type"] == "video":
                video_mapping[media["key"]] = media["oss_path"]
            elif media["type"] == "image":
                image_mapping[media["key"]] = media["oss_path"]

        data["videos"] = video_mapping
        data["images"] = image_mapping

        return jsonify(data)
    except Exception as e:
        print(f"Error retrieving stored data: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/videos/<path:filename>', methods=['GET'])
def get_video(filename):
    try:
        # Check if file is in OSS and redirect to signed URL
        oss_key = f"videos/{filename}"
        url = bucket.sign_url('GET', oss_key, 3600)  # 1-hour link
        return jsonify({"url": url})
    except Exception as e:
        print(f"Error serving video: {str(e)}")
        return jsonify({"error": str(e)}), 404


@app.route('/api/images/<path:filename>', methods=['GET'])
def get_image(filename):
    try:
        # Check if file is in OSS and redirect to signed URL
        oss_key = f"images/{filename}"
        url = bucket.sign_url('GET', oss_key, 3600)  # 1-hour link
        return jsonify({"url": url})
    except Exception as e:
        print(f"Error serving image: {str(e)}")
        return jsonify({"error": str(e)}), 404


if __name__ == '__main__':
    app.run(debug=True, port=5000)
