export interface IPlaidAccount {
  account_id: string;
  balances: {
    available: number;
    current: number;
    limit?: number;
  };
  mask: string;
  name: string;
  official_name?: string;
  subtype: string;
  type: string;
  verification_status?: string;
}

export interface IPlaidTransaction {
  account_id: string;
  account_owner?: string;
  amount: number;
  authorized_date?: string;
  category: string[];
  category_id?: string;
  date: string;
  iso_currency_code?: string;
  location?: {
    address?: string;
    city?: string;
    country?: string;
    lat?: number;
    lon?: number;
    postal_code?: string;
    region?: string;
    store_number?: string;
  };
  merchant_name?: string;
  name: string;
  payment_channel?: string;
  payment_meta?: {
    by_order_of?: string;
    payee?: string;
    payer?: string;
    payment_method?: string;
    payment_processor?: string;
    ppd_id?: string;
    reason?: string;
    reference_number?: string;
  };
  pending: boolean;
  pending_transaction_id?: string;
  transaction_code?: string;
  transaction_id: string;
  transaction_type: string;
  unofficial_currency_code?: string;
}

export interface IBankConnection {
  _id?: string;
  user: string; // ObjectId ref: 'Client'
  plaidItemId: string; // Unique identifier for the Plaid item
  plaidAccessToken: string; // Encrypted access token
  institutionId: string; // Plaid institution ID
  institutionName: string; // Institution display name
  accountId: string; // Plaid account ID
  accountName: string; // Account nickname
  accountType: string; // 'depository', 'credit', 'loan', 'investment', 'other'
  accountSubtype: string; // 'checking', 'savings', 'cd', etc.
  accountNumber: string; // Masked account number (last 4 digits)
  consentStatus: string; // 'active', 'expired', 'revoked', 'error'
  consentExpiryDate?: Date; // Optional for Plaid
  webhookUrl?: string; // For Plaid webhooks
  lastSuccessfulUpdate?: Date; // Last successful transaction sync
  errorCode?: string; // Plaid error codes
  errorMessage?: string; // Human readable error message
  connectedDate: Date;
  lastSyncedDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBankConnectionPayload extends Partial<IBankConnection> {
  user: string;
}

export interface ILinkTokenResponse {
  link_token: string;
  expiration: string;
}

export interface IExchangeTokenResponse {
  access_token: string;
  item_id: string;
  request_id: string;
}

export interface IConnectBankRequest {
  public_token: string;
  institution_id?: string;
  accounts?: IPlaidAccount[];
}

export interface ISyncTransactionsResponse {
  transactions: IPlaidTransaction[];
  total_transactions: number;
  last_synced_date: Date;
}

export interface IWebhookPayload {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: any;
  new_transactions?: number;
}

export type TBankConnectionStatus = 'active' | 'expired' | 'revoked' | 'error';

export type TAccountType = 'depository' | 'credit' | 'loan' | 'investment' | 'other';

export type TTransactionType = 'debit' | 'credit';
