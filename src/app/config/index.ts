import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join((process.cwd(), '.env')) });

export default {
  NODE_ENV: process.env.NODE_ENV,
  client_url: process.env.CLIENT_URL,
  contact_us_email: process.env.CONTACT_US_EMAIL,

  host: process.env.HOST,
  port: process.env.PORT,

  db_url: process.env.DB_URL,

  preffered_website_name: process.env.PREFFERED_WEBSITE_NAME,
  emailColor: process.env.EMAILCOLOR,
  buttonColor: process.env.BUTTONCOLOR,

  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  otp_expiry_minutes: process.env.OTP_EXPIRY_MINUTES,

  default_user_image: process.env.DEFAULT_USER_IMAGE,

  jwt: {
    access_secret: process.env.JWT_ACCESS_SECRET,
    access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN,
    refresh_secret: process.env.JWT_REFRESH_SECRET,
    refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
    otp_secret: process.env.JWT_OTP_SECRET,
    otp_secret_expires_in: process.env.JWT_OTP_SECRET_EXPIRES_IN,
  },

  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,

  nodemailer: {
    email: process.env.EMAIL_FOR_NODEMAILER,
    password: process.env.PASSWORD_FOR_NODEMAILER,
  },

  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    otp: process.env.ADMIN_OTP,
  },

  stripe: {
    stripe_secret_key: process.env.STRIPE_SECRET_KEY,
    stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
    // webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
    onboarding_refresh_url: process.env.STRIPE_ONBOARDING_REFRESH_URL,
    onboarding_return_url: process.env.STRIPE_ONBOARDING_RETURN_URL,
  },

  firebase_account_key: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  },

  twilio: {
    accountSid: process.env.TWILIO_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  plaid: {
    client_id: process.env.PLAID_CLIENT_ID,
    secret: process.env.PLAID_SECRET,
    environment: process.env.PLAID_ENV || 'sandbox',
    webhook_url: process.env.PLAID_WEBHOOK_URL,
    // Plaid SDK environment mappings
    env: process.env.PLAID_ENV || 'sandbox', // 'sandbox', 'development', 'production'
  },
};
