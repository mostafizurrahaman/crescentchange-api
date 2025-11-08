import { Request } from 'express';

export interface IWebhookRequest extends Request {
  webhookVerified: boolean;
}
