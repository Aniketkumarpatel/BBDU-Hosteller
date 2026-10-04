import { useState, useEffect, useMemo } from 'react';
import roomService from '../../services/roomService.js';
import floorService from '../../services/floorService.js';
import blockService from '../../services/blockService.js';
import hostelService from '../../services/hostelService.js';
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
  hostelId: '',
  blockId: '',
  floorId: '',
  roomNumber: '',
  roomType: 'DOUBLE',
  capacity: 2,
  currentOccupancy: 0,
  isActive: true,
};

export default function RoomManagementPage() {
  const [rooms, setRooms] = useState([]);
  const [floors, setFloors] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [hostelFilter, setHostelFilter] = useState('');
  const [blockFilter, setBlockFilter] = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Delete
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [roomRes, floorRes, blockRes, hostelRes] = await Promise.all([
        roomService.getAllRooms(),
        floorService.getAllFloors(),
        blockService.getAllBlocks(),
        hostelService.getAllHostels(),
      ]);

      if (roomRes.success) setRooms(roomRes.data);
      if (floorRes.success) setFloors(floorRes.data);
      if (blockRes.success) setBlocks(blockRes.data);
      if (hostelRes.success) setHostels(hostelRes.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error loading rooms');
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

  // Filter cascade for filters
  const filterBlocks = useMemo(() => {
    if (!hostelFilter) return blocks;
    return blocks.filter((b) => {
      const hId = typeof b.hostelId === 'object' ? b.hostelId?._id : b.hostelId;
      return String(hId) === String(hostelFilter);
    });
  }, [blocks, hostelFilter]);

  const filterFloors = useMemo(() => {
    if (!blockFilter) return floors;
    return floors.filter((f) => {
      const bId = typeof f.blockId === 'object' ? f.blockId?._id : f.blockId;
      return String(bId) === String(blockFilter);
    });
  }, [floors, blockFilter]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const hId = typeof r.hostelId === 'object' ? r.hostelId?._id : r.hostelId;
      const bId = typeof r.blockId === 'object' ? r.blockId?._id : r.blockId;
      const fId = typeof r.floorId === 'object' ? r.floorId?._id : r.floorId;

      const matchesSearch = r.roomNumber.toLowerCase().includes(search.toLowerCase());
      const matchesHostel = !hostelFilter || String(hId) === hostelFilter;
      const matchesBlock = !blockFilter || String(bId) === blockFilter;
      const matchesFloor = !floorFilter || String(fId) === floorFilter;
      const matchesType = !typeFilter || r.roomType === typeFilter;
      const matchesStatus =
        statusFilter === ''
          ? true
          : statusFilter === 'active'
          ? r.isActive
          : !r.isActive;

      return (
        matchesSearch &&
        matchesHostel &&
        matchesBlock &&
        matchesFloor &&
        matchesType &&
        matchesStatus
      );
    });
  }, [rooms, search, hostelFilter, blockFilter, floorFilter, typeFilter, statusFilter]);

  const handleOpenCreate = () => {
    setEditingRoom(null);
    const firstHostelId = hostels[0]?._id || '';
    const firstBlock = blocks.find((b) => {
      const hId = typeof b.hostelId === 'object' ? b.hostelId?._id : b.hostelId;
      return String(hId) === String(firstHostelId);
    });
    const firstBlockId = firstBlock?._id || '';
    const firstFloor = floors.find((f) => {
      const bId = typeof f.blockId === 'object' ? f.blockId?._id : f.blockId;
      return String(bId) === String(firstBlockId);
    });
    const firstFloorId = firstFloor?._id || '';

    setFormData({
      ...INITIAL_FORM,
      hostelId: firstHostelId,
      blockId: firstBlockId,
      floorId: firstFloorId,
    });
    setFormErrors({});
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (room) => {
    setEditingRoom(room);
    const hId = typeof room.hostelId === 'object' ? room.hostelId?._id : room.hostelId;
    const bId = typeof room.blockId === 'object' ? room.blockId?._id : room.blockId;
    const fId = typeof room.floorId === 'object' ? room.floorId?._id : room.floorId;

    setFormData({
      hostelId: hId || '',
      blockId: bId || '',
      floorId: fId || '',
      roomNumber: room.roomNumber,
      roomType: room.roomType,
      capacity: room.capacity,
      currentOccupancy: room.currentOccupancy,
      isActive: room.isActive,
    });
    setFormErrors({});
    setActionError(null);
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!formData.hostelId) errs.hostelId = 'Select a hostel';
    if (!formData.blockId) errs.blockId = 'Select a block';
    if (!formData.floorId) errs.floorId = 'Select a floor';
    if (!formData.roomNumber.trim()) errs.roomNumber = 'Room number is required';
    if (!formData.capacity || formData.capacity < 1) errs.capacity = 'Capacity must be at least 1';
    if (formData.currentOccupancy < 0) errs.currentOccupancy = 'Occupancy cannot be negative';
    if (formData.currentOccupancy > formData.capacity) {
      errs.currentOccupancy = 'Occupancy cannot exceed room capacity';
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
      if (editingRoom) {
        await roomService.updateRoom(editingRoom._id, formData);
      } else {
        await roomService.createRoom(formData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (room) => {
    setActionError(null);
    try {
      await roomService.toggleRoomStatus(room._id);
      fetchData();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Status toggle failed');
    }
  };

  const handleOpenDelete = (room) => {
    setRoomToDelete(room);
    setActionError(null);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!roomToDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await roomService.deleteRoom(roomToDelete._id);
      setDeleteConfirmOpen(false);
      setRoomToDelete(null);
      fetchData();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      header: 'Room',
      accessor: 'roomNumber',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 font-mono">Room {row.roomNumber}</span>
          <span className="block text-[11px] text-slate-500">{row.roomType}</span>
        </div>
      ),
    },
    {
      header: 'Hostel',
      render: (row) => <span className="font-semibold text-slate-800">{row.hostelId?.name || 'Unassigned'}</span>,
    },
    {
      header: 'Block',
      render: (row) => <span className="text-slate-700">{row.blockId?.name || 'Unassigned'}</span>,
    },
    {
      header: 'Floor',
      render: (row) => (
        <span className="text-slate-600">
          {row.floorId?.name || (row.floorId?.floorNumber !== undefined ? `Level ${row.floorId.floorNumber}` : 'Unassigned')}
        </span>
      ),
    },
    {
      header: 'Occupancy / Capacity',
      render: (row) => {
        const occRate = row.capacity > 0 ? Math.round((row.currentOccupancy / row.capacity) * 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">
              {row.currentOccupancy} / {row.capacity}
            </span>
            <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full ${
                  occRate >= 100 ? 'bg-rose-500' : occRate > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, occRate)}%` }}
              />
            </div>
          </div>
        );
      },
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
            title="Edit Room"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handleOpenDelete(row)}
            className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            title="Delete Room"
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
        <LoadingSpinner size="lg" message="Loading room inventory..." />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Room Error" message={error} onRetry={fetchData} />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Room Management</h1>
          <p className="text-xs text-slate-500">Configure residential rooms, capacities, and bed occupancy rules.</p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Room
        </button>
      </div>

      {actionError && (
        <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200">
          {actionError}
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="Search room #..." />
        </div>
        <div className="w-44">
          <FilterSelect
            value={hostelFilter}
            onChange={(val) => {
              setHostelFilter(val);
              setBlockFilter('');
              setFloorFilter('');
            }}
            placeholder="All Hostels"
            options={hostels.map((h) => ({ value: h._id, label: h.name }))}
          />
        </div>
        <div className="w-40">
          <FilterSelect
            value={blockFilter}
            onChange={(val) => {
              setBlockFilter(val);
              setFloorFilter('');
            }}
            placeholder="All Blocks"
            options={filterBlocks.map((b) => ({ value: b._id, label: b.name }))}
          />
        </div>
        <div className="w-36">
          <FilterSelect
            value={floorFilter}
            onChange={setFloorFilter}
            placeholder="All Floors"
            options={filterFloors.map((f) => ({
              value: f._id,
              label: f.name || `Floor ${f.floorNumber}`,
            }))}
          />
        </div>
        <div className="w-36">
          <FilterSelect
            value={typeFilter}
            onChange={setTypeFilter}
            placeholder="All Types"
            options={[
              { value: 'SINGLE', label: 'Single' },
              { value: 'DOUBLE', label: 'Double' },
              { value: 'TRIPLE', label: 'Triple' },
              { value: 'DORMITORY', label: 'Dormitory' },
              { value: 'OTHER', label: 'Other' },
            ]}
          />
        </div>
        <div className="w-32">
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
        data={filteredRooms}
        emptyMessage="No rooms found matching your criteria."
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRoom ? `Edit Room ${editingRoom.roomNumber}` : 'Create New Room'}
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
                const newFloor = floors.find((f) => {
                  const bId = typeof f.blockId === 'object' ? f.blockId?._id : f.blockId;
                  return String(bId) === String(newBlock?._id);
                });

                setFormData({
                  ...formData,
                  hostelId: newHostelId,
                  blockId: newBlock?._id || '',
                  floorId: newFloor?._id || '',
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

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Block" required error={formErrors.blockId}>
              <select
                value={formData.blockId}
                onChange={(e) => {
                  const newBlockId = e.target.value;
                  const newFloor = floors.find((f) => {
                    const bId = typeof f.blockId === 'object' ? f.blockId?._id : f.blockId;
                    return String(bId) === String(newBlockId);
                  });
                  setFormData({
                    ...formData,
                    blockId: newBlockId,
                    floorId: newFloor?._id || '',
                  });
                }}
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

            <FormField label="Floor" required error={formErrors.floorId}>
              <select
                value={formData.floorId}
                onChange={(e) => setFormData({ ...formData, floorId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                disabled={!formData.blockId}
              >
                <option value="">Select Floor</option>
                {modalFloors.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name || `Floor ${f.floorNumber}`}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Room Number" required error={formErrors.roomNumber}>
              <input
                type="text"
                value={formData.roomNumber}
                onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                placeholder="e.g. 101"
              />
            </FormField>

            <FormField label="Room Type" required>
              <select
                value={formData.roomType}
                onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="SINGLE">Single</option>
                <option value="DOUBLE">Double</option>
                <option value="TRIPLE">Triple</option>
                <option value="DORMITORY">Dormitory</option>
                <option value="OTHER">Other</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Bed Capacity" required error={formErrors.capacity}>
              <input
                type="number"
                min="1"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 0 })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
              />
            </FormField>

            <FormField label="Current Occupancy" error={formErrors.currentOccupancy}>
              <input
                type="number"
                min="0"
                value={formData.currentOccupancy}
                onChange={(e) => setFormData({ ...formData, currentOccupancy: parseInt(e.target.value, 10) || 0 })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
              />
            </FormField>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActiveRoom"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isActiveRoom" className="text-xs font-medium text-slate-700">
              Room is available and active
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
              {submitting ? 'Saving...' : editingRoom ? 'Update Room' : 'Create Room'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Room"
        message={`Are you sure you want to delete Room ${roomToDelete?.roomNumber}? Rooms with active resident occupancy cannot be deleted.`}
        confirmText={deleting ? 'Deleting...' : 'Delete Room'}
        type="danger"
      />
    </div>
  );
}
