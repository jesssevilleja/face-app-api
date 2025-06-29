import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type FaceInteractionDocument = HydratedDocument<FaceInteraction>;

@Schema({ timestamps: true })
export class FaceInteraction {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Face', required: true })
  faceId: string;

  @Prop({ default: false })
  hasViewed: boolean;

  @Prop({ default: false })
  hasLiked: boolean;
}

export const FaceInteractionSchema =
  SchemaFactory.createForClass(FaceInteraction);

FaceInteractionSchema.index({ userId: 1, faceId: 1 }, { unique: true }); // Ensure unique interaction per user-face pair
