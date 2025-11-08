import { PlaidApi, PlaidEnvironments, Configuration } from 'plaid';
import configuration from './index';
import crypto from 'crypto';

const PLAID_ENV = configuration.plaid?.env || 'sandbox';
const PLAID_CLIENT_ID = configuration.plaid?.client_id;
const PLAID_SECRET = configuration.plaid?.secret;
const PLAID_WEBHOOK_URL = configuration.plaid?.webhook_url;

// Plaid environment mapping
const getPlaidEnvironment = () => {
  switch (PLAID_ENV) {
    case 'sandbox':
      return PlaidEnvironments.sandbox;
    case 'development':
      return PlaidEnvironments.development;
    case 'production':
      return PlaidEnvironments.production;
    default:
      return PlaidEnvironments.sandbox;
  }
};

// Initialize Plaid client
const plaidConfig = new Configuration({
  basePath: getPlaidEnvironment(),
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID!,
      'PLAID-SECRET': PLAID_SECRET!,
    },
  },
});

export const plaidClient = new PlaidApi(plaidConfig);

// Helper functions for encryption
export const encryptData = (text: string): string => {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default32characterlongencryptionkey!', 'utf8');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

export const decryptData = (encryptedText: string): string => {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default32characterlongencryptionkey!', 'utf8');
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// Webhook verification
export const verifyPlaidWebhook = (webhookSignature: string, webhookBody: string): boolean => {
  try {
    const parts = webhookSignature.split(',');
    const timestamp = parts[0];
    const v2Signature = parts[1];

    const plaidWebhookKey = process.env.PLAID_WEBHOOK_KEY;
    
    if (!plaidWebhookKey) {
      console.error('Plaid webhook key not configured');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', plaidWebhookKey)
      .update(timestamp + '.' + webhookBody)
      .digest('base64');

    return v2Signature === expectedSignature;
  } catch (error) {
    console.error('Error verifying Plaid webhook:', error);
    return false;
  }
};

export default {
  client: plaidClient,
  environment: PLAID_ENV,
  webhookUrl: PLAID_WEBHOOK_URL,
  encrypt: encryptData,
  decrypt: decryptData,
  verifyWebhook: verifyPlaidWebhook,
};
