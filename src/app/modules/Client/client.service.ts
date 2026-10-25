import { AppError } from '../../utils';
import Donation from '../Donation/donation.model';
import { RoundUpModel } from '../RoundUp/roundUp.model';
import { RoundUpTransactionModel } from '../RoundUpTransaction/roundUpTransaction.model';
import Client from './client.model';
import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { ScheduledDonation } from '../ScheduledDonation/scheduledDonation.model';
import {
  getDateHeader,
  getDateRanges,
  getRecurringLabel,
  getTimeAgo,
} from '../../lib/filter-helper';
import Organization from '../Organization/organization.model';
import { IScheduledDonation } from '../Donation/donation.interface';
import { IClient } from './client.interface';
import {
  deleteFromS3,
  getS3KeyFromUrl,
  uploadToS3,
} from '../../utils/s3.utils';
import { IORGANIZATION } from '../Organization/organization.interface';
import {
  normalizePreferredCurrency,
  buildDonorDisplayLayer,
  donorDisplayMeta,
  getSupportedDisplayCurrencies,
} from '../../utils/donor-display-currency.utils';
import { PLATFORM_BASE_CURRENCY } from '../../utils/currency.utils';

// 1. Roundup donation stats
const getRoundupStats = async (userId: string, roundupId: string) => {
 
  // 1. Check User
  const client = await Client.findOne({
    auth: userId,
  });

  if (!client) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // 2. Get Active Roundup
  const currentRoundup = await RoundUpModel.findOne({
    user: client?.auth,
    _id: roundupId,
    enabled: true,
    isActive: true,
  }).populate<{ organization: IORGANIZATION }>(
    'organization',
    'name registeredCharityName country defaultCurrency'
  );

  if (!currentRoundup) {
    return {
      currentRoundupBalance: 0,
      monthlyThreshold: 0,
      todaysRoundupAmount: 0,
      lastTransactionAmount: 0,
      roundupPercentage: 0,
      daysLeft: 0,
      organizationName: '',
      registeredCharityName: '',
      recentTransactions: [],
      todaysRounduped: 0,
    };
  }

  // 3. Get Last Transaction Amount (Single Query for accuracy)
  const lastTransaction = await RoundUpTransactionModel.findOne({
    user: userId,
    roundUp: currentRoundup._id,
    status: 'processed',
  })
    .sort({ createdAt: -1 })
    .select('roundUpAmount currency');

  // 4. Calculate Today's Total Roundup Amount
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todaysStats = await RoundUpTransactionModel.aggregate([
    {
      $match: {
        user: new Types.ObjectId(userId),
        roundUp: currentRoundup._id,
        status: 'processed',
        createdAt: { $gte: startOfDay },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$roundUpAmount' },
      },
    },
  ]);

  const todaysRoundupAmount = todaysStats[0]?.total || 0;

  // 5. Get Recent Transactions (Grouped by Date)
  const recentTransactions = await RoundUpTransactionModel.aggregate([
    {
      $match: {
        user: new Types.ObjectId(userId),
        roundUp: currentRoundup._id,
        status: 'processed',
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $limit: 20,
    },
    {
      $addFields: {
        todayStr: {
          $dateToString: { format: '%Y-%m-%d', date: new Date() },
        },
        yesterdayStr: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: { $subtract: [new Date(), 24 * 60 * 60 * 1000] },
          },
        },
        createdDateStr: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        },

        formattedDate: {
          $toUpper: {
            $concat: [
              { $toString: { $dayOfMonth: '$createdAt' } },
              ' ',
              { $dateToString: { format: '%b %Y', date: '$createdAt' } },
            ],
          },
        },
      },
    },
    {
      $addFields: {
        dateLabel: {
          $switch: {
            branches: [
              {
                case: { $eq: ['$createdDateStr', '$todayStr'] },
                then: 'Today',
              },
              {
                case: { $eq: ['$createdDateStr', '$yesterdayStr'] },
                then: 'Yesterday',
              },
            ],
            default: '$formattedDate', // Returns "2 JUL 2025"
          },
        },
      },
    },
    {
      $group: {
        _id: '$dateLabel',
        sortDate: { $first: '$createdDateStr' },
        transactions: {
          $push: {
            transactionId: '$transactionId',
            roundupAmount: '$roundUpAmount',
            transactionAmount: '$originalAmount',
            transactionName: '$transactionName',
            createdAt: '$createdAt',
            currency: '$currency',
          },
        },
      },
    },
    {
      $sort: {
        sortDate: -1,
      },
    },
    {
      $project: {
        _id: 0,
        title: '$_id',
        transactions: 1,
      },
    },
  ]);

  const currentBalance = currentRoundup.currentMonthTotal || 0;
  const threshold = currentRoundup.monthlyThreshold;
  const isUnlimited = threshold === 'no-limit';

  const numericThreshold =
    !isUnlimited && typeof threshold === 'number' ? threshold : 0;

  let roundupPercentage = 0;
  if (numericThreshold > 0) {
    roundupPercentage = (currentBalance / numericThreshold) * 100;
  }

  // calculate the days left in the month
  const today = new Date();

  const nextMonthFirstDay = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    1
  );

  const diffTime = nextMonthFirstDay.getTime() - today.getTime();

  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const orgCurrency =
    currentRoundup?.organization?.defaultCurrency || PLATFORM_BASE_CURRENCY;
  const orgCurrencyLayer = await buildDonorDisplayLayer(
    orgCurrency,
    client.preferredCurrency
  );

  const prefCurrency = client.preferredCurrency || orgCurrency;
  const getTxDisplayAmount = (amount: number, txCurrency?: string) => {
    const c = txCurrency || orgCurrency;
    if (c === prefCurrency) {
      return Number((amount || 0).toFixed(2));
    }
    return orgCurrencyLayer.convert(amount || 0);
  };

  const mappedRecentTransactions = recentTransactions.map((group: any) => {
    const txList = (group.transactions || []).map((tx: any) => ({
      ...tx,
      currency: tx.currency || orgCurrency,
      displayRoundupAmount: getTxDisplayAmount(
        tx.roundupAmount || 0,
        tx.currency
      ),
      displayTransactionAmount: getTxDisplayAmount(
        tx.transactionAmount || 0,
        tx.currency
      ),
      displayCurrency: orgCurrencyLayer.displayCurrency,
    }));
    return {
      ...group,
      transactions: txList,
      data: txList,
    };
  });

  return {
    organizationName: currentRoundup?.organization?.name,
    registeredCharityName: currentRoundup?.organization?.registeredCharityName,
    ...donorDisplayMeta(orgCurrencyLayer),

    currentRoundupBalance: Number(currentBalance.toFixed(2)),
    displayCurrentRoundupBalance: orgCurrencyLayer.convert(currentBalance),
    todaysRoundupAmount: Number(todaysRoundupAmount.toFixed(2)) ?? 0,
    displayTodaysRoundupAmount: orgCurrencyLayer.convert(todaysRoundupAmount),
    monthlyThreshold: isUnlimited
      ? 'no-limit'
      : Number(numericThreshold.toFixed(2)),
    displayMonthlyThreshold: isUnlimited
      ? 'no-limit'
      : orgCurrencyLayer.convert(numericThreshold),
    lastTransactionAmount: Number(
      (lastTransaction?.roundUpAmount || 0).toFixed(2)
    ),
    displayLastTransactionAmount: getTxDisplayAmount(
      lastTransaction?.roundUpAmount || 0,
      (lastTransaction as any)?.currency
    ),
    roundupPercentage: Number(roundupPercentage.toFixed(2)),
    daysLeft,
    recentTransactions: mappedRecentTransactions,
  };
};

// 2. One time donation Stats:
const getOnetimeDonationStats = async (userId: string) => {
  const client = await Client.findOne({
    auth: userId,
  });

  if (!client) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const preferredCurrency = client.preferredCurrency || PLATFORM_BASE_CURRENCY;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const usdLayer = await buildDonorDisplayLayer(
    PLATFORM_BASE_CURRENCY,
    preferredCurrency
  );

  const donations = await Donation.find({
    donor: client._id,
    donationType: 'one-time',
    status: 'completed',
  })
    .sort({ donationDate: -1, createdAt: -1 })
    .populate('organization', 'name registeredCharityName logoImage')
    .lean();

  const getDisplayAmount = (donation: any): number => {
    if (donation.currency === preferredCurrency) {
      return Number(Number(donation.amount || 0).toFixed(2));
    }
    if (preferredCurrency === PLATFORM_BASE_CURRENCY) {
      if (
        donation.amountBase !== undefined &&
        donation.amountBase !== null &&
        donation.amountBase > 0
      ) {
        return Number(Number(donation.amountBase).toFixed(2));
      }
      if (donation.exchangeRate && donation.exchangeRate > 0) {
        return Number((donation.amount * donation.exchangeRate).toFixed(2));
      }
    }
    const baseAmount =
      donation.amountBase && donation.amountBase > 0
        ? donation.amountBase
        : donation.exchangeRate
        ? donation.amount * donation.exchangeRate
        : donation.amount;

    return usdLayer.convert(baseAmount);
  };

  const getBaseAmount = (donation: any): number => {
    if (
      donation.amountBase !== undefined &&
      donation.amountBase !== null &&
      donation.amountBase > 0
    ) {
      return Number(donation.amountBase);
    }
    if (donation.exchangeRate && donation.exchangeRate > 0) {
      return Number((donation.amount * donation.exchangeRate).toFixed(2));
    }
    return Number(donation.amount || 0);
  };

  let totalDonatedBase = 0;
  let totalDonatedDisplay = 0;
  let todaysTotalBase = 0;
  let todaysTotalDisplay = 0;

  for (const d of donations) {
    const baseAmt = getBaseAmount(d);
    const dispAmt = getDisplayAmount(d);

    totalDonatedBase += baseAmt;
    totalDonatedDisplay += dispAmt;

    const donationTime = d.donationDate || d.createdAt;
    if (donationTime && new Date(donationTime) >= startOfToday) {
      todaysTotalBase += baseAmt;
      todaysTotalDisplay += dispAmt;
    }
  }

  const recentList = donations.slice(0, 5);
  const groupedDonations: Record<string, any[]> = {};

  for (const item of recentList) {
    const org = item.organization as any;
    const date = item.donationDate || item.createdAt;
    const header = getDateHeader(date);
    const displayAmount = getDisplayAmount(item);

    const formattedDonation = {
      donationId: item._id,
      amount: item.amount,
      currency: item.currency,
      exchangeRate: item.exchangeRate ?? 1,
      amountBase: item.amountBase ?? item.amount,
      displayAmount,
      orgName: org?.name || 'Unknown',
      registeredCharityName: org?.registeredCharityName || '',
      orgLogo: org?.logoImage || null,
      timeAgo: getTimeAgo(date),
      createdAt: item.createdAt,
      donationDate: item.donationDate,
    };

    if (!groupedDonations[header]) {
      groupedDonations[header] = [];
    }
    groupedDonations[header].push(formattedDonation);
  }

  const recentDonations = Object.keys(groupedDonations).map((title) => ({
    title,
    donations: groupedDonations[title],
    data: groupedDonations[title],
  }));

  return {
    reportingCurrency: PLATFORM_BASE_CURRENCY,
    ...donorDisplayMeta(usdLayer),
    totalDonated: Number(totalDonatedBase.toFixed(2)),
    displayTotalDonated: Number(totalDonatedDisplay.toFixed(2)),
    todaysTotalDonation: Number(todaysTotalBase.toFixed(2)),
    displayTodaysTotalDonation: Number(todaysTotalDisplay.toFixed(2)),
    recentDonations,
  };
};

// 3. Recurring Donation Stats [Client]
export const getRecurringDonationStats = async (userId: string) => {
  const client = await Client.findOne({ auth: userId });
  if (!client) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const preferredCurrency = client.preferredCurrency || PLATFORM_BASE_CURRENCY;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const currentWeek = getDateRanges('this_week');

  const usdLayer = await buildDonorDisplayLayer(
    PLATFORM_BASE_CURRENCY,
    preferredCurrency
  );

  const todayDonations = await Donation.find({
    donor: client._id,
    donationType: 'recurring',
    status: 'completed',
    $or: [
      { donationDate: { $gte: startOfToday } },
      { createdAt: { $gte: startOfToday } },
    ],
  }).lean();

  let todaysRecurringBase = 0;
  let todaysRecurringDisplay = 0;

  for (const d of todayDonations) {
    const baseAmt =
      d.amountBase && d.amountBase > 0
        ? d.amountBase
        : d.exchangeRate
        ? d.amount * d.exchangeRate
        : d.amount;
    const dispAmt =
      d.currency === preferredCurrency ? d.amount : usdLayer.convert(baseAmt);
    todaysRecurringBase += baseAmt;
    todaysRecurringDisplay += dispAmt;
  }

  const scheduledWeekly = await ScheduledDonation.find({
    isActive: true,
    user: client._id,
    nextDonationDate: {
      $gte: currentWeek.current.startDate,
      $lte: currentWeek.current.endDate,
    },
    $or: [
      { frequency: 'weekly' },
      { frequency: 'custom', 'customInterval.unit': 'weeks' },
    ],
  }).lean();

  let totalWeeklyRecurringAmount = 0;
  let displayWeeklyRecurringAmount = 0;
  const distinctOrgs = new Set<string>();

  for (const s of scheduledWeekly) {
    distinctOrgs.add(s.organization.toString());
    totalWeeklyRecurringAmount += s.amount;
    if (s.currency === preferredCurrency) {
      displayWeeklyRecurringAmount += s.amount;
    } else {
      const orgCurrencyLayer = await buildDonorDisplayLayer(
        s.currency,
        preferredCurrency
      );
      displayWeeklyRecurringAmount += orgCurrencyLayer.convert(s.amount);
    }
  }

  const organizationDonations = await ScheduledDonation.aggregate([
    { $match: { isActive: true, user: client._id } },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: 'organizations',
        localField: 'organization',
        foreignField: '_id',
        as: 'organizationDetails',
      },
    },
    {
      $unwind: {
        path: '$organizationDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 1,
        amount: 1,
        currency: 1,
        frequency: 1,
        customInterval: 1,
        startDate: 1,
        'organizationDetails._id': 1,
        'organizationDetails.name': 1,
        'organizationDetails.logoImage': 1,
        'organizationDetails.coverImage': 1,
        'organizationDetails.registeredCharityName': 1,
      },
    },
  ]);

  const labeledDonations = organizationDonations.map((donation) => ({
    ...donation,
    label: getRecurringLabel(donation),
  }));

  const response = {
    reportingCurrency: PLATFORM_BASE_CURRENCY,
    ...donorDisplayMeta(usdLayer),
    todaysRecurringAmount: Number(todaysRecurringBase.toFixed(2)),
    displayTodaysRecurringAmount: Number(todaysRecurringDisplay.toFixed(2)),
    today: startOfToday.getDate(),
    totalWeeklyRecurringAmount: Number(totalWeeklyRecurringAmount.toFixed(2)),
    displayTotalWeeklyRecurringAmount: Number(
      displayWeeklyRecurringAmount.toFixed(2)
    ),
    organizationCount: distinctOrgs.size,
    donations: labeledDonations,
  };

  return response;
};

// 4. Get Organization Recurring donations:
export const getUserRecurringDonationsForSpecificOrganization = async (
  userId: string,
  organizationId: string
) => {
  const client = await Client.findOne({ auth: userId });
  if (!client) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const organization = await Organization.findOne({
    _id: organizationId,
  }).select(
    'name registeredCharityName serviceType address state country coverImage logoImage aboutUs website'
  );

  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, 'Organization not found!');
  }

  const today = getDateRanges('today');

  const [previousDonations, upcomingDonations] = await Promise.all([
    Donation.find({
      donor: client?._id,
      organization: organization?._id,
      donationType: 'recurring',
    })
      .populate<{ scheduledDonationId: IScheduledDonation }>(
        'scheduledDonationId',
        'isActive frequency customInterval'
      )
      .select(
        'donationDate totalAmount amount currency donationType scheduledDonationId netAmount status stripeFee gstOnFee platformFee coverFees'
      ),
    ScheduledDonation.aggregate([
      {
        $match: {
          user: client?._id,
          organization: organization?._id,
          isActive: true,
          nextDonationDate: {
            $gte: today.current.startDate,
          },
        },
      },
      {
        $project: {
          frequency: 1,
          coverFees: 1,
          amount: 1,
          currency: 1,
          nextDonationDate: 1,
          startDate: 1,
          customInterval: 1,
        },
      },
    ]),
  ]);

  return {
    organization,
    upcomingDonations,
    upcommingDoantions: upcomingDonations,
    previousDonations,
  };
};

const getUnifiedTransactionHistory = async (
  userId: string,
  query: Record<string, unknown>
) => {
  const client = await Client.findOne({ auth: userId });
  if (!client) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  const pipeline = [
    {
      $match: {
        user: client.auth,
        status: { $in: ['processed', 'donated'] },
      },
    },
    {
      $project: {
        _id: 1,

        type: { $literal: 'Round Up Transaction' },
        amount: '$roundUpAmount',
        originalAmount: '$originalAmount',
        originalTitle: '$transactionName',
        date: '$transactionDate',
        organization: '$organization',
        status: '$status',
        currency: '$currency',
      },
    },

    {
      $unionWith: {
        coll: 'donations',
        pipeline: [
          {
            $match: {
              donor: client._id,
              status: 'completed',
            },
          },
          {
            $project: {
              _id: 1,

              type: {
                $switch: {
                  branches: [
                    {
                      case: { $eq: ['$donationType', 'one-time'] },
                      then: 'One Time Donation',
                    },
                    {
                      case: { $eq: ['$donationType', 'recurring'] },
                      then: 'Recurring Donation',
                    },
                    {
                      case: { $eq: ['$donationType', 'round-up'] },
                      then: 'Round Up Donation',
                    },
                  ],
                  default: 'Donation',
                },
              },
              amount: '$amount',
              originalAmount: '$totalAmount',
              originalTitle: { $literal: null },
              date: '$donationDate',
              organization: '$organization',
              status: '$status',
              currency: '$currency',
            },
          },
        ],
      },
    },

    { $sort: { date: -1 } },
    {
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $skip: skip },
          { $limit: limit },

          {
            $lookup: {
              from: 'organizations',
              localField: 'organization',
              foreignField: '_id',
              as: 'orgDetails',
            },
          },
          {
            $unwind: { path: '$orgDetails', preserveNullAndEmptyArrays: true },
          },

          {
            $project: {
              _id: 1,
              type: 1,
              amount: 1,
              originalAmount: 1,

              title: {
                $cond: {
                  if: { $eq: ['$type', 'Round Up Transaction'] },
                  then: { $concat: ['Round up from ', '$originalTitle'] },
                  else: '$type',
                },
              },

              organizationName: '$orgDetails.name',
              image: '$orgDetails.logoImage',
              date: 1,
              currency: 1,
            },
          },
        ],
      },
    },
  ];

  const result = await RoundUpTransactionModel.aggregate(pipeline as any);

  const rawData = result[0].data;
  const total = result[0].metadata[0]?.total || 0;

  const groupedData: Record<string, any[]> = {};

  rawData.forEach((tx: any) => {
    const header = getDateHeader(new Date(tx.date));
    if (!groupedData[header]) {
      groupedData[header] = [];
    }

    groupedData[header].push({
      id: tx._id,
      title: tx.title,
      organizationName: tx.organizationName,
      amount: tx.amount,
      originalAmount: tx.originalAmount,
      currency: tx.currency,
      type: tx.type,
      image: tx.image,
      timeAgo: getTimeAgo(tx.date),
      fullDate: tx.date,
    });
  });

  const formattedResponse = Object.keys(groupedData).map((key) => ({
    title: key,
    transactions: groupedData[key],
  }));

  const history = await Promise.all(
    formattedResponse.map(async (group) => ({
      ...group,
      transactions: await Promise.all(
        group.transactions.map(async (tx: any) => {
          const layer = await buildDonorDisplayLayer(
            tx.currency,
            client.preferredCurrency
          );
          return {
            ...tx,
            ...donorDisplayMeta(layer),
            displayAmount: layer.convert(tx.amount),
            displayOriginalAmount: layer.convert(tx.originalAmount || 0),
          };
        })
      ),
    }))
  );

  return {
    history,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};

const updateClientProfile = async (
  userId: string,
  payload: Partial<IClient>,
  file?: Express.Multer.File
) => {
  // 1. Find the existing client profile
  const client = await Client.findOne({ auth: userId });

  if (!client) {
    // Note: No need to delete local file here anymore because it's in memory buffer
    throw new AppError(httpStatus.NOT_FOUND, 'Client profile not found!');
  }

  // 2. Handle Image Update if a file is provided
  if (file) {
    if (client.image && !client.image.includes('default')) {
      const oldKey = getS3KeyFromUrl(client.image);
      if (oldKey) {
        // Fire and forget (delete in background)
        deleteFromS3(oldKey).catch((err) =>
          console.error('Failed to delete old client image from S3:', err)
        );
      }
    }

    // B. Upload new image buffer to S3
    const fileName = `client-${userId}-${Date.now()}`;
    const uploadResult = await uploadToS3({
      buffer: file.buffer,
      key: fileName,
      contentType: file.mimetype,
      folder: 'profiles/clients',
    });

    // C. Set the new S3 URL to the payload
    payload.image = uploadResult.url;
  }

  if (payload.preferredCurrency !== undefined) {
    payload.preferredCurrency = normalizePreferredCurrency(
      payload.preferredCurrency
    ) as string | undefined;
  }

  // 3. Update the Database
  const result = await Client.findOneAndUpdate(
    { auth: userId },
    { $set: payload },
    { new: true, runValidators: true }
  );

  return result;
};

const getDisplayCurrencies = () => getSupportedDisplayCurrencies();

export default {
  getRoundupStats,
  getOnetimeDonationStats,
  getRecurringDonationStats,
  getUserRecurringDonationsForSpecificOrganization,
  getUnifiedTransactionHistory,
  updateClientProfile,
  getDisplayCurrencies,
};
