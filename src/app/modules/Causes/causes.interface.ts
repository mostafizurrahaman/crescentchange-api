import { Document, Types } from 'mongoose';

export type CauseCategoryType =
  | 'water'
  | 'education'
  | 'food'
  | 'youth'
  | 'orphans'
  | 'quran_education'
  | 'health_medical'
  | 'emergency_relief'
  | 'shelter_housing'
  | 'mosque_utilities'
  | 'zakat'
  | 'sadaqah'
  | 'ramadan'
  | 'qurban'
  | 'fitrah'
  | 'admin_operational'
  | 'refugees'
  | 'digital_dawah'
  | 'women_families';

export type CauseStatusType = 'pending' | 'suspended' | 'verified';

export interface ICause extends Document {
  _id: Types.ObjectId;
  name: string; // Dynamic text - no enum restriction
  description?: string; // Optional text field
  category: CauseCategoryType; // Enum for category
  status: CauseStatusType; // Enum for status with Pending, suspended, Verified
  organization: Types.ObjectId;
}

export interface IRaisedCauseSummary {
  causeId: string;
  name: string;
  category: CauseCategoryType;
  totalDonationAmount: number;
  startMonth: string;
  endMonth: string;
}
