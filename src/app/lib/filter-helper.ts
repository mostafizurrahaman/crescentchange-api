import { Types } from 'mongoose';
import { DONATION_STATUS } from '../modules/donation/donation.constant';
import { IAnalyticsPeriod } from '../modules/donation/donation.interface';

/**
 * Calculate percentage change between current and previous values
 */
export const calculatePercentageChange = (
  current: number,
  previous: number
): { percentageChange: number; isIncrease: boolean } => {
  if (previous === 0) {
    return {
      percentageChange: current > 0 ? 100 : 0,
      isIncrease: current > 0,
    };
  }

  const change = ((current - previous) / previous) * 100;
  return {
    percentageChange: Math.abs(parseFloat(change.toFixed(2))),
    isIncrease: change >= 0,
  };
};

/**
 * Get date ranges based on filter (current and previous period)
 */
export const getDateRanges = (
  filter: 'today' | 'this_week' | 'this_month',
  year?: number
): { current: IAnalyticsPeriod; previous: IAnalyticsPeriod } => {
  const now = new Date();
  let currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date;

  switch (filter) {
    case 'today':
      currentStart = new Date(now.setHours(0, 0, 0, 0));
      currentEnd = new Date(now.setHours(23, 59, 59, 999));

      const yesterday = new Date(currentStart);
      yesterday.setDate(yesterday.getDate() - 1);
      previousStart = new Date(yesterday.setHours(0, 0, 0, 0));
      previousEnd = new Date(yesterday.setHours(23, 59, 59, 999));
      break;

    case 'this_week':
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
      currentStart = new Date(startOfWeek.setDate(diff));
      currentStart.setHours(0, 0, 0, 0);
      currentEnd = new Date(now.setHours(23, 59, 59, 999));

      previousEnd = new Date(currentStart);
      previousEnd.setDate(previousEnd.getDate() - 1);
      previousEnd.setHours(23, 59, 59, 999);
      previousStart = new Date(previousEnd);
      previousStart.setDate(previousStart.getDate() - 6);
      previousStart.setHours(0, 0, 0, 0);
      break;

    case 'this_month':
      const monthYear = year || now.getFullYear();
      const month = now.getMonth();
      currentStart = new Date(monthYear, month, 1, 0, 0, 0, 0);
      currentEnd = new Date(monthYear, month + 1, 0, 23, 59, 59, 999);

      previousStart = new Date(monthYear, month - 1, 1, 0, 0, 0, 0);
      previousEnd = new Date(monthYear, month, 0, 23, 59, 59, 999);
      break;
  }

  return {
    current: { startDate: currentStart, endDate: currentEnd },
    previous: { startDate: previousStart, endDate: previousEnd },
  };
};

/**
 * Build base query for donation aggregation
 */
export const buildBaseQuery = (
  organizationId?: string
): Record<string, any> => {
  const query: any = { status: 'completed' };
  if (organizationId) {
    query.organization = new Types.ObjectId(organizationId);
  }
  return query;
};

/**
 * Format currency value to 2 decimal places
 */
export const formatCurrency = (value: number): number => {
  return parseFloat(value.toFixed(2));
};

/**
 * Validate filter parameter
 */
export const isValidFilter = (
  filter: string
): filter is 'today' | 'this_week' | 'this_month' => {
  return ['today', 'this_week', 'this_month'].includes(filter);
};

/**
 * Get period label for display
 */
export const getPeriodLabel = (
  filter: 'today' | 'this_week' | 'this_month'
): { current: string; previous: string } => {
  const labels = {
    today: { current: 'Today', previous: 'Yesterday' },
    this_week: { current: 'This Week', previous: 'Last Week' },
    this_month: { current: 'This Month', previous: 'Last Month' },
  };

  return labels[filter];
};
