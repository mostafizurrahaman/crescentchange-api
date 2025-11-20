import { Response } from 'express';

interface IApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json({
    success: response.success,
    message: response.message,
    data: response.data,
    meta: response.meta,
  });
};
