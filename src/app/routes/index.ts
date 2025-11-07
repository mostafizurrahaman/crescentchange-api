import { Router } from 'express';
import { AuthRoutes } from '../modules/Auth/auth.route';
// import { AdminRoutes } from '../modules/Admin/admin.route';
// import { ClientRoutes } from '../modules/Client/client.route';
// import { OrganizationRoutes } from '../modules/Organization/organization.routes';
// import { BusinessRoutes } from '../modules/Business/business.routes';
// import { notificationRoutes } from '../modules/Notification/notification.routes';

import { DonationRoutes } from '../modules/Donation/donation.route';
import { CauseRoutes } from '../modules/Causes/causes.route';

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
    path: '/donation',
    route: DonationRoutes,
  },
  {
    path: '/cause',
    route: CauseRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
