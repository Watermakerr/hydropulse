# GEE Runner (FastAPI)

Small HTTP service that runs a Google Earth Engine NDWI scan and returns
water area and metadata for the backend.

## Endpoints
- POST /api/scan
- GET /health

## Environment
GEE_SERVICE_ACCOUNT_FILE=path/to/service-account.json
GEE_PROJECT_ID=
GEE_SERVICE_ACCOUNT_EMAIL=
GEE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GEE_MAX_CLOUD=20
GEE_NDWI_THRESHOLD=0.1
GEE_LOOKBACK_DAYS=30

## Run (Windows PowerShell)
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn app:app --host 0.0.0.0 --port 8081

## Notes
- Backend should set GEE_RUNNER_URL to http://localhost:8081/api/scan
- For now, boundary_geojson is echoed back from the request
