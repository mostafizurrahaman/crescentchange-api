export const DONATION_TYPE = {
  BACKPACKS_AND_BOOKS: 'backpacks_and_books',
  DITIAL_DREAMS: 'digital_dreams',
  EMPOWERMENT: 'empowerment',
  FAMILY_CARE: 'family_care',
  HEALTH_AND_WELLNESS: 'health_and_wellness',
  HOMELESSNESS: 'homelessness',
  INNOVATION: 'innovation',
  LEARNING: 'learning',
  MENTAL_HEALTH: 'mental_health',
  MONEY_MANAGEMENT: 'money_management',
  NUTRITION: 'nutrition',
  OTHER: 'other',
  RECOVERY: 'recovery',
  SAFETY: 'safety',
  SOCIAL_CARE: 'social_care',
} as const;

export const DONATION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export const donationTypeValues = Object.values(DONATION_TYPE);
export const donationStatusValues = Object.values(DONATION_STATUS);
