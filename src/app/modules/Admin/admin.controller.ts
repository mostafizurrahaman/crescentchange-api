import httpStatus from 'http-status';
import { asyncHandler, sendResponse } from '../../utils';
import { IAuth } from '../Auth/auth.interface';
import { AdminService } from './admin.service';

const getAdminStates = asyncHandler(async (req, res) => {
  // Implementation for fetching admin states goes here
//   const user = req.user as IAuth;
  const result = await AdminService.getAdminStatesFromDb();
  
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      message: 'Cause created successfully!',
      data: result,
    });
});

export const AdminController = {
    getAdminStates,

};
