import fs from 'fs';
import httpStatus from 'http-status';
import { startSession } from 'mongoose';
import config from '../../config';
import {
  createAccessToken,
  createRefreshToken,
  generateOtp,
  verifyToken,
} from '../../lib';
import { TDeactiveAccountPayload, TProfileFileFields } from '../../types';
import { AppError, sendOtpEmail } from '../../utils';
import Business from '../Business/business.model';
import Organization from '../Organization/organization.model';
import Client from '../Client/client.model';
import { IAuth } from './auth.interface';
import { defaultUserImage, ROLE } from './auth.constant';
import Auth from './auth.model';
import { AuthValidation, TProfilePayload } from './auth.validation';
import { updateProfileImage } from './auth.utils';
import z from 'zod';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';

const OTP_EXPIRY_MINUTES =
  Number.parseInt(config.jwt.otpSecretExpiresIn as string, 10) || 5;

// Debug logging to check the value
console.log('config.jwt.otpSecretExpiresIn:', config.jwt.otpSecretExpiresIn);
console.log('OTP_EXPIRY_MINUTES:', OTP_EXPIRY_MINUTES);

// 1. createAuthIntoDB
const createAuthIntoDB = async (payload: IAuth) => {
  const existingUser = await Auth.isUserExistsByEmail(payload.email);

  // if user exists but unverified
  if (existingUser && !existingUser.isVerifiedByOTP) {
    const now = new Date();

    // if OTP expired sending new otp
    if (!existingUser.otpExpiry || existingUser.otpExpiry < now) {
      const otp = generateOtp();
      await sendOtpEmail({ email: payload.email, otp });

      existingUser.otp = otp;
      existingUser.otpExpiry = new Date(
        now.getTime() + (OTP_EXPIRY_MINUTES || 5) * 60 * 1000
      );
      await existingUser.save();

      throw new AppError(
        httpStatus.BAD_REQUEST,
        'You have an unverified account, verify it with the new OTP sent to the mail!'
      );
    } else {
      // if OTP is valid till now
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'You have an unverified account, verify it now with the otp sent to the mail!'
      );
    }
  } else if (existingUser && existingUser.isVerifiedByOTP) {
    // if user is already verified
    throw new AppError(httpStatus.BAD_REQUEST, 'User already exists!');
  } else if (!existingUser) {
    //  OTP generating and sending if user is new
    const otp = generateOtp();
    await sendOtpEmail({ email: payload.email, otp });

    // Save new user as unverified
    const now = new Date();
    const newUser = await Auth.create({
      ...payload,
      otp,
      otpExpiry: new Date(
        now.getTime() + (OTP_EXPIRY_MINUTES || 5) * 60 * 1000
      ),
      isVerifiedByOTP: false,
    });

    // const token = jwt.sign({ ...payload, otp }, config.jwt.otp_secret!, {
    //   expiresIn: config.jwt.otp_secret_expires_in!,
    // } as SignOptions);

    return {
      email: newUser.email,
      // token
    };
  }
};

// 2. sendSignupOtpAgain
const sendSignupOtpAgain = async (email: string) => {
  const now = new Date();
  const user = await Auth.isUserExistsByEmail(email);

  if (!user) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You must sign up first to get an OTP!'
    );
  } else if (!user.otpExpiry || user.otpExpiry < now) {
    // sending new OTP if previous one is expired
    const otp = generateOtp();

    // send OTP via Email
    await sendOtpEmail({ email: user.email, otp });

    user.otp = otp;
    user.otpExpiry = new Date(
      now.getTime() + (OTP_EXPIRY_MINUTES || 5) * 60 * 1000
    );
    await user.save();

    return {
      email: user.email,
    };
  } else if (user.isVerifiedByOTP) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This account is already verified!'
    );
  } else {
    // if OTP is still valid
    await sendOtpEmail({
      email: user.email,
      otp: user.otp,
      customMessage: 'Verify quickly using this OTP!',
    });
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'An OTP was already sent. Please wait until it expires before requesting a new one.'
    );
  }
};

// 3. verifySignupOtpIntoDB
const verifySignupOtpIntoDB = async (email: string, otp: string) => {
  const now = new Date();
  const user = await Auth.isUserExistsByEmail(email);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // Check if the user is already verified
  if (user.isVerifiedByOTP) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This account is already verified!'
    );
  }

  // Check if OTP is expired
  if (!user.otpExpiry || user.otpExpiry < now) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'OTP has been expired. Please request a new one!'
    );
  }

  // If OTP is invalid, throw error
  if (user?.otp !== otp) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid OTP!');
  }

  // Mark user as verified
  user.isVerifiedByOTP = true;
  await user.save();

  // Prepare user data for token generation
  const accessTokenPayload = {
    id: user?._id.toString(),
    name: 'User',
    image: defaultUserImage,
    email: user?.email,
    role: user?.role,
    isProfile: user?.isProfile,
    isActive: user?.isActive,
  };

  const refreshTokenPayload = {
    email: user?.email,
  };

  // tokens
  const accessToken = createAccessToken(accessTokenPayload);
  const refreshToken = createRefreshToken(refreshTokenPayload);

  return {
    accessToken,
    refreshToken,
  };
};

// 4. signinIntoDB
const signinIntoDB = async (payload: {
  email: string;
  password: string;
  fcmToken: string;
}) => {
  // const user = await Auth.findOne({ email: payload.email }).select('+password');
  const user = await Auth.isUserExistsByEmail(payload.email);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User does not exist!');
  }

  if (!user.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This account is not active!');
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This account is deleted!');
  }

  if (!user.isVerifiedByOTP) {
    const otp = generateOtp();

    await sendOtpEmail({ email: user.email, otp });

    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await user.save();

    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Verify your account with the new OTP sent to the mail!'
    );
  }

  // Validate password
  const isPasswordCorrect = await user.isPasswordMatched(payload.password);

  if (!isPasswordCorrect) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid credentials!');
  }

  // Prepare user data for token generation
  const accessTokenPayload = {
    id: user._id.toString(),
    name: 'User',
    image: defaultUserImage,
    email: user.email,
    role: user.role,
    isProfile: user?.isProfile,
    isActive: user?.isActive,
  };

  const refreshTokenPayload = {
    email: user?.email,
  };

  // tokens
  const accessToken = createAccessToken(accessTokenPayload);
  const refreshToken = createRefreshToken(refreshTokenPayload);

  return {
    accessToken,
    refreshToken,
  };
};

// 5. createProfileIntoDB
const createProfileIntoDB = async (
  payload: TProfilePayload,
  user: IAuth,
  files: TProfileFileFields
) => {
  // Prevent creating multiple profiles for same user
  if (user.isProfile) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Your profile is already created!'
    );
  }

  // Destructure relevant fields from the payload
  const {
    role,

    // CLIENT fields
    name,
    address,
    state,
    postalCode,
    nameInCard,
    cardNumber,
    cardExpiryDate,
    cardCVC,
    // notificationPreferences,

    // BUSINESS fields
    category,
    tagLine,
    description,
    businessPhoneNumber,
    businessEmail,
    businessWebsite,

    locations,

    // ORGANIZATION fields
    serviceType,
    website,
    phoneNumber,
    boardMemberName,
    boardMemberEmail,
    boardMemberPhoneNumber,
    tfnOrAbnNumber,
    zakatLicenseHolderNumber,
  } = payload;

  // Extract file paths for ID verification images for artists
  const clientImage = files?.clientImage?.[0]?.path.replace(/\\/g, '/') || null;
  const businessImage =
    files?.businessImage?.[0]?.path.replace(/\\/g, '/') || null;
  const organizationImage =
    files?.organizationImage?.[0]?.path.replace(/\\/g, '/') || null;

  const drivingLicenseURL =
    files?.drivingLincenseURL?.[0]?.path.replace(/\\/g, '/') || null;

  console.log({
    drivingLicenseURL,
  });

  // Start a MongoDB session for transaction
  const session = await startSession();

  try {
    session.startTransaction();

    // CLIENT PROFILE CREATION
    if (role === ROLE.CLIENT) {
      const isExistClient = await Client.findOne({ auth: user._id });
      if (isExistClient) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Client data already saved in database'
        );
      }

      const clientPayload = {
        auth: user._id,

        name,
        address,
        state,
        postalCode,

        image: clientImage,

        nameInCard,
        cardNumber,
        cardExpiryDate,
        cardCVC,
      };

      const [client] = await Client.create([clientPayload], { session });

      if (!client) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Client data not saved in database!'
        );
      }

      await Auth.findByIdAndUpdate(
        user._id,
        { role: ROLE.CLIENT, isProfile: true },
        { session }
      );

      await session.commitTransaction();
      await session.endSession();

      const accessTokenPayload = {
        id: user._id.toString(),
        name: client.name,
        image: client.image,
        email: user.email,
        role: user.role,
        isProfile: true,
        isActive: user?.isActive,
      };

      // const refreshTokenPayload = {
      //   email: user.email,
      // };

      const accessToken = createAccessToken(accessTokenPayload);
      // const refreshToken = createRefreshToken(refreshTokenPayload);

      return {
        accessToken,
        // refreshToken,
      };
    } else if (role === ROLE.BUSINESS) {
      // BUSINESS PROFILE CREATION
      const isExistBusiness = await Business.findOne({ auth: user._id });
      if (isExistBusiness) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Business profile already exists.'
        );
      }

      const businessPayload = {
        auth: user._id,

        category,
        name,
        tagLine,
        description,

        coverImage: businessImage,

        businessPhoneNumber,
        businessEmail,
        businessWebsite,
        locations,
      };

      const [business] = await Business.create([businessPayload], { session });

      if (!business) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Business data not saved in database!'
        );
      }

      await Auth.findByIdAndUpdate(
        user._id,
        { role: ROLE.BUSINESS, isProfile: true },
        { session }
      );

      await session.commitTransaction();
      await session.endSession();

      const accessTokenPayload = {
        id: user?._id.toString(),
        name: business?.name,
        image: business?.coverImage,
        email: user?.email,
        role: user?.role,
        isProfile: true,
        isActive: user?.isActive,
      };

      // const refreshTokenPayload = {
      //   email: user?.email,
      // };

      const accessToken = createAccessToken(accessTokenPayload);
      // const refreshToken = createRefreshToken(refreshTokenPayload);

      return {
        accessToken,
        // refreshToken,
      };
    } else if (role === ROLE.ORGANIZATION) {
      // ORGANIZATION PROFILE CREATION
      const isExistOrganization = await Organization.findOne({
        auth: user._id,
      });
      if (isExistOrganization) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Organization profile already exists.'
        );
      }

      const organizationPayload = {
        auth: user._id,

        name,
        serviceType,
        address,
        state,
        postalCode,
        website,

        phoneNumber,
        coverImage: organizationImage,

        boardMemberName,
        boardMemberEmail,
        boardMemberPhoneNumber,
        drivingLicenseURL,

        nameInCard,
        cardNumber,
        cardExpiryDate,
        cardCVC,

        tfnOrAbnNumber,
        zakatLicenseHolderNumber,
      };

      const [organization] = await Organization.create([organizationPayload], {
        session,
      });

      if (!organization) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Organization data not saved in database!'
        );
      }

      await Auth.findByIdAndUpdate(
        user._id,
        { role: ROLE.ORGANIZATION, isProfile: true },
        { session }
      );

      await session.commitTransaction();
      await session.endSession();

      const accessTokenPayload = {
        id: user._id.toString(),
        name: organization?.name,
        email: user.email,
        image: organization?.coverImage,
        role: user.role,
        isProfile: true,
        isActive: user?.isActive,
      };

      // const refreshTokenPayload = {
      //   email: user?.email,
      // };

      const accessToken = createAccessToken(accessTokenPayload);
      // const refreshToken = createRefreshToken(refreshTokenPayload);

      return {
        accessToken,
        // refreshToken,
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    // ❌ Roll back transaction in case of any error
    await session.abortTransaction();
    await session.endSession();

    // 🧼 Cleanup: Delete uploaded files to avoid storage bloat
    if (files && typeof files === 'object' && !Array.isArray(files)) {
      Object.values(files).forEach((fileArray) => {
        fileArray.forEach((file) => {
          try {
            if (file?.path && fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          } catch (deleteErr) {
            // eslint-disable-next-line no-console
            console.warn(
              'Failed to delete uploaded file:',
              file.path,
              deleteErr
            );
          }
        });
      });
    }

    // Re-throw application-specific errors
    if (error instanceof AppError) {
      throw error;
    }

    // Throw generic internal server error
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error?.message || 'Failed to create profile. Please try again!'
    );
  }
};

// 6. updatePhotoIntoDB
const updatePhotoIntoDB = async (
  user: IAuth,
  file: Express.Multer.File | undefined
) => {
  switch (user?.role) {
    case ROLE.CLIENT:
      return updateProfileImage(user, file, Client, 'image');
    case ROLE.BUSINESS:
      return updateProfileImage(user, file, Business, 'coverImage');
    case ROLE.ORGANIZATION:
      return updateProfileImage(user, file, Organization, 'coverImage');
    default:
      throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid role!');
  }
};

// 7. changePasswordIntoDB
const changePasswordIntoDB = async (
  payload: z.infer<typeof AuthValidation.changePasswordSchema.shape.body>,
  userData: IAuth
) => {
  // const user = await Auth.findOne({ _id: userData._id, isActive: true }).select(
  //   '+password'
  // );

  const user = await Auth.isUserExistsByEmail(userData.email);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User does not exist!');
  }

  if (!user.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This account is not active!');
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This account is deleted!');
  }

  const isCredentialsCorrect = await user.isPasswordMatched(
    payload.oldPassword
  );

  if (!isCredentialsCorrect) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Current password is not correct!'
    );
  }

  user.password = payload.newPassword;
  user.passwordChangedAt = new Date(Date.now() - 5000); // set 5 second before to avoid isJWTIssuedBeforePasswordChanged issue

  await user.save();

  let name: string = 'User';
  let image: string = defaultUserImage;

  if (user.role === ROLE.CLIENT) {
    const client = await Client.findOne({ auth: user._id });
    name = client?.name || 'User';
    image = client?.image || defaultUserImage;
  }

  if (user.role === ROLE.BUSINESS) {
    const business = await Business.findOne({ auth: user._id });
    name = business?.name || 'Business';
    image = business?.coverImage || defaultUserImage;
  }

  if (user.role === ROLE.ORGANIZATION) {
    const organization = await Organization.findOne({ auth: user._id });
    name = organization?.name || 'Organization';
    image = organization?.coverImage || defaultUserImage;
  }

  // Prepare user data for tokens
  const accessTokenPayload = {
    id: user._id.toString(),
    name,
    image,
    email: user.email,
    role: user.role,
    isProfile: user?.isProfile,
    isActive: user?.isActive,
  };

  const refreshTokenPayload = {
    email: user?.email,
  };

  const accessToken = createAccessToken(accessTokenPayload);
  const refreshToken = createRefreshToken(refreshTokenPayload);

  return {
    accessToken,
    refreshToken,
  };
};

// 8. forgotPassword - 1.(send Otp)
const forgotPassword = async (email: string) => {
  // const user = await Auth.findOne({ email, isActive: true });
  const user = await Auth.isUserExistsByEmail(email);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  if (!user.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This account is not active!');
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This account is deleted!');
  }

  const now = new Date();

  // If OTP exists and not expired, reuse it
  if (user.otp && user.otpExpiry && now < user.otpExpiry) {
    // Do nothing, just reuse existing OTP
    const remainingMs = user.otpExpiry.getTime() - now.getTime();
    const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));

    // await sendOtpEmail(email, user.otp, user.fullName || 'Guest');

    throw new AppError(
      httpStatus.NOT_FOUND,
      `Last OTP is valid till now, use that in ${remainingMinutes} minutes!`
    );
  } else {
    // Generate new OTP
    const otp = generateOtp();
    const otpExpiry = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    let name: string = 'User';

    if (user.role === ROLE.CLIENT) {
      const client = await Client.findOne({ auth: user._id });
      name = client?.name || 'User';
    }

    if (user.role === ROLE.BUSINESS) {
      const business = await Business.findOne({ auth: user._id });
      name = business?.name || 'Business';
    }

    if (user.role === ROLE.ORGANIZATION) {
      const organization = await Organization.findOne({ auth: user._id });
      name = organization?.name || 'Organization';
    }

    // Send OTP
    await sendOtpEmail({ email, otp, name });
  }

  // Issue token (just with email)
  const token = jwt.sign({ email }, config.jwt.otpSecret!, {
    expiresIn: config.jwt.otpSecretExpiresIn!,
  } as SignOptions);

  return { token };
};

// 9. sendForgotPasswordOtpAgain - 2.(send Otp Again)
const sendForgotPasswordOtpAgain = async (forgotPassToken: string) => {
  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(forgotPassToken, config.jwt.otpSecret!, {
      ignoreExpiration: true,
    }) as JwtPayload;
  } catch {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid token!');
  }
  const email = decoded.email;

  if (!email) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid token!');
  }

  // const user = await Auth.findOne({ email, isActive: true });
  const user = await Auth.isUserExistsByEmail(email);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  if (!user.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This account is not active!');
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This account is deleted!');
  }

  const now = new Date();

  // If OTP exists and not expired, reuse it
  if (user.otp && user.otpExpiry && now < user.otpExpiry) {
    // Do nothing, just reuse existing OTP
    const remainingMs = user.otpExpiry.getTime() - now.getTime();
    const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));

    // await sendOtpEmail(email, user.otp, user.fullName || 'Guest');

    throw new AppError(
      httpStatus.NOT_FOUND,
      `Last OTP is valid till now, use that in ${remainingMinutes} minutes!`
    );
  } else {
    // Generate new OTP
    const otp = generateOtp();
    const otpExpiry = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    let name: string = 'User';

    if (user.role === ROLE.CLIENT) {
      const client = await Client.findOne({ auth: user._id });
      name = client?.name || 'User';
    }

    if (user.role === ROLE.BUSINESS) {
      const business = await Business.findOne({ auth: user._id });
      name = business?.name || 'Business';
    }

    if (user.role === ROLE.ORGANIZATION) {
      const organization = await Organization.findOne({ auth: user._id });
      name = organization?.name || 'Organization';
    }

    // Send OTP
    await sendOtpEmail({ email, otp, name });
  }

  return null;
};

// 10. verifyOtpForForgotPassword - 3.(verify Otp)
const verifyOtpForForgotPassword = async (payload: {
  token: string;
  otp: string;
}) => {
  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(payload.token, config.jwt.otpSecret!, {
      ignoreExpiration: true,
    }) as JwtPayload;
  } catch {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid token!');
  }

  const email = decoded.email;

  // const user = await Auth.findOne({ email, isActive: true });
  const user = await Auth.isUserExistsByEmail(email);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  if (!user.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This account is not active!');
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This account is deleted!');
  }

  // Check if OTP expired
  if (!user.otp || !user.otpExpiry || Date.now() > user.otpExpiry.getTime()) {
    // Generate and send new OTP
    const newOtp = generateOtp();
    const newExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    user.otp = newOtp;
    user.otpExpiry = newExpiry;
    await user.save();

    let name: string = 'User';

    if (user.role === ROLE.CLIENT) {
      const client = await Client.findOne({ auth: user._id });
      name = client?.name || 'User';
    }

    if (user.role === ROLE.BUSINESS) {
      const business = await Business.findOne({ auth: user._id });
      name = business?.name || 'Business';
    }

    if (user.role === ROLE.ORGANIZATION) {
      const organization = await Organization.findOne({ auth: user._id });
      name = organization?.name || 'Organization';
    }

    await sendOtpEmail({ email, otp: newOtp, name });

    throw new AppError(
      httpStatus.BAD_REQUEST,
      'OTP expired. A new OTP has been sent again!'
    );
  }

  // Check if OTP matches
  if (user.otp !== payload.otp) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid OTP!');
  }

  // OTP verified → issue reset password token
  const resetPasswordToken = jwt.sign(
    {
      email: user.email,
      isResetPassword: true,
    },
    config.jwt.otpSecret!,
    { expiresIn: config.jwt.otpSecretExpiresIn! } as SignOptions
  );

  return { resetPasswordToken };
};

// 11. resetPasswordIntoDB - 4.(reset Password)
const resetPasswordIntoDB = async (
  resetPasswordToken: string,
  newPassword: string
) => {
  if (!resetPasswordToken) {
    throw new AppError(httpStatus.FORBIDDEN, 'Invalid reset password token!');
  }

  const payload = verifyToken(resetPasswordToken, config.jwt.otpSecret!) as {
    email: string;
    isResetPassword?: boolean;
  };

  if (!payload?.isResetPassword || !payload?.email) {
    throw new AppError(httpStatus.FORBIDDEN, 'Invalid reset password token!');
  }

  // const user = await Auth.findOne({ email: payload.email, isActive: true });
  const user = await Auth.isUserExistsByEmail(payload.email);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  if (!user.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This account is not active!');
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This account is deleted!');
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: true });

  return null;
};

// 12. fetchProfileFromDB
const fetchProfileFromDB = async (user: IAuth) => {
  if (user?.role === ROLE.CLIENT) {
    const client = await Client.findOne({ auth: user._id }).populate([
      {
        path: 'auth',
        select: 'email role isProfile',
      },
    ]);
    // .lean();

    return client;

    // return { ...client, preference };
    // return { ...client?.toObject(), preference };
  } else if (user?.role === ROLE.BUSINESS) {
    const business = await Business.findOne({ auth: user._id }).populate([
      {
        path: 'auth',
        select: 'email role isProfile',
      },
    ]);

    return business;

    // return { ...business?.toObject(), preference };
  } else if (user?.role === ROLE.ORGANIZATION) {
    const organization = await Organization.findOne({
      auth: user._id,
    }).populate([
      {
        path: 'auth',
        select: 'email role isProfile',
      },
    ]);

    return organization;

    // return { ...organization?.toObject(), preference };
  } else if (user?.role === ROLE.ADMIN) {
    return user;
  }
};

// 13. deactivateUserAccountFromDB
const deactivateUserAccountFromDB = async (
  user: IAuth,
  payload: TDeactiveAccountPayload
) => {
  const { email, password, deactivationReason } = payload;

  const currentUser = await Auth.findOne({
    _id: user._id,
    email: email,
  }).select('+password');

  if (!currentUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const isPasswordCorrect = currentUser.isPasswordMatched(password);

  if (!isPasswordCorrect) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid credentials');
  }

  const result = await Auth.findByIdAndUpdate(
    user._id,
    {
      $set: {
        isActive: false,
        deactivationReason,
        deactivatedAt: new Date(),
      },
    },
    {
      new: true,
      select: 'email name isActive deactivationReason deactivatedAt',
    }
  );

  return result;
};

// 14. deleteSpecificUserAccountFromDB
const deleteSpecificUserAccountFromDB = async (user: IAuth) => {
  const session = await startSession();

  try {
    session.startTransaction();

    const currentUser = await Auth.findById(user._id).session(session);

    if (!currentUser) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
    }

    currentUser.isDeleted = true;
    currentUser.isActive = false;

    await currentUser.save({ session });

    let name: string = 'User';

    if (user.role === ROLE.CLIENT) {
      const client = await Client.findOne({ auth: user._id })
        .select('_id')
        .session(session);

      if (client) {
        name = client?.name || 'User';

        const result = await Client.findByIdAndDelete(client._id, { session });

        if (!result) {
          throw new AppError(httpStatus.BAD_REQUEST, 'Client deletion failed!');
        }
      }
    } else if (user.role === ROLE.BUSINESS) {
      const business = await Business.findOne({ auth: user._id })
        .select('_id')
        .session(session);

      if (business) {
        name = business?.name || 'Business';

        const result = await Business.findByIdAndDelete(business._id, {
          session,
        });

        if (!result) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Business deletion failed!'
          );
        }
      }
    } else if (user.role === ROLE.ORGANIZATION) {
      const organization = await Organization.findOne({ auth: user._id })
        .select('_id')
        .session(session);

      if (organization) {
        name = organization?.name || 'Organization';

        const result = await Organization.findByIdAndDelete(organization._id, {
          session,
        });

        if (!result) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Organization deletion failed!'
          );
        }
      }
    }

    await session.commitTransaction();
    await session.endSession();
    return {
      email: currentUser.email,
      id: currentUser._id,
      name,
    };
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
};

// 15. getNewAccessTokenFromServer
const getNewAccessTokenFromServer = async (refreshToken: string) => {
  // checking if the given token is valid
  const decoded = verifyToken(
    refreshToken,
    config.jwt.refreshTokenExpiresIn!
  ) as JwtPayload;

  const { email, iat } = decoded;

  // checking if the user is exist
  const user = await Auth.isUserExistsByEmail(email);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  if (!user?.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This account is not active!');
  }

  if (user?.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This account is deleted!');
  }

  // checking if the any hacker using a token even-after the user changed the password
  if (
    user.passwordChangedAt &&
    user.isJWTIssuedBeforePasswordChanged(iat as number)
  ) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
  }

  let name: string = 'User';
  let image: string = defaultUserImage;

  if (user.role === ROLE.CLIENT) {
    const client = await Client.findOne({ auth: user._id });
    name = client?.name || 'User';
    image = client?.image || defaultUserImage;
  }

  if (user.role === ROLE.BUSINESS) {
    const business = await Business.findOne({ auth: user._id });
    name = business?.name || 'Business';
    image = business?.coverImage || defaultUserImage;
  }

  if (user.role === ROLE.ORGANIZATION) {
    const organization = await Organization.findOne({ auth: user._id });
    name = organization?.name || 'Organization';
    image = organization?.coverImage || defaultUserImage;
  }

  // Prepare user data for tokens
  const accessTokenPayload = {
    id: user?._id.toString(),
    name,
    image,
    email: user?.email,
    role: user?.role,
    isProfile: user?.isProfile,
    isActive: user?.isActive,
  };

  const accessToken = createAccessToken(accessTokenPayload);

  return {
    accessToken,
  };
};

// 16. updateAuthDataIntoDB
const updateAuthDataIntoDB = async (
  payload: { name: string },
  userData: IAuth
) => {
  const user = await Auth.findByIdAndUpdate(
    userData._id,
    {
      name: payload.name,
    },
    { new: true }
  );

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  if (!user?.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This account is not active!');
  }

  if (user?.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This account is deleted!');
  }

  let name: string = 'User';
  let image: string = defaultUserImage;

  if (user.role === ROLE.CLIENT) {
    const client = await Client.findOne({ auth: user._id });
    name = client?.name || 'User';
    image = client?.image || defaultUserImage;
  }

  if (user.role === ROLE.BUSINESS) {
    const business = await Business.findOne({ auth: user._id });
    name = business?.name || 'Business';
    image = business?.coverImage || defaultUserImage;
  }

  if (user.role === ROLE.ORGANIZATION) {
    const organization = await Organization.findOne({ auth: user._id });
    name = organization?.name || 'Organization';
    image = organization?.coverImage || defaultUserImage;
  }

  // Prepare user data for tokens
  const accessTokenPayload = {
    id: user._id.toString(),
    name,
    image,
    email: user.email,
    role: user.role,
    isProfile: user?.isProfile,
    isActive: user?.isActive,
  };

  const accessToken = createAccessToken(accessTokenPayload);

  return {
    accessToken,
  };
};

export const AuthService = {
  createAuthIntoDB,
  sendSignupOtpAgain,
  verifySignupOtpIntoDB,
  signinIntoDB,
  createProfileIntoDB,
  updatePhotoIntoDB,
  changePasswordIntoDB,
  forgotPassword,
  sendForgotPasswordOtpAgain,
  verifyOtpForForgotPassword,
  resetPasswordIntoDB,
  fetchProfileFromDB,
  deactivateUserAccountFromDB,
  deleteSpecificUserAccountFromDB,
  getNewAccessTokenFromServer,
  updateAuthDataIntoDB,
};
