const env = require('../config/env');

const key = env.geePrivateKey;
console.log('--- Key Details ---');
console.log('Total characters:', key.length);

const lines = key.split('\n');
console.log('Number of lines:', lines.length);

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  console.log(`Line ${i + 1} (${line.length} chars): "${line}"`);
}

// Reassemble the base64 body
const header = '-----BEGIN PRIVATE KEY-----';
const footer = '-----END PRIVATE KEY-----';

const headerIndex = key.indexOf(header);
const footerIndex = key.indexOf(footer);

if (headerIndex === -1 || footerIndex === -1) {
  console.log('Header or footer missing!');
} else {
  const base64Body = key.substring(headerIndex + header.length, footerIndex).replace(/\s/g, '');
  console.log('Base64 Body Length:', base64Body.length);
  
  try {
    const buffer = Buffer.from(base64Body, 'base64');
    console.log('Buffer successfully created from base64 body. Buffer length:', buffer.length);
    
    // Check if the buffer has a valid DER structure (first byte should be 0x30 for ASN.1 sequence)
    console.log('First byte (hex):', buffer[0].toString(16));
    if (buffer[0] === 0x30) {
      console.log('Looks like a valid ASN.1 sequence!');
    } else {
      console.log('Invalid ASN.1 sequence first byte.');
    }
  } catch (e) {
    console.log('Failed to decode base64 body:', e.message);
  }
}
