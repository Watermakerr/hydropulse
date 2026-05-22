const fs = require('fs');
const path = require('path');

// Reconstructed PEM with literal \n
const correctPem = `-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDUazknGXloVzgJN83teW6mxzgCnt8Q/G4a7y+LDNHCsNRVzISk79A9vmHkZz5WhyfIPpee/rpbH39IoRcq+Kw+SU4j1oJ9lH0gFZA6ZEYNyHnqPAdyhrWk3LUejCJPyUsRWsFxxoX0ZGYgh6PKOJyHgDRLYUi2e1MswvqMBujz8NSbD+gv606HhMOfRLvsr2i2TT7lcjstMirc0T98AafP75mTfsHRZ4c6G31z/RfARNzVsFbIUMVrMboiallie1viok/bkwN12lYv6rhbMwIjnTqksiijMBUkk9b9d63l/q0wSw13+G1XjBs7A+eLfums0xfH2kyO9H2gvRE9TuplAgMBAAECggEAGMMSE8aCsmDeeaaddRYvibYWB6os/z4p+K5SyL8bEbrK2eCgQtjo2dXAdB978xrIzq1LP//aSgaTMCyFNp9r9svVVdSq/AgsCOoymLf5OaCZ464RQS7GbHxFCdVUp5/jxhdiDwkRMwLkK90cARYV2y7dCb+CujEIqmJlUh75F3yQbxBW3b8eRw219Vtpui18EXx8J8scAX8rzISsFNbT+uG4vM5NNSmb9aH2gyFL1fbicZ4svO5TwAZCo2X9SOkFGYs4//JtpfGb/YwHG5+4AyFLGh3Eokf239HdOxaaQJtiDjBLFQjhrt46N4oFckuPLfc6+mp5Akqa0W7XUhDNcQKBgQDt8idXcfngB/GDaJ3PpHG6R0kB2Kg3VUaAwkXSLAsZ0TwjrTPAWP49zPg3XG+6uubGh8RpWK+E+LMufIVDshxhSoIVfc2nvZeibX3java8yPJBUs6RJrwKug7kaeM3KNCFhL7F0Ic27h/ijYh7SI86nyjS+QaFQA/rmmlw5BZL1QKBgQDkiTu8qTOaRaN8SvIuZpOBnc04bL3TEU6dZ+SD/TlizaD3zfKKqmM7/3UMKy2YjsFV2HxJ82KIn0MNpAOa8M6QN8sp//cMgkcComGvU/J2gAdKqndGKIS5Emy4CbaDplB0TXwrdkkroVxNQo4yX15Qf6g+TWJC2MloYVTmSw88UQKBgQDY03kWLj5M7/AclxB3Tppz7NGSZSOkiIiefGmzg376H7h1qjcmZ/IFzunBSPJnbjktYDqS5MXMnfRpv/6QGZXS8lpnyyPEXvf2g1/cBHSiw1o+PH8PtgRUogdADV2HviGGCdjt2X/dhlB32hEshoo+GRrSZSqT8jSPtT2wKahHoQKBgABjD/mM9esgXD9ZiUMhSeV2sehbJQfDjiT9piMv83wEkA3OXL9dzC3nu/Iok7Jalfz1jtJ8u4rOp3eM9I8P1XKveSa+BEmovIU+j5NuZ3IMAb5HptFFhsx/gKSY+NxfY4yW8QPMt7UwsU32Dm7LAu96RgMqY6GW2IylL4wdSjNhAoGBAN10VJnnhYpirYel8a4CUvBA7XXUlTfVr7kKV5pKT797Tf7i5lVZUHntxlIJW9gUm8ba8ar5sQIBKdzDlNp6lDpRF1CEMlmOXSD0q3RcNJRpFGfLQLvwj3w91bKdX3/rt3vD3mAPXgo5XxG+Bf+AxMxibC065cVQfxbr+VYvLnX+\\n-----END PRIVATE KEY-----`;

const envPath = path.join(__dirname, '../../.env');

try {
  let envContent = fs.readFileSync(envPath, 'utf8');
  envContent = envContent.replace(/GEE_PRIVATE_KEY=.*/, `GEE_PRIVATE_KEY="${correctPem}"`);
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('Successfully updated .env file with the recovered GEE private key!');
} catch (err) {
  console.error('Failed to update .env:', err);
}
