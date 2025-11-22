export const ORGANIZATION_STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  SUSPENDED: 'suspended',
};

export const searchableFields = [
  'name',
  'aboutUs',
  'serviceType',
  'address',
  'registeredCharityName',
  'tfnOrAbnNumber',
  'boardMemberName',
  'boardMemberEmail',
  'website',
  'country',
  'state',
  'postalCode',
  'phoneNumber',
];
export const organizationStatusValues = Object.values(ORGANIZATION_STATUS);
