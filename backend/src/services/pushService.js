const pool = require('../db/pool');
const { GoogleAuth } = require('google-auth-library');
const env = require('../config/env');

const FCM_URL = 'https://fcm.googleapis.com/fcm/send';
const FCM_V1_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

let googleAuthClient;

function shouldUseV1() {
  return env.fcmUseV1 || (!env.fcmServerKey && Boolean(env.fcmProjectId));
}

function getGoogleAuthClient() {
  if (googleAuthClient) {
    return googleAuthClient;
  }

  const credentials =
    env.fcmClientEmail && env.fcmPrivateKey
      ? {
          client_email: env.fcmClientEmail,
          private_key: env.fcmPrivateKey.replace(/\\n/g, '\n')
        }
      : undefined;

  googleAuthClient = new GoogleAuth({
    credentials,
    scopes: [FCM_V1_SCOPE]
  });

  return googleAuthClient;
}

async function sendPushV1(token, title, body, data = {}) {
  if (!env.fcmProjectId) {
    return { ok: false, reason: 'FCM_PROJECT_ID is not configured' };
  }

  const auth = getGoogleAuthClient();
  const accessToken = await auth.getAccessToken();

  if (!accessToken) {
    return { ok: false, reason: 'Unable to get Google access token' };
  }

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${env.fcmProjectId}/messages:send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      message: {
        token,
        notification: {
          title,
          body
        },
        data
      }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const v1ErrorCode = payload?.error?.details?.[0]?.errorCode || payload?.error?.status;
    return {
      ok: false,
      reason: v1ErrorCode || `HTTP_${response.status}`
    };
  }

  return { ok: true };
}

async function sendPushLegacy(token, title, body, data = {}) {
  if (!env.fcmServerKey) {
    return { ok: false, reason: 'FCM_SERVER_KEY is not configured' };
  }

  const response = await fetch(FCM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `key=${env.fcmServerKey}`
    },
    body: JSON.stringify({
      to: token,
      priority: 'high',
      notification: {
        title,
        body
      },
      data
    })
  });

  const payload = await response.json().catch(() => ({}));
  const fcmError = payload?.results?.[0]?.error;

  if (!response.ok || fcmError) {
    return {
      ok: false,
      reason: fcmError || `HTTP_${response.status}`
    };
  }

  return { ok: true };
}

async function sendPushToToken(token, title, body, data = {}) {
  if (shouldUseV1()) {
    return sendPushV1(token, title, body, data);
  }

  return sendPushLegacy(token, title, body, data);
}

function isInvalidTokenReason(reason) {
  return ['InvalidRegistration', 'NotRegistered', 'MismatchSenderId', 'UNREGISTERED', 'INVALID_ARGUMENT', 'SENDER_ID_MISMATCH'].includes(reason);
}

async function sendPushToUser(userId, { title, body, data = {} }) {
  if (!userId) {
    return { success: false, sentCount: 0, reason: 'missing user id' };
  }

  const tokensResult = await pool.query(
    `SELECT id, device_token
     FROM mobile_device_tokens
     WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );

  if (!tokensResult.rowCount) {
    return { success: false, sentCount: 0, reason: 'no active tokens' };
  }

  let sentCount = 0;
  const invalidTokenIds = [];

  for (const row of tokensResult.rows) {
    const result = await sendPushToToken(row.device_token, title, body, data);

    if (result.ok) {
      sentCount += 1;
    } else if (isInvalidTokenReason(result.reason)) {
      invalidTokenIds.push(row.id);
    }
  }

  if (invalidTokenIds.length) {
    await pool.query(
      `UPDATE mobile_device_tokens
       SET is_active = FALSE
       WHERE id = ANY($1::uuid[])`,
      [invalidTokenIds]
    );
  }

  return {
    success: sentCount > 0,
    sentCount,
    invalidCount: invalidTokenIds.length
  };
}

module.exports = {
  sendPushToUser
};
