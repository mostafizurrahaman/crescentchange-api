import { BadRequestError, NotFoundError } from '../../errors';
import BankConnection from './bankConnection.model';
import { 
  IBankConnectionPayload, 
  ILinkTokenResponse, 
  IExchangeTokenResponse,
  IConnectBankRequest,
  ISyncTransactionsResponse,
  IPlaidAccount,
  IPlaidTransaction,
  IWebhookPayload
} from './bankConnection.interface';
import { plaidClient, encrypt, decrypt } from '../../config/plaid';
import { 
  BANK_CONNECTION_MESSAGES,
  EXCLUDED_TRANSACTION_CATEGORIES,
  ELIGIBLE_TRANSACTION_TYPES,
  PAGINATION_LIMITS,
  PLAID_ERROR_CODES
} from './bankConnection.constant';
import { TransactionsGetRequest } from 'plaid';

class BankConnectionService {
  /**
   * Create a Plaid Link token for the frontend
   */
  async createLinkToken(userId: string): Promise<ILinkTokenResponse> {
    try {
      // Check if user already has active connections
      const existingConnections = await BankConnection.findByUser(userId);
      
      // Create a user token with client_user_id
      const request = {
        user: {
          client_user_id: userId,
        },
        client_name: 'Crescent Change',
        products: ['transactions'] as const,
        country_codes: ['US', 'CA'] as const, // Adjust based on target market
        language: 'en',
        webhook: process.env.PLAID_WEBHOOK_URL,
      };

      const response = await plaidClient.linkTokenCreate(request);
      
      return {
        link_token: response.data.link_token,
        expiration: response.data.expiration,
      };
    } catch (error: any) {
      throw new BadRequestError(`Failed to create link token: ${error.message}`);
    }
  }

  /**
   * Exchange public token and save bank connection
   */
  async connectBank(userId: string, connectData: IConnectBankRequest): Promise<any> {
    try {
      // Exchange public token for access token
      const { access_token, item_id } = await this.exchangePublicToken(connectData.public_token);
      
      // Get institution info
      const itemResponse = await plaidClient.itemGet({ access_token });
      const institutionResponse = await plaidClient.institutionsGetById({
        institution_id: itemResponse.data.item.institution_id!,
        country_codes: ['US', 'CA'],
      });

      // Get accounts
      const accountsResponse = await plaidClient.accountsGet({ access_token });
      
      // Save each account as separate connection
      const institution = institutionResponse.data.institution.institution;
      const connections = [];
      
      for (const account of accountsResponse.data.accounts) {
        const connectionPayload: IBankConnectionPayload = {
          user: userId,
          plaidItemId: item_id,
          plaidAccessToken: encrypt(access_token), // Encrypt the access token
          institutionId: institution.institution_id,
          institutionName: institution.name,
          accountId: account.account_id,
          accountName: account.name || account.official_name || `${account.subtype} Account`,
          accountType: account.type,
          accountSubtype: account.subtype,
          accountNumber: account.mask || '****',
          consentStatus: 'active',
          connectedDate: new Date(),
          isActive: true,
        };

        const connection = await BankConnection.create(connectionPayload);
        connections.push(connection);
      }

      return {
        connections,
        institution: institution.name,
        total_accounts: connections.length,
      };
    } catch (error: any) {
      throw new BadRequestError(`Failed to connect bank: ${error.message}`);
    }
  }

  /**
   * Exchange public token for access token
   */
  private async exchangePublicToken(publicToken: string): Promise<IExchangeTokenResponse> {
    try {
      const response = await plaidClient.itemPublicTokenExchange({
        public_token: publicToken,
      });

      return {
        access_token: response.data.access_token,
        item_id: response.data.item_id,
        request_id: response.data.request_id,
      };
    } catch (error: any) {
      throw new Error(`Token exchange failed: ${error.message}`);
    }
  }

  /**
   * Sync transactions for a specific bank connection
   */
  async syncTransactions(connectionId: string): Promise<ISyncTransactionsResponse> {
    try {
      const connection = await BankConnection.findById(connectionId);
      if (!connection) {
        throw new NotFoundError(BANK_CONNECTION_MESSAGES.CONNECTION_NOT_FOUND);
      }

      if (connection.consentStatus !== 'active') {
        throw new BadRequestError(BANK_CONNECTION_MESSAGES.CONNECTION_EXPIRED);
      }

      // Get decrypted access token
      const accessToken = decrypt(connection.plaidAccessToken);
      
      // Calculate date range for sync
      const startDate = connection.lastSyncedDate 
        ? new Date(connection.lastSyncedDate)
        : new Date(Date.now() - PAGINATION_LIMITS.MAX_TRANSACTION_SYNC_DAYS * 24 * 60 * 60 * 1000);
      
      const endDate = new Date();

      const transactions = await this.fetchTransactions(
        accessToken,
        connection.accountId,
        startDate,
        endDate
      );

      // Filter eligible transactions for round-ups
      const eligibleTransactions = this.filterEligibleTransactions(transactions);

      // Update last sync date
      connection.lastSyncedDate = endDate;
      await connection.save();

      return {
        transactions: eligibleTransactions,
        total_transactions: eligibleTransactions.length,
        last_synced_date: endDate,
      };
    } catch (error: any) {
      throw new BadRequestError(`Transaction sync failed: ${error.message}`);
    }
  }

  /**
   * Fetch transactions from Plaid with pagination
   */
  private async fetchTransactions(
    accessToken: string,
    accountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<IPlaidTransaction[]> {
    const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const endDateStr = endDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const request: TransactionsGetRequest = {
      access_token: accessToken,
      start_date: startDateStr,
      end_date: endDateStr,
      options: {
        count: PAGINATION_LIMITS.TRANSACTIONS_PER_REQUEST,
        offset: 0,
        account_ids: [accountId], // Only fetch for this account
      },
    };

    let allTransactions: IPlaidTransaction[] = [];
    let totalTransactions = 0;

    // Fetch transactions with pagination
    do {
      const response = await plaidClient.transactionsGet(request);
      
      const transactions = response.data.transactions.map(tx => ({
        account_id: tx.account_id,
        amount: tx.amount,
        category: tx.category || [],
        date: tx.date,
        location: tx.location,
        merchant_name: tx.merchant_name,
        name: tx.name,
        pending: tx.pending,
        transaction_id: tx.transaction_id,
        transaction_type: tx.transaction_type,
        payment_channel: tx.payment_channel,
        iso_currency_code: tx.iso_currency_code,
      }));

      allTransactions = allTransactions.concat(transactions);
      totalTransactions = response.data.total_transactions;
      
      // Update offset for next request if needed
      request.options!.offset = allTransactions.length;
      
      // Break if we've fetched all transactions
      if (allTransactions.length >= totalTransactions) {
        break;
      }
      
      // Safety check to prevent infinite loop
      if (request.options!.offset >= 2000) { // Max 2000 transactions
        break;
      }
    } while (true);

    return allTransactions;
  }

  /**
   * Filter transactions eligible for round-up calculations
   */
  private filterEligibleTransactions(transactions: IPlaidTransaction[]): IPlaidTransaction[] {
    return transactions.filter(tx => {
      // Only process completed transactions (not pending)
      if (tx.pending) {
        return false;
      }

      // Only process debit transactions (purchases)
      if (tx.amount >= 0) { // Credit transactions are >= 0, debits are < 0
        return false;
      }

      // Skip if transaction falls under excluded categories
      if (tx.category && tx.category.some(cat => 
        EXCLUDED_TRANSACTION_CATEGORIES.some(excluded => 
          cat.toLowerCase().includes(excluded.toLowerCase())
        )
      )) {
        return false;
      }

      // Skip transfers and other non-purchase transactions
      if (tx.transaction_type && !ELIGIBLE_TRANSACTION_TYPES.includes(tx.transaction_type.toLowerCase())) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get all bank connections for a user
   */
  async getUserConnections(userId: string): Promise<any[]> {
    try {
      const connections = await BankConnection.findByUser(userId);
      return connections;
    } catch (error: any) {
      throw new BadRequestError(`Failed to fetch connections: ${error.message}`);
    }
  }

  /**
   * Get bank connection by ID
   */
  async getConnectionById(connectionId: string): Promise<any> {
    try {
      const connection = await BankConnection.findById(connectionId);
      if (!connection) {
        throw new NotFoundError(BANK_CONNECTION_MESSAGES.CONNECTION_NOT_FOUND);
      }
      return connection;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Update connection status (usually from webhook)
   */
  async updateConnectionStatus(
    plaidItemId: string,
    status: string,
    errorCode?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      const connection = await BankConnection.findByPlaidItemId(plaidItemId);
      if (!connection) {
        console.warn(`Connection not found for item ${plaidItemId}`);
        return;
      }

      await connection.updateStatus(status as any, errorCode, errorMessage);
    } catch (error: any) {
      console.error(`Failed to update connection status: ${error.message}`);
    }
  }

  /**
   * Handle Plaid webhooks
   */
  async handleWebhook(webhookData: IWebhookPayload): Promise<void> {
    try {
      const { webhook_type, webhook_code, item_id, error } = webhookData;

      switch (webhook_type) {
        case 'TRANSACTIONS':
          // New transactions available
          await this.handleTransactionsWebhook(item_id, webhook_code);
          break;

        case 'ITEM':
          // Item status changes
          await this.handleItemWebhook(item_id, webhook_code, error);
          break;

        case 'AUTH':
          // Account verification updates
          await this.handleAuthWebhook(item_id, webhook_code);
          break;

        default:
          console.log(`Unhandled webhook type: ${webhook_type}`);
      }
    } catch (error: any) {
      console.error(`Webhook handling failed: ${error.message}`);
    }
  }

  /**
   * Handle transaction-related webhooks
   */
  private async handleTransactionsWebhook(itemId: string, webhookCode: string): Promise<void> {
    if (webhookCode === 'SYNC_UPDATES_AVAILABLE') {
      // Find all connections with this item_id
      const connections = await BankConnection.find({ plaidItemId: itemId });
      
      // Trigger sync for each connection
      for (const connection of connections) {
        try {
          await this.syncTransactions(connection._id?.toString()!);
        } catch (error: any) {
          console.error(`Failed to sync connection ${connection._id}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Handle item-related webhooks
   */
  private async handleItemWebhook(itemId: string, webhookCode: string, error?: any): Promise<void> {
    let status = 'active';
    let errorMessage: string | undefined;
    
    switch (webhookCode) {
      case 'ERROR':
        status = 'error';
        errorMessage = error?.display_message || 'An error occurred';
        break;
        
      case 'LOGIN_REQUIRED':
        status = 'error';
        errorMessage = 'Login required - user needs to re-authenticate';
        break;
        
      case 'WEBHOOK_UPDATED':
        // Webhook URL was updated successfully
        console.log(`Webhook URL updated for item ${itemId}`);
        return;
        
      case 'PENDING_EXPIRATION':
        // Item will expire soon
        console.log(`Item ${itemId} pending expiration`);
        return;
        
      case 'USER_PERMISSION_REVOKED':
        status = 'revoked';
        errorMessage = 'User permission revoked';
        break;
        
      case 'ITEM_LOGIN_REQUIRED':
        status = 'error';
        errorMessage = 'Login required for this item';
        break;
        
      default:
        console.log(`Unhandled item webhook code: ${webhookCode}`);
        return;
    }

    await this.updateConnectionStatus(
      itemId,
      status,
      error?.error_code,
      errorMessage
    );
  }

  /**
   * Handle auth-related webhooks
   */
  private async handleAuthWebhook(itemId: string, webhookCode: string): Promise<void> {
    switch (webhookCode) {
      case 'AUTOMATICALLY_VERIFIED':
      case 'MANUALLY_VERIFIED':
        console.log(`Account verified for item ${itemId}`);
        break;
        
      case 'VERIFICATION_EXPIRED':
        console.log(`Account verification expired for item ${itemId}`);
        break;
        
      default:
        console.log(`Unhandled auth webhook code: ${webhookCode}`);
    }
  }

  /**
   * Delete bank connection
   */
  async deleteConnection(connectionId: string, userId: string): Promise<void> {
    try {
      const connection = await BankConnection.findOne({ _id: connectionId, user: userId });
      if (!connection) {
        throw new NotFoundError(BANK_CONNECTION_MESSAGES.CONNECTION_NOT_FOUND);
      }

      // Remove the item from Plaid
      const accessToken = decrypt(connection.plaidAccessToken);
      await plaidClient.itemRemove({ access_token: accessToken });

      // Mark connection as inactive instead of deleting for audit trail
      connection.isActive = false;
      connection.consentStatus = 'revoked';
      await connection.save();
    } catch (error: any) {
      throw new BadRequestError(`Failed to delete connection: ${error.message}`);
    }
  }

  /**
   * Calculate round-up value for a transaction amount
   */
  calculateRoundUp(amount: number): number {
    const absoluteAmount = Math.abs(amount);
    const rounded = Math.ceil(absoluteAmount);
    return parseFloat((rounded - absoluteAmount).toFixed(2));
  }
}

export default new BankConnectionService();
