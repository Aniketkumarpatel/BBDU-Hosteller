import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar.jsx';
import Topbar from '../components/common/Topbar.jsx';

const titleMap = {
  '/admin/dashboard': 'Admin Dashboard Overview',
  '/admin/analytics': 'Analytics & Operational Intelligence',
  '/admin/users': 'User Management',
  '/admin/hostels': 'Hostel Management',
  '/admin/blocks': 'Block Management',
  '/admin/floors': 'Floor Management',
  '/admin/rooms': 'Room Management',
  '/admin/departments': 'Department Management',
  '/admin/sla-rules': 'SLA Rules Management',
  '/admin/escalation-rules': 'Escalation Hierarchy Rules',
  '/admin/sla-config': 'SLA Configuration & Escalation Control',
  '/admin/profile': 'Super Admin Profile',
};

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const title = titleMap[location.pathname] || 'Administration';

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={title} onOpenSidebar={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
