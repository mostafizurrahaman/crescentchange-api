// src/app/modules/Causes/causes.validation.ts
import { z } from 'zod';
import { causeNameTypeValues } from './causes.constant';

// Create cause schema
const createCauseSchema = z.object({
  body: z.object({
    name: z.enum(causeNameTypeValues as [string, ...string[]], {
      message: 'Invalid cause name!',
    }),
    notes: z.string().max(500).optional(),
    organization: z
      .string({
        message: 'Organization ID is required!',
      })
      .optional(), // Optional because organization can set their own
  }),
});

// Update cause schema
const updateCauseSchema = z.object({
  body: z
    .object({
      name: z
        .enum(causeNameTypeValues as [string, ...string[]], {
          error: 'Invalid cause name!',
        })
        .optional(),
      notes: z.string().max(500).optional(),
    })
    .strict(),
  params: z.object({
    id: z.string({
      message: 'Cause ID is required!',
    }),
  }),
});

// Get cause by ID schema
const getCauseByIdSchema = z.object({
  params: z.object({
    id: z.string({
      message: 'Cause ID is required!',
    }),
  }),
});

// Get causes by organization schema
const getCausesByOrganizationSchema = z.object({
  params: z.object({
    organizationId: z.string({
      message: 'Organization ID is required!',
    }),
  }),
});

// Get causes query schema
const getCausesQuerySchema = z.object({
  query: z.object({
    name: z
      .enum(causeNameTypeValues as [string, ...string[]], {
        error: 'Invalid cause name!',
      })
      .optional(),
    organization: z.string().optional(),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(10).optional(),
    sortBy: z.string().default('createdAt').optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
  }),
});

// Bulk assign causes schema
const bulkAssignCausesSchema = z.object({
  body: z.object({
    causeNames: z
      .array(z.enum(causeNameTypeValues as [string, ...string[]]), {
        error: 'Invalid caues name!',
      })
      .min(1, 'At least one cause must be selected!')
      .max(20, 'Maximum 20 causes can be assigned!'),
  }),
  params: z.object({
    organizationId: z.string({
      message: 'Organization ID is required!',
    }),
  }),
});

export const CauseValidation = {
  createCauseSchema,
  updateCauseSchema,
  getCauseByIdSchema,
  getCausesByOrganizationSchema,
  getCausesQuerySchema,
  bulkAssignCausesSchema,
};
