// src/app/modules/Receipt/receipt.interface.ts
import { Document, Types } from 'mongoose';

export interface IReceipt extends Document {
  _id: Types.ObjectId;
  donation: Types.ObjectId;
  donor: Types.ObjectId;
  organization: Types.ObjectId;
  cause?: Types.ObjectId;

  receiptNumber: string;

  amount: number;
  currency: string;
  donationType: 'one-time' | 'recurring' | 'round-up';
  donationDate: Date;
  paymentMethod?: string;

  taxDeductible: boolean;
  abnNumber?: string;
  zakatEligible: boolean;

  pdfUrl: string;
  pdfKey: string;

  emailSent: boolean;
  emailSentAt?: Date;
  emailAttempts: number;
  lastEmailError?: string;

  donorName: string;
  donorEmail: string;

  organizationName: string;
  organizationEmail?: string;
  organizationAddress?: string;

  specialMessage?: string;

  status: 'pending' | 'generated' | 'sent' | 'failed';

  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReceiptModel extends IReceipt, Document {}
