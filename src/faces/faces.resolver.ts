import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { FacesService } from './faces.service';
import { Face } from './models/face.model';
import { CreateFaceInput } from './dto/create-face.input';
import { UpdateFaceInput } from './dto/update-face.input';
import { AllFacesInput } from './dto/all-faces.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Resolver(() => Face)
export class FacesResolver {
  constructor(private readonly facesService: FacesService) {}

  @Query(() => [Face], { name: 'allFaces' })
  async allFaces(
    @Args('input') input: AllFacesInput,
  ): Promise<Face[]> {
    const { page, limit, searchTerm, sortBy, sortOrder, userId } = input;
    return this.facesService.findAll(
      page,
      limit,
      searchTerm,
      sortBy,
      sortOrder,
      userId,
    );
  }

  @Query(() => Face, { name: 'face', nullable: true })
  async getFace(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Face | null> {
    return this.facesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => Face, { name: 'createFace' })
  async createFace(
    @Args('input') createFaceInput: CreateFaceInput,
    @CurrentUser() user: any,
  ): Promise<Face> {
    return this.facesService.create(createFaceInput, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => Face, { name: 'updateFace' })
  async updateFace(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') updateFaceInput: UpdateFaceInput,
    @CurrentUser() user: any,
  ): Promise<Face | null> {
    return this.facesService.update(id, updateFaceInput, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => Boolean, { name: 'deleteFace' })
  async deleteFace(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    return this.facesService.remove(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => Face, { name: 'incrementFaceView' })
  async incrementFaceView(
    @Args('faceId', { type: () => ID }) faceId: string,
    @CurrentUser() user: any,
  ): Promise<Face | null> {
    return this.facesService.incrementView(faceId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => Face, { name: 'toggleFaceLike' })
  async toggleFaceLike(
    @Args('faceId', { type: () => ID }) faceId: string,
    @CurrentUser() user: any,
  ): Promise<Face | null> {
    return this.facesService.toggleLike(faceId, user.id);
  }
}