const { GoogleAuth } = require('google-auth-library');
const env = require('../config/env');

async function main() {
  const email = env.geeServiceAccountEmail;
  const privateKey = env.geePrivateKey;

  console.log('--- Key Load Diagnostic via Config ---');
  console.log('Email:', email);
  console.log('Key Type:', typeof privateKey);
  if (privateKey) {
    console.log('Key Length:', privateKey.length);
    console.log('Starts with "-----BEGIN PRIVATE KEY-----":', privateKey.startsWith('-----BEGIN PRIVATE KEY-----'));
    console.log('Contains escaped \\n (literally two chars):', privateKey.includes('\\n'));
    console.log('Contains actual newline:', privateKey.includes('\n'));
    
    try {
      const auth = new GoogleAuth({
        credentials: {
          client_email: email,
          private_key: privateKey
        },
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      console.log('Initiating test client auth...');
      const client = await auth.getClient();
      console.log('Success! GoogleAuth parsed the key with no errors.');
    } catch (err) {
      console.error('\nOpenSSL / GoogleAuth Error:');
      console.error(err.stack || err.message || err);
    }
  } else {
    console.log('Error: GEE_PRIVATE_KEY is undefined!');
  }
  process.exit(0);
}

main();

