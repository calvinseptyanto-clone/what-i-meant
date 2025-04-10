import os
from flask import Flask, request, jsonify, send_file, send_from_directory
from openai import OpenAI
import json
from flask_cors import CORS
import requests
import time
import urllib.request

app = Flask(__name__)
CORS(app)

# Initialize clients
qwen_client = OpenAI(
    api_key="sk-2673ab7cbfd84fe0a9fc466b055fdb33",
    base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
)

# OpenAI client for DALL-E image generation
openai_client = OpenAI(
    api_key="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"
)

EAS_URL = "http://quickstart-deploy-20250410-erph.5899343498937115.cn-hongkong.pai-eas.aliyuncs.com/"
EAS_TOKEN = "YWUxNmI0NGI5NmQyNmE3MWY1NjFiNDhlODhmMDFkYWQ4YjQyMDBkMQ=="

# Define paths for data storage
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
VIDEOS_DIR = os.path.join(os.path.dirname(
    os.path.abspath(__file__)), 'temp_videos')
IMAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'images')
DATA_FILE = os.path.join(DATA_DIR, 'categorized_data.json')

# Create directories if they don't exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(VIDEOS_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)


class TaskStatus:
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


def save_data(data):
    """Save categorized data to JSON file"""
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)


def load_data():
    """Load categorized data from JSON file"""
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading data: {str(e)}")
    return {"items": []}


def generate_and_save_image(prompt, filename):
    """Generate image using DALL-E and save to disk"""
    try:
        # Create a more realistic prompt
        enhanced_prompt = f"A realistic, high-quality photograph of {prompt}. Professional lighting, detailed texture, photorealistic style. No text, no watermarks."

        # Check if image already exists
        image_path = os.path.join(IMAGES_DIR, filename)
        if os.path.exists(image_path):
            print(f"Image already exists for {prompt}")
            return filename

        print(f"Generating image for: {prompt}")

        # Generate image using DALL-E 3
        response = openai_client.images.generate(
            model="dall-e-3",
            prompt=enhanced_prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )

        image_url = response.data[0].url

        # Download and save the image
        urllib.request.urlretrieve(image_url, image_path)

        print(f"Image generated and saved for {prompt}")
        return filename

    except Exception as e:
        print(f"Error generating image for {prompt}: {str(e)}")
        return None


@app.route('/categorize-items', methods=['POST'])
def categorize_items():
    try:
        # Get items from request
        data = request.json
        items = data.get('items', '')

        if not items:
            return jsonify({"error": "No items provided"}), 400

        # Call OpenAI API
        completion = qwen_client.chat.completions.create(
            model="qwen-max",
            messages=[
                {'role': 'system',
                    'content': 'Generate a JSON structure that categorizes the following items into appropriate categories and subcategories. Each item should also include up to 1 common requests or assistance needs that an aphasia patient might want to communicate to caregivers regarding this item. Each item should be organized in this format:\n{\n  "items": [\n    {\n      "name": "item name",\n      "category": "main category",\n      "subcategory": "specific subcategory",\n      "requests": ["request1"]\n    },\n    ...\n  ]\n}\n\nFor example, if the item is "water", the entry would be:\n{\n  "name": "water",\n  "category": "food and drinks",\n  "subcategory": "beverages",\n  "requests": ["need refill"]\n}\n\nProcess the following items and strictly output in JSON format only without any explanation:'},
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
        # Validate it's proper JSON
        parsed = json.loads(response)

        # Load existing data
        existing_data = load_data()
        existing_items = {
            item["name"]: item for item in existing_data.get("items", [])}

        # Track images and videos
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
            item_image = generate_and_save_image(
                item_name, item_image_filename)
            if item_image:
                image_mapping[f"item-{item_name}"] = item_image

            # Process requests for videos
            if "requests" in item:
                for action in item["requests"]:
                    # Generate a unique key for this video
                    video_key = f"{item_name}-{action}"
                    video_filename = f"{video_key.replace(' ', '_').replace('-', '_')}.mp4"
                    video_path = os.path.join(VIDEOS_DIR, video_filename)

                    # Check if video already exists
                    if os.path.exists(video_path):
                        print(
                            f"Video already exists for {item_name} - {action}")
                        video_mapping[video_key] = video_filename
                        continue

                    try:
                        print(f"Generating video for: {item_name} - {action}")

                        # Create prompt with item context
                        prompt = f"A person {action} with {item_name}"

                        # Call video generation API
                        response = requests.post(
                            f"{EAS_URL}/generate",
                            headers={"Authorization": f"{EAS_TOKEN}"},
                            json={
                                "prompt": prompt,
                                "seed": 42,
                                "neg_prompt": "low quality, blurry",
                                "infer_steps": 50,
                                "cfg_scale": 7.5,
                                "height": 480,
                                "width": 832
                            }
                        )

                        if not response.ok:
                            print(
                                f"Error initiating video for {video_key}: {response.text}")
                            continue

                        task_data = response.json()
                        task_id = task_data.get("task_id")

                        if not task_id:
                            print(f"No task ID returned for {video_key}")
                            continue

                        print(f"Task ID: {task_id}")

                        # Poll for completion using while True loop
                        while True:
                            status_response = requests.get(
                                f"{EAS_URL}/tasks/{task_id}/status",
                                headers={"Authorization": f"{EAS_TOKEN}"}
                            )

                            if not status_response.ok:
                                print(
                                    f"Error checking status for {video_key}: {status_response.text}")
                                break

                            status = status_response.json()
                            print(
                                f"Current status for {item_name} - {action}: {status['status']}")

                            if status["status"] == TaskStatus.COMPLETED:
                                print(
                                    f"Video ready for {item_name} - {action}!")

                                # Get the video
                                video_response = requests.get(
                                    f"{EAS_URL}/tasks/{task_id}/video",
                                    headers={"Authorization": f"{EAS_TOKEN}"}
                                )

                                if video_response.ok:
                                    # Save the video with a predictable filename
                                    with open(video_path, "wb") as f:
                                        f.write(video_response.content)

                                    # Store the filename
                                    video_mapping[video_key] = video_filename
                                    print(
                                        f"Video downloaded successfully for {item_name} - {action}!")
                                break
                            elif status["status"] == TaskStatus.FAILED:
                                print(
                                    f"Failed: {status.get('error', 'Unknown error')}")
                                break

                            # Wait before checking again
                            time.sleep(2)

                    except Exception as e:
                        print(
                            f"Error processing video for {video_key}: {str(e)}")

        # Generate images for categories
        for category in categories:
            category_image_filename = f"category_{category.replace(' ', '_').lower()}.png"
            category_image = generate_and_save_image(
                category, category_image_filename)
            if category_image:
                image_mapping[f"category-{category}"] = category_image

        # Generate images for subcategories
        for subcategory_full in subcategories:
            parts = subcategory_full.split('-', 1)
            if len(parts) == 2:
                category, subcategory = parts
                subcategory_image_filename = f"subcategory_{category.replace(' ', '_').lower()}_{subcategory.replace(' ', '_').lower()}.png"
                subcategory_image = generate_and_save_image(
                    f"{subcategory} in {category}", subcategory_image_filename)
                if subcategory_image:
                    image_mapping[f"subcategory-{category}-{subcategory}"] = subcategory_image

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

        # Save the updated data
        save_data(final_data)

        return jsonify(final_data)

    except Exception as e:
        print(f"Error during categorization: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/stored-data', methods=['GET'])
def get_stored_data():
    """Return all stored data"""
    try:
        data = load_data()

        # Add video information
        if "items" in data:
            video_mapping = {}
            image_mapping = data.get("images", {})

            for item in data["items"]:
                if "requests" in item:
                    for action in item["requests"]:
                        video_key = f"{item['name']}-{action}"
                        video_filename = f"{video_key.replace(' ', '_').replace('-', '_')}.mp4"
                        video_path = os.path.join(VIDEOS_DIR, video_filename)

                        if os.path.exists(video_path):
                            video_mapping[video_key] = video_filename

            data["videos"] = video_mapping
            data["images"] = image_mapping

        return jsonify(data)
    except Exception as e:
        print(f"Error retrieving stored data: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/videos/<path:filename>', methods=['GET'])
def get_video(filename):
    try:
        return send_from_directory(VIDEOS_DIR, filename, mimetype='video/mp4')
    except Exception as e:
        print(f"Error serving video: {str(e)}")
        return jsonify({"error": str(e)}), 404


@app.route('/api/images/<path:filename>', methods=['GET'])
def get_image(filename):
    try:
        return send_from_directory(IMAGES_DIR, filename, mimetype='image/png')
    except Exception as e:
        print(f"Error serving image: {str(e)}")
        return jsonify({"error": str(e)}), 404


if __name__ == '__main__':
    app.run(debug=True, port=5000)
