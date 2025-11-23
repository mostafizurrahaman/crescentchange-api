import Donation from '../Donation/donation.model';
import Organization from '../Organization/organization.model';

const getAdminStatesFromDb = async () => {
  // if(!user?.roles?.includes('admin')){
  //     throw new Error('Unauthorized access');
  // }

  const formatPct = (pct: number | null) =>
    pct === null ? null : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs last month`;

  const calcPct = (prev: number | null, curr: number) => {
    if (prev === null) return null;
    if (prev === 0) return curr === 0 ? 0 : 100;
    return ((curr - prev) / prev) * 100;
  };

  // total donations (all time)
  const totalDonationAgg = await Donation.aggregate([
    { $match: { amount: { $gt: 0 } } },
    { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
  ]);
  const totalDonation = (totalDonationAgg[0]?.totalAmount ?? 0) as number;

  // time windows
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const previousMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const currentMonthStart = new Date(currentYear, currentMonth, 1);
  const nextMonthStart = new Date(currentYear, currentMonth + 1, 1);
  const previousMonthStart = new Date(previousMonthYear, previousMonth, 1);
  const previousMonthEnd = new Date(previousMonthYear, previousMonth + 1, 1);

  // total active organizations (current snapshot)
  const totalActiveOrganizations = await Organization.countDocuments({ });

  // active organizations created this month vs previous month (growth)
  const currentMonthActiveOrgs = await Organization.countDocuments({
    // status: 'active',
    createdAt: { $gte: currentMonthStart, $lt: nextMonthStart },
  });
  const previousMonthActiveOrgs = await Organization.countDocuments({
    // status: 'active',
    createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd },
  });
  const orgChangePct = calcPct(previousMonthActiveOrgs, currentMonthActiveOrgs);
  const orgChangeText = formatPct(orgChangePct);

  // donation counts for month-over-month (already present)
  // const currentMonthDonations = await Donation.countDocuments({
  //   createdAt: { $gte: currentMonthStart, $lt: nextMonthStart },
  // });
  // const previousMonthDonations = await Donation.countDocuments({
  //   createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd },
  // });

  // donation amounts for month-over-month (amount change)
  const currentMonthAmountAgg = await Donation.aggregate([
    { $match: { createdAt: { $gte: currentMonthStart, $lt: nextMonthStart } } },
    { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
  ]);
  const previousMonthAmountAgg = await Donation.aggregate([
    { $match: { createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } } },
    { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
  ]);
  const currentMonthAmount = (currentMonthAmountAgg[0]?.totalAmount ?? 0) as number;
  const previousMonthAmount = (previousMonthAmountAgg[0]?.totalAmount ?? 0) as number;
  const donationAmountChangePct = calcPct(previousMonthAmount, currentMonthAmount);
  const donationAmountChangeText = formatPct(donationAmountChangePct);

  // donations for the selected year (Jan-Dec) with month-over-month growth %
  const targetYear = currentYear; // change this to filter a different year
  // const donationYearFilter = {
  //   createdAt: {
  //     $gte: new Date(targetYear, 0, 1),
  //     $lt: new Date(targetYear + 1, 0, 1),
  //   },
  // };

  const donationGrowthMonthly = await (async () => {
    const months = Array.from({ length: 12 }, (_, m) => ({
      start: new Date(targetYear, m, 1),
      end: new Date(targetYear, m + 1, 1),
      year: targetYear,
      month: m,
    }));

    const counts = await Promise.all(
      months.map((interval) =>
        Donation.countDocuments({
          createdAt: { $gte: interval.start, $lt: interval.end },
          donationType: { $eq: 'one-time' },
        })
      )
    );

    return months.map((interval, idx) => {
      const count = counts[idx];
      const prev = idx === 0 ? null : counts[idx - 1];
      const growth = prev === null ? null : prev === 0 ? 100 : ((count - prev) / prev) * 100;
      return {
        year: interval.year,
        month: interval.month, // 0-11
        count,
        growth, // null for January (no previous month), otherwise percentage
      };
    });
  })();

  // donations growth from the subscriptions type
  const subscriptionDonationGrowthMonthly = await (async () => {
    const months = Array.from({ length: 12 }, (_, m) => ({
      start: new Date(targetYear, m, 1),
      end: new Date(targetYear, m + 1, 1),
      year: targetYear,
      month: m,
    }));
    const counts = await Promise.all(
      months.map((interval) =>
        Donation.countDocuments({
          createdAt: { $gte: interval.start, $lt: interval.end },
          donationType: { $eq: 'recurring' },
        })
      )
    );
    return months.map((interval, idx) => {
      const count = counts[idx];
      const prev = idx === 0 ? null : counts[idx - 1];
      const growth = prev === null ? null : prev === 0 ? 100 : ((count - prev) / prev) * 100;
      return {
        year: interval.year,
        month: interval.month, // 0-11
        count,
        growth, // null for January (no previous month), otherwise percentage
      };
    });
  })();

  // total donations by cause (all time) + month-over-month change per cause
  const donationsByCause = await Donation.aggregate([
    { $group: { _id: '$cause', totalAmount: { $sum: '$amount' } } },
    {
      $lookup: {
        from: 'causes',
        localField: '_id',
        foreignField: '_id',
        as: 'causeDetails',
      },
    },
    { $unwind: '$causeDetails' },
    { $project: { _id: 0, causeId: '$_id', cause: '$causeDetails.name', totalAmount: 1 } },
  ]);

  const currentByCauseAgg = await Donation.aggregate([
    { $match: { createdAt: { $gte: currentMonthStart, $lt: nextMonthStart } } },
    { $group: { _id: '$cause', totalAmount: { $sum: '$amount' } } },
    {
      $lookup: {
        from: 'causes',
        localField: '_id',
        foreignField: '_id',
        as: 'causeDetails',
      },
    },
    { $unwind: { path: '$causeDetails', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, cause: '$causeDetails.name', totalAmount: 1 } },
  ]);

  const previousByCauseAgg = await Donation.aggregate([
    { $match: { createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } } },
    { $group: { _id: '$cause', totalAmount: { $sum: '$amount' } } },
    {
      $lookup: {
        from: 'causes',
        localField: '_id',
        foreignField: '_id',
        as: 'causeDetails',
      },
    },
    { $unwind: { path: '$causeDetails', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, cause: '$causeDetails.name', totalAmount: 1 } },
  ]);

  const currentByCauseMap = new Map<string, number>();
  currentByCauseAgg.forEach((d: any) => currentByCauseMap.set(d.cause, d.totalAmount ?? 0));
  const previousByCauseMap = new Map<string, number>();
  previousByCauseAgg.forEach((d: any) => previousByCauseMap.set(d.cause, d.totalAmount ?? 0));

  const donationsByCauseWithChange = donationsByCause.map((c: any) => {
    const curr = currentByCauseMap.get(c.cause) ?? 0;
    const prev = previousByCauseMap.get(c.cause) ?? 0;
    const pct = calcPct(prev, curr);
    return {
      cause: c.cause,
      totalAmount: c.totalAmount,
      currentMonthAmount: curr,
      previousMonthAmount: prev,
      changePct: pct,
      changeText: formatPct(pct),
    };
  });

  // top 5 donors (all time) + month-over-month change per donor (by name)
  const topDonors = await Donation.aggregate([
    { $group: { _id: '$donor', totalAmount: { $sum: '$amount' } } },
    {
      $lookup: {
        from: 'clients',
        localField: '_id',
        foreignField: '_id',
        as: 'donorDetails',
      },
    },
    { $unwind: '$donorDetails' },
    { $project: { _id: 0, donorId: '$_id', donor: '$donorDetails.name', totalAmount: 1, since: '$clients.createdAt' } },
    { $sort: { totalAmount: -1 } },
    { $limit: 5 },
  ]);

  const currentDonorAgg = await Donation.aggregate([
    { $match: { createdAt: { $gte: currentMonthStart, $lt: nextMonthStart } } },
    { $group: { _id: '$donor', totalAmount: { $sum: '$amount' } } },
    {
      $lookup: {
        from: 'clients',
        localField: '_id',
        foreignField: '_id',
        as: 'donorDetails',
      },
    },
    { $unwind: { path: '$donorDetails', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, donor: '$donorDetails.name', totalAmount: 1, since: '$donorDetails.createdAt' } },
  ]);

  const previousDonorAgg = await Donation.aggregate([
    { $match: { createdAt: { $gte: previousMonthStart, $lt: previousMonthEnd } } },
    { $group: { _id: '$donor', totalAmount: { $sum: '$amount' } } },
    {
      $lookup: {
        from: 'clients',
        localField: '_id',
        foreignField: '_id',
        as: 'donorDetails',
      },
    },
    { $unwind: { path: '$donorDetails', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, donor: '$donorDetails.name', totalAmount: 1, since: '$donorDetails.createdAt'  } },
  ]);

  const currentDonorMap = new Map<string, { totalAmount: number; since?: any }>();
  currentDonorAgg.forEach((d: any) =>
    currentDonorMap.set(d.donor, { totalAmount: d.totalAmount ?? 0, since: d.since })
  );
  const previousDonorMap = new Map<string, number>();
  previousDonorAgg.forEach((d: any) => previousDonorMap.set(d.donor, d.totalAmount ?? 0));

  const topDonorsWithChange = topDonors.map((d: any) => {
    const curr = currentDonorMap.get(d.donor)?.totalAmount ?? 0;
    const prev = previousDonorMap.get(d.donor) ?? 0;
    const pct = calcPct(prev, curr);
    return {
      donor: d.donor,
      totalAmount: d.totalAmount,
      currentMonthAmount: curr,
      previousMonthAmount: prev,
      changePct: pct,
      changeText: formatPct(pct),
      since: d.since ?? currentDonorMap.get(d.donor)?.since,
    };
  });

  // recent donors (unchanged)
  const recentDonorDocs = await Donation.aggregate([
    { $sort: { createdAt: -1 } },
    { $limit: 5 },

    {
      $lookup: {
        from: 'clients',
        localField: 'donor',
        foreignField: '_id',
        as: 'donor',
      },
    },

    { $unwind: { path: '$donor', preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: 'auths',
        localField: 'donor.auth',
        foreignField: '_id',
        as: 'donor_auth',
      },
    },

    { $unwind: { path: '$donor_auth', preserveNullAndEmptyArrays: true } },

    {
      $project: {
        _id: 0,
        createdAt: 1,
        donor: {
          name: '$donor.name',
          email: '$donor_auth.email',
        },
      },
    },
  ]);

  return {
    totalDonation,
    // donation amount month-over-month change
    // currentMonthAmount,
    // previousMonthAmount,
    // donationAmountChangePct,
    donationAmountChangeText,

    totalActiveOrganizations,
    currentMonthActiveOrgs,
    previousMonthActiveOrgs,
    organizationChangePct: orgChangePct,
    organizationChangeText: orgChangeText,

    // donationCountCurrentMonth: currentMonthDonations,
    // donationCountPreviousMonth: previousMonthDonations,

    donationGrowthMonthly, // per-month counts + growth
    subscriptionDonationGrowthMonthly,
    donationsByCause: donationsByCauseWithChange,
    topDonors: topDonorsWithChange,
    recentDonorDocs,
  };
};

export const AdminService = {
  getAdminStatesFromDb,
};
