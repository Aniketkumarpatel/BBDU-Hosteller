import asyncHandler from '../utils/asyncHandler.js';
import * as messService from '../services/mess.service.js';

export const handleCreateNotice = asyncHandler(async (req, res) => {
  const notice = await messService.createNotice(req.body, req.user);
  res.status(201).json({
    success: true,
    message: 'Mess notice posted successfully',
    data: notice,
  });
});

export const handleGetNotices = asyncHandler(async (req, res) => {
  const { messId } = req.query;
  const notices = await messService.getNotices(messId, req.query);
  res.status(200).json({
    success: true,
    data: notices,
  });
});

export const handleToggleNoticeActive = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const notice = await messService.toggleNoticeActive(req.params.id, isActive, req.user);
  res.status(200).json({
    success: true,
    message: `Notice ${notice.isActive ? 'activated' : 'deactivated'} successfully`,
    data: notice,
  });
});
