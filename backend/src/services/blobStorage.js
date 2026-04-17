const { BlobServiceClient } = require('@azure/storage-blob');
const env = require('../config/env');

let containerClient;

function getContainerClient() {
  if (containerClient) {
    return containerClient;
  }

  if (!env.azureConnectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is required');
  }

  const client = BlobServiceClient.fromConnectionString(env.azureConnectionString);
  containerClient = client.getContainerClient(env.azureContainer);
  return containerClient;
}

async function ensureContainer() {
  const container = getContainerClient();
  // Keep container private; many production accounts disable public access.
  await container.createIfNotExists();
}

async function uploadBuffer(buffer, blobName, mimeType) {
  await ensureContainer();
  const container = getContainerClient();
  const blockBlobClient = container.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: mimeType || 'application/octet-stream'
    }
  });

  return {
    url: blockBlobClient.url,
    blobPath: blobName
  };
}

async function getReadUrl(blobPath, expiresInMinutes = env.azureBlobReadSasMinutes) {
  const container = getContainerClient();
  const blockBlobClient = container.getBlockBlobClient(blobPath);

  try {
    const sasUrl = await blockBlobClient.generateSasUrl({
      permissions: 'r',
      startsOn: new Date(Date.now() - 5 * 60 * 1000),
      expiresOn: new Date(Date.now() + Math.max(5, expiresInMinutes) * 60 * 1000)
    });
    return sasUrl;
  } catch (error) {
    // Fallback to raw URL for environments without shared key capability.
    return blockBlobClient.url;
  }
}

module.exports = {
  uploadBuffer,
  getReadUrl
};
