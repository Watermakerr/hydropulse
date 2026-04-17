const dotenv = require('dotenv');

dotenv.config();

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
  azureBlobReadSasMinutes: Number(process.env.AZURE_BLOB_READ_SAS_MINUTES || 60)
};
