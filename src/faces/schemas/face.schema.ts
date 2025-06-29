import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type FaceDocument = HydratedDocument<Face>;

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class Face {
  @Prop()
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  imageUrl: string;

  @Prop({ default: 0 })
  views: number;

  @Prop({ default: 0 })
  likes: number;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  userId: string;

  @Prop()
  expression: string;

  @Prop()
  style: string;

  @Prop()
  makeup: string;

  @Prop()
  accessories: string;

  @Prop({ type: [String], default: [] })
  productsUsed: string[];
}

export const FaceSchema = SchemaFactory.createForClass(Face);

// Indexing for frequently queried fields
FaceSchema.index({ name: 'text' });
FaceSchema.index({ views: -1 });
FaceSchema.index({ likes: -1 });
FaceSchema.index({ createdAt: -1 });
FaceSchema.index({ userId: 1 });