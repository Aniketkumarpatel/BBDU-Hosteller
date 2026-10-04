import mongoose from 'mongoose';
import Complaint from '../models/Complaint.js';
import ComplaintSlaCycle from '../models/ComplaintSlaCycle.js';
import ComplaintEscalation from '../models/ComplaintEscalation.js';
import Department from '../models/Department.js';
import Hostel from '../models/Hostel.js';
import User from '../models/User.js';
import { ROLES } from '../constants/roles.js';
import {
  COMPLAINT_STATUSES,
  COMPLAINT_STATUS_VALUES,
  COMPLAINT_PRIORITY_VALUES,
  COMPLAINT_CATEGORY_VALUES,
} from '../constants/complaint.constants.js';
import { SLA_STATUSES } from '../constants/sla.constants.js';
import ApiError from '../utils/ApiError.js';

/**
 * Builds the base MongoDB query filter based on User Role and Query Parameters
 */
export const buildAnalyticsFilter = (user, query = {}) => {
  if (!user || user.role === ROLES.STUDENT) {
    throw new ApiError(403, 'Access denied. Students cannot access operational analytics.');
  }

  const match = {};

  // 1. Role-based scoping
  if (user.role === ROLES.WARDEN) {
    if (!user.hostelId) {
      // Warden without assigned hostel matches nothing
      match.hostelId = new mongoose.Types.ObjectId('000000000000000000000000');
    } else {
      match.hostelId = new mongoose.Types.ObjectId(user.hostelId._id || user.hostelId);
    }
  } else if (user.role === ROLES.HOSTEL_STAFF) {
    const staffId = new mongoose.Types.ObjectId(user._id);
    if (user.departmentId) {
      const deptId = new mongoose.Types.ObjectId(user.departmentId._id || user.departmentId);
      match.$or = [{ assignedTo: staffId }, { departmentId: deptId }];
    } else {
      match.assignedTo = staffId;
    }
  } else if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.AUTHORITY) {
    // Admin / Authority can filter by hostel or department if supplied
    if (query.hostelId && mongoose.isValidObjectId(query.hostelId)) {
      match.hostelId = new mongoose.Types.ObjectId(query.hostelId);
    }
    if (query.departmentId && mongoose.isValidObjectId(query.departmentId)) {
      match.departmentId = new mongoose.Types.ObjectId(query.departmentId);
    }
  }

  // 2. Date Range Filtering
  const now = new Date();
  let start = null;
  let end = null;

  if (query.range === '7d') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    end = now;
  } else if (query.range === '30d') {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    end = now;
  } else if (query.range === '90d') {
    start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    end = now;
  } else if (query.range === 'all') {
    // No date boundary
  } else {
    // Check custom startDate / endDate or default to 30d
    if (query.startDate) {
      start = new Date(query.startDate);
      if (isNaN(start.getTime())) start = null;
    }
    if (query.endDate) {
      end = new Date(query.endDate);
      if (isNaN(end.getTime())) {
        end = null;
      } else {
        // Set end to end of day if it's just YYYY-MM-DD
        if (query.endDate.length <= 10) {
          end.setUTCHours(23, 59, 59, 999);
        }
      }
    }

    if (!start && !end && !query.range) {
      // Default to 30 days
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      end = now;
    }
  }

  if (start || end) {
    match.createdAt = {};
    if (start) match.createdAt.$gte = start;
    if (end) match.createdAt.$lte = end;
  }

  // 3. Additional optional filters
  if (query.category && COMPLAINT_CATEGORY_VALUES.includes(query.category.toUpperCase())) {
    match.category = query.category.toUpperCase();
  }
  if (query.priority && COMPLAINT_PRIORITY_VALUES.includes(query.priority.toUpperCase())) {
    match.priority = query.priority.toUpperCase();
  }
  if (query.status && COMPLAINT_STATUS_VALUES.includes(query.status.toUpperCase())) {
    match.status = query.status.toUpperCase();
  }
  if (query.slaStatus) {
    const sla = query.slaStatus.toUpperCase();
    if (sla === 'BREACHED') {
      match.slaStatus = SLA_STATUSES.BREACHED;
    } else if (sla === 'ACTIVE') {
      match.slaStatus = SLA_STATUSES.ACTIVE;
    } else if (sla === 'COMPLETED') {
      match.slaStatus = SLA_STATUSES.COMPLETED;
    }
  }

  return { match, dateRange: { start, end } };
};

/**
 * 1. Overview KPIs
 */
export const getOverviewKpis = async (user, query = {}) => {
  const { match } = buildAnalyticsFilter(user, query);
  const now = new Date();

  const [aggResult] = await Complaint.aggregate([
    { $match: match },
    {
      $facet: {
        total: [{ $count: 'count' }],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        slaBreached: [
          {
            $match: {
              $or: [{ slaStatus: 'BREACHED' }, { slaBreachedAt: { $ne: null } }],
            },
          },
          { $count: 'count' },
        ],
        escalated: [
          {
            $match: {
              $or: [
                { currentEscalationLevel: { $gt: 0 } },
                { status: 'ESCALATED' },
                { escalationCount: { $gt: 0 } },
              ],
            },
          },
          { $count: 'count' },
        ],
        reopened: [
          {
            $match: {
              $or: [{ status: 'REOPENED' }, { reopenCount: { $gt: 0 } }],
            },
          },
          { $count: 'count' },
        ],
        resolutionTimes: [
          {
            $match: {
              resolvedAt: { $ne: null },
              submittedAt: { $ne: null },
            },
          },
          {
            $project: {
              durationMs: { $subtract: ['$resolvedAt', '$submittedAt'] },
            },
          },
          {
            $group: {
              _id: null,
              avgMs: { $avg: '$durationMs' },
              minMs: { $min: '$durationMs' },
              maxMs: { $max: '$durationMs' },
            },
          },
        ],
        firstResponseTimes: [
          {
            $project: {
              firstResponseAt: {
                $ifNull: ['$acknowledgedAt', { $ifNull: ['$assignedAt', '$triagedAt'] }],
              },
              submittedAt: '$submittedAt',
            },
          },
          {
            $match: {
              firstResponseAt: { $ne: null },
              submittedAt: { $ne: null },
            },
          },
          {
            $project: {
              responseDurationMs: { $subtract: ['$firstResponseAt', '$submittedAt'] },
            },
          },
          {
            $group: {
              _id: null,
              avgMs: { $avg: '$responseDurationMs' },
            },
          },
        ],
        openOlderThanSla: [
          {
            $match: {
              status: {
                $in: [
                  COMPLAINT_STATUSES.SUBMITTED,
                  COMPLAINT_STATUSES.TRIAGED,
                  COMPLAINT_STATUSES.ASSIGNED,
                  COMPLAINT_STATUSES.ACKNOWLEDGED,
                  COMPLAINT_STATUSES.IN_PROGRESS,
                  COMPLAINT_STATUSES.WAITING_FOR_INFORMATION,
                  COMPLAINT_STATUSES.REOPENED,
                  COMPLAINT_STATUSES.ESCALATED,
                ],
              },
              $or: [
                { slaStatus: 'BREACHED' },
                { slaDueAt: { $lt: now, $ne: null } },
              ],
            },
          },
          { $count: 'count' },
        ],
      },
    },
  ]);

  const totalComplaints = aggResult.total[0]?.count || 0;
  const statusMap = (aggResult.byStatus || []).reduce((acc, curr) => {
    acc[curr._id] = curr.count;
    return acc;
  }, {});

  const openStatuses = [
    COMPLAINT_STATUSES.SUBMITTED,
    COMPLAINT_STATUSES.TRIAGED,
    COMPLAINT_STATUSES.ASSIGNED,
    COMPLAINT_STATUSES.ACKNOWLEDGED,
    COMPLAINT_STATUSES.IN_PROGRESS,
    COMPLAINT_STATUSES.WAITING_FOR_INFORMATION,
    COMPLAINT_STATUSES.REOPENED,
    COMPLAINT_STATUSES.ESCALATED,
  ];

  const openComplaints = openStatuses.reduce((sum, s) => sum + (statusMap[s] || 0), 0);
  const inProgressComplaints = statusMap[COMPLAINT_STATUSES.IN_PROGRESS] || 0;
  const resolvedComplaints =
    (statusMap[COMPLAINT_STATUSES.RESOLVED] || 0) +
    (statusMap[COMPLAINT_STATUSES.STUDENT_VERIFICATION] || 0) +
    (statusMap[COMPLAINT_STATUSES.CLOSED] || 0);
  const closedComplaints = statusMap[COMPLAINT_STATUSES.CLOSED] || 0;
  const reopenedComplaints = aggResult.reopened[0]?.count || 0;
  const escalatedComplaints = aggResult.escalated[0]?.count || 0;
  const slaBreachedComplaints = aggResult.slaBreached[0]?.count || 0;

  // Compliance % = ((Total - Breached) / Total) * 100
  const slaComplianceRate =
    totalComplaints > 0
      ? Number((((totalComplaints - slaBreachedComplaints) / totalComplaints) * 100).toFixed(1))
      : 100.0;

  const avgResMs = aggResult.resolutionTimes[0]?.avgMs || 0;
  const avgResolutionTimeHours = Number((avgResMs / (1000 * 3600)).toFixed(1));

  const avgFirstRespMs = aggResult.firstResponseTimes[0]?.avgMs || 0;
  const avgFirstResponseTimeHours = Number((avgFirstRespMs / (1000 * 3600)).toFixed(1));

  const openComplaintsOlderThanSla = aggResult.openOlderThanSla[0]?.count || 0;

  return {
    totalComplaints,
    openComplaints,
    inProgressComplaints,
    resolvedComplaints,
    closedComplaints,
    reopenedComplaints,
    escalatedComplaints,
    slaBreachedComplaints,
    slaComplianceRate,
    avgResolutionTimeHours,
    avgResolutionTimeMs: Math.round(avgResMs),
    avgFirstResponseTimeHours,
    avgFirstResponseTimeMs: Math.round(avgFirstRespMs),
    openComplaintsOlderThanSla,
  };
};

/**
 * 2. Time-series Complaint Trends
 */
export const getComplaintTrends = async (user, query = {}) => {
  const { match, dateRange } = buildAnalyticsFilter(user, query);
  const groupBy = query.groupBy || 'day';

  let dateToStringFormat = '%Y-%m-%d';
  if (groupBy === 'month') {
    dateToStringFormat = '%Y-%m';
  } else if (groupBy === 'week') {
    dateToStringFormat = '%Y-W%V';
  }

  const rawTrends = await Complaint.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { format: dateToStringFormat, date: '$createdAt' },
        },
        submitted: { $sum: 1 },
        resolved: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$status',
                  [
                    COMPLAINT_STATUSES.RESOLVED,
                    COMPLAINT_STATUSES.STUDENT_VERIFICATION,
                    COMPLAINT_STATUSES.CLOSED,
                  ],
                ],
              },
              1,
              0,
            ],
          },
        },
        breached: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$slaStatus', 'BREACHED'] },
                  { $ne: ['$slaBreachedAt', null] },
                ],
              },
              1,
              0,
            ],
          },
        },
        escalated: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $gt: ['$currentEscalationLevel', 0] },
                  { $eq: ['$status', 'ESCALATED'] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const trends = rawTrends.map((t) => ({
    date: t._id,
    submitted: t.submitted,
    resolved: t.resolved,
    breached: t.breached,
    escalated: t.escalated,
  }));

  return { trends, groupBy, dateRange };
};

/**
 * 3. Status Distribution
 */
export const getStatusDistribution = async (user, query = {}) => {
  const { match } = buildAnalyticsFilter(user, query);

  const rawCounts = await Complaint.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const total = rawCounts.reduce((acc, curr) => acc + curr.count, 0);

  const distribution = rawCounts.map((item) => ({
    status: item._id,
    count: item.count,
    percentage: total > 0 ? Number(((item.count / total) * 100).toFixed(1)) : 0,
  }));

  return { distribution, total };
};

/**
 * 4. Category Analytics
 */
export const getCategoryAnalytics = async (user, query = {}) => {
  const { match } = buildAnalyticsFilter(user, query);

  const rawCategories = await Complaint.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        breachedCount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$slaStatus', 'BREACHED'] },
                  { $ne: ['$slaBreachedAt', null] },
                ],
              },
              1,
              0,
            ],
          },
        },
        resolvedCount: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$status',
                  [
                    COMPLAINT_STATUSES.RESOLVED,
                    COMPLAINT_STATUSES.STUDENT_VERIFICATION,
                    COMPLAINT_STATUSES.CLOSED,
                  ],
                ],
              },
              1,
              0,
            ],
          },
        },
        avgResolutionMs: {
          $avg: {
            $cond: [
              { $and: [{ $ne: ['$resolvedAt', null] }, { $ne: ['$submittedAt', null] }] },
              { $subtract: ['$resolvedAt', '$submittedAt'] },
              null,
            ],
          },
        },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const total = rawCategories.reduce((acc, curr) => acc + curr.count, 0);

  const categories = rawCategories.map((c) => ({
    category: c._id,
    count: c.count,
    percentage: total > 0 ? Number(((c.count / total) * 100).toFixed(1)) : 0,
    breachedCount: c.breachedCount,
    breachRate: c.count > 0 ? Number(((c.breachedCount / c.count) * 100).toFixed(1)) : 0,
    resolvedCount: c.resolvedCount,
    avgResolutionHours: c.avgResolutionMs
      ? Number((c.avgResolutionMs / (1000 * 3600)).toFixed(1))
      : 0,
  }));

  return { categories, total };
};

/**
 * 5. Priority Analytics
 */
export const getPriorityAnalytics = async (user, query = {}) => {
  const { match } = buildAnalyticsFilter(user, query);

  const rawPriorities = await Complaint.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 },
        breachedCount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$slaStatus', 'BREACHED'] },
                  { $ne: ['$slaBreachedAt', null] },
                ],
              },
              1,
              0,
            ],
          },
        },
        escalatedCount: {
          $sum: {
            $cond: [{ $gt: ['$currentEscalationLevel', 0] }, 1, 0],
          },
        },
        avgResolutionMs: {
          $avg: {
            $cond: [
              { $and: [{ $ne: ['$resolvedAt', null] }, { $ne: ['$submittedAt', null] }] },
              { $subtract: ['$resolvedAt', '$submittedAt'] },
              null,
            ],
          },
        },
      },
    },
  ]);

  const total = rawPriorities.reduce((acc, curr) => acc + curr.count, 0);

  // Order priority logically: CRITICAL, HIGH, MEDIUM, LOW
  const priorityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const priorities = priorityOrder.map((pName) => {
    const found = rawPriorities.find((r) => r._id === pName) || {
      count: 0,
      breachedCount: 0,
      escalatedCount: 0,
      avgResolutionMs: 0,
    };
    return {
      priority: pName,
      count: found.count,
      percentage: total > 0 ? Number(((found.count / total) * 100).toFixed(1)) : 0,
      breachedCount: found.breachedCount,
      breachRate: found.count > 0 ? Number(((found.breachedCount / found.count) * 100).toFixed(1)) : 0,
      escalatedCount: found.escalatedCount,
      avgResolutionHours: found.avgResolutionMs
        ? Number((found.avgResolutionMs / (1000 * 3600)).toFixed(1))
        : 0,
    };
  });

  return { priorities, total };
};

/**
 * 6. Department Performance
 */
export const getDepartmentPerformance = async (user, query = {}) => {
  const { match } = buildAnalyticsFilter(user, query);

  const rawDepartments = await Complaint.aggregate([
    { $match: { ...match, departmentId: { $ne: null } } },
    {
      $group: {
        _id: '$departmentId',
        total: { $sum: 1 },
        inProgress: {
          $sum: {
            $cond: [{ $eq: ['$status', COMPLAINT_STATUSES.IN_PROGRESS] }, 1, 0],
          },
        },
        resolved: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$status',
                  [
                    COMPLAINT_STATUSES.RESOLVED,
                    COMPLAINT_STATUSES.STUDENT_VERIFICATION,
                    COMPLAINT_STATUSES.CLOSED,
                  ],
                ],
              },
              1,
              0,
            ],
          },
        },
        breached: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$slaStatus', 'BREACHED'] },
                  { $ne: ['$slaBreachedAt', null] },
                ],
              },
              1,
              0,
            ],
          },
        },
        avgResolutionMs: {
          $avg: {
            $cond: [
              { $and: [{ $ne: ['$resolvedAt', null] }, { $ne: ['$submittedAt', null] }] },
              { $subtract: ['$resolvedAt', '$submittedAt'] },
              null,
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'departments',
        localField: '_id',
        foreignField: '_id',
        as: 'dept',
      },
    },
    { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
    { $sort: { total: -1 } },
  ]);

  const departments = rawDepartments.map((d) => {
    const complianceRate =
      d.total > 0 ? Number((((d.total - d.breached) / d.total) * 100).toFixed(1)) : 100.0;
    return {
      departmentId: d._id,
      name: d.dept?.name || 'Unassigned / General',
      code: d.dept?.code || 'N/A',
      total: d.total,
      inProgress: d.inProgress,
      resolved: d.resolved,
      breached: d.breached,
      complianceRate,
      avgResolutionHours: d.avgResolutionMs
        ? Number((d.avgResolutionMs / (1000 * 3600)).toFixed(1))
        : 0,
    };
  });

  return { departments };
};

/**
 * 7. Hostel Performance
 */
export const getHostelPerformance = async (user, query = {}) => {
  const { match } = buildAnalyticsFilter(user, query);

  const rawHostels = await Complaint.aggregate([
    { $match: { ...match, hostelId: { $ne: null } } },
    {
      $group: {
        _id: '$hostelId',
        total: { $sum: 1 },
        open: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$status',
                  [
                    COMPLAINT_STATUSES.SUBMITTED,
                    COMPLAINT_STATUSES.TRIAGED,
                    COMPLAINT_STATUSES.ASSIGNED,
                    COMPLAINT_STATUSES.ACKNOWLEDGED,
                    COMPLAINT_STATUSES.IN_PROGRESS,
                    COMPLAINT_STATUSES.WAITING_FOR_INFORMATION,
                    COMPLAINT_STATUSES.REOPENED,
                    COMPLAINT_STATUSES.ESCALATED,
                  ],
                ],
              },
              1,
              0,
            ],
          },
        },
        resolved: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$status',
                  [
                    COMPLAINT_STATUSES.RESOLVED,
                    COMPLAINT_STATUSES.STUDENT_VERIFICATION,
                    COMPLAINT_STATUSES.CLOSED,
                  ],
                ],
              },
              1,
              0,
            ],
          },
        },
        breached: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$slaStatus', 'BREACHED'] },
                  { $ne: ['$slaBreachedAt', null] },
                ],
              },
              1,
              0,
            ],
          },
        },
        escalated: {
          $sum: {
            $cond: [{ $gt: ['$currentEscalationLevel', 0] }, 1, 0],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'hostels',
        localField: '_id',
        foreignField: '_id',
        as: 'hostel',
      },
    },
    { $unwind: { path: '$hostel', preserveNullAndEmptyArrays: true } },
    { $sort: { total: -1 } },
  ]);

  const hostels = rawHostels.map((h) => {
    const complianceRate =
      h.total > 0 ? Number((((h.total - h.breached) / h.total) * 100).toFixed(1)) : 100.0;
    return {
      hostelId: h._id,
      name: h.hostel?.name || 'Unknown Hostel',
      code: h.hostel?.code || 'N/A',
      type: h.hostel?.type || 'COED',
      total: h.total,
      open: h.open,
      resolved: h.resolved,
      breached: h.breached,
      escalated: h.escalated,
      complianceRate,
    };
  });

  return { hostels };
};

/**
 * 8. SLA Performance (Detailed cycle breakdown)
 */
export const getSlaPerformance = async (user, query = {}) => {
  const { match } = buildAnalyticsFilter(user, query);

  // Match complaint IDs from current scope
  const matchingComplaints = await Complaint.find(match).select('_id').lean();
  const complaintIds = matchingComplaints.map((c) => c._id);

  const cycleMatch = { complaintId: { $in: complaintIds } };

  const [cycleStats] = await ComplaintSlaCycle.aggregate([
    { $match: cycleMatch },
    {
      $facet: {
        totalCycles: [{ $count: 'count' }],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byLevel: [{ $group: { _id: '$escalationLevel', count: { $sum: 1 } } }],
      },
    },
  ]);

  const totalCycles = cycleStats?.totalCycles[0]?.count || 0;
  const statusCounts = (cycleStats?.byStatus || []).reduce((acc, curr) => {
    acc[curr._id] = curr.count;
    return acc;
  }, {});

  const cyclesByLevel = (cycleStats?.byLevel || []).map((l) => ({
    level: l._id,
    count: l.count,
  }));

  // Overview from complaints
  const totalInScope = matchingComplaints.length;
  const breachedCount = await Complaint.countDocuments({
    ...match,
    $or: [{ slaStatus: 'BREACHED' }, { slaBreachedAt: { $ne: null } }],
  });

  const complianceRate =
    totalInScope > 0
      ? Number((((totalInScope - breachedCount) / totalInScope) * 100).toFixed(1))
      : 100.0;

  return {
    totalComplaints: totalInScope,
    slaBreachedComplaints: breachedCount,
    complianceRate,
    totalCycles,
    activeCycles: statusCounts.ACTIVE || 0,
    breachedCycles: statusCounts.BREACHED || 0,
    completedCycles: statusCounts.COMPLETED || 0,
    cyclesByLevel,
  };
};

/**
 * 9. Escalation Analytics
 */
export const getEscalationAnalytics = async (user, query = {}) => {
  const { match } = buildAnalyticsFilter(user, query);

  const matchingComplaints = await Complaint.find(match).select('_id').lean();
  const complaintIds = matchingComplaints.map((c) => c._id);

  const escalationMatch = { complaintId: { $in: complaintIds } };

  const [escalationsByLevel, escalationsByTrigger, recentEscalations] = await Promise.all([
    ComplaintEscalation.aggregate([
      { $match: escalationMatch },
      { $group: { _id: '$escalationLevel', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    ComplaintEscalation.aggregate([
      { $match: escalationMatch },
      { $group: { _id: '$triggeredBy', count: { $sum: 1 } } },
    ]),
    ComplaintEscalation.find(escalationMatch)
      .populate('complaintId', 'complaintId title category priority')
      .populate('fromUserId', 'name role')
      .populate('toUserId', 'name role')
      .sort({ triggeredAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const levelMap = {
    1: 'Level 1 (Staff → Warden)',
    2: 'Level 2 (Warden → Authority)',
    3: 'Level 3 (Authority → Super Admin)',
  };

  const byLevel = escalationsByLevel.map((el) => ({
    level: el._id,
    label: levelMap[el._id] || `Level ${el._id}`,
    count: el.count,
  }));

  const byTrigger = escalationsByTrigger.map((et) => ({
    trigger: et._id || 'SYSTEM',
    count: et.count,
  }));

  const totalEscalations = escalationsByLevel.reduce((sum, item) => sum + item.count, 0);

  return {
    totalEscalations,
    byLevel,
    byTrigger,
    recentEscalations: recentEscalations.map((e) => ({
      id: e._id,
      complaintRef: e.complaintId?.complaintId || 'Unknown',
      title: e.complaintId?.title || '',
      category: e.complaintId?.category || '',
      priority: e.complaintId?.priority || '',
      fromRole: e.fromRole,
      fromUser: e.fromUserId?.name || 'N/A',
      toRole: e.toRole,
      toUser: e.toUserId?.name || 'N/A',
      level: e.escalationLevel,
      reason: e.reason,
      triggeredBy: e.triggeredBy,
      triggeredAt: e.triggeredAt,
    })),
  };
};

/**
 * 10. Staff Workload & Performance
 */
export const getWorkloadAnalytics = async (user, query = {}) => {
  const { match } = buildAnalyticsFilter(user, query);

  const rawStaff = await Complaint.aggregate([
    { $match: { ...match, assignedTo: { $ne: null } } },
    {
      $group: {
        _id: '$assignedTo',
        totalAssigned: { $sum: 1 },
        active: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$status',
                  [
                    COMPLAINT_STATUSES.ASSIGNED,
                    COMPLAINT_STATUSES.ACKNOWLEDGED,
                    COMPLAINT_STATUSES.IN_PROGRESS,
                  ],
                ],
              },
              1,
              0,
            ],
          },
        },
        resolved: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$status',
                  [
                    COMPLAINT_STATUSES.RESOLVED,
                    COMPLAINT_STATUSES.STUDENT_VERIFICATION,
                    COMPLAINT_STATUSES.CLOSED,
                  ],
                ],
              },
              1,
              0,
            ],
          },
        },
        breached: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$slaStatus', 'BREACHED'] },
                  { $ne: ['$slaBreachedAt', null] },
                ],
              },
              1,
              0,
            ],
          },
        },
        avgResolutionMs: {
          $avg: {
            $cond: [
              { $and: [{ $ne: ['$resolvedAt', null] }, { $ne: ['$submittedAt', null] }] },
              { $subtract: ['$resolvedAt', '$submittedAt'] },
              null,
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $sort: { totalAssigned: -1 } },
  ]);

  const workload = rawStaff.map((s) => ({
    userId: s._id,
    name: s.user?.name || 'Staff Member',
    email: s.user?.email || '',
    role: s.user?.role || 'HOSTEL_STAFF',
    totalAssigned: s.totalAssigned,
    active: s.active,
    resolved: s.resolved,
    breached: s.breached,
    resolutionRate:
      s.totalAssigned > 0 ? Number(((s.resolved / s.totalAssigned) * 100).toFixed(1)) : 0,
    avgResolutionHours: s.avgResolutionMs
      ? Number((s.avgResolutionMs / (1000 * 3600)).toFixed(1))
      : 0,
  }));

  return { workload };
};

/**
 * 11. Export CSV
 */
export const exportAnalyticsCsv = async (user, type = 'complaints', query = {}) => {
  const { match } = buildAnalyticsFilter(user, query);

  if (type === 'departments') {
    const { departments } = await getDepartmentPerformance(user, query);
    const headers = ['Department Name', 'Code', 'Total Complaints', 'In Progress', 'Resolved', 'SLA Breached', 'Compliance Rate (%)', 'Avg Resolution (Hours)'];
    const rows = departments.map((d) => [
      `"${d.name.replace(/"/g, '""')}"`,
      `"${d.code}"`,
      d.total,
      d.inProgress,
      d.resolved,
      d.breached,
      `${d.complianceRate}%`,
      d.avgResolutionHours,
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  if (type === 'hostels') {
    const { hostels } = await getHostelPerformance(user, query);
    const headers = ['Hostel Name', 'Code', 'Type', 'Total Complaints', 'Open', 'Resolved', 'SLA Breached', 'Escalated', 'Compliance Rate (%)'];
    const rows = hostels.map((h) => [
      `"${h.name.replace(/"/g, '""')}"`,
      `"${h.code}"`,
      h.type,
      h.total,
      h.open,
      h.resolved,
      h.breached,
      h.escalated,
      `${h.complianceRate}%`,
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  if (type === 'workload') {
    const { workload } = await getWorkloadAnalytics(user, query);
    const headers = ['Staff Name', 'Email', 'Role', 'Total Assigned', 'Active Work', 'Resolved', 'SLA Breached', 'Resolution Rate (%)', 'Avg Resolution (Hours)'];
    const rows = workload.map((w) => [
      `"${w.name.replace(/"/g, '""')}"`,
      `"${w.email}"`,
      w.role,
      w.totalAssigned,
      w.active,
      w.resolved,
      w.breached,
      `${w.resolutionRate}%`,
      w.avgResolutionHours,
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  // Default: detailed complaints list CSV
  const complaints = await Complaint.find(match)
    .populate('hostelId', 'name code')
    .populate('departmentId', 'name code')
    .populate('assignedTo', 'name')
    .populate('studentId', 'name studentId')
    .sort({ createdAt: -1 })
    .limit(2000)
    .lean();

  const headers = [
    'Complaint ID',
    'Title',
    'Category',
    'Priority',
    'Status',
    'Hostel',
    'Department',
    'Student Name',
    'Assigned To',
    'SLA Status',
    'Escalation Level',
    'Submitted At',
    'Resolved At',
  ];

  const rows = complaints.map((c) => [
    `"${c.complaintId}"`,
    `"${(c.title || '').replace(/"/g, '""')}"`,
    `"${c.category}"`,
    `"${c.priority}"`,
    `"${c.status}"`,
    `"${(c.hostelId?.name || '').replace(/"/g, '""')}"`,
    `"${(c.departmentId?.name || 'N/A').replace(/"/g, '""')}"`,
    `"${(c.studentId?.name || '').replace(/"/g, '""')}"`,
    `"${(c.assignedTo?.name || 'Unassigned').replace(/"/g, '""')}"`,
    `"${c.slaStatus || 'NONE'}"`,
    c.currentEscalationLevel || 0,
    c.createdAt ? new Date(c.createdAt).toISOString() : '',
    c.resolvedAt ? new Date(c.resolvedAt).toISOString() : '',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
};
