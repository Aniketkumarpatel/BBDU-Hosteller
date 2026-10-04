import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import adminRoutes from './admin.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import complaintRoutes from './complaint.routes.js';
import slaRuleRoutes from './slaRule.routes.js';
import escalationRuleRoutes from './escalationRule.routes.js';
import notificationRoutes from './notification.routes.js';
import analyticsRoutes from './analytics.routes.js';
import workOrderRoutes from './workOrder.routes.js';
import assetRoutes from './asset.routes.js';
import maintenancePlanRoutes from './maintenancePlan.routes.js';
import maintenanceRoutes from './maintenance.routes.js';
import messRoutes from './mess.routes.js';
import messFeedbackRoutes from './messFeedback.routes.js';
import messNoticeRoutes from './messNotice.routes.js';
import cleaningRoutes from './cleaning.routes.js';
import outpassRoutes from './outpass.routes.js';
import aiCommandCenterRoutes from './aiCommandCenter.routes.js';
import financeRoutes from './finance.routes.js';
import studentServicesRoutes from './studentServices.routes.js';

const router = Router();

// Public health check
router.use('/health', healthRoutes);

// Authentication & Profile
router.use('/auth', authRoutes);

// Role-based dashboard stats
router.use('/dashboard', dashboardRoutes);

// Operational Analytics & Intelligence
router.use('/analytics', analyticsRoutes);

// Maintenance & Work Orders (Step 8)
router.use('/work-orders', workOrderRoutes);

// Asset Management (Step 8)
router.use('/assets', assetRoutes);

// Preventive Maintenance & Smart Scheduling (Step 9)
router.use('/maintenance-plans', maintenancePlanRoutes);
router.use('/maintenance', maintenanceRoutes);

// Mess & Food Quality Management (Step 10)
router.use('/messes', messRoutes);
router.use('/mess-feedback', messFeedbackRoutes);
router.use('/mess-notices', messNoticeRoutes);

// Cleaning & Housekeeping Management (Step 11)
router.use('/cleaning', cleaningRoutes);

// Visitor & Outpass Management (Step 12)
router.use('/outpass', outpassRoutes);

// AI Hostel Command Center & Smart Operations (Step 13)
router.use('/ai-command-center', aiCommandCenterRoutes);

// Hostel Finance & Expense Management (Step 15)
router.use('/finance', financeRoutes);

// Student Services & Digital Communication (Step 16)
router.use('/student-services', studentServicesRoutes);

// Complaints operations
router.use('/complaints', complaintRoutes);

// Notifications
router.use('/notifications', notificationRoutes);

// SLA & Escalation management (Super Admin)
router.use('/sla-rules', slaRuleRoutes);
router.use('/escalation-rules', escalationRuleRoutes);

// Super-admin protected operations
router.use('/admin', adminRoutes);

export default router;
