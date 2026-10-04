import asyncHandler from '../utils/asyncHandler.js';
import * as aiInsightService from '../services/aiInsight.service.js';

/**
 * Controller for AI Hostel Command Center & Smart Operations
 */

export const handleGetOverview = asyncHandler(async (req, res) => {
  const overview = await aiInsightService.getCommandCenterOverview(req.query, req.user);
  res.status(200).json({
    success: true,
    data: overview,
  });
});

export const handleGetHealthScore = asyncHandler(async (req, res) => {
  const healthScore = await aiInsightService.calculateOperationalHealthScore(req.query, req.user);
  res.status(200).json({
    success: true,
    data: healthScore,
  });
});

export const handleGetInsights = asyncHandler(async (req, res) => {
  const insights = await aiInsightService.generateOperationalInsights(req.query, req.user);
  res.status(200).json({
    success: true,
    data: insights,
  });
});

export const handleGetRecommendations = asyncHandler(async (req, res) => {
  const recommendations = await aiInsightService.generateExecutiveRecommendations(req.query, req.user);
  res.status(200).json({
    success: true,
    data: recommendations,
  });
});

export const handleAskAssistant = asyncHandler(async (req, res) => {
  const queryText = req.body?.query || req.query?.query || '';
  const answer = await aiInsightService.askOperationalAssistant(queryText, req.query, req.user);
  res.status(200).json({
    success: true,
    data: answer,
  });
});
