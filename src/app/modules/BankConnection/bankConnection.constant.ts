// Account types
export const ACCOUNT_TYPES = {
  DEPOSITORY: 'depository',
  CREDIT: 'credit',
  LOAN: 'loan',
  INVESTMENT: 'investment',
  OTHER: 'other',
} as const;

// Account subtypes
export const ACCOUNT_SUBTYPES = {
  CHECKING: 'checking',
  SAVINGS: 'savings',
  CD: 'cd',
  MONEY_MARKET: 'money market',
  CREDIT_CARD: 'credit card',
  AUTO_LOAN: 'auto loan',
  STUDENT_LOAN: 'student loan',
  PERSONAL_LOAN: 'personal loan',
  MORTGAGE: 'mortgage',
  INVESTMENT_BROKERAGE: 'brokerage',
  INVESTMENT_401K: '401k',
  INVESTMENT_ROTH_IRA: 'roth ira',
} as const;

// Consent statuses
export const CONSENT_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  ERROR: 'error',
} as const;

// Error codes from Plaid
export const PLAID_ERROR_CODES = {
  ITEM_LOGIN_REQUIRED: 'ITEM_LOGIN_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  MFA_SETUP_REQUIRED: 'MFA_SETUP_REQUIRED',
  INSUFFICIENT_CREDENTIALS: 'INSUFFICIENT_CREDENTIALS',
  INVALID_ACCESS_TOKEN: 'INVALID_ACCESS_TOKEN',
  PLAID_SYSTEM_MAINTENANCE: 'PLAID_SYSTEM_MAINTENANCE',
  NO_ACCOUNTS: 'NO_ACCOUNTS',
  NO_AUTHENTICATED_ACCOUNTS: 'NO_AUTHENTICATED_ACCOUNTS',
  TEMPORARY_ISSUE: 'TEMPORARY_ISSUE',
} as const;

// Webhook types
export const WEBHOOK_TYPES = {
  TRANSACTIONS: 'TRANSACTIONS',
  ITEM: 'ITEM',
  AUTH: 'AUTH',
  BANK_TRANSFERS: 'BANK_TRANSFERS',
  ASSETS: 'ASSETS',
  INCOME: 'INCOME',
  INVESTMENT_TRANSACTIONS: 'INVESTMENT_TRANSACTIONS',
  HOLDINGS: 'HOLDINGS',
  LIABILITIES: 'LIABILITIES',
  IDENTITY: 'IDENTITY',
  PAYMENTS: 'PAYMENTS',
  CREDIT: 'CREDIT',
  EMPLOYMENT: 'EMPLOYMENT',
  CUSTOMER: 'CUSTOMER',
  RISK_SIGNALS: 'RISK_SIGNALS',
  RECURRING_TRANSACTIONS: 'RESCURRING_TRANSACTIONS',
  TRANSFER: 'TRANSFER',
} as const;

// Transaction categories to exclude from round-ups
export const EXCLUDED_TRANSACTION_CATEGORIES = [
  'Transfer',
  'ATM',
  'Bank Service',
  'Deposit',
  'Payment',
  'Withdrawal',
  'Interest',
  'Fees',
  'Tax',
  'Credit Card',
  'Loan',
  'Investment',
  'Refund',
];

// Transaction types eligible for round-ups
export const ELIGIBLE_TRANSACTION_TYPES = [
  'debit',
  'purchase',
  'place',
];

// Pagination limits
export const PAGINATION_LIMITS = {
  TRANSACTIONS_PER_REQUEST: 500, // Max allowed by Plaid
  MAX_TRANSACTION_SYNC_DAYS: 90, // Don't sync more than 90 days at once
} as const;

// API Response Messages
export const BANK_CONNECTION_MESSAGES = {
  CONNECTION_CREATED: 'Bank connection created successfully',
  CONNECTION_UPDATED: 'Bank connection updated successfully',
  CONNECTION_DELETED: 'Bank connection deleted successfully',
  CONNECTION_NOT_FOUND: 'Bank connection not found',
  TOKEN_EXCHANGE_FAILED: 'Failed to exchange public token',
  TRANSACTIONS_SYNCED: 'Transactions synced successfully',
  CONNECTION_EXPIRED: 'Bank connection expired. Please reconnect.',
  CONNECTION_REVOKED: 'Bank connection revoked',
  INVALID_TOKEN: 'Invalid access token',
  ERROR_FETCHING_TRANSACTIONS: 'Error fetching bank transactions',
  WEBHOOK_RECEIVED: 'Webhook received and processed',
} as const;

// Status codes
export const STATUS_CODES = {
  SUCCESS: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
