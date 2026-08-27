import { model, now, Schema } from 'mongoose';
import { IORGANIZATION } from './organization.interface';
import { organizationServiceTypeValues } from './organization.constants';
import {
  PLATFORM_BASE_CURRENCY,
  getCurrencyForCountry,
} from '../../utils/currency.utils';

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
      enum: organizationServiceTypeValues,
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

    tfnOrAbnNumber: {
      type: String,
    },
    acncNumber: {
      type: String,
    },
    zakatLicenseHolderNumber: {
      type: String,
      default: null,
    },

    country: {
      type: String,
      default: '',
    },
    defaultCurrency: {
      type: String,
      default: PLATFORM_BASE_CURRENCY,
      uppercase: true,
    },
    aboutUs: {
      type: String,
      default: '',
    },
    dateOfEstablishment: {
      type: Date,
      default: now(),
    },

    registeredCharityName: {
      type: String,
      default: '',
    },
    isProfileVisible: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true }, // Enable virtuals
    toObject: { virtuals: true },
  }
);

organizationSchema.virtual('stripeAccount', {
  ref: 'StripeAccount',
  localField: '_id',
  foreignField: 'organization',
  justOne: true,
});

// Keep defaultCurrency in sync with country on create/update
organizationSchema.pre('save', function (next) {
  if (this.isModified('country') || this.isNew || !this.defaultCurrency) {
    this.defaultCurrency = getCurrencyForCountry(this.country);
  }
  next();
});

const Organization = model<IORGANIZATION>('Organization', organizationSchema);

export default Organization;
export { Organization as OrganizationModel };
