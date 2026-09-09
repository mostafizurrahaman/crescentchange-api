import fs from 'fs';
import os from 'os';
import path from 'path';
import config from '../../config';
import sendOtpEmail from '../../utils/sendOtpEmail';
import sendReceiptEmail from '../../utils/sendReceiptEmail';
import {
  sendReceiptEmail as sendSimpleReceiptEmail,
  sendWelcomeEmail,
} from '../../utils/emailService';
import sendContactUsEmail from '../../utils/sendContactUsEmail';
import sendRewardCodeEmail from '../../utils/sendReward';
import { generateReceiptPDF } from '../../utils/pdf.utils';
import { EMAIL_TEST_TYPES } from './emailTest.validation';

type EmailTestType = (typeof EMAIL_TEST_TYPES)[number];

export interface IEmailTestResult {
  type: EmailTestType;
  status: 'sent' | 'failed';
  deliveredTo: string;
  error?: string;
}

const ALL_TYPES: EmailTestType[] = [...EMAIL_TEST_TYPES];

const sendType = async (
  type: EmailTestType,
  to: string,
  name: string
): Promise<IEmailTestResult> => {
  const deliveredTo = type === 'contact' ? config.email.contactUsEmail : to;

  try {
    switch (type) {
      case 'otp':
        await sendOtpEmail({
          email: to,
          otp: '482917',
          name,
          subject: '[TEST] Your Crescent Change verification code',
          customMessage: 'This is a test OTP email. You can ignore it.',
        });
        break;

      case 'receipt': {
        const receiptNumber = `TEST-${Date.now()}`;
        const pdfPath = path.join(os.tmpdir(), `Receipt-${receiptNumber}.pdf`);
        const pdfBuffer = await generateReceiptPDF({
          receiptNumber,
          donorName: name,
          donorEmail: to,
          organizationName: 'Crescent Change Test Org',
          taxDeductible: true,
          zakatEligible: false,
          amount: 25,
          coverFees: true,
          platformFee: 1.25,
          gstOnFee: 0.13,
          stripeFee: 0.5,
          totalAmount: 26.88,
          netAmount: 25,
          currency: 'AUD',
          donationType: 'one-time',
          donationDate: new Date(),
          specialMessage: 'Test receipt email',
        });
        fs.writeFileSync(pdfPath, pdfBuffer);
        try {
          await sendReceiptEmail({
            donorEmail: to,
            donorName: name,
            organizationName: 'Crescent Change Test Org',
            receiptNumber,
            amount: 25,
            totalAmount: 26.88,
            coverFees: true,
            platformFee: 1.25,
            gstOnFee: 0.13,
            stripeFee: 0.5,
            currency: 'AUD',
            donationDate: new Date(),
            pdfUrl: pdfPath,
            donationType: 'one-time',
            specialMessage: 'This is a test receipt email.',
          });
        } finally {
          if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
          }
        }
        break;
      }

      case 'receipt-simple':
        await sendSimpleReceiptEmail({
          to,
          donorName: name,
          organizationName: 'Crescent Change Test Org',
          receiptUrl: '/receipts/test-receipt.pdf',
          receiptNumber: `TEST-SIMPLE-${Date.now()}`,
          donationAmount: 25,
          donationDate: new Date(),
          currency: 'AUD',
        });
        break;

      case 'welcome':
        await sendWelcomeEmail(to, name);
        break;

      case 'contact':
        await sendContactUsEmail({
          email: to,
          fullName: name,
          phoneNumber: '+61 400 000 000',
          message:
            'This is a test Contact Us email from the /email/test endpoint.',
        });
        break;

      case 'reward':
        await sendRewardCodeEmail({
          email: to,
          userName: name,
          rewardTitle: 'Test Reward 10% Off',
          code: 'TEST10',
          businessName: 'Crescent Change Test Business',
        });
        break;

      default:
        break;
    }

    return { type, status: 'sent', deliveredTo };
  } catch (error) {
    return {
      type,
      status: 'failed',
      deliveredTo,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

const sendTestEmails = async (payload: { to: string; name?: string }) => {
  const name = payload.name || 'Test User';
  const results = await Promise.all(
    ALL_TYPES.map((type) => sendType(type, payload.to, name))
  );

  return {
    to: payload.to,
    sent: results.filter((item) => item.status === 'sent').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results,
  };
};

export const EmailTestService = {
  sendTestEmails,
};
