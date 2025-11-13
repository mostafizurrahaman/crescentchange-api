import { model, Schema } from 'mongoose';
import { ICause } from './causes.interface';
import { causeNameTypeValues } from './causes.constant';

const causeSchema = new Schema<ICause>(
  {
    name: {
      type: String,
      required: true,
      enum: causeNameTypeValues,
      trim: true,
    },
    notes: {
      type: String,
      required: false,
      trim: true,
      maxlength: 500, // optional: set a reasonable max length
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
