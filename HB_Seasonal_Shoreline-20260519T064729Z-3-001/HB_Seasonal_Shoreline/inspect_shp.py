import shapefile
import sys

def inspect_shp(path):
    print(f"=== Inspecting {path} ===")
    try:
        sf = shapefile.Reader(path)
        print(f"Shape Type: {sf.shapeTypeName} (code: {sf.shapeType})")
        print(f"Number of shapes: {len(sf.shapes())}")
        print(f"Number of records: {len(sf.records())}")
        print(f"Fields: {sf.fields}")
        
        shapes = sf.shapes()
        if len(shapes) > 0:
            print("First shape coordinates bounding box:", shapes[0].bbox)
            print("First shape points count:", len(shapes[0].points))
            print("First shape parts:", shapes[0].parts)
            # print first 5 points
            print("First 5 points:", shapes[0].points[:5])
        else:
            print("No shapes found!")
            
        records = sf.records()
        if len(records) > 0:
            print("First record:", records[0])
    except Exception as e:
        print("Error:", str(e))

if __name__ == "__main__":
    inspect_shp("HB_Dry_Vector")
    inspect_shp("HB_Wet_Vector")
