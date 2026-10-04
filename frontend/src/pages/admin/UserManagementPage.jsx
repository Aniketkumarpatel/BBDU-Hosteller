import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import userService from '../../services/userService.js';
import hostelService from '../../services/hostelService.js';
import blockService from '../../services/blockService.js';
import floorService from '../../services/floorService.js';
import roomService from '../../services/roomService.js';
import departmentService from '../../services/departmentService.js';
import DataTable from '../../components/common/DataTable.jsx';
import SearchInput from '../../components/common/SearchInput.jsx';
import FilterSelect from '../../components/common/FilterSelect.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import ConfirmationDialog from '../../components/common/ConfirmationDialog.jsx';
import FormField from '../../components/common/FormField.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';

const INITIAL_FORM = {
  name: '',
  email: '',
  password: '',
  phone: '',
  role: 'STUDENT',
  studentId: '',
  employeeId: '',
  hostelId: '',
  blockId: '',
  floorId: '',
  roomId: '',
  departmentId: '',
  isActive: true,
};

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Delete
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [uRes, hRes, bRes, fRes, rRes, dRes] = await Promise.all([
        userService.getAllUsers(),
        hostelService.getAllHostels(),
        blockService.getAllBlocks(),
        floorService.getAllFloors(),
        roomService.getAllRooms(),
        departmentService.getAllDepartments(),
      ]);

      if (uRes.success) setUsers(uRes.data);
      if (hRes.success) setHostels(hRes.data);
      if (bRes.success) setBlocks(bRes.data);
      if (fRes.success) setFloors(fRes.data);
      if (rRes.success) setRooms(rRes.data);
      if (dRes.success) setDepartments(dRes.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error loading users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter cascade for modal
  const modalBlocks = useMemo(() => {
    if (!formData.hostelId) return [];
    return blocks.filter((b) => {
      const hId = typeof b.hostelId === 'object' ? b.hostelId?._id : b.hostelId;
      return String(hId) === String(formData.hostelId);
    });
  }, [blocks, formData.hostelId]);

  const modalFloors = useMemo(() => {
    if (!formData.blockId) return [];
    return floors.filter((f) => {
      const bId = typeof f.blockId === 'object' ? f.blockId?._id : f.blockId;
      return String(bId) === String(formData.blockId);
    });
  }, [floors, formData.blockId]);

  const modalRooms = useMemo(() => {
    if (!formData.floorId) return [];
    return rooms.filter((r) => {
      const fId = typeof r.floorId === 'object' ? r.floorId?._id : r.floorId;
      return String(fId) === String(formData.floorId);
    });
  }, [rooms, formData.floorId]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      const matchesSearch =
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.studentId && u.studentId.toLowerCase().includes(q)) ||
        (u.employeeId && u.employeeId.toLowerCase().includes(q));

      const matchesRole = !roleFilter || u.role === roleFilter;
      const matchesStatus =
        statusFilter === ''
          ? true
          : statusFilter === 'active'
          ? u.isActive
          : !u.isActive;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData(INITIAL_FORM);
    setFormErrors({});
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // optional on update
      phone: user.phone || '',
      role: user.role,
      studentId: user.studentId || '',
      employeeId: user.employeeId || '',
      hostelId: typeof user.hostelId === 'object' ? user.hostelId?._id || '' : user.hostelId || '',
      blockId: typeof user.blockId === 'object' ? user.blockId?._id || '' : user.blockId || '',
      floorId: typeof user.floorId === 'object' ? user.floorId?._id || '' : user.floorId || '',
      roomId: typeof user.roomId === 'object' ? user.roomId?._id || '' : user.roomId || '',
      departmentId: typeof user.departmentId === 'object' ? user.departmentId?._id || '' : user.departmentId || '',
      isActive: user.isActive,
    });
    setFormErrors({});
    setActionError(null);
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Full name is required';
    if (!editingUser) {
      if (!formData.email.trim()) errs.email = 'Email is required';
      if (!formData.password || formData.password.length < 8) {
        errs.password = 'Password must be at least 8 characters';
      }
    }
    if (formData.password && formData.password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setActionError(null);
    try {
      const payload = { ...formData };
      if (editingUser && !payload.password) {
        delete payload.password;
      }
      // Clean up empty relation IDs
      ['hostelId', 'blockId', 'floorId', 'roomId', 'departmentId'].forEach((field) => {
        if (!payload[field]) delete payload[field];
      });

      if (editingUser) {
        await userService.updateUser(editingUser._id, payload);
      } else {
        await userService.createUser(payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    if (user._id === currentUser?._id) {
      setActionError('You cannot deactivate your own administrative account.');
      return;
    }
    setActionError(null);
    try {
      await userService.toggleUserStatus(user._id);
      fetchData();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Status toggle failed');
    }
  };

  const handleOpenDelete = (user) => {
    if (user._id === currentUser?._id) {
      setActionError('You cannot delete your own administrative account.');
      return;
    }
    setUserToDelete(user);
    setActionError(null);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await userService.deleteUser(userToDelete._id);
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
      fetchData();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      header: 'User',
      accessor: 'name',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.name}</div>
          <div className="text-xs text-slate-500">{row.email}</div>
          {row.phone && <div className="text-[11px] text-slate-400 font-mono">{row.phone}</div>}
        </div>
      ),
    },
    {
      header: 'Role',
      accessor: 'role',
      render: (row) => {
        const roleColors = {
          STUDENT: 'bg-indigo-100 text-indigo-700',
          WARDEN: 'bg-blue-100 text-blue-700',
          HOSTEL_STAFF: 'bg-teal-100 text-teal-700',
          AUTHORITY: 'bg-purple-100 text-purple-700',
          SUPER_ADMIN: 'bg-rose-100 text-rose-700',
        };
        return (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${
              roleColors[row.role] || 'bg-slate-100 text-slate-700'
            }`}
          >
            {row.role}
          </span>
        );
      },
    },
    {
      header: 'ID / Code',
      render: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {row.studentId || row.employeeId || '-'}
        </span>
      ),
    },
    {
      header: 'Hostel / Room',
      render: (row) => (
        <div>
          <span className="font-medium text-slate-800">
            {row.hostelId?.name || '-'}
          </span>
          {row.roomId && (
            <span className="block text-[11px] font-mono text-slate-500">
              Room {row.roomId?.roomNumber || row.roomId}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Department',
      render: (row) => (
        <span className="text-slate-600 text-xs">
          {row.departmentId?.name || '-'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'isActive',
      render: (row) => <StatusBadge status={row.isActive} />,
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => handleToggleStatus(row)}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            title={row.isActive ? 'Deactivate' : 'Activate'}
          >
            {row.isActive ? (
              <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleOpenEdit(row)}
            className="rounded p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
            title="Edit User"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handleOpenDelete(row)}
            className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            title="Delete User"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" message="Loading users..." />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="User Error" message={error} onRetry={fetchData} />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">User Management</h1>
          <p className="text-xs text-slate-500">Manage user accounts across all roles, assigned hostels, and departments.</p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {actionError && (
        <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200">
          {actionError}
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-64">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, ID..." />
        </div>
        <div className="w-40">
          <FilterSelect
            value={roleFilter}
            onChange={setRoleFilter}
            placeholder="All Roles"
            options={[
              { value: 'STUDENT', label: 'Student' },
              { value: 'WARDEN', label: 'Warden' },
              { value: 'HOSTEL_STAFF', label: 'Hostel Staff' },
              { value: 'AUTHORITY', label: 'Authority' },
              { value: 'SUPER_ADMIN', label: 'Super Admin' },
            ]}
          />
        </div>
        <div className="w-36">
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All Status"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredUsers}
        emptyMessage="No users found matching your search."
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? `Edit User: ${editingUser.name}` : 'Create New User'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Full Name" required error={formErrors.name}>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                placeholder="e.g. John Doe"
              />
            </FormField>

            <FormField label="Email Address" required={!editingUser} error={formErrors.email}>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!!editingUser}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-500"
                placeholder="john@bbdu.ac.in"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label={editingUser ? 'Password (Leave blank to keep current)' : 'Initial Password'}
              required={!editingUser}
              error={formErrors.password}
            >
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                placeholder="••••••••"
              />
            </FormField>

            <FormField label="Phone Number">
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                placeholder="e.g. 9876543210"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="System Role" required>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="STUDENT">STUDENT</option>
                <option value="WARDEN">WARDEN</option>
                <option value="HOSTEL_STAFF">HOSTEL_STAFF</option>
                <option value="AUTHORITY">AUTHORITY</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
            </FormField>

            {formData.role === 'STUDENT' ? (
              <FormField label="Student ID / Roll No">
                <input
                  type="text"
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono uppercase focus:border-indigo-500 focus:outline-hidden"
                  placeholder="e.g. BBDU-2026-001"
                />
              </FormField>
            ) : (
              <FormField label="Employee ID">
                <input
                  type="text"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono uppercase focus:border-indigo-500 focus:outline-hidden"
                  placeholder="e.g. EMP-001"
                />
              </FormField>
            )}
          </div>

          <FormField label="Academic / Service Department">
            <select
              value={formData.departmentId}
              onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="">None / Unassigned</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </FormField>

          {/* Location Hierarchy Fields */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Hostel Accommodation Linkage (Optional)
            </span>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Hostel">
                <select
                  value={formData.hostelId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hostelId: e.target.value,
                      blockId: '',
                      floorId: '',
                      roomId: '',
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden bg-white"
                >
                  <option value="">None</option>
                  {hostels.map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.name} ({h.code})
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Block">
                <select
                  value={formData.blockId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      blockId: e.target.value,
                      floorId: '',
                      roomId: '',
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden bg-white"
                  disabled={!formData.hostelId}
                >
                  <option value="">None</option>
                  {modalBlocks.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Floor">
                <select
                  value={formData.floorId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      floorId: e.target.value,
                      roomId: '',
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden bg-white"
                  disabled={!formData.blockId}
                >
                  <option value="">None</option>
                  {modalFloors.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name || `Floor ${f.floorNumber}`}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Room">
                <select
                  value={formData.roomId}
                  onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden bg-white"
                  disabled={!formData.floorId}
                >
                  <option value="">None</option>
                  {modalRooms.map((r) => (
                    <option key={r._id} value={r._id}>
                      Room {r.roomNumber} ({r.currentOccupancy}/{r.capacity})
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActiveUser"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isActiveUser" className="text-xs font-medium text-slate-700">
              User account is active
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete User Account"
        message={`Are you sure you want to delete user account "${userToDelete?.name}" (${userToDelete?.email})? This action is permanent.`}
        confirmText={deleting ? 'Deleting...' : 'Delete User'}
        type="danger"
      />
    </div>
  );
}
