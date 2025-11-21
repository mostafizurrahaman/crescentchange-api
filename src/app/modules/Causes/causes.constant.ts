export const CAUSE_CATEGORY_TYPE = {
  WATER: 'water',
  EDUCATION: 'education',
  FOOD: 'food',
  YOUTH: 'youth',
  ORPHANS: 'orphans',
  QURAN_EDUCATION: 'quran_education',
  HEALTH_MEDICAL: 'health_medical',
  EMERGENCY_RELIEF: 'emergency_relief',
  SHELTER_HOUSING: 'shelter_housing',
  MOSQUE_UTILITIES: 'mosque_utilities',
  ZAKAT: 'zakat',
  SADAQAH: 'sadaqah',
  RAMADAN: 'ramadan',
  QURBAN: 'qurban',
  FITRAH: 'fitrah',
  ADMIN_OPERATIONAL: 'admin_operational',
  REFUGEES: 'refugees',
  DIGITAL_DAWAH: 'digital_dawah',
  WOMEN_FAMILIES: 'women_families',
} as const;

export const CAUSE_STATUS_TYPE = {
  PENDING: 'pending',
  SUSPENDED: 'suspended',
  VERIFIED: 'verified',
} as const;

export const causeCategoryTypeValues = Object.values(CAUSE_CATEGORY_TYPE);
export const causeStatusTypeValues = Object.values(CAUSE_STATUS_TYPE);
