const crypto = require('crypto');
const env = require('../config/env');

const rawKey = env.geePrivateKey;
const header = '-----BEGIN PRIVATE KEY-----';
const footer = '-----END PRIVATE KEY-----';

const headerIndex = rawKey.indexOf(header);
const footerIndex = rawKey.indexOf(footer);

if (headerIndex === -1 || footerIndex === -1) {
  console.error('Header or footer not found!');
  process.exit(1);
}

// Reassemble the base64 body without whitespace
const base64Body = rawKey.substring(headerIndex + header.length, footerIndex).replace(/\s/g, '');
console.log('Original base64 body length:', base64Body.length);

const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function testKey(body) {
  const pem = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
  try {
    crypto.createPrivateKey(pem);
    return pem;
  } catch (e) {
    return null;
  }
}

console.log('Searching for the missing character...');
let found = false;

// Try to insert one character at every possible index from 0 to base64Body.length
for (let i = 0; i <= base64Body.length; i++) {
  // To speed up, we can print progress
  if (i % 200 === 0) {
    console.log(`Checking position ${i}/${base64Body.length}...`);
  }
  
  for (let c = 0; c < 64; c++) {
    const char = base64Chars[c];
    const candidateBody = base64Body.slice(0, i) + char + base64Body.slice(i);
    
    // Quick validation: must be valid base64 length (multiple of 4)
    if (candidateBody.length % 4 !== 0) continue;
    
    const validPem = testKey(candidateBody);
    if (validPem) {
      console.log('\n🎉 SUCCESS! FOUND THE CORRECT PRIVATE KEY!');
      console.log(`Inserted character '${char}' at index ${i}`);
      console.log('\nCorrect PEM:\n', validPem);
      found = true;
      break;
    }
  }
  if (found) break;
}

if (!found) {
  console.log('\nCould not find a valid key by inserting 1 character.');
}
