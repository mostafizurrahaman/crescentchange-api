import { Router } from 'express';
import { AuthRoutes } from '../modules/Auth/auth.route';
// import { AdminRoutes } from '../modules/Admin/admin.route';
// import { ClientRoutes } from '../modules/Client/client.route';
// import { OrganizationRoutes } from '../modules/Organization/organization.routes';
// import { BusinessRoutes } from '../modules/Business/business.routes';
// import { notificationRoutes } from '../modules/Notification/notification.routes';
import { contentRoutes } from '../modules/Page/page.route';
import { DonationReceiptRoutes } from '../modules/DonationReceipt/donationReceipt.route';
import { RoundUpRoutes } from '../modules/RoundUp/roundUp.route';

const router = Router();

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthRoutes,
  },
  // {
  //   path: '/admin',
  //   route: AdminRoutes,
  // },
  // {
  //   path: '/client',
  //   route: ClientRoutes,
  // },
  // {
  //   path: '/organization',
  //   route: OrganizationRoutes,
  // },

  // {
  //   path: '/business',
  //   route: BusinessRoutes,
  // },
  // {
  //   path: '/notification',
  //   route: notificationRoutes,
  // },
  {
    path: '/content',
    route: contentRoutes,
  },
  {
    path: '/donation-receipts',
    route: DonationReceiptRoutes,
  },
  {
    path: '/round-up',
    route: RoundUpRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
