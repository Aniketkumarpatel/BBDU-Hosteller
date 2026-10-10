import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import LandingPage from '../pages/LandingPage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import RegisterPage from '../pages/RegisterPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import ChangePasswordPage from '../pages/ChangePasswordPage.jsx';
import StaffJobsLayout from '../layouts/StaffJobsLayout.jsx';
import WardenPilotLayout from '../layouts/WardenPilotLayout.jsx';
import StudentPilotLayout from '../layouts/StudentPilotLayout.jsx';
import StudentHomePage from '../pages/student/StudentHomePage.jsx';
import StudentProblemsPage from '../pages/student/StudentProblemsPage.jsx';
import StudentProblemPage from '../pages/student/StudentProblemPage.jsx';
import StudentReportPage from '../pages/student/StudentReportPage.jsx';
import StudentAlertsPage from '../pages/student/StudentAlertsPage.jsx';
import StudentMePage from '../pages/student/StudentMePage.jsx';
import WardenProblemsPage from '../pages/warden/WardenProblemsPage.jsx';
import WardenProblemPage from '../pages/warden/WardenProblemPage.jsx';
import StaffJobsPage from '../pages/staff/StaffJobsPage.jsx';
import StaffJobPage from '../pages/staff/StaffJobPage.jsx';
import { IS_PILOT_MODE } from '../config/pilot.js';
import { ProtectedRoute, RoleProtectedRoute } from './Guards.jsx';

// Role Dashboards
import StudentDashboard from '../pages/dashboards/StudentDashboard.jsx';
import WardenDashboard from '../pages/dashboards/WardenDashboard.jsx';
import StaffDashboard from '../pages/dashboards/StaffDashboard.jsx';
import AuthorityDashboard from '../pages/dashboards/AuthorityDashboard.jsx';
import AdminDashboard from '../pages/dashboards/AdminDashboard.jsx';

// Student Complaint Pages
import MyComplaintsPage from '../pages/student/MyComplaintsPage.jsx';
import SubmitComplaintPage from '../pages/student/SubmitComplaintPage.jsx';
import ComplaintDetailPage from '../pages/student/ComplaintDetailPage.jsx';

// Operational Complaint Pages (Step 5.2)
import WardenComplaintsPage from '../pages/warden/WardenComplaintsPage.jsx';
import WardenPeoplePage from '../pages/warden/WardenPeoplePage.jsx';
import StaffComplaintsPage from '../pages/staff/StaffComplaintsPage.jsx';
import AuthorityComplaintsPage from '../pages/authority/AuthorityComplaintsPage.jsx';
import ComplaintManageDetailPage from '../pages/complaints/ComplaintManageDetailPage.jsx';

// Admin Management Layout & Pages
import AdminLayout from '../layouts/AdminLayout.jsx';
import UserManagementPage from '../pages/admin/UserManagementPage.jsx';
import HostelManagementPage from '../pages/admin/HostelManagementPage.jsx';
import BlockManagementPage from '../pages/admin/BlockManagementPage.jsx';
import FloorManagementPage from '../pages/admin/FloorManagementPage.jsx';
import RoomManagementPage from '../pages/admin/RoomManagementPage.jsx';
import DepartmentManagementPage from '../pages/admin/DepartmentManagementPage.jsx';
import SlaRulesManagementPage from '../pages/admin/SlaRulesManagementPage.jsx';
import EscalationRulesManagementPage from '../pages/admin/EscalationRulesManagementPage.jsx';
import AdminSlaConfigPage from '../pages/admin/AdminSlaConfigPage.jsx';
import AdminProfilePage from '../pages/admin/AdminProfilePage.jsx';
import AnalyticsDashboardPage from '../pages/admin/AnalyticsDashboardPage.jsx';

// Maintenance & Work Orders (Step 8)
import WorkOrderListPage from '../pages/workOrders/WorkOrderListPage.jsx';
import WorkOrderDetailPage from '../pages/workOrders/WorkOrderDetailPage.jsx';
import AssetManagementPage from '../pages/assets/AssetManagementPage.jsx';
import AssetDetailPage from '../pages/assets/AssetDetailPage.jsx';

// Preventive Maintenance & Scheduling (Step 9)
import MaintenanceDashboardPage from '../pages/maintenance/MaintenanceDashboardPage.jsx';
import MaintenancePlanDetailPage from '../pages/maintenance/MaintenancePlanDetailPage.jsx';

// Mess & Dining Management (Step 10)
import MessDashboardPage from '../pages/mess/MessDashboardPage.jsx';

// Cleaning & Housekeeping Management (Step 11)
import CleaningDashboardPage from '../pages/cleaning/CleaningDashboardPage.jsx';

// Visitor & Outpass Management (Step 12)
import OutpassDashboardPage from '../pages/outpass/OutpassDashboardPage.jsx';

// AI Hostel Command Center & Smart Operations (Step 13)
import AiCommandCenterPage from '../pages/aiCommandCenter/AiCommandCenterPage.jsx';

// Hostel Finance & Expense Management (Step 15)
import FinanceDashboardPage from '../pages/finance/FinanceDashboardPage.jsx';
import ExpenseDetailPage from '../pages/finance/ExpenseDetailPage.jsx';

// Student Services & Digital Communication (Step 16)
import StudentServicesDashboardPage from '../pages/studentServices/StudentServicesDashboardPage.jsx';
import ServiceRequestDetailPage from '../pages/studentServices/ServiceRequestDetailPage.jsx';

// Old staff links and bookmarks keep working in pilot mode by forwarding to the new job screen
function ForwardToJob() {
  const { id } = useParams();
  return <Navigate to={`/staff/jobs/${id}`} replace />;
}

// And for the student's old complaint links
function ForwardToStudentProblem() {
  const { id } = useParams();
  return <Navigate to={`/student/problems/${id}`} replace />;
}

// Same for the Warden's old complaint links
function ForwardToProblem() {
  const { id } = useParams();
  return <Navigate to={`/warden/problems/${id}`} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Legacy home redirect */}
      <Route path="/home" element={<Navigate to="/" replace />} />

      {/* Authenticated Routes */}
      <Route element={<ProtectedRoute />}>
        {/* Any signed-in user; also the only page reachable while a password change is forced */}
        <Route path="/change-password" element={<ChangePasswordPage />} />

        {/* Technician job screens (DEC-026): own simple layout, shown instead of the staff dashboard in pilot mode */}
        <Route element={<RoleProtectedRoute allowedRoles={['HOSTEL_STAFF', 'SUPER_ADMIN']} />}>
          <Route element={<StaffJobsLayout />}>
            <Route path="/staff/jobs" element={<StaffJobsPage />} />
            <Route path="/staff/jobs/:id" element={<StaffJobPage />} />
          </Route>
        </Route>

        {/* Student pilot screens (DEC-031): own layout with a location bar and bottom tabs */}
        {IS_PILOT_MODE && (
          <Route element={<RoleProtectedRoute allowedRoles={['STUDENT']} />}>
            <Route element={<StudentPilotLayout />}>
              <Route path="/student/home" element={<StudentHomePage />} />
              <Route path="/student/problems" element={<StudentProblemsPage />} />
              <Route path="/student/problems/:id" element={<StudentProblemPage />} />
              <Route path="/student/report" element={<StudentReportPage />} />
              <Route path="/student/alerts" element={<StudentAlertsPage />} />
              <Route path="/student/me" element={<StudentMePage />} />
            </Route>
          </Route>
        )}

        {/* Warden pilot screens (DEC-029): own layout with two tabs, Problems and People */}
        {IS_PILOT_MODE && (
          <Route element={<RoleProtectedRoute allowedRoles={['WARDEN', 'SUPER_ADMIN']} />}>
            <Route element={<WardenPilotLayout />}>
              <Route path="/warden/problems" element={<WardenProblemsPage />} />
              <Route path="/warden/problems/:id" element={<WardenProblemPage />} />
              <Route path="/warden/people" element={<WardenPeoplePage />} />
            </Route>
          </Route>
        )}

        {/* Persistent Dashboard Layout for Non-Admin Routes */}
        <Route element={<DashboardLayout />}>
          {/* Student Portal & Complaints */}
          <Route element={<RoleProtectedRoute allowedRoles={['STUDENT']} />}>
            {IS_PILOT_MODE ? (
              <>
                <Route path="/student/dashboard" element={<Navigate to="/student/home" replace />} />
                <Route path="/student/complaints" element={<Navigate to="/student/problems" replace />} />
                <Route path="/student/complaints/new" element={<Navigate to="/student/report" replace />} />
                <Route path="/student/complaints/:id" element={<ForwardToStudentProblem />} />
              </>
            ) : (
              <>
                <Route path="/student/dashboard" element={<StudentDashboard />} />
                <Route path="/student/complaints" element={<MyComplaintsPage />} />
                <Route path="/student/complaints/new" element={<SubmitComplaintPage />} />
                <Route path="/student/complaints/:id" element={<ComplaintDetailPage />} />
              </>
            )}
            <Route path="/student/mess" element={<Navigate to="/mess" replace />} />
            <Route path="/student/outpass" element={<Navigate to="/outpass" replace />} />
            <Route path="/student/services" element={<Navigate to="/student-services" replace />} />
          </Route>

          {/* Warden Portal & Complaints Management */}
          <Route element={<RoleProtectedRoute allowedRoles={['WARDEN', 'SUPER_ADMIN']} />}>
            {IS_PILOT_MODE ? (
              <>
                <Route path="/warden/dashboard" element={<Navigate to="/warden/problems" replace />} />
                <Route path="/warden/complaints" element={<Navigate to="/warden/problems" replace />} />
                <Route path="/warden/complaints/:id" element={<ForwardToProblem />} />
              </>
            ) : (
              <>
                <Route path="/warden/dashboard" element={<WardenDashboard />} />
                <Route path="/warden/complaints" element={<WardenComplaintsPage />} />
                <Route path="/warden/complaints/:id" element={<ComplaintManageDetailPage />} />
                <Route path="/warden/people" element={<WardenPeoplePage />} />
              </>
            )}
            <Route path="/warden/analytics" element={<AnalyticsDashboardPage />} />
          </Route>

          {/* Staff Portal & Assigned Work Queue */}
          <Route element={<RoleProtectedRoute allowedRoles={['HOSTEL_STAFF', 'SUPER_ADMIN']} />}>
            {IS_PILOT_MODE ? (
              <>
                <Route path="/staff/dashboard" element={<Navigate to="/staff/jobs" replace />} />
                <Route path="/staff/complaints" element={<Navigate to="/staff/jobs" replace />} />
                <Route path="/staff/complaints/:id" element={<ForwardToJob />} />
              </>
            ) : (
              <>
                <Route path="/staff/dashboard" element={<StaffDashboard />} />
                <Route path="/staff/complaints" element={<StaffComplaintsPage />} />
                <Route path="/staff/complaints/:id" element={<ComplaintManageDetailPage />} />
              </>
            )}
          </Route>

          {/* Authority Portal & Campus Complaints Oversight */}
          <Route element={<RoleProtectedRoute allowedRoles={['AUTHORITY', 'SUPER_ADMIN']} />}>
            <Route path="/authority/dashboard" element={<AuthorityDashboard />} />
            <Route path="/authority/complaints" element={<AuthorityComplaintsPage />} />
            <Route path="/authority/complaints/:id" element={<ComplaintManageDetailPage />} />
            <Route path="/authority/analytics" element={<AnalyticsDashboardPage />} />
          </Route>

          {/* Work Orders Management (Step 8) */}
          <Route element={<RoleProtectedRoute allowedRoles={['HOSTEL_STAFF', 'WARDEN', 'AUTHORITY', 'SUPER_ADMIN']} />}>
            <Route path="/work-orders" element={<WorkOrderListPage />} />
            <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
          </Route>

          {/* Asset Inventory & Lifecycle (Step 8 & 14) */}
          <Route element={<RoleProtectedRoute allowedRoles={['STUDENT', 'HOSTEL_STAFF', 'WARDEN', 'AUTHORITY', 'SUPER_ADMIN']} />}>
            <Route path="/assets" element={<AssetManagementPage />} />
            <Route path="/assets/:id" element={<AssetDetailPage />} />
            <Route path="/inventory" element={<Navigate to="/assets" replace />} />
          </Route>

          {/* Preventive Maintenance & Smart Scheduling (Step 9) */}
          <Route element={<RoleProtectedRoute allowedRoles={['HOSTEL_STAFF', 'WARDEN', 'AUTHORITY', 'SUPER_ADMIN']} />}>
            <Route path="/maintenance" element={<MaintenanceDashboardPage />} />
            <Route path="/maintenance/plans/:id" element={<MaintenancePlanDetailPage />} />
          </Route>

          {/* Mess & Food Quality Management (Step 10) */}
          <Route element={<RoleProtectedRoute allowedRoles={['STUDENT', 'HOSTEL_STAFF', 'WARDEN', 'AUTHORITY', 'SUPER_ADMIN']} />}>
            <Route path="/mess" element={<MessDashboardPage />} />
          </Route>

          {/* Cleaning & Housekeeping Management (Step 11) */}
          <Route element={<RoleProtectedRoute allowedRoles={['HOSTEL_STAFF', 'WARDEN', 'AUTHORITY', 'SUPER_ADMIN']} />}>
            <Route path="/cleaning" element={<CleaningDashboardPage />} />
          </Route>

          {/* Visitor & Outpass Management (Step 12) */}
          <Route element={<RoleProtectedRoute allowedRoles={['STUDENT', 'HOSTEL_STAFF', 'WARDEN', 'AUTHORITY', 'SUPER_ADMIN']} />}>
            <Route path="/outpass" element={<OutpassDashboardPage />} />
          </Route>

          {/* AI Hostel Command Center & Smart Operations (Step 13) */}
          <Route element={<RoleProtectedRoute allowedRoles={['WARDEN', 'AUTHORITY', 'SUPER_ADMIN']} />}>
            <Route path="/ai-command-center" element={<AiCommandCenterPage />} />
          </Route>

          {/* Hostel Finance & Expense Management (Step 15) */}
          <Route element={<RoleProtectedRoute allowedRoles={['HOSTEL_STAFF', 'WARDEN', 'AUTHORITY', 'SUPER_ADMIN']} />}>
            <Route path="/finance" element={<FinanceDashboardPage />} />
            <Route path="/finance/expenses/:id" element={<ExpenseDetailPage />} />
            <Route path="/expenses" element={<Navigate to="/finance" replace />} />
            <Route path="/budgets" element={<Navigate to="/finance" replace />} />
          </Route>

          {/* Student Services & Digital Communication (Step 16) */}
          <Route element={<RoleProtectedRoute allowedRoles={['STUDENT', 'HOSTEL_STAFF', 'WARDEN', 'AUTHORITY', 'SUPER_ADMIN']} />}>
            <Route path="/student-services" element={<StudentServicesDashboardPage />} />
            <Route path="/student-services/requests/:id" element={<ServiceRequestDetailPage />} />
            <Route path="/notices" element={<Navigate to="/student-services" replace />} />
          </Route>
        </Route>

        {/* Super Admin Console (Nested inside AdminLayout) */}
        <Route element={<RoleProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/analytics" element={<AnalyticsDashboardPage />} />
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/admin/hostels" element={<HostelManagementPage />} />
            <Route path="/admin/blocks" element={<BlockManagementPage />} />
            <Route path="/admin/floors" element={<FloorManagementPage />} />
            <Route path="/admin/rooms" element={<RoomManagementPage />} />
            <Route path="/admin/departments" element={<DepartmentManagementPage />} />
            <Route path="/admin/sla-rules" element={<SlaRulesManagementPage />} />
            <Route path="/admin/escalation-rules" element={<EscalationRulesManagementPage />} />
            <Route path="/admin/sla-config" element={<AdminSlaConfigPage />} />
            <Route path="/admin/profile" element={<AdminProfilePage />} />
          </Route>
        </Route>
      </Route>

      {/* 404 Fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
