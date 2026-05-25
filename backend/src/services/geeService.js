const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');
const env = require('../config/env');

const DEFAULT_SCOPES = ['https://www.googleapis.com/auth/cloud-platform'];

async function getAccessToken() {
  const clientEmail = env.geeServiceAccountEmail;
  const privateKey = env.geePrivateKey;

  if (!clientEmail || !privateKey) {
    return null;
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey
    },
    scopes: DEFAULT_SCOPES
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return typeof token === 'string' ? token : token?.token || null;
}

async function runGeeScan(payload) {
  const endpoint = env.geeRunnerUrl;

  const runSimulation = () => {
    console.log('[GEE Service] Running simulation scan fallback...');
    
    const boundaryGeoJSON = payload.boundary_geojson;
    const date = payload.date || new Date().toISOString().split('T')[0];
    
    // Determine season from month of date
    const month = new Date(date).getMonth() + 1;
    let season = 'dry';
    if (month >= 6 && month <= 10) {
      season = 'wet';
    } else if (month === 5) {
      season = 'wet'; // May is transition, simulate wet
    } else {
      season = 'dry';
    }
    
    // Simulate realistic water area percentage
    // Let's vary the factor based on whether the current minute is odd or even
    // to allow testing both LOW and HIGH warnings!
    const currentMinute = new Date().getMinutes();
    const isOdd = currentMinute % 2 !== 0;
    
    let areaFactor = season === 'wet' ? 1.012 : 0.988; // LOW alert (normal variation)
    let description = 'Simulated Google Earth Engine NDWI water extraction (Stable status)';
    if (isOdd) {
      // Drought/heavy flood simulation for testing alerts!
      areaFactor = season === 'wet' ? 1.124 : 0.875; // HIGH alert (>10% change)
      description = `Simulated Google Earth Engine NDWI water extraction (Alert status triggered on odd minute: ${currentMinute})`;
    }
    
    const totalAreaM2 = (payload.reservoir?.area_ha || 3700) * 10000;
    const waterArea = totalAreaM2 * areaFactor;
    
    return {
      boundary_geojson: boundaryGeoJSON,
      water_surface_area: waterArea,
      capture_date: date,
      season: season,
      metadata: {
        source: 'simulated_gee',
        cloud_cover: 0.015,
        clear_percent: 98.5,
        description: description,
        is_alert_test: isOdd
      }
    };
  };

  if (!endpoint) {
    console.log('[GEE Service] GEE_RUNNER_URL is not configured.');
    return runSimulation();
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    const token = await getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    console.log(`[GEE Service] Sending POST request to GEE runner at ${endpoint}...`);
    const response = await axios.post(endpoint, payload, { headers, timeout: 60000 }); // 60s timeout for real Google Earth Engine cloud processing

    return response.data;
  } catch (error) {
    console.warn(`[GEE Service] External GEE runner failed (${error.message}). Falling back to simulation scan...`);
    return runSimulation();
  }
}

module.exports = {
  runGeeScan
};
