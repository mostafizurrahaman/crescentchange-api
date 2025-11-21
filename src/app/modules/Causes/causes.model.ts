import { model, Schema } from 'mongoose';
import { ICause } from './causes.interface';
import {
  causeCategoryTypeValues,
  causeStatusTypeValues,
} from './causes.constant';

const causeSchema = new Schema<ICause>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: false,
      trim: true,
      maxlength: 500,
    },
    category: {
      type: String,
      required: true,
      enum: causeCategoryTypeValues,
    },
    status: {
      type: String,
      required: true,
      enum: causeStatusTypeValues,
      default: 'pending',
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required!'],
    },
  },
  { timestamps: true, versionKey: false }
);

const Cause = model<ICause>('Cause', causeSchema);

export default Cause;
