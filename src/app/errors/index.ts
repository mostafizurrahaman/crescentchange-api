import handleCastError from './handleCastError';
import handleDuplicateError from './handleDuplicateError';
import handleMongooseError from './handleMongooseError';
import handleZodError from './handleZodError';
import { BadRequestError, NotFoundError } from './CustomErrors';

// CatchAsync utility for handling async errors
export const catchAsync = (fn: Function) => {
  return (req: any, res: any, next: any) => {
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
