import { Request, Response, NextFunction } from 'express';
import handleCastError from './handleCastError';
import handleDuplicateError from './handleDuplicateError';
import handleMongooseError from './handleMongooseError';
import handleZodError from './handleZodError';
import { BadRequestError, NotFoundError } from './CustomErrors';

// CatchAsync utility for handling async errors
export const catchAsync = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export {
  handleCastError,
  handleDuplicateError,
  handleMongooseError,
  handleZodError,
  BadRequestError,
  NotFoundError,
};
