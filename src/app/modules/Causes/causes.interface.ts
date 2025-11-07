import { Document, Types } from 'mongoose';

export type CauseNameType =
  | 'backpacks_and_books'
  | 'digital_dreams'
  | 'empowerment'
  | 'family_care'
  | 'health_and_wellness'
  | 'homelessness'
  | 'innovation'
  | 'learning'
  | 'mental_health'
  | 'money_management'
  | 'nutrition'
  | 'other'
  | 'recovery'
  | 'safety'
  | 'social_care';

export interface ICause extends Document {
  _id: Types.ObjectId;
  name: CauseNameType;
  notes: string;
  organization: Types.ObjectId;
}
