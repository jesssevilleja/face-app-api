import { Schema, SchemaOptions } from '@nestjs/mongoose';

export abstract class BaseSchema {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
    transform: (_, ret) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
};