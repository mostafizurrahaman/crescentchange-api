import { CountryCode, DepositoryAccountSubtype } from 'plaid';

export interface IBankConnection {
  user: string;
  itemId: string;
  accessToken: string;
  accountId: string;
  accountName: string;
  accountType: string;
  institutionName: string;
  institutionId: string;
  consentGivenAt: Date;
  consentExpiry?: Date;
  isActive: boolean;
  plaidWebhookId?: string;
  lastSyncAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPlaidAccount {
  id: string;
  name: string;
  type: string;
  subtype: string;
  mask?: string;
}

export interface IPlaidInstitution {
  institution_id: string;
  name: string;
  url?: string;
  logo?: string;
  primary_color?: string;
}

export interface IPlaidLinkTokenRequest {
  user: {
    client_user_id: string;
  };
  client_name?: string;
  products?: string[];
  country_codes?: CountryCode[];
  language?: string;
  webhook?: string;
  account_filters?: {
    depository?: {
      account_subtypes: DepositoryAccountSubtype[];
    };
  };
}

export interface IPlaidPublicTokenExchange {
  public_token: string;
}

export interface IPlaidTransaction {
  transaction_id: string;
  pending_transaction_id?: string;
  amount: number;
  iso_currency_code: string;
  date: string;
  name: string;
  merchant_name?: string;
  category: string[];
  account_id: string;
  account_owner: string;
}

export interface ITransactionFilter {
  userId?: string;
  accountIds?: string[];
  excludeCategories?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ISyncResponse {
  hasMore: boolean;
  nextCursor?: string;
  added: IPlaidTransaction[];
  modified: IPlaidTransaction[];
  removed: string[];
}
