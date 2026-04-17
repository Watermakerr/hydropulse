const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`HydroPulse API listening on port ${env.port}`);
});
