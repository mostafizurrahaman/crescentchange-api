import { IPlaidTransaction } from '../BankConnection/bankConnection.interface';

export interface IRoundUpTransaction {
  _id?: string;
  roundUp?: string; // ObjectId ref: 'RoundUp'
  user: string; // ObjectId ref: 'Client'
  bankConnection: string; // ObjectId ref: 'BankConnection'
  plaidTransactionId: string; // From Plaid API
  plaidAccountId: string; // Plaid account ID
  
  // Transaction details
  originalAmount: number; // Always positive
  roundUpValue: number; // Between 0.01 and 0.99
  transactionDate: Date;
  transactionDescription: string;
  
  // Plaid-specific fields
  transactionType: 'debit' | 'credit';
  category?: string[];
  merchantName?: string;
  location?: {
    address?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    lat?: number;
    lon?: number;
  };
  
  // Status
  processed: boolean;
  donationId?: string; // ObjectId ref: 'Donation'
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoundUpTransactionPayload extends Partial<IRoundUpTransaction> {
  user: string;
  bankConnection: string;
}

export interface ICreateRoundUpTransactionPayload {
  user: string;
  bankConnection: string;
  plaidTransaction: IPlaidTransaction;
}

export interface ISyncRoundUpTransactionsResponse {
  transactions: IRoundUpTransaction[];
  totalProcessed: number;
  totalAmount: number;
  lastSyncDate: Date;
}

export interface IGetTransactionsQuery {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  processed?: boolean;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  searchTerm?: string;
}

export interface ITransactionSummary {
  totalTransactions: number;
  totalRoundUpAmount: number;
  totalDonatedAmount: number;
  averageRoundUp: number;
  mostActiveMonth: string;
  topCategories: {
    category: string;
    count: number;
    amount: number;
  }[];
}

export interface IPlaidTransactionWithRoundUp extends IPlaidTransaction {
  roundUpValue: number;
}
