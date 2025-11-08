import { Types, Document, startSession } from 'mongoose';
import Notification from './notification.model';
import QueryBuilder from 'mongoose-query-builders';
import { IAuth } from '../Auth/auth.interface';
import { AppError } from '../../utils';
import httpStatus from 'http-status';

interface INotification extends Document {
  _id: Types.ObjectId;
  title: string;
  message: string;
  receiver: Types.ObjectId;
  sender?: Types.ObjectId;
  type: string;
  relatedId?: Types.ObjectId;
  isSeen: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const getAllNotifications = async (
  user: IAuth,
  query: Record<string, unknown>
) => {
  const baseQuery = Notification.find({ receiver: user.id });

  const builder = new QueryBuilder(baseQuery, query);

  builder.search(['title', 'message']).filter().sort().paginate().fields();

  const data = await builder.modelQuery.exec();

  const meta = await builder.countTotal();

  return {
    meta: {
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
      totalPages: meta.totalPage,
    },
    data,
  };
};

const markNotificationAsSeen = async (notificationId: string) => {
  const updated = await Notification.findByIdAndUpdate(
    notificationId,
    { isSeen: true },
    { new: true }
  );
  return updated;
};

const getAllUnseenNotificationCount = async (userId: string) => {
  const result = await Notification.aggregate([
    {
      $match: {
        receiver: new Types.ObjectId(userId),
        isSeen: false,
      },
    },
    {
      $count: 'unseenCount',
    },
  ]);

  return result[0]?.unseenCount || 0;
};

const createNotification = async (
  receiverId: string,
  type: string,
  message: string,
  relatedId?: string,
  session?: typeof startSession
) => {
  try {
    const notificationData = {
      title: type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      message,
      receiver: new Types.ObjectId(receiverId),
      type,
      relatedId: relatedId ? new Types.ObjectId(relatedId) : undefined,
    };

    if (session) {
      const notification = await Notification.create([notificationData], { session });
      return notification[0];
    } else {
      const notification = await Notification.create(notificationData);
      return notification;
    }
  } catch (error: unknown) {
    console.warn('Failed to create notification:', error);
    // Don't throw error to avoid breaking main flow
    return null;
  }
};

export const notificationService = {
  getAllNotifications,
  markNotificationAsSeen,
  getAllUnseenNotificationCount,
  createNotification,
};

// Export createNotification for direct import
export { createNotification };
