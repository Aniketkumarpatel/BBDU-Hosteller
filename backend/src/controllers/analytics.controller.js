import asyncHandler from '../utils/asyncHandler.js';
import {
  getOverviewKpis,
  getComplaintTrends,
  getStatusDistribution,
  getCategoryAnalytics,
  getPriorityAnalytics,
  getDepartmentPerformance,
  getHostelPerformance,
  getSlaPerformance,
  getEscalationAnalytics,
  getWorkloadAnalytics,
  exportAnalyticsCsv,
} from '../services/analytics.service.js';

export const getOverview = asyncHandler(async (req, res) => {
  const data = await getOverviewKpis(req.user, req.query);
  res.status(200).json({ success: true, data });
});

export const getTrends = asyncHandler(async (req, res) => {
  const data = await getComplaintTrends(req.user, req.query);
  res.status(200).json({ success: true, data });
});

export const getStatusStats = asyncHandler(async (req, res) => {
  const data = await getStatusDistribution(req.user, req.query);
  res.status(200).json({ success: true, data });
});

export const getCategories = asyncHandler(async (req, res) => {
  const data = await getCategoryAnalytics(req.user, req.query);
  res.status(200).json({ success: true, data });
});

export const getPriorities = asyncHandler(async (req, res) => {
  const data = await getPriorityAnalytics(req.user, req.query);
  res.status(200).json({ success: true, data });
});

export const getDepartments = asyncHandler(async (req, res) => {
  const data = await getDepartmentPerformance(req.user, req.query);
  res.status(200).json({ success: true, data });
});

export const getHostels = asyncHandler(async (req, res) => {
  const data = await getHostelPerformance(req.user, req.query);
  res.status(200).json({ success: true, data });
});

export const getSla = asyncHandler(async (req, res) => {
  const data = await getSlaPerformance(req.user, req.query);
  res.status(200).json({ success: true, data });
});

export const getEscalations = asyncHandler(async (req, res) => {
  const data = await getEscalationAnalytics(req.user, req.query);
  res.status(200).json({ success: true, data });
});

export const getWorkload = asyncHandler(async (req, res) => {
  const data = await getWorkloadAnalytics(req.user, req.query);
  res.status(200).json({ success: true, data });
});

export const exportCsv = asyncHandler(async (req, res) => {
  const type = req.query.type || 'complaints';
  const csvData = await exportAnalyticsCsv(req.user, type, req.query);

  const filename = `bbdu_analytics_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csvData);
});
