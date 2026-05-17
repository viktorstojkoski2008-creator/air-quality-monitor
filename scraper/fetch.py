import requests
from supabase import create_client
from datetime import datetime, timezone, timedelta

# Your Supabase credentials
SUPABASE_URL = "https://ghvzroqgafzwvnoupknc.supabase.co"
SUPABASE_KEY = "sb_publishable_LSNQ_EqYsZ81ylQZIn-dEw__4mHu0vT"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

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
    else:
        print("No readings found.")

if __name__ == "__main__":
    scrape_air_quality()