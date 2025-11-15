import { model, Schema } from 'mongoose';
import { IORGANIZATION } from './organization.interface';

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
  },
  { timestamps: true, versionKey: false }
);

const Organization = model<IORGANIZATION>('Organization', organizationSchema);

export default Organization;
export { Organization as OrganizationModel };
