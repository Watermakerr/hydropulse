const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const env = require('../config/env');

const tempFile = path.join(__dirname, 'temp_key.pem');
fs.writeFileSync(tempFile, env.geePrivateKey);

console.log('Temporary key file written.');

exec(`openssl pkey -in "${tempFile}" -text -noout`, (error, stdout, stderr) => {
  if (error) {
    console.error('OpenSSL error:', stderr || error.message);
  } else {
    console.log('OpenSSL success!');
    console.log(stdout.slice(0, 200));
  }
  
  // Clean up
  try {
    fs.unlinkSync(tempFile);
  } catch (_) {}
});
