import asyncHandler from '../utils/asyncHandler.js';
import * as messService from '../services/mess.service.js';

export const handleSubmitFeedback = asyncHandler(async (req, res) => {
  const feedback = await messService.submitFeedback(req.body, req.user);
  res.status(201).json({
    success: true,
    message: 'Meal feedback submitted successfully',
    data: feedback,
  });
});

export const handleGetMyFeedbacks = asyncHandler(async (req, res) => {
  const result = await messService.getMyFeedbacks(req.user, req.query);
  res.status(200).json({
    success: true,
    data: result.feedbacks,
    pagination: result.pagination,
  });
});

export const handleGetMessFeedbacks = asyncHandler(async (req, res) => {
  const result = await messService.getMessFeedbacks(req.query);
  res.status(200).json({
    success: true,
    data: result.feedbacks,
    pagination: result.pagination,
  });
});

export const handleGetFeedbackAnalytics = asyncHandler(async (req, res) => {
  const analytics = await messService.getFoodQualityAnalytics(req.user, req.query);
  res.status(200).json({
    success: true,
    data: analytics,
  });
});
