import asyncHandler from '../utils/asyncHandler.js';
import * as securityAuditService from '../services/securityAudit.service.js';

export const getSecurityLogs = asyncHandler(async (req, res) => {
  const result = await securityAuditService.getSecurityAuditLogs(req.query, req.user);
  res.status(200).json({
    success: true,
    data: result.logs,
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    },
  });
});

export const getSecurityStats = asyncHandler(async (req, res) => {
  const stats = await securityAuditService.getSecurityStats(req.user);
  res.status(200).json({
    success: true,
    data: stats,
  });
});
