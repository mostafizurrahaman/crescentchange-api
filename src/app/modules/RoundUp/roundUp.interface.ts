export type TRoundUpStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed';

export interface IRoundUp {
  user: string; // Reference to Client
  organization: string; // Reference to Organization
  cause: string; // Reference to Cause (required)
  bankConnection: string; // Reference to BankConnection
  monthlyThreshold?: number | "no-limit"; // Monthly cap amount (min $3, "no-limit", or undefined)
  specialMessage?: string; // Optional special message for donations (max 250 chars)
  status: TRoundUpStatus; // Backend-only managed status: pending, processing, completed
  isActive: boolean;
  enabled: boolean;
  totalAccumulated: number; // Total accumulated across all time
  currentMonthTotal: number; // Current month total
  lastMonthReset: Date; // Track when we last reset the monthly total
  lastCharitySwitch?: Date; // Track last charity switch for 30-day rule
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IRoundUpSummary {
  roundUpId: string;
  userId: string;
  charityName: string;
  currentMonthTotal: number;
  totalAccumulated: number;
  monthlyThreshold?: number | "no-limit";
  isActive: boolean;
  enabled: boolean;
  nextDonationDate: Date;
  isThresholdMet: boolean;
}

export interface ICharitySwitchRequest {
  roundUpId: string;
  newOrganizationId: string;
  newCauseId: string;
  reason?: string;
}

export interface ICharitySwitchResponse {
  success: boolean;
  message: string;
  canSwitch: boolean;
  daysUntilNextSwitch?: number;
  lastSwitchDate?: Date;
}



export interface IRoundUpSettings {
  enabled: boolean;
  monthlyThreshold?: number | "no-limit";
  organizationId: string;
  causeId: string;
  autoDonate: boolean; // Whether to donate when threshold is met or wait for month end
}

export interface IUserRoundUpStats {
  totalDonated: number;
  totalRoundUps: number;
  monthsDonated: number;
  currentMonthTotal: number;
  currentCharity: {
    name: string;
    totalFromUser: number;
  };
}

export interface IAdminRoundUpStats {
  totalUsers: number;
  activeUsers: number;
  totalDonated: number;
  totalCharities: number;
  monthlyStats: {
    month: string;
    amount: number;
    users: number;
  }[];
  topCharities: {
    organizationId: string;
    name: string;
    amount: number;
    donors: number;
  }[];
  issues: {
    inactiveConnections: number;
    failedTransfers: number;
    pendingDonations: number;
  };
}
