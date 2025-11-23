/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import fs from 'fs';
import httpStatus from 'http-status';
import { IAuth } from './auth.interface';
import { AppError } from '../../utils';
import { defaultUserImage } from '../Auth/auth.constant';
import { createAccessToken } from '../../lib';

// Helper function to delete old image if exists
const deleteOldImage = async (imagePath: string | undefined) => {
  if (imagePath) {
    try {
      await fs.promises.unlink(imagePath);
    } catch (error) {
      console.error('Error deleting old file:', error);
    }
  }
};

// Helper function to update the image and return JWT token
export const updateProfileImage = async (
  user: IAuth,
  file: Express.Multer.File | undefined,
  model: any, // Client, Business, or Organization
  imageField: string
) => {
  
  if (!file?.path) {
    throw new AppError(httpStatus.BAD_REQUEST, 'File is required!');
  }

  // Find the user-specific model instance (Client, Business, or Organization)
  const entity = await model.findOne({ auth: user?._id });

  if (!entity) {
    await fs.promises.unlink(file?.path);
    throw new AppError(httpStatus.BAD_REQUEST, `${model.modelName} not found!`);
  }

  // Delete the old image if it exists
  await deleteOldImage(entity?.[imageField]);

  // Update the image field with the new file path
  const updatedEntity = await model
    .findOneAndUpdate(
      { auth: user?._id },
      { [imageField]: file.path.replace(/\\/g, '/') }, // Ensure correct path format
      { new: true }
    )
    .select('name image');

  if (!updatedEntity) {
    await fs.promises.unlink(file?.path); // Clean up if update fails
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Something went wrong!'
    );
  }

  // Prepare JWT payload with updated image
  const accessTokenPayload = {
    id: user?._id.toString(),
    name: updatedEntity?.name,
    image: updatedEntity?.[imageField] || defaultUserImage, // Default image if not set
    email: user?.email,
    role: user?.role,
    isProfile: user?.isProfile,
    isActive: user?.isActive,
  };

  const accessToken = createAccessToken(accessTokenPayload);

  return { accessToken };
};
