import { Request, Response, NextFunction } from 'express';
import { sendResponse, catchAsync } from '../../utils';
import bankConnectionService from './bankConnection.service';
import { ROLE } from '../Auth/auth.constant';
import { auth } from '../../middlewares';
import { STATUS_CODES } from './bankConnection.constant';

/**
 * Create a new bank connection
 * POST /api/v1/bank-connection/link-token
 */
const createLinkToken = catchAsync(async (req: Request, res: Response) => {
  const { id: userId } = req.user!;
  const linkToken = await bankConnectionService.createLinkToken(userId);
  
  sendResponse(res, {
    statusCode: STATUS_CODES.CREATED,
    success: true,
    message: 'Link token created successfully',
    data: linkToken,
  });
});

/**
 * Exchange public token and create bank connection
 * POST /api/v1/bank-connection/connect
 */
const connectBank = catchAsync(async (req: Request, res: Response) => {
  const { id: userId } = req.user!;
  const { public_token } = req.body;
  
  if (!public_token) {
    return sendResponse(res, {
      statusCode: STATUS_CODES.BAD_REQUEST,
      success: false,
      message: 'Public token is required',
    });
  }

  const connection = await bankConnectionService.connectBank(userId, {
    public_token,
  });
  
  sendResponse(res, {
    statusCode: STATUS_CODES.CREATED,
    success: true,
    message: 'Bank connected successfully',
    data: connection,
  });
});

/**
 * Get all bank connections for the authenticated user
 * GET /api/v1/bank-connection
 */
const getUserConnections = catchAsync(async (req: Request, res: Response) => {
  const { id: userId } = req.user!;
  const connections = await bankConnectionService.getUserConnections(userId);
  
  sendResponse(res, {
    statusCode: STATUS_CODES.SUCCESS,
    success: true,
    message: 'Connections retrieved successfully',
    data: connections,
  });
});

/**
 * Get a specific bank connection
 * GET /api/v1/bank-connection/:id
 */
const getConnectionById = catchAsync(async (req: Request, res: Response) => {
  const { id: userId } = req.user!;
  const { id: connectionId } = req.params;
  
  const connection = await bankConnectionService.getConnectionById(connectionId);
  
  // Verify user owns this connection
  if (connection.user.toString() !== userId) {
    return sendResponse(res, {
      statusCode: STATUS_CODES.FORBIDDEN,
      success: false,
      message: 'Access denied',
    });
  }
  
  sendResponse(res, {
    statusCode: STATUS_CODES.SUCCESS,
    success: true,
    message: 'Connection retrieved successfully',
    data: connection,
  });
});

/**
 * Sync transactions for a bank connection
 * POST /api/v1/bank-connection/:id/sync
 */
const syncTransactions = catchAsync(async (req: Request, res: Response) => {
  const { id: userId } = req.user!;
  const { id: connectionId } = req.params;
  
  const connection = await bankConnectionService.getConnectionById(connectionId);
  
  // Verify user owns this connection
  if (connection.user.toString() !== userId) {
    return sendResponse(res, {
      statusCode: STATUS_CODES.FORBIDDEN,
      success: false,
      message: 'Access denied',
    });
  }
  
  const syncResult = await bankConnectionService.syncTransactions(connectionId);
  
  sendResponse(res, {
    statusCode: STATUS_CODES.SUCCESS,
    success: true,
    message: 'Transactions synced successfully',
    data: syncResult,
  });
});

/**
 * Handle Plaid webhooks
 * POST /api/v1/bank-connection/webhook
 */
const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  // Here you would verify the webhook signature
  // For now, we'll process it directly
  
  await bankConnectionService.handleWebhook(req.body);
  
  sendResponse(res, {
    statusCode: STATUS_CODES.SUCCESS,
    success: true,
    message: 'Webhook processed successfully',
  });
});

/**
 * Delete a bank connection
 * DELETE /api/v1/bank-connection/:id
 */
const deleteConnection = catchAsync(async (req: Request, res: Response) => {
  const { id: userId } = req.user!;
  const { id: connectionId } = req.params;
  
  await bankConnectionService.deleteConnection(connectionId, userId);
  
  sendResponse(res, {
    statusCode: STATUS_CODES.SUCCESS,
    success: true,
    message: 'Bank connection deleted successfully',
  });
});

/**
 * Get connection status and sync information
 * GET /api/v1/bank-connection/:id/status
 */
const getConnectionStatus = catchAsync(async (req: Request, res: Response) => {
  const { id: userId } = req.user!;
  const { id: connectionId } = req.params;
  
  const connection = await bankConnectionService.getConnectionById(connectionId);
  
  // Verify user owns this connection
  if (connection.user.toString() !== userId) {
    return sendResponse(res, {
      statusCode: STATUS_CODES.FORBIDDEN,
      success: false,
      message: 'Access denied',
    });
  }
  
  // Return only status-related information
  const statusInfo = {
    accountId: connection.accountId,
    accountName: connection.accountName,
    institutionName: connection.institutionName,
    consentStatus: connection.consentStatus,
    lastSyncedDate: connection.lastSyncedDate,
    errorMessage: connection.errorMessage,
    errorCode: connection.errorCode,
    isActive: connection.isActive,
  };
  
  sendResponse(res, {
    statusCode: STATUS_CODES.SUCCESS,
    success: true,
    message: 'Connection status retrieved successfully',
    data: statusInfo,
  });
});

export const BankConnectionController = {
  createLinkToken,
  connectBank,
  getUserConnections,
  getConnectionById,
  syncTransactions,
  handleWebhook,
  deleteConnection,
  getConnectionStatus,
};
