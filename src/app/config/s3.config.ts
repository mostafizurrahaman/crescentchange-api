// src/app/config/s3.config.ts
import { S3 } from 'aws-sdk';

const s3Config = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
};

export const s3Client = new S3(s3Config);

export const S3_BUCKET =
  process.env.S3_BUCKET_NAME || 'crescent-change-receipts';

export const verifyS3Connection = async () => {
  try {
    await s3Client.headBucket({ Bucket: S3_BUCKET }).promise();
    console.log('✅ S3 connection verified');
  } catch (error) {
    console.error('❌ S3 configuration error:', error);
  }
};
