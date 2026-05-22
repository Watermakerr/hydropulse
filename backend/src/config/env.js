const dotenv = require('dotenv');

dotenv.config();

// Sanitize GEE Private Key
const rawPrivateKey = process.env.GEE_PRIVATE_KEY || '';
let sanitizedPrivateKey = rawPrivateKey.trim();
if (sanitizedPrivateKey.startsWith('"') && sanitizedPrivateKey.endsWith('"')) {
  sanitizedPrivateKey = sanitizedPrivateKey.slice(1, -1);
}
if (sanitizedPrivateKey.startsWith("'") && sanitizedPrivateKey.endsWith("'")) {
  sanitizedPrivateKey = sanitizedPrivateKey.slice(1, -1);
}
sanitizedPrivateKey = sanitizedPrivateKey.replace(/\\n/g, '\n');

module.exports = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'dev_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  fcmUseV1: process.env.FCM_USE_V1 === 'true',
  fcmProjectId: process.env.FCM_PROJECT_ID || '',
  fcmClientEmail: process.env.FCM_CLIENT_EMAIL || '',
  fcmPrivateKey: process.env.FCM_PRIVATE_KEY || '',
  fcmServerKey: process.env.FCM_SERVER_KEY || '',
  azureConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
  azureContainer: process.env.AZURE_STORAGE_CONTAINER || 'report-photos',
  azureBlobReadSasMinutes: Number(process.env.AZURE_BLOB_READ_SAS_MINUTES || 60),
  geeRunnerUrl: process.env.GEE_RUNNER_URL || '',
  geeServiceAccountEmail: process.env.GEE_SERVICE_ACCOUNT_EMAIL || '',
  geePrivateKey: sanitizedPrivateKey,
  geeWetMonths: process.env.GEE_WET_MONTHS || '6,7,8,9,10',
  geeDryMonths: process.env.GEE_DRY_MONTHS || '11,12,1,2,3,4'
};

