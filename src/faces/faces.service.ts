import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Face, FaceDocument } from './schemas/face.schema';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import {
  FaceInteraction,
  FaceInteractionDocument,
} from './schemas/face-interaction.schema';
import { CreateFaceInput } from './dto/create-face.input';
import { UpdateFaceInput } from './dto/update-face.input';

@Injectable()
export class FacesService {
  constructor(
    @InjectModel(Face.name) private faceModel: Model<FaceDocument>,
    @InjectModel(FaceInteraction.name)
    private faceInteractionModel: Model<FaceInteractionDocument>,
  ) {}

  async create(createFaceInput: CreateFaceInput, userId: string): Promise<Face> {
    const newFace = new this.faceModel({
      ...createFaceInput,
      userId,
    });

    const face = await newFace.save();
    return face.toJSON();
  }

  async findAll(
    page: number,
    limit: number,
    searchTerm?: string,
    sortBy?: string,
    sortOrder?: string,
    userId?: string,
  ): Promise<Face[]> {
    const query: any = {};
    if (searchTerm) {
      query.name = { $regex: searchTerm, $options: 'i' };
    }

    // If userId is provided, filter by user's faces
    if (userId) {
      query.userId = new Types.ObjectId(userId);
    }

    const sort: any = {};
    if (sortBy) {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    const faces = await this.faceModel
      .find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    if (!userId) {
      return faces.map((face) => this.faceModel.hydrate(face).toJSON());
    }

    // Get user interactions for all faces
    const interactions = await this.faceInteractionModel
      .find({
        userId: new Types.ObjectId(userId),
        faceId: { $in: faces.map((face) => face._id) },
      })
      .exec();

    // Create a map of interactions for quick lookup
    const interactionMap = new Map(
      interactions.map((interaction) => [
        interaction.faceId.toString(),
        interaction,
      ]),
    );

    // Add interaction data to each face
    return faces.map((face) => {
      const faceObj = this.faceModel.hydrate(face).toJSON();
      const interaction = interactionMap.get(face._id.toString());
      return {
        ...faceObj,
        isLiked: interaction?.hasLiked || false,
        isViewed: interaction?.hasViewed || false,
      };
    });
  }

  async findOne(id: string): Promise<Face | null> {
    const face = await this.faceModel.findById(id).exec();
    return face ? face.toJSON() : null;
  }

  async update(id: string, updateFaceInput: UpdateFaceInput, userId: string): Promise<Face | null> {
    const face = await this.faceModel.findById(id).exec();
    
    if (!face) {
      throw new NotFoundException(`Face with ID ${id} not found`);
    }

    if (face.userId.toString() !== userId) {
      throw new ForbiddenException('You can only update your own faces');
    }

    const updatedFace = await this.faceModel
      .findByIdAndUpdate(id, updateFaceInput, { new: true })
      .exec();

    return updatedFace ? updatedFace.toJSON() : null;
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const face = await this.faceModel.findById(id).exec();
    
    if (!face) {
      throw new NotFoundException(`Face with ID ${id} not found`);
    }

    if (face.userId.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own faces');
    }

    const result = await this.faceModel.deleteOne({ _id: id }).exec();
    return result.deletedCount === 1;
  }

  async incrementView(faceId: string, userId: string): Promise<Face | null> {
    const face = await this.faceModel.findById(faceId).exec();
    if (!face) {
      throw new NotFoundException(`Face with ID ${faceId} not found`);
    }

    // Check if the user has already viewed this face
    const interaction = await this.faceInteractionModel.findOne({
      userId: new Types.ObjectId(userId),
      faceId: new Types.ObjectId(faceId),
    });

    if (!interaction || !interaction.hasViewed) {
      // Increment view count only if not viewed by this user before
      await this.faceModel
        .findByIdAndUpdate(faceId, { $inc: { views: 1 } })
        .exec();
      // Record the view interaction
      if (interaction) {
        interaction.hasViewed = true;
        await interaction.save();
      } else {
        await this.faceInteractionModel.create({
          userId,
          faceId,
          hasViewed: true,
          hasLiked: false,
        });
      }
    }

    const viewedFace = await this.faceModel.findById(faceId).exec();
    return viewedFace ? viewedFace.toJSON() : null;
  }

  async toggleLike(faceId: string, userId: string): Promise<Face | null> {
    const face = await this.faceModel.findById(faceId).exec();
    if (!face) {
      throw new NotFoundException(`Face with ID ${faceId} not found`);
    }

    let interaction = await this.faceInteractionModel.findOne({
      userId: new Types.ObjectId(userId),
      faceId: new Types.ObjectId(faceId),
    });

    if (interaction) {
      interaction.hasLiked = !interaction.hasLiked;
      await interaction.save();
    } else {
      interaction = await this.faceInteractionModel.create({
        userId,
        faceId,
        hasViewed: false,
        hasLiked: true,
      });
    }

    // Update like count based on the new state
    const likeChange = interaction.hasLiked ? 1 : -1;
    await this.faceModel
      .findByIdAndUpdate(faceId, { $inc: { likes: likeChange } })
      .exec();

    const likedFace = await this.faceModel.findById(faceId).exec();
    return likedFace ? likedFace.toJSON() : null;
  }

  async getUserInteraction(
    faceId: string,
    userId: string,
  ): Promise<FaceInteraction | null> {
    return this.faceInteractionModel.findOne({
      userId: new Types.ObjectId(userId),
      faceId: new Types.ObjectId(faceId),
    });
  }
}