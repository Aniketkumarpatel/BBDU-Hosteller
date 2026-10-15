import api from './api.js';

export const virtualVisitService = {
  // Read-only exploration endpoint with hostel, block, floor, roomType filters
  getExploreData: async (params) => {
    const res = await api.get('/virtual-visit/explore', { params });
    return res.data;
  },

  // Single room virtual visit details
  getRoomVirtualVisit: async (roomId) => {
    const res = await api.get(`/virtual-visit/rooms/${roomId}`);
    return res.data;
  },

  // Warden-only upload: up to 6 photos, 2 short videos, and 360 panorama
  uploadRoomMedia: async (roomId, formData) => {
    const res = await api.post(`/virtual-visit/rooms/${roomId}/upload`, formData);
    return res.data;
  },

  // Warden-only delete specific photo or video item
  deleteRoomMediaItem: async (roomId, type, url) => {
    const res = await api.delete(`/virtual-visit/rooms/${roomId}/media-item`, {
      data: { type, url },
    });
    return res.data;
  },

  // Warden-only media metadata update
  updateRoomMediaMeta: async (roomId, data) => {
    const res = await api.patch(`/virtual-visit/rooms/${roomId}/media`, data);
    return res.data;
  },
};

export default virtualVisitService;
