import { useState, useEffect, useMemo } from 'react';
import floorService from '../../services/floorService.js';
import blockService from '../../services/blockService.js';
import hostelService from '../../services/hostelService.js';
import DataTable from '../../components/common/DataTable.jsx';
import FilterSelect from '../../components/common/FilterSelect.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import ConfirmationDialog from '../../components/common/ConfirmationDialog.jsx';
import FormField from '../../components/common/FormField.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';

const INITIAL_FORM = {
  hostelId: '',
  blockId: '',
  floorNumber: 1,
  name: '',
  description: '',
  isActive: true,
};

export default function FloorManagementPage() {
  const [floors, setFloors] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Filters
  const [hostelFilter, setHostelFilter] = useState('');
  const [blockFilter, setBlockFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFloor, setEditingFloor] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Delete
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [floorToDelete, setFloorToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [floorRes, blockRes, hostelRes] = await Promise.all([
        floorService.getAllFloors(),
        blockService.getAllBlocks(),
        hostelService.getAllHostels(),
      ]);

      if (floorRes.success) setFloors(floorRes.data);
      if (blockRes.success) setBlocks(blockRes.data);
      if (hostelRes.success) setHostels(hostelRes.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error loading floors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter blocks for modal based on selected hostel in form
  const modalBlocks = useMemo(() => {
    if (!formData.hostelId) return [];
    return blocks.filter((b) => {
      const hId = typeof b.hostelId === 'object' ? b.hostelId?._id : b.hostelId;
      return String(hId) === String(formData.hostelId);
    });
  }, [blocks, formData.hostelId]);

  // Filter blocks for filter dropdown based on selected hostelFilter
  const filterBlocks = useMemo(() => {
    if (!hostelFilter) return blocks;
    return blocks.filter((b) => {
      const hId = typeof b.hostelId === 'object' ? b.hostelId?._id : b.hostelId;
      return String(hId) === String(hostelFilter);
    });
  }, [blocks, hostelFilter]);

  const filteredFloors = useMemo(() => {
    return floors.filter((f) => {
      const hId = typeof f.hostelId === 'object' ? f.hostelId?._id : f.hostelId;
      const bId = typeof f.blockId === 'object' ? f.blockId?._id : f.blockId;

      const matchesHostel = !hostelFilter || String(hId) === hostelFilter;
      const matchesBlock = !blockFilter || String(bId) === blockFilter;
      const matchesStatus =
        statusFilter === ''
          ? true
          : statusFilter === 'active'
          ? f.isActive
          : !f.isActive;

      return matchesHostel && matchesBlock && matchesStatus;
    });
  }, [floors, hostelFilter, blockFilter, statusFilter]);

  const handleOpenCreate = () => {
    setEditingFloor(null);
    const firstHostelId = hostels[0]?._id || '';
    const firstBlockId = blocks.find((b) => {
      const hId = typeof b.hostelId === 'object' ? b.hostelId?._id : b.hostelId;
      return String(hId) === String(firstHostelId);
    })?._id || '';

    setFormData({
      ...INITIAL_FORM,
      hostelId: firstHostelId,
      blockId: firstBlockId,
    });
    setFormErrors({});
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (floor) => {
    setEditingFloor(floor);
    const hId = typeof floor.hostelId === 'object' ? floor.hostelId?._id : floor.hostelId;
    const bId = typeof floor.blockId === 'object' ? floor.blockId?._id : floor.blockId;

    setFormData({
      hostelId: hId || '',
      blockId: bId || '',
      floorNumber: floor.floorNumber,
      name: floor.name || '',
      description: floor.description || '',
      isActive: floor.isActive,
    });
    setFormErrors({});
    setActionError(null);
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!formData.hostelId) errs.hostelId = 'Select a hostel';
    if (!formData.blockId) errs.blockId = 'Select a block';
    if (formData.floorNumber === undefined || formData.floorNumber === '') {
      errs.floorNumber = 'Floor number is required';
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
      if (editingFloor) {
        await floorService.updateFloor(editingFloor._id, formData);
      } else {
        await floorService.createFloor(formData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (floor) => {
    setActionError(null);
    try {
      await floorService.toggleFloorStatus(floor._id);
      fetchData();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Status update failed');
    }
  };

  const handleOpenDelete = (floor) => {
    setFloorToDelete(floor);
    setActionError(null);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!floorToDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await floorService.deleteFloor(floorToDelete._id);
      setDeleteConfirmOpen(false);
      setFloorToDelete(null);
      fetchData();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      header: 'Floor Level',
      accessor: 'floorNumber',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900">
            {row.name || `Floor ${row.floorNumber}`}
          </span>
          <span className="ml-2 font-mono text-xs text-slate-500">
            (Level {row.floorNumber})
          </span>
        </div>
      ),
    },
    {
      header: 'Block',
      render: (row) => <span className="font-semibold text-slate-800">{row.blockId?.name || 'Unassigned'}</span>,
    },
    {
      header: 'Hostel',
      render: (row) => <span className="text-slate-700">{row.hostelId?.name || 'Unassigned'}</span>,
    },
    {
      header: 'Rooms',
      accessor: 'roomsCount',
      render: (row) => <span className="font-semibold text-indigo-700">{row.roomsCount ?? 0}</span>,
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
            title="Edit Floor"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handleOpenDelete(row)}
            className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            title="Delete Floor"
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
        <LoadingSpinner size="lg" message="Loading floors..." />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Floor Error" message={error} onRetry={fetchData} />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Floor Management</h1>
          <p className="text-xs text-slate-500">Organize building floor levels within blocks and hostels.</p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Floor
        </button>
      </div>

      {actionError && (
        <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200">
          {actionError}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-48">
          <FilterSelect
            value={hostelFilter}
            onChange={(val) => {
              setHostelFilter(val);
              setBlockFilter('');
            }}
            placeholder="All Hostels"
            options={hostels.map((h) => ({ value: h._id, label: h.name }))}
          />
        </div>
        <div className="w-48">
          <FilterSelect
            value={blockFilter}
            onChange={setBlockFilter}
            placeholder="All Blocks"
            options={filterBlocks.map((b) => ({ value: b._id, label: b.name }))}
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
        data={filteredFloors}
        emptyMessage="No floors found matching your criteria."
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingFloor ? 'Edit Floor' : 'Create New Floor'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Hostel" required error={formErrors.hostelId}>
            <select
              value={formData.hostelId}
              onChange={(e) => {
                const newHostelId = e.target.value;
                const newBlock = blocks.find((b) => {
                  const hId = typeof b.hostelId === 'object' ? b.hostelId?._id : b.hostelId;
                  return String(hId) === String(newHostelId);
                });
                setFormData({
                  ...formData,
                  hostelId: newHostelId,
                  blockId: newBlock?._id || '',
                });
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="">Select Hostel</option>
              {hostels.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name} ({h.code})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Block" required error={formErrors.blockId}>
            <select
              value={formData.blockId}
              onChange={(e) => setFormData({ ...formData, blockId: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
              disabled={!formData.hostelId}
            >
              <option value="">Select Block</option>
              {modalBlocks.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Floor Number" required error={formErrors.floorNumber}>
              <input
                type="number"
                value={formData.floorNumber}
                onChange={(e) => setFormData({ ...formData, floorNumber: parseInt(e.target.value, 10) || 0 })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                placeholder="e.g. 1"
              />
            </FormField>

            <FormField label="Floor Display Name">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                placeholder="e.g. First Floor"
              />
            </FormField>
          </div>

          <FormField label="Description">
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
              placeholder="e.g. West wing corridor"
            />
          </FormField>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActiveFloor"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isActiveFloor" className="text-xs font-medium text-slate-700">
              Floor is operational and active
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
              {submitting ? 'Saving...' : editingFloor ? 'Update Floor' : 'Create Floor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Floor"
        message={`Are you sure you want to delete floor "${floorToDelete?.name || `Floor ${floorToDelete?.floorNumber}`}"? Floors containing active rooms cannot be deleted.`}
        confirmText={deleting ? 'Deleting...' : 'Delete Floor'}
        type="danger"
      />
    </div>
  );
}
