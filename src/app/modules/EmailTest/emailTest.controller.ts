import httpStatus from 'http-status';
import { asyncHandler, sendResponse } from '../../utils';
import { EmailTestService } from './emailTest.service';

const sendTestEmails = asyncHandler(async (req, res) => {
  const data = await EmailTestService.sendTestEmails(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: `All test emails sent together. ${data.sent} sent, ${data.failed} failed.`,
    data,
  });
});

export const EmailTestController = {
  sendTestEmails,
};
