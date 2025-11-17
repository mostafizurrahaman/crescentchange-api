export interface IRoundUpTransaction {
  user: string; // Reference to Client
  bankConnection: string; // Reference to BankConnection
  roundUp: string; // Reference to RoundUp configuration
  transactionId: string; // Plaid transaction ID for deduplication
  originalAmount: number;
  roundUpAmount: number;
  currency: string; // Will be "USD" for Plaid US
  organization: string; // Reference to Organization
  transactionDate: Date;
  transactionName: string;
  transactionCategory: string[];
  status: 'pending' | 'processed' | 'processing' | 'donated' | 'failed';
  donation?: string; // Reference to main Donation record
  
  // Webhook-based payment fields
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  donationAttemptedAt?: Date;
  donatedAt?: Date;
  lastPaymentFailure?: Date;
  lastPaymentFailureReason?: string;
  
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITransactionProcessingResult {
  processed: number;
  skipped: number;
  failed: number;
  roundUpsCreated: IRoundUpTransaction[];
  thresholdReached?: {
    roundUpId: string;
    amount: number;
    charityId: string;
  };
}

export interface ITransactionFilter {
  user?: string;
  bankConnection?: string;
  organization?: string;
  status?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  month?: string; // Format: "2024-01"
  year?: number;
}

export interface IEligibleTransactions {
  totalTransactions: number;
  eligibleTransactions: number;
  totalRoundUpAmount: number;
  averageRoundUpAmount: number;
  transactions: IRoundUpTransaction[];
}

export interface ITransactionSummary {
  user: string;
  totalTransactions: number;
  totalRoundUps: number;
  totalDonated: number;
  currentMonthTotal: number;
  averageRoundUp: number;
  lastTransactionDate: Date;
  statusCounts: {
    pending: number;
    processed: number;
    processing: number;
    donated: number;
    failed: number;
  };
}
