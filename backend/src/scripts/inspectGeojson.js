const fs = require('fs');

const filePath = "d:\\New folder\\gis_lake\\HB_Seasonal_Shoreline-20260519T064729Z-3-001\\HB_Seasonal_Shoreline\\HB_Dry_Vector.geojson";
const raw = fs.readFileSync(filePath, 'utf-8');
const parsed = JSON.parse(raw);

const geom = parsed.features[0].geometry;
console.log('Geometry Type:', geom.type);
console.log('Coordinates Length:', geom.coordinates.length);
for (let i = 0; i < geom.coordinates.length; i++) {
  console.log(`Polygon #${i}: Ring Count = ${geom.coordinates[i].length}, Outer Ring Points = ${geom.coordinates[i][0].length}`);
}
process.exit(0);
