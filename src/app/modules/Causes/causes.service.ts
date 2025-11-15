// src/app/modules/Causes/causes.service.ts
import httpStatus from 'http-status';
import {  startSession } from 'mongoose';
import { AppError } from '../../utils';
import QueryBuilder from '../../builders/QueryBuilder';
import Cause from './causes.model';
import { ICause, CauseCategoryType, CauseStatusType } from './causes.interface';
import Organization from '../Organization/organization.model';
import { CAUSE_CATEGORY_TYPE, CAUSE_STATUS_TYPE } from './causes.constant';

// Create cause
const createCauseIntoDB = async (payload: {
  name: string;
  description?: string;
  category: CauseCategoryType;
  organization: string;
}) => {
  const session = await startSession();

  try {
    session.startTransaction();

    // Verify organization exists
    const organization = await Organization.findById(
      payload.organization
    ).session(session);

    if (!organization) {
      throw new AppError(httpStatus.NOT_FOUND, 'Organization not found!');
    }

    // Note: With dynamic names, we don't check for duplicates unless specifically needed

    // Create cause
    const [cause] = await Cause.create([payload], { session });

    await session.commitTransaction();
    await session.endSession();

    // Populate organization
    const populatedCause = await Cause.findById(cause._id).populate(
      'organization',
      'name serviceType coverImage'
    );

    return populatedCause;
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create cause!'
    );
  }
};

// Get cause by ID
const getCauseByIdFromDB = async (causeId: string) => {
  const cause = await Cause.findById(causeId).populate(
    'organization',
    'name serviceType coverImage'
  );

  if (!cause) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cause not found!');
  }

  return cause;
};

// Define searchable fields
const causeSearchFields = ['name', 'notes'];

// Get all causes with filters
const getCausesFromDB = async (query: Record<string, unknown>) => {
  // Create base query without filters (QueryBuilder will handle filtering)
  const baseQuery = Cause.find().populate(
    'organization',
    'name serviceType coverImage'
  );

  console.log('Query received:', query);

  const causeQuery = new QueryBuilder<ICause>(baseQuery, query)
    .search(causeSearchFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await causeQuery.modelQuery;
  const meta = await causeQuery.countTotal();

  console.log('Result count:', result.length);
  console.log('Meta:', meta);

  return { causes: result, meta };
};

// Get causes by organization
const getCausesByOrganizationFromDB = async (organizationId: string) => {
  const causes = await Cause.find({ organization: organizationId }).populate(
    'organization',
    'name serviceType coverImage'
  );

  return causes;
};

// Update cause
const updateCauseIntoDB = async (
  causeId: string,
  payload: {
    name?: string;
    description?: string;
    category?: CauseCategoryType;
  }
) => {
  // Check if cause exists
  const existingCause = await Cause.findById(causeId);
  if (!existingCause) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cause not found!');
  }

  const cause = await Cause.findByIdAndUpdate(causeId, payload, {
    new: true,
    runValidators: true,
  }).populate('organization', 'name serviceType coverImage');

  if (!cause) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cause not found!');
  }

  return cause;
};

// Delete cause
const deleteCauseFromDB = async (causeId: string) => {
  const cause = await Cause.findByIdAndDelete(causeId);

  if (!cause) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cause not found!');
  }

  return { message: 'Cause deleted successfully!' };
};

// Get cause categories (for dropdown/filter purposes)
const getCauseCategoriesFromDB = async () => {
  const causeCategories = Object.entries(CAUSE_CATEGORY_TYPE).map(([key, value]) => ({
    label: key
      .replace(/_/g, ' ')
      .split('/')
      .map(word => 
        word.split(' ')
          .map(subword => 
            subword.charAt(0).toUpperCase() + subword.slice(1).toLowerCase()
          )
          .join(' ')
      )
      .join(' / '),
    value: value,
  }));

  return causeCategories;
};

// Update cause status
const updateCauseStatusIntoDB = async (
  causeId: string,
  status: CauseStatusType
) => {
  const cause = await Cause.findByIdAndUpdate(
    causeId,
    { status },
    { new: true, runValidators: true }
  ).populate('organization', 'name serviceType coverImage');

  if (!cause) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cause not found!');
  }

  return cause;
};

export const CauseService = {
  createCauseIntoDB,
  getCauseByIdFromDB,
  getCausesFromDB,
  getCausesByOrganizationFromDB,
  updateCauseIntoDB,
  deleteCauseFromDB,
  getCauseCategoriesFromDB,
  updateCauseStatusIntoDB,
};
