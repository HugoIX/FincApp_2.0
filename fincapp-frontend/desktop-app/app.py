from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import requests

load_dotenv()

app = Flask(__name__)
CORS(app, origins=[os.getenv("FRONTEND_URL", "http://localhost:8080"), "http://127.0.0.1:8080"])

inventory_db = []

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "service": "FincApp AI helper"})

@app.route("/api/livestock", methods=["POST"])
def add_animal():
    data = request.get_json(silent=True) or {}
    inventory_db.append(data)
    return jsonify({
        "status": "success",
        "message": "Animal registered in Python demo memory",
        "received": data
    }), 201

@app.route("/api/livestock", methods=["GET"])
def get_inventory():
    return jsonify(inventory_db)

@app.route("/api/diagnosis", methods=["POST"])
def get_diagnosis():
    data = request.get_json(silent=True) or {}
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        return jsonify({
            "diagnosis": "AURA demo diagnosis: review feed intake, hydration, and recent health records before taking action."
        })

    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                "max_tokens": 180,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are AURA, FincApp's livestock operations assistant. Give short, practical livestock health guidance in Spanish. Do not replace a veterinarian."
                    },
                    {
                        "role": "user",
                        "content": f"Animal tag: {data.get('tag') or data.get('id')}; breed: {data.get('breed')}; weight: {data.get('weight')} kg. Give a brief recommendation in max 3 sentences."
                    }
                ]
            },
            timeout=20
        )
        response.raise_for_status()
        result = response.json()
        diagnosis = result["choices"][0]["message"]["content"]
        return jsonify({"diagnosis": diagnosis})
    except Exception as exc:
        print("AI diagnosis error:", exc)
        return jsonify({
            "diagnosis": "AURA could not contact the AI service. For the demo, check weight, appetite, temperature, and recent alerts."
        }), 200

if __name__ == "__main__":
    app.run(port=int(os.getenv("AI_PORT", 5000)), debug=os.getenv("FLASK_DEBUG", "false") == "true")
