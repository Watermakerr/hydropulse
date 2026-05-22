import shapefile
import json
import os

def convert_shp_to_geojson(shp_path, geojson_path):
    print(f"Converting {shp_path} to {geojson_path}...")
    try:
        reader = shapefile.Reader(shp_path)
        features = []
        for shape in reader.shapes():
            geom = shape.__geo_interface__
            features.append({
                "type": "Feature",
                "geometry": geom,
                "properties": {}
            })
        
        geojson = {
            "type": "FeatureCollection",
            "features": features
        }
        with open(geojson_path, "w", encoding="utf-8") as f:
            json.dump(geojson, f, ensure_ascii=False, indent=2)
        print("Success!")
    except Exception as e:
        print("Error during conversion:", str(e))

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    dry_shp = os.path.join(base_dir, "HB_Dry_Vector")
    dry_json = os.path.join(base_dir, "HB_Dry_Vector.geojson")
    convert_shp_to_geojson(dry_shp, dry_json)
    
    wet_shp = os.path.join(base_dir, "HB_Wet_Vector")
    wet_json = os.path.join(base_dir, "HB_Wet_Vector.geojson")
    convert_shp_to_geojson(wet_shp, wet_json)
