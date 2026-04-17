async function add() {
  try {
    const loginRes = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@hydropulse.vn', password: 'Admin@123456', platform: 'web' })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.accessToken;

    const geojson = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[106.30, 11.35], [106.40, 11.35], [106.40, 11.40], [106.30, 11.40], [106.30, 11.35]]] }, properties: {} }] };
    
    const res = await fetch('http://localhost:4000/api/reservoirs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ name: 'Hồ Dầu Tiếng (Tây Ninh)', description: 'Khu vực miền Nam, hy vọng trời nắng đẹp và ít sương mù', status: 'active', boundaryGeoJSON: geojson })
    });
    
    console.log(await res.json());
    process.exit(0);
  } catch(e) { console.error(e); process.exit(1); }
}
add();
