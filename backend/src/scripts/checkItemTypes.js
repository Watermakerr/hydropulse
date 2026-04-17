const axios = require('axios');
const API_KEY = process.env.PLANET_API_KEY || 'PLAK65c8c84a8e2e45f598275af35cbcbc62';

async function getAccessibleItemTypes() {
  try {
    const response = await axios.get('https://api.planet.com/data/v1/item-types', {
      auth: { username: API_KEY, password: '' }
    });
    console.log(response.data.item_types.map(it => it.id));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}
getAccessibleItemTypes();
