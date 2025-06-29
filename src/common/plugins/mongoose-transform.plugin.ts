import { Schema } from 'mongoose';

export function mongooseTransformPlugin(schema: Schema) {
  // Add virtual id field
  schema.virtual('id').get(function(this: any) {
    return this._id.toString();
  });

  // Configure toJSON transform
  schema.set('toJSON', {
    virtuals: true,
    transform: (_, ret) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  });

  // Configure toObject transform
  schema.set('toObject', {
    virtuals: true,
    transform: (_, ret) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  });
}