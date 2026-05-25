import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import ee
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from google.oauth2 import service_account
from pydantic import BaseModel, Field

# Load environment variables from .env file if present
load_dotenv()


SCOPES = ["https://www.googleapis.com/auth/earthengine.readonly"]
DEFAULT_WET_MONTHS = [6, 7, 8, 9, 10]
DEFAULT_DRY_MONTHS = [11, 12, 1, 2, 3, 4]


class Reservoir(BaseModel):
    id: str
    name: str
    area_ha: Optional[float] = None


class SeasonConfig(BaseModel):
    wet_months: List[int] = Field(default_factory=list)
    dry_months: List[int] = Field(default_factory=list)


class ScanRequest(BaseModel):
    reservoir: Reservoir
    boundary_geojson: Dict[str, Any]
    date: Optional[str] = None
    season_config: Optional[SeasonConfig] = None


app = FastAPI()
_initialized = False


def _sanitize_key(value: str) -> str:
    key = value.strip()
    if (key.startswith('"') and key.endswith('"')) or (key.startswith("'") and key.endswith("'")):
        key = key[1:-1]
    return key.replace("\\n", "\n")


def load_credentials():
    svc_file = os.getenv("GEE_SERVICE_ACCOUNT_FILE") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if svc_file:
        svc_file = os.path.abspath(svc_file)
        if os.path.exists(svc_file):
            return service_account.Credentials.from_service_account_file(svc_file, scopes=SCOPES)

    email = os.getenv("GEE_SERVICE_ACCOUNT_EMAIL")
    key = os.getenv("GEE_PRIVATE_KEY")
    if email and key:
        key = _sanitize_key(key)
        info = {
            "type": "service_account",
            "client_email": email,
            "private_key": key,
            "token_uri": "https://oauth2.googleapis.com/token"
        }
        return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)

    raise RuntimeError("Missing service account credentials.")


def init_ee() -> None:
    global _initialized
    if _initialized:
        return
    creds = load_credentials()
    project = os.getenv("GEE_PROJECT_ID") or getattr(creds, "project_id", None)
    if project:
        ee.Initialize(creds, project=project)
    else:
        ee.Initialize(creds)
    _initialized = True


def parse_date(value: Optional[str]) -> datetime:
    if value:
        try:
            return datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            pass
    return datetime.utcnow()


def get_env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def get_env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def to_geometry(geojson: Dict[str, Any]) -> ee.Geometry:
    geo_type = geojson.get("type")
    if geo_type == "Feature":
        return ee.Geometry(geojson.get("geometry", {}))
    if geo_type == "FeatureCollection":
        return ee.FeatureCollection(geojson).geometry()
    return ee.Geometry(geojson)


def get_season_sets(cfg: Optional[SeasonConfig]):
    wet = set(DEFAULT_WET_MONTHS)
    dry = set(DEFAULT_DRY_MONTHS)
    if cfg:
        if cfg.wet_months:
            wet = set(cfg.wet_months)
        if cfg.dry_months:
            dry = set(cfg.dry_months)
    return wet, dry


def determine_season(date_value: datetime, wet_months: set, dry_months: set) -> str:
    month = date_value.month
    if month in wet_months:
        return "wet"
    if month in dry_months:
        return "dry"
    return "wet" if 6 <= month <= 10 else "dry"


def safe_area_m2(geom: ee.Geometry, area_ha: Optional[float]) -> float:
    try:
        area = geom.area(1).getInfo()
        if area:
            return float(area)
    except Exception:
        pass
    if area_ha:
        return float(area_ha) * 10000
    return 0.0


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/scan")
@app.post("/api/scan")
def scan(payload: ScanRequest):
    try:
        init_ee()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    max_cloud = get_env_float("GEE_MAX_CLOUD", 20.0)
    ndwi_threshold = get_env_float("GEE_NDWI_THRESHOLD", 0.1)
    lookback_days = get_env_int("GEE_LOOKBACK_DAYS", 30)

    target_date = parse_date(payload.date)
    date_to = target_date.date().isoformat()

    wet_months, dry_months = get_season_sets(payload.season_config)
    geom = to_geometry(payload.boundary_geojson)

    # Automatically expand lookback window in stages (30, 90, 180, 365 days) to find the LATEST low-cloud image
    windows = [max(30, lookback_days), 90, 180, 365]
    windows = sorted(list(set(windows)))
    
    collection = None
    scene_count = 0
    final_days = 30

    for days in windows:
        date_from = (target_date - timedelta(days=days)).date().isoformat()
        temp_collection = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(geom)
            .filterDate(date_from, date_to)
            .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", max_cloud))
            # Sort by capture date descending so we get the most recent clear image
            .sort("system:time_start", False)
        )
        try:
            count = int(temp_collection.size().getInfo() or 0)
            print(f"[GEE Scan] Searching last {days} days... Found {count} clear scenes.")
            if count > 0:
                collection = temp_collection
                scene_count = count
                final_days = days
                break
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to query scenes: {exc}") from exc


    if scene_count == 0:
        fallback_area = safe_area_m2(geom, payload.reservoir.area_ha)
        season = determine_season(target_date, wet_months, dry_months)
        return {
            "boundary_geojson": payload.boundary_geojson,
            "water_surface_area": fallback_area,
            "capture_date": date_to,
            "season": season,
            "metadata": {
                "source": "gee",
                "status": "NO_SCENE",
                "scene_count": scene_count,
                "cloud_max": max_cloud,
                "date_from": date_from,
                "date_to": date_to
            }
        }

    image = ee.Image(collection.first())
    ndwi = image.normalizedDifference(["B3", "B8"]).rename("ndwi")
    water_mask = ndwi.gt(ndwi_threshold)
    area_image = water_mask.multiply(ee.Image.pixelArea()).rename("water_area")

    try:
        area_result = area_image.reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=geom,
            scale=10,
            maxPixels=1e9
        )
        water_area = area_result.get("water_area")
        water_area_value = water_area.getInfo() if water_area else None
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to compute water area: {exc}") from exc

    if water_area_value is None:
        water_area_value = safe_area_m2(geom, payload.reservoir.area_ha)

    try:
        capture_ms = image.get("system:time_start").getInfo()
    except Exception:
        capture_ms = None
    capture_date = date_to
    if capture_ms:
        capture_date = datetime.utcfromtimestamp(capture_ms / 1000).date().isoformat()

    try:
        cloud_cover = image.get("CLOUDY_PIXEL_PERCENTAGE").getInfo()
    except Exception:
        cloud_cover = None

    try:
        scene_id = image.get("PRODUCT_ID").getInfo()
    except Exception:
        scene_id = None
    if not scene_id:
        try:
            scene_id = image.id().getInfo()
        except Exception:
            scene_id = None

    season = determine_season(datetime.strptime(capture_date, "%Y-%m-%d"), wet_months, dry_months)

    return {
        "boundary_geojson": payload.boundary_geojson,
        "water_surface_area": float(water_area_value),
        "capture_date": capture_date,
        "season": season,
        "metadata": {
            "source": "gee",
            "scene_count": scene_count,
            "scene_id": scene_id,
            "cloud_cover": cloud_cover,
            "ndwi_threshold": ndwi_threshold,
            "collection": "COPERNICUS/S2_SR_HARMONIZED"
        }
    }
