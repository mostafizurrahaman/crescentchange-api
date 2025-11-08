import { Error } from 'mongoose';

const handleCastError = (err: Error.CastError) => {
  return {
    statusCode: 400,
    message: 'Invalid mongodb object id',
    errors: [
      {
        path: String(err?.path || ''),
        message: err?.message || 'Invalid ID format',
      },
    ],
  };
};

export default handleCastError;
