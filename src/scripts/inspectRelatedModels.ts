import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

const dbUrl = process.env.DATABASE_URL || process.env.MONGO_URI || process.env.DB_URL;

async function inspect() {
  if (!dbUrl) {
    console.error('No database URL found');
    return;
  }
  await mongoose.connect(dbUrl);
  console.log('Connected to DB:', mongoose.connection.name);

  const db = mongoose.connection.db;
  if (!db) {
    console.error('No db connection');
    return;
  }

  // 1. Check Receipts
  const receipts = await db.collection('receipts').find({}).limit(10).toArray();
  console.log('\n--- Receipts sample (count = ' + (await db.collection('receipts').countDocuments()) + ') ---');
  receipts.forEach((r) => {
    console.log({
      id: r._id,
      receiptNumber: r.receiptNumber,
      amount: r.amount,
      totalAmount: r.totalAmount,
      platformFee: r.platformFee,
      stripeFee: r.stripeFee,
      gstOnFee: r.gstOnFee,
      donation: r.donation,
    });
  });

  // 2. Check PointsTransactions
  const pointsTx = await db.collection('pointstransactions').find({}).limit(10).toArray();
  console.log('\n--- PointsTransactions sample (count = ' + (await db.collection('pointstransactions').countDocuments()) + ') ---');
  pointsTx.forEach((pt) => {
    console.log({
      id: pt._id,
      user: pt.user,
      transactionType: pt.transactionType,
      amount: pt.amount,
      balance: pt.balance,
      source: pt.source,
      donation: pt.donation,
      metadata: pt.metadata,
    });
  });

  // 3. Check PointsBalances
  const pointsBal = await db.collection('pointsbalances').find({}).limit(10).toArray();
  console.log('\n--- PointsBalances sample (count = ' + (await db.collection('pointsbalances').countDocuments()) + ') ---');
  pointsBal.forEach((pb) => {
    console.log({
      id: pb._id,
      user: pb.user,
      totalEarned: pb.totalEarned,
      currentBalance: pb.currentBalance,
      lifetimePoints: pb.lifetimePoints,
    });
  });

  // 4. Check BalanceTransactions
  const balanceTx = await db.collection('balancetransactions').find({}).limit(10).toArray();
  console.log('\n--- BalanceTransactions sample (count = ' + (await db.collection('balancetransactions').countDocuments()) + ') ---');
  balanceTx.forEach((bt) => {
    console.log({
      id: bt._id,
      organization: bt.organization,
      amount: bt.amount,
      donation: bt.donation,
      type: bt.type,
      category: bt.category,
      metadata: bt.metadata,
    });
  });

  // 5. Check Causes
  const causes = await db.collection('causes').find({}).limit(10).toArray();
  console.log('\n--- Causes sample (count = ' + (await db.collection('causes').countDocuments()) + ') ---');
  causes.forEach((c) => {
    console.log({
      id: c._id,
      name: c.name,
      status: c.status,
      raisedAmount: (c as any).raisedAmount,
    });
  });

  await mongoose.disconnect();
}

inspect().catch(console.error);
