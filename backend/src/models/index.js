import User from './User.js';
import Hostel from './Hostel.js';
import Block from './Block.js';
import Floor from './Floor.js';
import Room from './Room.js';
import Department from './Department.js';
import Complaint from './Complaint.js';
import ComplaintAssignment from './ComplaintAssignment.js';
import ComplaintResolution from './ComplaintResolution.js';
import Counter from './Counter.js';
import SlaRule from './SlaRule.js';
import EscalationRule from './EscalationRule.js';
import ComplaintEscalation from './ComplaintEscalation.js';
import ComplaintSlaCycle from './ComplaintSlaCycle.js';
import Notification from './Notification.js';
import Asset from './Asset.js';
import MaintenanceWorkOrder from './MaintenanceWorkOrder.js';
import MaintenancePlan from './MaintenancePlan.js';
import MaintenanceCycle from './MaintenanceCycle.js';
import Mess from './Mess.js';
import MessMenu from './MessMenu.js';
import MessFeedback from './MessFeedback.js';
import MessNotice from './MessNotice.js';
import CleaningArea from './CleaningArea.js';
import CleaningPlan from './CleaningPlan.js';
import CleaningTask from './CleaningTask.js';
import Outpass from './Outpass.js';
import Visitor from './Visitor.js';
import FinancialYear from './FinancialYear.js';
import HostelBudget from './HostelBudget.js';
import Vendor from './Vendor.js';
import HostelExpense from './HostelExpense.js';
import Notice from './Notice.js';
import ServiceRequest from './ServiceRequest.js';
import HostelContact from './HostelContact.js';
import StudentFeedback from './StudentFeedback.js';
import SecurityAuditLog from './SecurityAuditLog.js';

export {
  User,
  Hostel,
  Block,
  Floor,
  Room,
  Department,
  Complaint,
  ComplaintAssignment,
  ComplaintResolution,
  Counter,
  SlaRule,
  EscalationRule,
  ComplaintEscalation,
  ComplaintSlaCycle,
  Notification,
  Asset,
  MaintenanceWorkOrder,
  MaintenancePlan,
  MaintenanceCycle,
  Mess,
  MessMenu,
  MessFeedback,
  MessNotice,
  CleaningArea,
  CleaningPlan,
  CleaningTask,
  Outpass,
  Visitor,
  FinancialYear,
  HostelBudget,
  Vendor,
  HostelExpense,
  Notice,
  ServiceRequest,
  HostelContact,
  StudentFeedback,
  SecurityAuditLog,
};

// Core 6 models for backward-compatibility with Step 2 test suite
export const models = { User, Hostel, Block, Floor, Room, Department };
export const allModels = {
  User,
  Hostel,
  Block,
  Floor,
  Room,
  Department,
  Complaint,
  ComplaintAssignment,
  ComplaintResolution,
  Counter,
  SlaRule,
  EscalationRule,
  ComplaintEscalation,
  ComplaintSlaCycle,
  Notification,
  Asset,
  MaintenanceWorkOrder,
  MaintenancePlan,
  MaintenanceCycle,
  Mess,
  MessMenu,
  MessFeedback,
  MessNotice,
  CleaningArea,
  CleaningPlan,
  CleaningTask,
  Outpass,
  Visitor,
  FinancialYear,
  HostelBudget,
  Vendor,
  HostelExpense,
  Notice,
  ServiceRequest,
  HostelContact,
  StudentFeedback,
  SecurityAuditLog,
};

/**
 * Wait for every model's indexes to be built. Call after connecting so unique
 * constraints are guaranteed to be in place before the API accepts traffic.
 */
export const initModels = async () => {
  try {
    await MessMenu.collection.dropIndex('messId_1_dayOfWeek_1_mealType_1');
  } catch {
    // Ignore if legacy index does not exist
  }
  await Promise.all(Object.values(allModels).map((m) => m.init()));
};
