# Droid Development Guidelines

**Purpose**: This document establishes coding patterns, validation approaches, and best practices based on the auth module analysis for consistent development across the codebase.

## Core Project Structure Patterns

### Module Structure
Every module should follow this standard structure:
```
modules/[ModuleName]/
├── [moduleName].constant.ts      # All constant values
├── [moduleName].interface.ts      # TypeScript interfaces
├── [moduleName].model.ts         # Mongoose models
├── [moduleName].validation.ts    # Zod validation schemas
├── [moduleName].service.ts       # Business logic
├── [moduleName].controller.ts    # HTTP request handlers
├── [moduleName].route.ts        # Express routes
└── [moduleName].utils.ts        # Module-specific helpers (if needed)
```

### File Naming Conventions
- Use kebab-case for directory names: `Auth`, `Donation`, `BankConnection`
- Use camelCase for files with module prefix: `auth.controller.ts`, `donation.service.ts`
- Consistent capitalization: first letter uppercase for module names

## Validation Patterns

### Zod Schema Structure
```typescript
// Use descriptive function names
const [action]Schema = z.object({
  body: z.object({
    // Required fields with detailed validation
    email: z
      .email({ message: 'Invalid email format!' })
      .transform((email) => email.toLowerCase())
      .refine((email) => email !== '', { message: 'Email is required!' })
      .refine((value) => typeof value === 'string', {
        message: 'Email must be string!',
      }),
    
    // Password validation with regex patterns
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters long!' })
      .max(20, { message: 'Password cannot exceed 20 characters!' })
      .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter!' })
      .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter!' })
      .regex(/[0-9]/, { message: 'Password must contain at least one number!' })
      .regex(/[@$!%*?&#]/, { message: 'Password must contain at least one special character!' }),
  }),
});
```

### Validation Best Practices
1. **Use transform()**: Normalize data (lowercase emails, trim strings)
2. **Detailed error messages**: Always provide specific context in validation messages
3. **Regex patterns**: Use for complex validations (passwords, phone numbers)
4. **Conditional validation**: Use `superRefine()` for role-based or conditional fields
5. **Reuse patterns**: Create reusable validators like `zodEnumFromObject`
6. **Export all schemas**: Group all schemas in a single export object

## Controller Patterns

### Standard Controller Structure
```typescript
import httpStatus from 'http-status';
import { Request, Response } from 'express';
import { ModuleService } from './module.service';
import { ModuleValidation } from './module.validation';
import { asyncHandler, sendResponse, AppError } from '../../utils';

const controllerAction = asyncHandler(async (req: Request, res: Response) => {
  // 1. Validate input
  const { body } = ModuleValidation.actionSchema.parse(req);
  
  // 2. Extract user from request
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }
  
  // 3. Call service
  const result = await ModuleService.actionMethod({ ...body, userId });
  
  // 4. Send response
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Action completed successfully',
    data: result,
  });
});
```

### Controller Guidelines
1. **Always wrap with asyncHandler**: For consistent error handling
2. **Validate input first**: Use Zod schemas at the controller level
3. **Check authentication**: Verify user existence before processing
4. **Use sendResponse**: Standardized response format
5. **Import from utils**: Use centralized utility functions

## Service Patterns

### Service Function Structure
```typescript
const serviceFunction = async (payload: PayloadType & { userId: string }) => {
  // 1. Validate dependencies exist
  const entityExists = await Model.isExists(payload.id);
  if (!entityExists) {
    throw new AppError(httpStatus.NOT_FOUND, 'Entity not found');
  }
  
  // 2. Process business logic
  const result = await Model.create(payload);
  
  // 3. Populate necessary fields
  const populated = await Model.findById(result._id)
    .populate('relatedField', 'name email');
  
  return populated;
};
```

### Service Best Practices
1. **Database transactions**: Use sessions for multi-step operations
2. **File cleanup**: Always clean up uploaded files on failure
3. **Population**: Only populate fields needed for responses
4. **Error types**: Use AppError with appropriate HTTP status codes
5. **Type safety**: Use TypeScript interfaces for all parameters

## Utils Functions Usage

### Standard Utils
- `asyncHandler`: Wrap all async functions for error handling
- `sendResponse`: Standardized API responses
- `AppError`: Custom error class with status codes
- `catchAsync`: Alternative to asyncHandler (choose one consistently)
- `sendOtpEmail`: Email utility for OTP communications
- `deleteFile`: Safe file deletion with error handling

### Stripe/Crypto Utils
- `createAccessToken`: JWT access token generation
- `createRefreshToken`: JWT refresh token generation
- `verifyToken`: Token validation
- `generateOtp`: OTP generation for authentication
- `upload`: File upload handling

## Error Handling Patterns

### AppError Usage
```typescript
// Standard pattern
throw new AppError(
  httpStatus.BAD_REQUEST,  // Or appropriate status code
  'Specific error message describing the issue',
  optionalErrorsArray // For validation errors
);
```

### Common Status Codes
- `400` (BAD_REQUEST): Validation errors, business logic violations
- `401` (UNAUTHORIZED): Missing or invalid authentication
- `403` (FORBIDDEN): User doesn't have permission
- `404` (NOT_FOUND): Resource doesn't exist
- `500` (INTERNAL_SERVER_ERROR): Unexpected server errors

## Database Patterns

### Mongoose Model Structure
```typescript
// Interface definition
export interface IModel extends Document {
  field: Type;
  // Instance methods
  isPasswordMatched(password: string): Promise<boolean>;
  isJWTIssuedBeforePasswordChanged(iat: number): boolean;
}

// Schema definition
const modelSchema = new Schema<IModel>({
  field: { type: String, required: true },
}, { timestamps: true });

// Static methods
modelSchema.statics.isExists = async function(id: string) {
  return await this.findById(id);
};

// Model export
export const Model = model<IModel>('Model', modelSchema);
```

### Database Best Practices
1. **Timestamps**: Always include `timestamps: true` in schemas
2. **Types**: Use TypeScript interfaces for all models
3. **Static methods**: Create helper methods like `isExists`, `isUserExistsByEmail`
4. **Population**: Use `.populate()` in controllers/services, not in models
5. **Transactions**: Use for multi-document operations
6. **Indexes**: Add indexes for frequently queried fields

## TypeScript Patterns

### Type Inference from Zod
```typescript
// Export types from validation schemas
export type TCreateProfilePayload = z.infer<typeof createProfileSchema.shape.body>;
export type TQueryParams = z.infer<typeof querySchema.shape.query>;

// Use these types in service methods
const serviceMethod = async (payload: TCreateProfilePayload) => {
  // Payload is now fully typed
};
```

### Request Types
```typescript
// Use Express Request with user type
const controllerAction = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;  // user is defined in middleware
  
  // Always check if user exists
  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }
});
```

## File Upload Patterns

### Standard Upload Handling
```typescript
// Handle files in controllers/files
const files = (req?.files as TSpecificFileType) || {};

// Cleanup on error
catch (error) {
  if (files && typeof files === 'object') {
    Object.values(files).forEach((fileArray) => {
      fileArray.forEach((file) => {
        try {
          if (file?.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (deleteErr) {
          console.warn('Failed to delete uploaded file:', file.path, deleteErr);
        }
      });
    });
  }
  throw error;
}
```

## Session Management

### JWT Token Patterns
```typescript
// Standard token payload structure
const accessTokenPayload = {
  id: user._id.toString(),
  name: user.name,
  image: user.image || defaultUserImage,
  email: user.email,
  role: user.role,
  isProfile: user.isProfile,
  isActive: user.isActive,
};

// Token creation
const accessToken = createAccessToken(accessTokenPayload);
export { accessToken };
```

## Response Standards

### Consistent Response Structure
```typescript
// Always use sendResponse with standardized format
sendResponse(res, {
  statusCode: httpStatus.OK,          // HTTP status code
  message: 'Operation completed',     // User-friendly message
  data: result,                      // Result data
  // meta: { page, limit, total }   // Include for paginated responses
});
```

## Code Style Guidelines

### Imports Organization
```typescript
// 1. Node.js built-ins
import fs from 'fs';

// 2. Third-party libraries
import httpStatus from 'http-status';
import { z } from 'zod';

// 3. Local imports - specific paths
import { AppError } from '../../utils';
import { ModuleValidation } from './module.validation';

// 4. Type imports (when needed)
import type { Request, Response } from 'express';
```

### Function Export Patterns
```typescript
// Group all exports in a single object
export const AuthController = {
  createAuth,
  signin,
  signup,
  deleteAccount,
};

// For validation schemas
export const AuthValidation = {
  createAuthSchema,
  signinSchema,
  signupSchema,
};
```

## Authentication & Authorization

### User Context Pattern
```typescript
// In every protected route
const userId = req.user?.id;
const userRole = req.user?.role;

if (!userId) {
  throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
}

// Role-based checks
if (userRole !== 'ADMIN' && userId !== resourceOwnerId) {
  throw new AppError(httpStatus.FORBIDDEN, 'Access denied');
}
```

## Testing Guidelines

### Validation Testing
- Test all validation failure cases
- Ensure error messages are user-friendly
- Test transform functions (lowercase, trim, etc.)

### Service Testing
- Test database operations
- Test error scenarios
- Test business logic edge cases

### Controller Testing
- Test request/response flow
- Test authentication checks
- Test error handling

## Security Considerations

### Input Validation
- Never trust client input
- Validate all request parameters
- Use Zod schemas consistently

### Data Protection
- Hash passwords before storage
- Use JWT tokens for authentication
- Implement rate limiting for sensitive endpoints

### Error Information
- Don't expose sensitive information in error messages
- Use generic messages for security-related errors
- Log detailed errors for debugging

This document should be used as a reference for all new feature development to ensure consistency with the existing codebase patterns.
