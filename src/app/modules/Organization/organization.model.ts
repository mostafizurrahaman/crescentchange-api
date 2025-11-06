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

    boardMemberName: {
      type: String,
    },
    boardMemberEmail: {
      type: String,
    },
    boardMemberPhoneNumber: {
      type: String,
    },

    nameInCard: {
      type: String,
    },
    cardNumber: {
      type: String,
    },
    cardExpiryDate: {
      type: Date,
    },
    cardCVC: {
      type: String,
    },

    tfnOrAbnNumber: {
      type: String,
    },
    zakatLicenseHolderNumber: {
      type: String,
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

const Organization = model<IORGANIZATION>('Organization', organizationSchema);

export default Organization;
