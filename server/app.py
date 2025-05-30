import os
import subprocess
import json
import time
from pathlib import Path
import shutil
import base64

from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import requests
import urllib.request
from pymongo import MongoClient
from botocore.exceptions import ClientError
import oss2
from openai import OpenAI
from aliyunsdkcore.client import AcsClient
from aliyunsdkcore.acs_exception.exceptions import ClientException, ServerException
from aliyunsdknls.request.v20180628 import CreateTtsTaskRequest


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

# Initialize Alibaba Intelligent Speech client
speech_client = AcsClient(
    os.getenv("ALIBABA_SPEECH_ACCESS_KEY_ID"),
    os.getenv("ALIBABA_SPEECH_ACCESS_KEY_SECRET"),
    os.getenv("ALIBABA_SPEECH_REGION", "ap-southeast-1")
)


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


def generate_tts_audio(text, voice="Olivia", filename=None):
    """Generate speech audio from text using Alibaba Intelligent Speech Interaction"""
    try:
        if not filename:
            # Generate a unique filename based on text
            filename = f"speech_{text.replace(' ', '_')[:30].lower()}_{int(time.time())}.mp3"

        # Local audio path
        local_audio_path = os.path.join(TEMP_DIR, 'audio', filename)
        os.makedirs(os.path.join(TEMP_DIR, 'audio'), exist_ok=True)

        # Create TTS request
        request = CreateTtsTaskRequest.CreateTtsTaskRequest()
        request.set_accept_format('json')
        request.set_Text(text)
        request.set_Voice(voice)  # Voice options like Olivia, William, etc.
        request.set_Format("mp3")
        request.set_SampleRate(16000)

        # Execute request
        response = speech_client.do_action_with_exception(request)
        response_json = json.loads(response)

        if 'TaskId' in response_json:
            task_id = response_json['TaskId']

            # Wait for task completion and download the audio file
            status = "RUNNING"
            while status == "RUNNING":
                time.sleep(1)
                status_request = GetTtsTaskRequest.GetTtsTaskRequest()
                status_request.set_TaskId(task_id)
                status_response = speech_client.do_action_with_exception(
                    status_request)
                status_response_json = json.loads(status_response)
                status = status_response_json.get('StatusText', 'RUNNING')

            if status == "SUCCESS" and 'TtsUrl' in status_response_json:
                # Download the audio file
                urllib.request.urlretrieve(
                    status_response_json['TtsUrl'], local_audio_path)

                # Upload to OSS
                oss_key = f"audio/{filename}"
                upload_file_to_oss(local_audio_path, oss_key)
                return oss_key
            else:
                print(f"TTS task failed with status: {status}")
                return None
        else:
            print("Failed to create TTS task")
            return None
    except Exception as e:
        print(f"Error generating audio: {str(e)}")
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

        # Process categories, subcategories, and items for TTS
        audio_mapping = {}

        # Generate audio for categories
        for category in categories:
            audio_key = generate_tts_audio(category)
            if audio_key:
                audio_mapping[category] = audio_key

        # Generate audio for subcategories
        for subcategory_full in subcategories:
            parts = subcategory_full.split('-', 1)
            if len(parts) == 2:
                _, subcategory = parts
                audio_key = generate_tts_audio(subcategory)
                if audio_key:
                    audio_mapping[subcategory] = audio_key

        # Generate audio for items
        for item in parsed["items"]:
            audio_key = generate_tts_audio(item["name"])
            if audio_key:
                audio_mapping[item["name"]] = audio_key

        # Add audio to final response
        final_data["audio"] = audio_mapping

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
        media_collection = db["media"]
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


@app.route('/api/audio/<path:filename>', methods=['GET'])
def get_audio(filename):
    try:
        # Check if file exists in OSS and return signed URL
        oss_key = f"audio/{filename}"
        url = bucket.sign_url('GET', oss_key, 3600)  # 1-hour link
        return jsonify({"url": url})
    except Exception as e:
        print(f"Error serving audio: {str(e)}")
        return jsonify({"error": str(e)}), 404


@app.route('/api/generate-speech', methods=['POST'])
def generate_speech():
    try:
        data = request.json
        text = data.get('text')
        voice = data.get('voice', 'Olivia')

        if not text:
            return jsonify({"error": "No text provided"}), 400

        # Generate a deterministic filename based on text content
        sanitized_text = text.replace(' ', '_').lower()
        filename = f"{sanitized_text[:30]}_{hash(text) % 10000}.mp3"

        # Check if this audio already exists in OSS
        oss_key = f"audio/{filename}"
        try:
            bucket.get_object_meta(oss_key)
            print(f"Audio already exists in OSS for '{text}'")
        except:
            # Generate new audio
            print(f"Generating audio for: '{text}'")
            oss_key = generate_tts_audio(text, voice, filename)

            if not oss_key:
                return jsonify({"error": "Failed to generate audio"}), 500

        # Get signed URL
        url = bucket.sign_url('GET', oss_key, 3600)  # 1-hour link
        return jsonify({"url": url, "key": oss_key})

    except Exception as e:
        print(f"Error generating speech: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/detect-object', methods=['POST'])
def detect_object():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image file provided"}), 400

        image_file = request.files['image']

        # Save the image temporarily
        temp_image_path = os.path.join(TEMP_DIR, 'temp_image.jpg')
        image_file.save(temp_image_path)

        # Encode the image to base64 for Qwen-VL
        with open(temp_image_path, "rb") as image_file:
            encoded_string = base64.b64encode(
                image_file.read()).decode('utf-8')

        # Call Qwen-VL for object detection
        completion = qwen_client.chat.completions.create(
            model="qwen-vl",
            messages=[
                {'role': 'system', 'content': 'You are an AI assistant capable of analyzing images. Detect the main object in the image and provide its name as a single word or short phrase. No explanations.'},
                {'role': 'user', 'content': [
                    {'type': 'text', 'text': 'What is the main object in this image?'},
                    {'type': 'image_url', 'image_url': {
                        'url': f"data:image/jpeg;base64,{encoded_string}"}}
                ]}
            ],
            temperature=0
        )

        detected_object = completion.choices[0].message.content.strip()

        # Clean up temporary file
        os.remove(temp_image_path)

        return jsonify({"detected_item": detected_object})

    except Exception as e:
        print(f"Error detecting object: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/update-item-requests', methods=['POST'])
def update_item_requests():
    try:
        data = request.json
        item_name = data.get('itemName')
        requests = data.get('requests')
        video_path = data.get('videoPath')

        if not item_name or not requests:
            return jsonify({"error": "Invalid request data"}), 400

        # Update the item in MongoDB
        result = items_collection.update_one(
            {"name": item_name},
            {"$set": {"requests": requests}}
        )

        # Update media collection for the new video
        if video_path:
            # The last request is the new one
            video_key = f"{item_name}-{requests[-1]}"
            media_collection.update_one(
                {"key": video_key},
                {"$set": {
                    "type": "video",
                    "key": video_key,
                    "oss_path": video_path
                }},
                upsert=True
            )

        return jsonify({"success": True})

    except Exception as e:
        print(f"Error updating item requests: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/generate-action-video', methods=['POST'])
def generate_action_video():
    try:
        data = request.json
        item_name = data.get('itemName')
        action = data.get('action')

        if not item_name or not action:
            return jsonify({"error": "Invalid request data"}), 400

        # Generate a unique filename
        video_filename = f"{item_name.replace(' ', '_')}_{action.replace(' ', '_')}.mp4"

        # Generate the video
        video_path = generate_video(item_name, action, video_filename)

        if not video_path:
            return jsonify({"error": "Failed to generate video"}), 500

        return jsonify({
            "success": True,
            "videoPath": video_path
        })

    except Exception as e:
        print(f"Error generating action video: {str(e)}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
