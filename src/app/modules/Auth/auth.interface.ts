import { Document, Model, ObjectId } from 'mongoose';
import { TRole } from './auth.constant';
import { organizationStatusValues } from '../Organization/organization.constants';

export type OrganizationStatusType = 'pending' | 'suspended' | 'verified';

// Instance methods
export interface IAuth extends Document {
  // extends Document for using .save() method
  _id: ObjectId;

  email: string;
  password: string;
  passwordChangedAt?: Date;

  otp: string;
  otpExpiry: Date;
  isVerifiedByOTP: boolean;

  isProfile: boolean;

  role: TRole;
  isActive: boolean;
  isDeleted: boolean;
  status: OrganizationStatusType;

  deactivationReason: string;
  deactivatedAt: Date;

  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  isPasswordMatched(plainTextPassword: string): Promise<boolean>;
  isJWTIssuedBeforePasswordChanged(
    jwtIssuedTimestamp: number | undefined
  ): boolean;
}

// Static methods
export interface IAuthModel extends Model<IAuth> {
  isUserExistsByEmail(email: string): Promise<IAuth | null>;
}
