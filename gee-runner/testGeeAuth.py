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
    print("=== Testing GEE Runner Authentication ===")
    
    email = os.getenv("GEE_SERVICE_ACCOUNT_EMAIL")
    key = os.getenv("GEE_PRIVATE_KEY")
    project = os.getenv("GEE_PROJECT_ID")
    
    print(f"Service Account Email: {email}")
    print(f"Project ID: {project}")
    print(f"Private Key present: {bool(key)}")
    
    if not email or not key:
        print("Error: Missing credentials in .env file.")
        return

    try:
        sanitized_key = _sanitize_key(key)
        info = {
            "type": "service_account",
            "client_email": email,
            "private_key": sanitized_key,
            "token_uri": "https://oauth2.googleapis.com/token"
        }
        creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
        print("Google OAuth Credentials successfully generated from key info!")
        
        print("Initializing Earth Engine...")
        if project:
            ee.Initialize(creds, project=project)
        else:
            ee.Initialize(creds)
        print("Earth Engine successfully initialized!")
        
        print("Querying small GEE operation (ee.Number(1).add(1).getInfo())...")
        res = ee.Number(1).add(1).getInfo()
        print(f"Success! GEE test query result: {res}")
        
    except Exception as e:
        print("\n!!! EARTH ENGINE INITIALIZATION FAILED !!!")
        print(f"Exception Type: {type(e)}")
        print(f"Exception Message: {e}")

if __name__ == "__main__":
    main()
