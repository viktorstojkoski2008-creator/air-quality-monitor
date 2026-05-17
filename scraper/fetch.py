import os
import requests
from supabase import create_client
from datetime import datetime, timezone, timedelta

# Your Supabase credentials
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ghvzroqgafzwvnoupknc.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_publishable_LSNQ_EqYsZ81ylQZIn-dEw__4mHu0vT")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

ONESIGNAL_API_KEY = os.environ.get("ONESIGNAL_API_KEY", "your_onesignal_key_here")
ONESIGNAL_APP_ID = os.environ.get("ONESIGNAL_APP_ID", "c16ba5dc-7d22-4f8f-b4e4-8838e99b5e0a")

THRESHOLDS = {
    "PM10":  90,
    "PM2.5": 50,
    "NO2":   200,
    "O3":    180,
    "SO2":   250,
}

def send_notification(station, pollutant, value):
    message = f"⚠️ {station}: {pollutant} is at {value:.1f} µg/m³ — Unhealthy air quality detected!"
    payload = {
        "app_id": ONESIGNAL_APP_ID,
        "included_segments": ["Total Subscriptions"],
        "contents": {"en": message},
        "headings": {"en": "🌿 AirMK Alert"},
    }
    headers = {
        "Authorization": f"Key {ONESIGNAL_API_KEY}",
        "Content-Type": "application/json"
    }
    requests.post("https://api.onesignal.com/notifications", json=payload, headers=headers)
    print(f"🔔 Alert sent: {message}")

def check_alerts(readings):
    for reading in readings:
        threshold = THRESHOLDS.get(reading["pollutant"])
        if threshold and reading["value"] > threshold:
            send_notification(reading["station"], reading["pollutant"], reading["value"])
            supabase.table("alerts").insert({
                "station": reading["station"],
                "pollutant": reading["pollutant"],
                "value": reading["value"],
                "threshold": float(threshold),
            }).execute()

API_URL = "https://air.moepp.gov.mk/api/data/measurements-filtered"

def scrape_air_quality():
    print("Fetching air quality data...")
    
    today = datetime.now().strftime("%Y-%m-%d")
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    
    payload = {
        "RegionIds": ["1"],
        "StationIds": ["31", "48", "32", "46", "64", "44", "1"],
        "Parameters": ["PM10", "PM25", "NO2", "O3", "SO2"],
        "Aggregation": "24",
        "FromDate": week_ago,
        "ToDate": today
    }
    
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
    }
    
    response = requests.post(API_URL, json=payload, headers=headers, timeout=15)
    data = response.json()
    
    readings = []
    for item in data:
        station = item.get("stationNameEN", "Unknown")
        date = item.get("date", today)
        
        pollutants = {
            "PM10": item.get("pM10_Value"),
            "PM2.5": item.get("pM25_Value"),
            "NO2": item.get("nO2_Value"),
            "O3": item.get("o3_Value"),
            "SO2": item.get("sO2_Value"),
        }
        
        for pollutant, value in pollutants.items():
            if value is not None:
                readings.append({
                    "station": station,
                    "pollutant": pollutant,
                    "value": float(value),
                    "unit": "µg/m³",
                    "recorded_at": f"{date}T00:00:00+00:00"
                })
    
    if readings:
        supabase.table("readings").insert(readings).execute()
        print(f"✅ Saved {len(readings)} readings to Supabase!")
        check_alerts(readings)
    else:
        print("No readings found.")

if __name__ == "__main__":
    scrape_air_quality()