import { model, now, Schema } from 'mongoose';
import { IORGANIZATION } from './organization.interface';
import { optional } from 'zod';

const organizationSchema = new Schema<IORGANIZATION>(
  {
    auth: {
      type: Schema.Types.ObjectId,
      ref: 'Auth',
      required: true,
      unique: true,
    },

    // orgnaization details:
    name: {
      type: String,
    },
    serviceType: {
      type: String,
    },
    address: {
      type: String,
    },

    state: {
      type: String,
    },
    postalCode: {
      type: String,
    },
    website: {
      type: String,
    },

    phoneNumber: {
      type: String,
    },

    coverImage: {
      type: String,
    },
    logoImage: {
      type: String,
      optional: true,
    },

    // Verify Your registration
    tfnOrAbnNumber: {
      type: String,
    },
    zakatLicenseHolderNumber: {
      type: String,
      default: null,
    },

    // Stripe Connect account for receiving donations
    stripeConnectAccountId: {
      type: String,
      required: false,
    },

    // Board Memeber Fields :
    boardMemberName: {
      type: String,
    },
    boardMemberEmail: {
      type: String,
    },
    boardMemberPhoneNumber: {
      type: String,
    },
    drivingLicenseURL: {
      type: String,
    },

    //  Extra fields added:
    country: {
      type: String,
      default: '',
    },
    aboutUs: {
      type: String,
      default: '',
    },
    dateOfEstablishment: {
      type: Date,
      default: now(),
    },

    // Extra Access Fields :
    registeredCharityName: {
      type: String,
      default: '',
    },
    isProfileVisible: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false }
);

const Organization = model<IORGANIZATION>('Organization', organizationSchema);

export default Organization;
export { Organization as OrganizationModel };
