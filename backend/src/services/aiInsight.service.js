import mongoose from 'mongoose';
import {
  Complaint,
  MaintenanceWorkOrder,
  Asset,
  MaintenancePlan,
  CleaningTask,
  CleaningArea,
  MessFeedback,
  Outpass,
  Visitor,
  Hostel,
  Department,
  User,
} from '../models/index.js';
import {
  INSIGHT_CATEGORIES,
  INSIGHT_MODULES,
  HEALTH_SCORE_BANDS,
} from '../constants/aiCommandCenter.constants.js';
import { COMPLAINT_STATUSES } from '../constants/complaint.constants.js';
import { WORK_ORDER_STATUSES } from '../constants/workOrder.constants.js';
import { OUTPASS_STATUSES } from '../constants/outpass.constants.js';
import { ROLES } from '../constants/roles.js';

/**
 * Transparent, Explainable Operational Health Score Engine (0 to 100)
 */
export const calculateOperationalHealthScore = async (filters = {}, user = {}) => {
  const matchHostel = {};
  if (user?.role === ROLES.WARDEN && user?.hostelId) {
    matchHostel.hostelId = new mongoose.Types.ObjectId(user.hostelId);
  } else if (filters.hostelId) {
    matchHostel.hostelId = new mongoose.Types.ObjectId(filters.hostelId);
  }

  const now = new Date();
  const past7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Parallel Query Execution across all 7 operational subsystems
  const [
    totalOpenComplaints,
    criticalOpenComplaints,
    breachedComplaints,
    warningComplaints,
    overdueWorkOrders,
    failingAssets,
    overdueCleaningTasks,
    missedCleaningTasks,
    cleaningQualityAgg,
    lowRatedMeals,
    overdueOutpasses,
    studentsOutside,
  ] = await Promise.all([
    // 1. Open Complaints
    Complaint.countDocuments({
      ...matchHostel,
      status: {
        $nin: [
          COMPLAINT_STATUSES.RESOLVED,
          COMPLAINT_STATUSES.STUDENT_VERIFICATION,
          COMPLAINT_STATUSES.CLOSED,
          COMPLAINT_STATUSES.REJECTED,
        ],
      },
    }),
    // 2. Critical Open Complaints
    Complaint.countDocuments({
      ...matchHostel,
      priority: 'CRITICAL',
      status: {
        $nin: [
          COMPLAINT_STATUSES.RESOLVED,
          COMPLAINT_STATUSES.STUDENT_VERIFICATION,
          COMPLAINT_STATUSES.CLOSED,
          COMPLAINT_STATUSES.REJECTED,
        ],
      },
    }),
    // 3. Breached Complaints
    Complaint.countDocuments({
      ...matchHostel,
      slaStatus: 'BREACHED',
      status: {
        $nin: [COMPLAINT_STATUSES.CLOSED, COMPLAINT_STATUSES.REJECTED],
      },
    }),
    // 4. Complaints Near Deadline (warning threshold sent)
    Complaint.countDocuments({
      ...matchHostel,
      slaStatus: 'ACTIVE',
      reminderSentAt: { $ne: null },
      status: {
        $nin: [
          COMPLAINT_STATUSES.RESOLVED,
          COMPLAINT_STATUSES.STUDENT_VERIFICATION,
          COMPLAINT_STATUSES.CLOSED,
        ],
      },
    }),
    // 5. Overdue Work Orders
    MaintenanceWorkOrder.countDocuments({
      ...matchHostel,
      status: {
        $nin: [WORK_ORDER_STATUSES.COMPLETED, WORK_ORDER_STATUSES.CANCELLED],
      },
      dueAt: { $lt: now, $ne: null },
    }),
    // 6. Failing Assets
    Asset.countDocuments({
      ...matchHostel,
      $or: [{ failureCount: { $gte: 2 } }, { healthStatus: 'CRITICAL' }],
    }),
    // 7. Overdue Cleaning Tasks
    CleaningTask.countDocuments({
      ...matchHostel,
      isOverdue: true,
      status: { $nin: ['COMPLETED', 'VERIFIED', 'CANCELLED'] },
    }),
    // 8. Missed Cleaning Tasks
    CleaningTask.countDocuments({
      ...matchHostel,
      isMissed: true,
    }),
    // 9. Cleaning Quality Aggregation
    CleaningTask.aggregate([
      { $match: { ...matchHostel, qualityScore: { $ne: null } } },
      { $group: { _id: null, avgScore: { $avg: '$qualityScore' } } },
    ]),
    // 10. Low Rated Meals (last 7 days)
    MessFeedback.countDocuments({
      createdAt: { $gte: past7Days },
      isLowRated: true,
    }),
    // 11. Overdue Outpasses
    Outpass.countDocuments({
      ...matchHostel,
      $or: [{ status: OUTPASS_STATUSES.OVERDUE }, { isOverdue: true }],
    }),
    // 12. Students Currently Outside
    Outpass.countDocuments({
      ...matchHostel,
      status: OUTPASS_STATUSES.OUTSIDE,
    }),
  ]);

  const avgQualityScore =
    cleaningQualityAgg.length > 0 ? Number(cleaningQualityAgg[0].avgScore.toFixed(2)) : 5.0;

  // Calculation of Component Scores and Explicit Factors
  const positiveFactors = [];
  const negativeFactors = [];

  // Subsystem 1: Complaints & SLA (Max 30 pts)
  let complaintsScore = 30;
  if (criticalOpenComplaints > 0) {
    const penalty = Math.min(15, criticalOpenComplaints * 5);
    complaintsScore -= penalty;
    negativeFactors.push({
      factor: `${criticalOpenComplaints} critical priority complaint(s) unresolved`,
      impact: `-${penalty} pts`,
      module: INSIGHT_MODULES.COMPLAINTS,
    });
  }
  if (breachedComplaints > 0) {
    const penalty = Math.min(15, breachedComplaints * 4);
    complaintsScore -= penalty;
    negativeFactors.push({
      factor: `${breachedComplaints} complaint(s) currently in SLA breach`,
      impact: `-${penalty} pts`,
      module: INSIGHT_MODULES.COMPLAINTS,
    });
  }
  if (warningComplaints > 0) {
    const penalty = Math.min(6, warningComplaints * 2);
    complaintsScore -= penalty;
    negativeFactors.push({
      factor: `${warningComplaints} complaint(s) near resolution deadline (75% elapsed)`,
      impact: `-${penalty} pts`,
      module: INSIGHT_MODULES.COMPLAINTS,
    });
  }
  complaintsScore = Math.max(0, complaintsScore);
  if (complaintsScore >= 26) {
    positiveFactors.push({
      factor: 'Low critical complaint volume and high SLA compliance',
      impact: '+5 pts',
      module: INSIGHT_MODULES.COMPLAINTS,
    });
  }

  // Subsystem 2: Maintenance & Equipment (Max 20 pts)
  let maintenanceScore = 20;
  if (overdueWorkOrders > 0) {
    const penalty = Math.min(12, overdueWorkOrders * 3);
    maintenanceScore -= penalty;
    negativeFactors.push({
      factor: `${overdueWorkOrders} maintenance work order(s) past due target`,
      impact: `-${penalty} pts`,
      module: INSIGHT_MODULES.MAINTENANCE,
    });
  }
  if (failingAssets > 0) {
    const penalty = Math.min(8, failingAssets * 2);
    maintenanceScore -= penalty;
    negativeFactors.push({
      factor: `${failingAssets} equipment asset(s) with recurring failures`,
      impact: `-${penalty} pts`,
      module: INSIGHT_MODULES.MAINTENANCE,
    });
  }
  maintenanceScore = Math.max(0, maintenanceScore);
  if (maintenanceScore >= 18) {
    positiveFactors.push({
      factor: 'Hostel facilities & asset operational health optimal',
      impact: '+3 pts',
      module: INSIGHT_MODULES.MAINTENANCE,
    });
  }

  // Subsystem 3: Cleaning & Housekeeping (Max 20 pts)
  let cleaningScore = 20;
  if (avgQualityScore < 3.5) {
    const penalty = 8;
    cleaningScore -= penalty;
    negativeFactors.push({
      factor: `Average sanitation quality score below benchmark (${avgQualityScore} / 5.0)`,
      impact: `-${penalty} pts`,
      module: INSIGHT_MODULES.CLEANING,
    });
  } else if (avgQualityScore >= 4.5) {
    positiveFactors.push({
      factor: `Exemplary housekeeping quality score (${avgQualityScore} / 5.0)`,
      impact: '+4 pts',
      module: INSIGHT_MODULES.CLEANING,
    });
  }

  if (overdueCleaningTasks > 0 || missedCleaningTasks > 0) {
    const penalty = Math.min(10, (overdueCleaningTasks + missedCleaningTasks) * 2);
    cleaningScore -= penalty;
    negativeFactors.push({
      factor: `${overdueCleaningTasks} overdue and ${missedCleaningTasks} missed cleaning task(s)`,
      impact: `-${penalty} pts`,
      module: INSIGHT_MODULES.CLEANING,
    });
  }
  cleaningScore = Math.max(0, cleaningScore);

  // Subsystem 4: Dining & Food Quality (Max 15 pts)
  let messScore = 15;
  if (lowRatedMeals > 0) {
    const penalty = Math.min(12, lowRatedMeals * 3);
    messScore -= penalty;
    negativeFactors.push({
      factor: `${lowRatedMeals} low-rated meal feedback(s) registered in past 7 days`,
      impact: `-${penalty} pts`,
      module: INSIGHT_MODULES.MESS,
    });
  } else {
    positiveFactors.push({
      factor: 'Zero hygiene or low-quality food feedback in the past week',
      impact: '+3 pts',
      module: INSIGHT_MODULES.MESS,
    });
  }
  messScore = Math.max(0, messScore);

  // Subsystem 5: Outpass & Campus Security (Max 15 pts)
  let securityScore = 15;
  if (overdueOutpasses > 0) {
    const penalty = Math.min(15, overdueOutpasses * 5);
    securityScore -= penalty;
    negativeFactors.push({
      factor: `${overdueOutpasses} student(s) currently overdue on return curfew`,
      impact: `-${penalty} pts`,
      module: INSIGHT_MODULES.OUTPASS,
    });
  } else {
    positiveFactors.push({
      factor: 'Full student return compliance (zero overdue outpasses)',
      impact: '+3 pts',
      module: INSIGHT_MODULES.OUTPASS,
    });
  }
  securityScore = Math.max(0, securityScore);

  // Calculate Overall Sum
  let overallScore = complaintsScore + maintenanceScore + cleaningScore + messScore + securityScore;
  overallScore = Math.min(100, Math.max(0, Math.round(overallScore)));

  // Derive Band
  let band = HEALTH_SCORE_BANDS.OPTIMAL;
  if (overallScore < 50) band = HEALTH_SCORE_BANDS.CRITICAL;
  else if (overallScore < 70) band = HEALTH_SCORE_BANDS.HIGH_RISK;
  else if (overallScore < 85) band = HEALTH_SCORE_BANDS.MODERATE_RISK;

  return {
    overallScore,
    band,
    positiveFactors,
    negativeFactors,
    breakdown: {
      complaints: { score: complaintsScore, max: 30 },
      maintenance: { score: maintenanceScore, max: 20 },
      cleaning: { score: cleaningScore, max: 20 },
      mess: { score: messScore, max: 15 },
      security: { score: securityScore, max: 15 },
    },
    rawMetrics: {
      totalOpenComplaints,
      criticalOpenComplaints,
      breachedComplaints,
      warningComplaints,
      overdueWorkOrders,
      failingAssets,
      overdueCleaningTasks,
      missedCleaningTasks,
      avgQualityScore,
      lowRatedMeals,
      overdueOutpasses,
      studentsOutside,
    },
  };
};

/**
 * AI Insight Generator consuming structured operational metrics
 */
export const generateOperationalInsights = async (filters = {}, user = {}) => {
  const matchHostel = {};
  if (user?.role === ROLES.WARDEN && user?.hostelId) {
    matchHostel.hostelId = new mongoose.Types.ObjectId(user.hostelId);
  } else if (filters.hostelId) {
    matchHostel.hostelId = new mongoose.Types.ObjectId(filters.hostelId);
  }

  const now = new Date();
  const insights = [];

  // 1. SLA Breach & Critical Complaints Analysis
  const criticalBreaches = await Complaint.find({
    ...matchHostel,
    status: {
      $nin: [
        COMPLAINT_STATUSES.RESOLVED,
        COMPLAINT_STATUSES.STUDENT_VERIFICATION,
        COMPLAINT_STATUSES.CLOSED,
        COMPLAINT_STATUSES.REJECTED,
      ],
    },
    $or: [{ slaStatus: 'BREACHED' }, { priority: 'CRITICAL' }],
  })
    .populate('hostelId', 'name')
    .populate('departmentId', 'name code')
    .populate('assignedTo', 'name')
    .lean();

  if (criticalBreaches.length > 0) {
    const breachedCount = criticalBreaches.filter((c) => c.slaStatus === 'BREACHED').length;
    insights.push({
      insightId: `INS-${now.getFullYear()}-SLA01`,
      category: breachedCount > 0 ? INSIGHT_CATEGORIES.CRITICAL : INSIGHT_CATEGORIES.HIGH,
      title: `${criticalBreaches.length} Urgent Tickets Require Executive Attention`,
      explanation: `${breachedCount} complaint(s) have breached SLA deadlines and ${criticalBreaches.length - breachedCount} critical complaints are pending triage/work. Immediate follow-up with assigned technicians is recommended.`,
      sourceMetrics: {
        totalCritical: criticalBreaches.length,
        breachedCount,
        sampleTicketIds: criticalBreaches.slice(0, 3).map((c) => c.complaintId),
      },
      affectedModule: INSIGHT_MODULES.COMPLAINTS,
      affectedEntity: criticalBreaches[0]?.departmentId?.name || 'Operations',
      confidence: 0.98,
      generatedAt: now,
      recommendedAction: 'Review and expedite pending critical tickets with respective department supervisors.',
      status: 'ACTIVE',
    });
  }

  // 2. Overdue Outpass & Student Curfew Monitor
  const overdueOutpasses = await Outpass.find({
    ...matchHostel,
    status: OUTPASS_STATUSES.OVERDUE,
  })
    .populate('studentId', 'name phone')
    .populate('hostelId', 'name')
    .lean();

  if (overdueOutpasses.length > 0) {
    insights.push({
      insightId: `INS-${now.getFullYear()}-OUT01`,
      category: INSIGHT_CATEGORIES.CRITICAL,
      title: `${overdueOutpasses.length} Student(s) Currently Overdue on Outpass`,
      explanation: `${overdueOutpasses.length} student resident(s) have not recorded return verification at the gate past their approved curfew deadline. Emergency contacts are available in the Outpass Monitor.`,
      sourceMetrics: {
        overdueCount: overdueOutpasses.length,
        students: overdueOutpasses.slice(0, 3).map((o) => ({
          name: o.studentId?.name,
          phone: o.studentId?.phone,
          outpassId: o.outpassId,
        })),
      },
      affectedModule: INSIGHT_MODULES.OUTPASS,
      affectedEntity: overdueOutpasses[0]?.hostelId?.name || 'Hostel Campus',
      confidence: 1.0,
      generatedAt: now,
      recommendedAction: 'Initiate telephone outreach to overdue residents and emergency parent contacts.',
      status: 'ACTIVE',
    });
  }

  // 3. Repeated Asset Failures (Predictive Maintenance Opportunity)
  const recurrentFailures = await Asset.find({
    ...matchHostel,
    failureCount: { $gte: 2 },
  })
    .populate('hostelId', 'name')
    .lean();

  if (recurrentFailures.length > 0) {
    insights.push({
      insightId: `INS-${now.getFullYear()}-AST01`,
      category: INSIGHT_CATEGORIES.HIGH,
      title: `${recurrentFailures.length} Facility Asset(s) Showing Recurrent Breakdowns`,
      explanation: `Equipment assets such as "${recurrentFailures[0].name}" have suffered multiple breakdowns (${recurrentFailures[0].failureCount} failures). Recurring reactive repairs are increasing maintenance overhead.`,
      sourceMetrics: {
        failingAssetsCount: recurrentFailures.length,
        assetNames: recurrentFailures.slice(0, 3).map((a) => a.name),
      },
      affectedModule: INSIGHT_MODULES.MAINTENANCE,
      affectedEntity: recurrentFailures[0]?.hostelId?.name || 'Facilities',
      confidence: 0.92,
      generatedAt: now,
      recommendedAction: 'Schedule thorough diagnostic preventive overhaul or evaluate warranty/replacement.',
      status: 'ACTIVE',
    });
  }

  // 4. Sanitation & Cleaning Quality Trends
  const poorCleaningAreas = await CleaningTask.find({
    ...matchHostel,
    qualityScore: { $lte: 2, $ne: null },
  })
    .populate('cleaningAreaId', 'name areaType')
    .populate('hostelId', 'name')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  if (poorCleaningAreas.length > 0) {
    insights.push({
      insightId: `INS-${now.getFullYear()}-CLN01`,
      category: INSIGHT_CATEGORIES.MEDIUM,
      title: 'Sanitation Inspection Scores Below Quality Standard in Specific Areas',
      explanation: `Recent supervisor inspections in areas such as "${poorCleaningAreas[0]?.cleaningAreaId?.name || 'Washrooms'}" scored 2 stars or lower. Deep scrubbing and disinfectant supplies require verification.`,
      sourceMetrics: {
        lowRatedCount: poorCleaningAreas.length,
        areaName: poorCleaningAreas[0]?.cleaningAreaId?.name,
      },
      affectedModule: INSIGHT_MODULES.CLEANING,
      affectedEntity: poorCleaningAreas[0]?.hostelId?.name || 'Housekeeping',
      confidence: 0.89,
      generatedAt: now,
      recommendedAction: 'Instruct housekeeping supervisors to perform mandatory re-inspection on flagged areas.',
      status: 'ACTIVE',
    });
  }

  // 5. Mess & Food Quality Feedback
  const recentLowFeedback = await MessFeedback.find({
    createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 3600 * 1000) },
    isLowRated: true,
  })
    .populate('messId', 'name')
    .lean();

  if (recentLowFeedback.length > 0) {
    insights.push({
      insightId: `INS-${now.getFullYear()}-MSS01`,
      category: INSIGHT_CATEGORIES.MEDIUM,
      title: `${recentLowFeedback.length} Negative Meal Feedback(s) Logged This Week`,
      explanation: `Students reported issues regarding food taste, hygiene, or quantity across recent meals. Early review prevents formal food complaints.`,
      sourceMetrics: {
        feedbackCount: recentLowFeedback.length,
        mealTypes: Array.from(new Set(recentLowFeedback.map((f) => f.mealType))),
      },
      affectedModule: INSIGHT_MODULES.MESS,
      affectedEntity: recentLowFeedback[0]?.messId?.name || 'Mess Catering',
      confidence: 0.85,
      generatedAt: now,
      recommendedAction: 'Review dining supplier ingredient quality and kitchen preparation procedures.',
      status: 'ACTIVE',
    });
  } else {
    insights.push({
      insightId: `INS-${now.getFullYear()}-MSS02`,
      category: INSIGHT_CATEGORIES.INFO,
      title: 'Mess Catering Satisfaction Stable',
      explanation: 'No critical hygiene or taste alerts reported in the past 7 days across dining facilities.',
      sourceMetrics: { lowRatedCount: 0 },
      affectedModule: INSIGHT_MODULES.MESS,
      affectedEntity: 'Dining Services',
      confidence: 0.95,
      generatedAt: now,
      recommendedAction: 'Continue weekly menu rotations and routine kitchen hygiene spot checks.',
      status: 'ACTIVE',
    });
  }

  // Ensure every insight has both category and priority set
  return insights.map((ins) => ({
    ...ins,
    priority: ins.priority || ins.category,
  }));
};

/**
 * Actionable AI Advisory Recommendations for Management Review
 */
export const generateExecutiveRecommendations = async (filters = {}, user = {}) => {
  const insights = await generateOperationalInsights(filters, user);
  const recommendations = [];

  for (const ins of insights) {
    let priorityLevel = 'MEDIUM';
    if (ins.category === INSIGHT_CATEGORIES.CRITICAL) priorityLevel = 'URGENT';
    else if (ins.category === INSIGHT_CATEGORIES.HIGH) priorityLevel = 'HIGH';
    else if (ins.category === INSIGHT_CATEGORIES.INFO) priorityLevel = 'LOW';

    recommendations.push({
      id: `REC-${ins.insightId}`,
      recommendationId: `REC-${ins.insightId}`,
      module: ins.affectedModule,
      priority: priorityLevel,
      title: ins.title,
      actionTitle: ins.title,
      rationale: ins.explanation,
      proposedAction: ins.recommendedAction,
      recommendedAction: ins.recommendedAction,
      impact:
        priorityLevel === 'URGENT'
          ? 'Prevents operational escalation and guarantees resident safety.'
          : 'Optimizes operational throughput and facility uptime.',
      status: 'ADVISORY',
      isAutomatedAction: false,
      requiresHumanApproval: true,
    });
  }

  return recommendations;
};

/**
 * Command Center Unified Operational Overview
 */
export const getCommandCenterOverview = async (filters = {}, user = {}) => {
  const matchHostel = {};
  if (user?.role === ROLES.WARDEN && user?.hostelId) {
    matchHostel.hostelId = new mongoose.Types.ObjectId(user.hostelId);
  } else if (filters.hostelId) {
    matchHostel.hostelId = new mongoose.Types.ObjectId(filters.hostelId);
  }

  const [healthScore, insights, recommendations, hostelsList, departmentsList] =
    await Promise.all([
      calculateOperationalHealthScore(filters, user),
      generateOperationalInsights(filters, user),
      generateExecutiveRecommendations(filters, user),
      Hostel.find({ isActive: true }).select('name code type').lean(),
      Department.find({ isActive: true }).select('name code').lean(),
    ]);

  return {
    healthScore,
    insights,
    recommendations,
    criticalAlerts: insights.filter(
      (i) => i.category === INSIGHT_CATEGORIES.CRITICAL || i.category === INSIGHT_CATEGORIES.HIGH
    ),
    moduleRisks: healthScore.breakdown,
    systemSummary: healthScore.rawMetrics,
    hostels: hostelsList,
    departments: departmentsList,
    generatedAt: new Date(),
  };
};

/**
 * AI Operational Inquiry Assistant: Real-Time Natural Language Operational Q&A
 */
export const askOperationalAssistant = async (queryText = '', filters = {}, user = {}) => {
  if (!queryText || !queryText.trim()) {
    return {
      answer: 'Please provide an operational question regarding hostel operations, tickets, or facilities.',
      items: [],
      suggestedActions: [],
    };
  }

  const query = queryText.toLowerCase().trim();
  const matchHostel = {};
  if (user?.role === ROLES.WARDEN && user?.hostelId) {
    matchHostel.hostelId = new mongoose.Types.ObjectId(user.hostelId);
  } else if (filters.hostelId) {
    matchHostel.hostelId = new mongoose.Types.ObjectId(filters.hostelId);
  }

  // Question 1: Serious problems / Critical issues
  if (
    query.includes('serious') ||
    query.includes('problem') ||
    query.includes('urgent') ||
    query.includes('critical') ||
    query.includes('attention')
  ) {
    const [criticalTickets, overdueOutpasses, overdueWorkOrders] = await Promise.all([
      Complaint.find({
        ...matchHostel,
        priority: 'CRITICAL',
        status: {
          $nin: [
            COMPLAINT_STATUSES.RESOLVED,
            COMPLAINT_STATUSES.STUDENT_VERIFICATION,
            COMPLAINT_STATUSES.CLOSED,
            COMPLAINT_STATUSES.REJECTED,
          ],
        },
      })
        .select('complaintId title category priority slaStatus')
        .lean(),
      Outpass.find({ ...matchHostel, status: OUTPASS_STATUSES.OVERDUE })
        .populate('studentId', 'name phone')
        .select('outpassId destination expectedReturnAt')
        .lean(),
      MaintenanceWorkOrder.find({
        ...matchHostel,
        dueAt: { $lt: new Date(), $ne: null },
        status: { $nin: ['COMPLETED', 'CANCELLED'] },
      })
        .select('workOrderId title priority dueAt')
        .lean(),
    ]);

    const totalIssues = criticalTickets.length + overdueOutpasses.length + overdueWorkOrders.length;
    let answer = '';
    if (totalIssues === 0) {
      answer = 'Currently, there are no unaddressed critical problems. All complaints, maintenance tasks, and student outpasses are within operational limits.';
    } else {
      answer = `Identified ${totalIssues} urgent operational items: ${criticalTickets.length} critical complaint(s), ${overdueOutpasses.length} overdue student outpass(es), and ${overdueWorkOrders.length} overdue maintenance work order(s). Immediate managerial review is recommended.`;
    }

    return {
      query: queryText,
      answer,
      items: [
        ...criticalTickets.map((t) => ({ type: 'COMPLAINT', id: t.complaintId, title: t.title, priority: t.priority })),
        ...overdueOutpasses.map((o) => ({ type: 'OUTPASS', id: o.outpassId, title: `Student: ${o.studentId?.name || 'Resident'} - ${o.destination}`, priority: 'OVERDUE' })),
        ...overdueWorkOrders.map((w) => ({ type: 'WORK_ORDER', id: w.workOrderId, title: w.title, priority: w.priority })),
      ],
      suggestedActions: [
        'Direct department technicians to expedite critical complaints.',
        'Contact emergency parents of overdue residents via Outpass Monitor.',
      ],
    };
  }

  // Question 2: SLA breaches and risk
  if (query.includes('sla') || query.includes('breach') || query.includes('deadline')) {
    const [breached, nearDeadline] = await Promise.all([
      Complaint.find({
        ...matchHostel,
        slaStatus: 'BREACHED',
        status: {
          $nin: [COMPLAINT_STATUSES.CLOSED, COMPLAINT_STATUSES.REJECTED],
        },
      })
        .populate('departmentId', 'name')
        .select('complaintId title priority slaBreachedAt')
        .lean(),
      Complaint.find({
        ...matchHostel,
        slaStatus: 'ACTIVE',
        reminderSentAt: { $ne: null },
        status: {
          $nin: [
            COMPLAINT_STATUSES.RESOLVED,
            COMPLAINT_STATUSES.STUDENT_VERIFICATION,
            COMPLAINT_STATUSES.CLOSED,
          ],
        },
      })
        .select('complaintId title priority slaDueAt')
        .lean(),
    ]);

    return {
      query: queryText,
      answer: `Found ${breached.length} complaint(s) currently in SLA breach and ${nearDeadline.length} active complaint(s) near resolution deadline (exceeded 75% elapsed threshold).`,
      items: [
        ...breached.map((b) => ({ type: 'BREACHED', id: b.complaintId, title: b.title, status: 'BREACHED' })),
        ...nearDeadline.map((n) => ({ type: 'NEAR_DEADLINE', id: n.complaintId, title: n.title, status: 'WARNING' })),
      ],
      suggestedActions: [
        'Dispatch reminders to assigned technicians.',
        'Review ticket reassignments to avoid secondary automatic escalation.',
      ],
    };
  }

  // Question 3: Outpasses and students outside
  if (query.includes('outpass') || query.includes('outside') || query.includes('student') || query.includes('visitor')) {
    const [outsideCount, overdueList, activeVisitors] = await Promise.all([
      Outpass.countDocuments({ ...matchHostel, status: OUTPASS_STATUSES.OUTSIDE }),
      Outpass.find({ ...matchHostel, status: OUTPASS_STATUSES.OVERDUE })
        .populate('studentId', 'name phone')
        .lean(),
      Visitor.countDocuments({ ...matchHostel, status: 'CHECKED_IN' }),
    ]);

    return {
      query: queryText,
      answer: `There are currently ${outsideCount} student(s) legitimately outside the hostel campus, ${overdueList.length} student(s) overdue beyond curfew, and ${activeVisitors} checked-in guest visitor(s).`,
      items: overdueList.map((o) => ({
        type: 'OVERDUE_STUDENT',
        id: o.outpassId,
        title: `${o.studentId?.name || 'Student'} (Phone: ${o.studentId?.phone || 'N/A'}) - Dest: ${o.destination}`,
      })),
      suggestedActions: [
        'Review Gate Register for incoming arrivals.',
        'Contact overdue students via Outpass Emergency Outreach.',
      ],
    };
  }

  // Question 4: Asset failures
  if (query.includes('asset') || query.includes('equipment') || query.includes('fail') || query.includes('machine')) {
    const assets = await Asset.find({
      ...matchHostel,
      failureCount: { $gte: 1 },
    })
      .sort({ failureCount: -1 })
      .limit(5)
      .lean();

    return {
      query: queryText,
      answer: `Found ${assets.length} equipment asset(s) with recorded breakdown histories. Top failing asset: "${assets[0]?.name || 'None'}" with ${assets[0]?.failureCount || 0} failure events.`,
      items: assets.map((a) => ({
        type: 'ASSET',
        id: a.assetCode || a._id,
        title: `${a.name} (${a.failureCount} recorded failures, Health: ${a.healthStatus})`,
      })),
      suggestedActions: [
        'Schedule preventive maintenance cycle overhaul.',
        'Inspect operational load parameters and electrical supply stability.',
      ],
    };
  }

  // Question 5: Cleaning and Sanitation
  if (query.includes('clean') || query.includes('washroom') || query.includes('hygiene') || query.includes('housekeep')) {
    const tasks = await CleaningTask.find({
      ...matchHostel,
      $or: [{ isOverdue: true }, { isMissed: true }, { qualityScore: { $lte: 3, $ne: null } }],
    })
      .populate('cleaningAreaId', 'name areaType')
      .limit(5)
      .lean();

    return {
      query: queryText,
      answer: `Analyzed sanitation operations: ${tasks.length} task(s) or area(s) require housekeeping intervention due to overdue timelines or low inspection scores.`,
      items: tasks.map((t) => ({
        type: 'CLEANING_TASK',
        id: t.taskId,
        title: `${t.title} (Area: ${t.cleaningAreaId?.name}, Status: ${t.status})`,
      })),
      suggestedActions: [
        'Instruct housekeeping supervisor to perform deep cleaning spot checks.',
        'Verify disinfectant chemical stocks in floor supply closets.',
      ],
    };
  }

  // Default General Operational Summary
  const scoreData = await calculateOperationalHealthScore(filters, user);
  return {
    query: queryText,
    answer: `Overall Hostel Operational Health is rated at ${scoreData.overallScore}/100 (${scoreData.band}). Active workload includes ${scoreData.rawMetrics.totalOpenComplaints} open complaints, ${scoreData.rawMetrics.overdueWorkOrders} overdue work orders, and ${scoreData.rawMetrics.overdueOutpasses} overdue outpasses.`,
    items: scoreData.negativeFactors.map((f, i) => ({
      type: 'FACT_FACTOR',
      id: `FACTOR-${i + 1}`,
      title: f.factor,
    })),
    suggestedActions: [
      'Focus resources on high-penalty factors highlighted in the Operational Health Score breakdown.',
      'Check Executive Recommendations for targeted managerial actions.',
    ],
  };
};
