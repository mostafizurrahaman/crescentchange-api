import z from 'zod';

// Tab 1: Organization Details (without images)
const editProfileOrgDetailsSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    dateOfEstablishment: z
      .string()
      .or(z.date())
      .transform((val) => (typeof val === 'string' ? new Date(val) : val))
      .optional(),
    address: z.string().optional(),
    website: z.string().url('Invalid website URL!').optional(),
    phoneNumber: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    isProfileVisible: z.boolean().optional(),
    aboutUs: z.string().optional(),
  }),
});

// Tab 2: Tax Details
const editOrgTaxDetailsSchema = z.object({
  body: z.object({
    registeredCharityName: z.string().optional(),
    tfnOrAbnNumber: z.string().optional(),
    zakatLicenseHolderNumber: z.string().nullable().optional(),
  }),
});

export const OrganizationValidation = {
  editProfileOrgDetailsSchema,
  editOrgTaxDetailsSchema,
};

export const organizationValidation = {
  editProfileOrgDetailsSchema,
  editOrgTaxDetailsSchema,
};

export type TEditProfileOrgDetails = z.infer<
  typeof editProfileOrgDetailsSchema.shape.body
>;
export type TEditOrgTaxDetails = z.infer<
  typeof editOrgTaxDetailsSchema.shape.body
>;
