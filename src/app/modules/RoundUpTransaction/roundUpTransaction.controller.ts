import { Request, Response, NextFunction } from 'express';
import { sendResponse, catchAsync } from '../../utils';
import roundUpTransactionService from './roundUpTransaction.service';
import { auth } from '../../middlewares';
import { ROLE } from '../Auth/auth.constant';
import { STATUS_CODES } from '../BankConnection/bankConnection.constant';
import bankConnectionService from '../BankConnection/bankConnection.service';

/**
 * Get user's round-up transactions
 * GET /api/v1/roundup-transaction
 */
const getUserTransactions = catchAsync(async (req: Request, res: Response) => {
  const { id: userId } = req.user!;
  const query = req.query as any;
  
  const transactions = await roundUpTransactionService.getUserTransactions(userId, query);
  
  sendResponse(res, {
    statusCode: STATUS_CODES.SUCCESS,
    success: true,
    message: 'Transactions retrieved successfully',
    data: transactions,
  });
});

/**
 * Get transaction summary
 * GET /api/v1/roundup-transaction/summary
 */
const getTransactionSummary = catchAsync(async (req: Request, res: Response) => {
  const { id: userId } = req.user!;
  
  const summary = await roundUpTransactionService.getTransactionSummary(userId);
  
  sendResponse(res, {
    statusCode: STATUS_CODES.SUCCESS,
    success: true,
    message: 'Transaction summary retrieved successfully',
    data: summary,
  });
});

/**
 * Create round-up transactions from synced bank transactions
 * POST /api/v1/roundup-transaction/create-from-sync
 */
const createFromBankSync = catchAsync(async (req: Request, res: Response) => {
  const { id: userId } = req.user!;
  const { bankConnectionId } = req.body;
  
  // First sync transactions from Plaid
  const syncResult = await bankConnectionService.syncTransactions(bankConnectionId);
  
  // Then create round-up transactions
  const roundUpResult = await roundUpTransactionService.createRoundUpTransactions(
    userId,
    bankConnectionId,
    syncResult.transactions
  );
  
  sendResponse(res, {
    statusCode: STATUS_CODES.CREATED,
    success: true,
    message: 'Round-up transactions created successfully',
    data: {
      sync: syncResult,
      roundUps: roundUpResult,
    },
  });
});

/**
 * Process unprocessed transactions into donation
 * POST /api/v1/roundup-transaction/process
 */
const processUnprocessedTransactions = catchAsync(async (req: Request, res: Response) => {
  const { id: userId } = req.user!;
  const { thresholdAmount } = req.body;
  
  if (!thresholdAmount || thresholdAmount <= 0) {
    return sendResponse(res, {
      statusCode: STATUS_CODES.BAD_REQUEST,
      success: false,
      message: 'Valid threshold amount is required',
    });
  }

  const result = await roundUpTransactionService.processUnprocessedTransactions(
    userId,
    thresholdAmount
  );
  
  sendResponse(res, {
    statusCode: STATUS_CODES.SUCCESS,
    success: true,
    message: result.message,
    data: result,
  });
});

/**
 * Get specific transaction by ID
 * GET /api/v1/roundup-transaction/:id
 */
const getTransactionById = catchAsync(async (req: Request, res: Response) => {
  const { id: userId } = req.user!;
  const { id: transactionId } = req.params;
  
  const transaction = await roundUpTransactionService.getTransactionById(
    transactionId,
    userId
  );
  
  sendResponse(res, {
    statusCode: STATUS_CODES.SUCCESS,
    success: true,
    message: 'Transaction retrieved successfully',
    data: transaction,
  });
});

/**
 * Mark transaction as processed with donation ID
 * POST /api/v1/roundup-transaction/:id/process
 */
const markTransactionAsProcessed = catchAsync(async (req: Request, res: Response) => {
  const { id: userId } = req.user!;
  const { id: transactionId } = req.params;
  const { donationId } = req.body;
  
  if (!donationId) {
    return sendResponse(res, {
      statusCode: STATUS_CODES.BAD_REQUEST,
      success: false,
      message: 'Donation ID is required',
    });
  }

  await roundUpTransactionService.markTransactionAsProcessed(
    transactionId,
    donationId,
    userId
  );
  
  sendResponse(res, {
    statusCode: STATUS_CODES.SUCCESS,
    success: true,
    message: 'Transaction marked as processed',
  });
});

/**
 * Delete transaction (admin only)
 * DELETE /api/v1/roundup-transaction/:id
 */
const deleteTransaction = catchAsync(async (req: Request, res: Response) => {
  const { id: transactionId } = req.params;
  
  await roundUpTransactionService.deleteTransaction(transactionId);
  
  sendResponse(res, {
    statusCode: STATUS_CODES.SUCCESS,
    success: true,
    message: 'Transaction deleted successfully',
  });
});

/**
 * Get monthly transaction breakdown
 * GET /api/v1/roundup-transaction/monthly
 */
const getMonthlyBreakdown = catchAsync(async (req: Request, res: Response) => {
  const { id: userId } = req.user!;
  
  const monthlyData = await RoundUpTransaction.getMonthlyBreakdown(userId);
  
  sendResponse(res, {
    statusCode: STATUS_CODES.SUCCESS,
    success: true,
    message: 'Monthly breakdown retrieved successfully',
    data: monthlyData,
  });
});

/**
 * Get category transaction breakdown
 * GET /api/v1/roundup-transaction/categories
 */
const getCategoryBreakdown = catchAsync(async (req: Request, res: Response) => {
  const { id: userId } = req.user!;
  
  const categoryData = await RoundUpTransaction.getCategoryBreakdown(userId);
  
  sendResponse(res, {
    statusCode: STATUS_CODES.SUCCESS,
    success: true,
    message: 'Category breakdown retrieved successfully',
    data: categoryData,
  });
});

export const RoundUpTransactionController = {
  getUserTransactions,
  getTransactionSummary,
  createFromBankSync,
  processUnprocessedTransactions,
  getTransactionById,
  markTransactionAsProcessed,
  deleteTransaction,
  getMonthlyBreakdown,
  getCategoryBreakdown,
};
