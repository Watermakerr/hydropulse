import os
import ee
from dotenv import load_dotenv
from google.oauth2 import service_account

load_dotenv()

SCOPES = ["https://www.googleapis.com/auth/earthengine.readonly"]

def _sanitize_key(value: str) -> str:
    key = value.strip()
    if (key.startswith('"') and key.endswith('"')) or (key.startswith("'") and key.endswith("'")):
        key = key[1:-1]
    return key.replace("\\n", "\n")

def main():
    print("=== Analyzing Sentinel-2 NDWI Water Extraction for 2026-04-22 ===")
    
    email = os.getenv("GEE_SERVICE_ACCOUNT_EMAIL")
    key = os.getenv("GEE_PRIVATE_KEY")
    project = os.getenv("GEE_PROJECT_ID")
    
    sanitized_key = _sanitize_key(key)
    info = {
        "type": "service_account",
        "client_email": email,
        "private_key": sanitized_key,
        "token_uri": "https://oauth2.googleapis.com/token"
    }
    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    if project:
        ee.Initialize(creds, project=project)
    else:
        ee.Initialize(creds)
        
    # Get reservoir boundary
    # We will query the database to get the boundary of Hoa Binh reservoir (ID: 18d10020-9ec7-4735-b251-dc5329b63ecc)
    import psycopg2
    conn = psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", "123456"),
        port=os.getenv("PGPORT", "5432"),
        database=os.getenv("PGDATABASE", "gis_lake")
    )
    cursor = conn.cursor()
    cursor.execute(
        "SELECT ST_AsGeoJSON(boundary)::json FROM reservoirs WHERE id = '18d10020-9ec7-4735-b251-dc5329b63ecc'"
    )
    row = cursor.fetchone()
    if not row:
        print("Reservoir not found in DB.")
        return
    
    geojson = row[0]
    geom = ee.Geometry(geojson)
    
    # Query Sentinel-2 Harmonized for 2026-04-22
    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(geom)
        .filterDate("2026-03-01", "2026-04-23")
        .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", 20))
        .sort("system:time_start", False)
    )
    
    count = int(collection.size().getInfo() or 0)
    print(f"Total scenes found in 50 days: {count}")
    if count == 0:
        print("No scenes found.")
        return
        
    image = ee.Image(collection.first())
    scene_id = image.get("PRODUCT_ID").getInfo()
    cloud_cover = image.get("CLOUDY_PIXEL_PERCENTAGE").getInfo()
    capture_date = ee.Date(image.get("system:time_start")).format("yyyy-MM-dd").getInfo()
    print(f"Latest Scene ID: {scene_id}")
    print(f"Capture Date: {capture_date}")
    print(f"Cloud Cover: {cloud_cover}%")
    
    # Test different thresholds for NDWI (Green B3 & NIR B8)
    ndwi = image.normalizedDifference(["B3", "B8"])
    
    print("\n--- Testing different McFeeters NDWI (B3 & B8) thresholds ---")
    thresholds = [0.2, 0.1, 0.05, 0.0, -0.05, -0.1, -0.15, -0.2]
    for t in thresholds:
        water_mask = ndwi.gt(t)
        area_image = water_mask.multiply(ee.Image.pixelArea()).rename("water_area")
        area_result = area_image.reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=geom,
            scale=10,
            maxPixels=1e9
        ).get("water_area")
        
        area_val = area_result.getInfo() if area_result else 0.0
        area_ha = (area_val or 0.0) / 10000
        print(f"Threshold: {t:+.2f} | Water Area: {area_ha:,.2f} ha")
        
    print("\n--- Testing Modified NDWI (MNDWI) (Green B3 & SWIR B11) ---")
    mndwi = image.normalizedDifference(["B3", "B11"])
    for t in thresholds:
        water_mask = mndwi.gt(t)
        area_image = water_mask.multiply(ee.Image.pixelArea()).rename("water_area")
        area_result = area_image.reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=geom,
            scale=10,
            maxPixels=1e9
        ).get("water_area")
        
        area_val = area_result.getInfo() if area_result else 0.0
        area_ha = (area_val or 0.0) / 10000
        print(f"MNDWI Threshold: {t:+.2f} | Water Area: {area_ha:,.2f} ha")


if __name__ == "__main__":
    main()
