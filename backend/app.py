from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from datetime import datetime
import redis
import threading
import time
import json
import random
import os
import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

FRONTEND_PATH = os.path.join(BASE_DIR, '..', 'Frontend')

app = Flask(
    __name__,
    template_folder=FRONTEND_PATH,
    static_folder=FRONTEND_PATH,
    static_url_path=''
)
CORS(app)

# Load and train models for all 3 industries
DATASETS_PATH = os.path.dirname(os.path.abspath(__file__))
industries = {}

# Steel Industry
try:
    steel_path = os.path.join(DATASETS_PATH, 'datasets', 'steel.csv')
    steel_df = pd.read_csv(steel_path)
    steel_X = steel_df[['Week']].values / steel_df['Week'].max()
    steel_y = steel_df['Energy_kWh']
    steel_model = LinearRegression()
    steel_model.fit(steel_X, steel_y)
    industries['steel'] = {
        'df': steel_df,
        'model': steel_model,
        'energy_col': 'Energy_kWh',
        'co2_col': 'Carbon_tCO2'
    }
    print(f"Steel model trained on {len(steel_df)} records. Avg Energy: {steel_df['Energy_kWh'].mean():.2f} kWh")
except Exception as e:
    print(f"Steel data error: {e}")

# Concrete Industry
try:
    concrete_path = os.path.join(DATASETS_PATH, 'datasets', 'concrete.csv')
    concrete_df = pd.read_csv(concrete_path, sep='\t')
    concrete_X = concrete_df[['age']].values / concrete_df['age'].max()
    concrete_y = concrete_df['energy_consumption']
    concrete_model = LinearRegression()
    concrete_model.fit(concrete_X, concrete_y)
    industries['concrete'] = {
        'df': concrete_df,
        'model': concrete_model,
        'energy_col': 'energy_consumption',
        'co2_col': 'embodied_CO2'
    }
    print(f"Concrete model trained on {len(concrete_df)} records. Avg Energy: {concrete_df['energy_consumption'].mean():.2f} kWh")
except Exception as e:
    print(f"Concrete data error: {e}")

# Textile Industry
try:
    textile_path = os.path.join(DATASETS_PATH, 'datasets', 'textile.csv')
    textile_df = pd.read_csv(textile_path, sep='\t')
    textile_X = textile_df[['Production_Year']].values / textile_df['Production_Year'].max()
    textile_y = textile_df['Energy_Consumption']
    textile_model = LinearRegression()
    textile_model.fit(textile_X, textile_y)
    industries['textile'] = {
        'df': textile_df,
        'model': textile_model,
        'energy_col': 'Energy_Consumption',
        'co2_col': 'Greenhouse_Gas_Emissions'
    }
    print(f"Textile model trained on {len(textile_df)} records. Avg Energy: {textile_df['Energy_Consumption'].mean():.2f} kWh")
except Exception as e:
    print(f"Textile data error: {e}")

# Default to steel for backward compatibility
current_industry = 'steel'
df = industries['steel']['df']
model = industries['steel']['model']

# OpenRouter API configuration (replaces openai SDK to avoid pydantic_core DLL block)
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
r = None
try:
    r = redis.Redis(host='localhost', port=6379, decode_responses=True)
except:
    print("Redis not available, running without it")

# ALWAYS AVAILABLE FALLBACK DATA
live_data = {
    ind: {
        'energy': 0.0,
        'carbon': 0.0,
        'status': 'idle',
        'alert': 'healthy',
        'timestamp': ''
    }
    for ind in ['steel', 'concrete', 'textile']
}

def update_live_data():
    while True:
        for ind in industries:
            df = industries[ind]['df']
            base_energy = float(df[industries[ind]['energy_col']].mean())
            base_carbon = float(df[industries[ind]['co2_col']].mean())
            noise = random.uniform(0.85, 1.15)
            energy = round(base_energy * noise, 2)
            carbon = round(base_carbon * random.uniform(0.9, 1.1) * noise, 4)
            status = random.choice(['running', 'idle', 'maintenance', 'alert'])
            alert = 'critical' if noise > 1.1 else 'warning' if noise > 1.0 else 'healthy'
            ts = datetime.now().isoformat()
            data = {'energy': energy, 'carbon': carbon, 'status': status, 'alert': alert, 'timestamp': ts}
            live_data[ind] = data
            try:
                r.xadd(f"live:{ind}", data)
            except:
                pass  # No Redis ok, use live_data dict
        time.sleep(5)

threading.Thread(target=update_live_data, daemon=True).start()

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/industries")
def get_industries():
    return jsonify({
        "available": list(industries.keys()),
        "current": current_industry
    })

@app.route("/industry/data")
def industry_data():
    industry = request.args.get('industry', current_industry).lower()
    if industry not in industries:
        return jsonify({"error": f"Industry {industry} not found"}), 400
    
    ind = industries[industry]
    df_ind = ind['df']
    energy_col = ind['energy_col']
    co2_col = ind['co2_col']
    
    avg_energy = round(float(df_ind[energy_col].mean()), 2)
    avg_co2 = round(float(df_ind[co2_col].mean()), 4)
    return jsonify({
        "industry": industry,
        "energy": avg_energy,
        "carbon": avg_co2,
        "records": len(df_ind)
    })

@app.route("/predict")
def predict():
    industry = request.args.get('industry', current_industry).lower()
    days = int(request.args.get('days', 30))
    days = max(1, min(days, 30))

    if industry not in industries:
        return jsonify({"error": f"Industry {industry} not found"}), 400
    
    ind = industries[industry]
    df_ind = ind['df']
    ind_model = ind['model']
    
    if industry == 'steel':
        last_value = int(df_ind['Week'].max())
        future_values = np.array([[v] for v in range(last_value + 1, last_value + 1 + days)])
        normalized = future_values / df_ind['Week'].max()
    elif industry == 'concrete':
        last_value = int(df_ind['age'].max())
        future_values = np.array([[v] for v in range(last_value + 1, last_value + 1 + days)])
        normalized = future_values / df_ind['age'].max()
    else:  # textile
        last_value = int(df_ind['Production_Year'].max())
        future_values = np.array([[v] for v in range(last_value + 1, last_value + 1 + days)])
        normalized = future_values / df_ind['Production_Year'].max()
    
    future_energy = ind_model.predict(normalized)
    return jsonify({
        "future_energy": round(float(future_energy.mean()), 2),
        "days": list(range(1, days + 1)),
        "predictions": [round(float(value), 2) for value in future_energy]
    })

@app.route("/live-data/<industry>")
def get_live_data(industry):
    data = live_data.get(industry.lower(), {})
    try:
        latest = r.xrevrange(f"live:{industry.lower()}", count=1)
        if latest:
            data = dict(latest[0][1])
    except:
        pass
    return jsonify(data)

from flask import Response

@app.route("/live/<industry>")
def live_stream(industry):
    if industry.lower() not in industries:
        return "Invalid industry", 400
    
    def generate():
        last_id = "$"
        while True:
            try:
                msgs = r.xread({f"live:{industry.lower()}": last_id}, block=10000, count=1)
                if msgs:
                    _, streams = msgs[0]
                    last_id = streams[0][0]
                    data = dict(streams[0][1])
                    yield f"data: {json.dumps(data)}\n\n"
                else:
                    data = live_data.get(industry.lower(), {})
                    yield f"data: {json.dumps(data)}\n\n"
            except:
                data = live_data.get(industry.lower(), {})
                yield f"data: {json.dumps(data)}\n\n"
            time.sleep(2)
    
    return Response(generate(), mimetype="text/event-stream")

@app.route("/chat", methods=["POST"])
def chat():
    try:
        question = request.json.get("question", "").strip()

        if not question:
            return jsonify({"reply": "Please ask a question about energy or sustainability."})

        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "openrouter/free",
            "messages": [
                {"role": "user", "content": question}
            ]
        }

        response = requests.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        reply = data["choices"][0]["message"]["content"]

        return jsonify({"reply": reply})

    except requests.exceptions.HTTPError as http_err:
        error_msg = str(http_err)
        if response.status_code == 429 or "RESOURCE_EXHAUSTED" in error_msg:
            return jsonify({"reply": "🔋 API quota exceeded. Please get a new Gemini API key at https://aistudio.google.com/app/apikey"})
        if "invalid api key" in error_msg.lower() or "api key not valid" in error_msg.lower():
            return jsonify({
                "reply": f"🔑 Invalid/missing Gemini API key. Get free key at https://aistudio.google.com/app/apikey then:\n\n• Windows: `set GEMINI_API_KEY=AIzaYourKey`\n• Restart server\n\nError: {error_msg}"
            })
        return jsonify({"reply": f"AI service error: {error_msg[:100]}"})

    except Exception as e:
        return jsonify({"reply": f"AI service error: {str(e)}"})





if __name__ == "__main__":
    print("🚀 SustainAI Server Running...")
    print("🌐 Open: http://127.0.0.1:5000")
    app.run(debug=True, port=5000)

