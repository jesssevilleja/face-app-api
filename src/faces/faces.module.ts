import { Module } from '@nestjs/common';
import { FacesResolver } from './faces.resolver';
import { FacesService } from './faces.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Face, FaceSchema } from './schemas/face.schema';
import {
  FaceInteraction,
  FaceInteractionSchema,
} from './schemas/face-interaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Face.name, schema: FaceSchema },
      { name: FaceInteraction.name, schema: FaceInteractionSchema },
    ]),
  ],
  providers: [FacesResolver, FacesService],
  exports: [FacesService],
})
export class FacesModule {}
