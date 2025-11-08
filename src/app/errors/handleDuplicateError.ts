interface DuplicateError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
  keyPattern?: Record<string, number>;
}

const handleDuplicateError = (err: DuplicateError) => {
  const keys = err?.keyValue ? Object.keys(err.keyValue).join(', ') : 'unknown';
  const values = err?.keyValue ? Object.values(err.keyValue).join(', ') : 'unknown';
  
  return {
    statusCode: 400,
    message: 'Duplicate field',
    errors: [
      {
        path: keys,
        message: `${values} is already exists`,
      },
    ],
  };
};

export default handleDuplicateError;
