// src/app/modules/Causes/causes.controller.ts
import httpStatus from 'http-status';
import { asyncHandler, sendResponse } from '../../utils';
import { CauseService } from './causes.service';
import { AppError } from '../../utils';
import { IAuth } from '../Auth/auth.interface';
import Organization from '../Organization/organization.model';
import { CauseNameType } from './causes.interface';
import { ROLE } from '../Auth/auth.constant';

// Create cause
const createCause = asyncHandler(async (req, res) => {
  const user = req.user as IAuth;
  let organizationId = req.body.organization;

  // If user is an organization, use their own ID
  if (user.role === ROLE.ORGANIZATION) {
    const organization = await Organization.findOne({ auth: user._id });
    if (!organization) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Organization profile not found!'
      );
    }
    organizationId = organization._id.toString();
  }

  const result = await CauseService.createCauseIntoDB({
    name: req.body.name,
    notes: req.body.notes,
    organization: organizationId,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'Cause created successfully!',
    data: result,
  });
});

// Get all causes
const getCauses = asyncHandler(async (req, res) => {
  const filters = req.query;

  const result = await CauseService.getCausesFromDB({
    name: filters.name as CauseNameType,
    organization: filters.organization as string,
    page: filters.page ? Number(filters.page) : undefined,
    limit: filters.limit ? Number(filters.limit) : undefined,
    sortBy: filters.sortBy as string,
    sortOrder: filters.sortOrder as 'asc' | 'desc',
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Causes retrieved successfully!',
    data: result.causes,
    meta: {
      page: result.meta.page,
      limit: result.meta.limit,
      total: result.meta.total,
      totalPage: result.meta.totalPages,
    },
  });
});

// Get cause by ID
const getCauseById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await CauseService.getCauseByIdFromDB(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Cause retrieved successfully!',
    data: result,
  });
});

// Get causes by organization
const getCausesByOrganization = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const result = await CauseService.getCausesByOrganizationFromDB(
    organizationId
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Organization causes retrieved successfully!',
    data: result,
  });
});

// Update cause
const updateCause = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.user as IAuth;

  // Check if user is authorized to update
  if (user.role === ROLE.ORGANIZATION) {
    const cause = await CauseService.getCauseByIdFromDB(id);
    const organization = await Organization.findOne({ auth: user._id });

    if (cause.organization.toString() !== organization?._id.toString()) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You are not authorized to update this cause!'
      );
    }
  }

  const result = await CauseService.updateCauseIntoDB(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Cause updated successfully!',
    data: result,
  });
});

// Delete cause
const deleteCause = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.user as IAuth;

  // Check if user is authorized to delete
  if (user.role === 'ORGANIZATION') {
    const cause = await CauseService.getCauseByIdFromDB(id);
    const organization = await Organization.findOne({ auth: user._id });

    if (cause.organization.toString() !== organization?._id.toString()) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You are not authorized to delete this cause!'
      );
    }
  }

  const result = await CauseService.deleteCauseFromDB(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Cause deleted successfully!',
    data: result,
  });
});

// Get unique cause names
const getCauseNames = asyncHandler(async (req, res) => {
  const result = await CauseService.getUniqueCauseNamesFromDB();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Cause names retrieved successfully!',
    data: result,
  });
});

export const CauseController = {
  createCause,
  getCauses,
  getCauseById,
  getCausesByOrganization,
  updateCause,
  deleteCause,
  getCauseNames,
};
