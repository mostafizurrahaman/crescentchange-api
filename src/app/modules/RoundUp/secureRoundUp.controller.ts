import { Request, Response } from 'express';
import { sendResponse } from '../../utils/ResponseHandler';
import { catchAsync } from '../../errors';
import { roundUpService } from './roundUp.service';

// Controller functions that handle HTTP requests/responses and call service functions
const savePlaidConsent = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const payload = req.body;
  
  const result = await roundUpService.savePlaidConsent(userId, payload);
  
  return sendResponse(res, result.statusCode, {
    success: result.success,
    message: result.message,
    data: result.data,
  });
});

const revokeConsent = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { bankConnectionId } = req.params;
  
  const result = await roundUpService.revokeConsent(userId, bankConnectionId);
  
  return sendResponse(res, result.statusCode, {
    success: result.success,
    message: result.message,
    data: result.data,
  });
});

const syncTransactions = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { bankConnectionId } = req.params;
  const payload = req.body;
  
  const result = await roundUpService.syncTransactions(userId, bankConnectionId, payload);
  
  return sendResponse(res, result.statusCode, {
    success: result.success,
    message: result.message,
    data: result.data,
  });
});

const processMonthlyDonation = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const payload = req.body;
  
  const result = await roundUpService.processMonthlyDonation(userId, payload);
  
  return sendResponse(res, result.statusCode, {
    success: result.success,
    message: result.message,
    data: result.data,
  });
});

const resumeRoundUp = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const payload = req.body;
  
  const result = await roundUpService.resumeRoundUp(userId, payload);
  
  return sendResponse(res, result.statusCode, {
    success: result.success,
    message: result.message,
    data: result.data,
  });
});

const switchCharity = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const payload = req.body;
  
  const result = await roundUpService.switchCharity(userId, payload);
  
  return sendResponse(res, result.statusCode, {
    success: result.success,
    message: result.message,
    data: result.data,
  });
});

const getUserDashboard = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  
  const result = await roundUpService.getUserDashboard(userId);
  
  return sendResponse(res, result.statusCode, {
    success: result.success,
    message: result.message,
    data: result.data,
  });
});

const getTransactionDetails = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { transactionId } = req.params;
  
  const result = await roundUpService.getTransactionDetails(userId, transactionId);
  
  return sendResponse(res, result.statusCode, {
    success: result.success,
    message: result.message,
    data: result.data,
  });
});

const getAdminDashboard = catchAsync(async (req: Request, res: Response) => {
  const userRole = req.user?.role ? [req.user.role] : [];
  
  const result = await roundUpService.getAdminDashboard(userRole);
  
  return sendResponse(res, result.statusCode, {
    success: result.success,
    message: result.message,
    data: result.data,
  });
});

export const roundUpController = {
  savePlaidConsent,
  revokeConsent,
  syncTransactions,
  processMonthlyDonation,
  resumeRoundUp,
  switchCharity,
  getUserDashboard,
  getTransactionDetails,
  getAdminDashboard,
};
