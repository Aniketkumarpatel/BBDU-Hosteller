import asyncHandler from '../utils/asyncHandler.js';
import * as messService from '../services/mess.service.js';

// Mess Handlers
export const handleCreateMess = asyncHandler(async (req, res) => {
  const mess = await messService.createMess(req.body, req.user);
  res.status(201).json({
    success: true,
    message: 'Mess created successfully',
    data: mess,
  });
});

export const handleGetMesses = asyncHandler(async (req, res) => {
  const messes = await messService.getMesses(req.query);
  res.status(200).json({
    success: true,
    data: messes,
  });
});

export const handleGetMessById = asyncHandler(async (req, res) => {
  const mess = await messService.getMessById(req.params.id);
  res.status(200).json({
    success: true,
    data: mess,
  });
});

export const handleUpdateMess = asyncHandler(async (req, res) => {
  const mess = await messService.updateMess(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Mess updated successfully',
    data: mess,
  });
});

// Menu Handlers
export const handleCreateOrUpdateMenu = asyncHandler(async (req, res) => {
  const menu = await messService.createOrUpdateMenu(req.params.messId, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Menu updated successfully',
    data: menu,
  });
});

export const handleGetMenus = asyncHandler(async (req, res) => {
  const menus = await messService.getMenus(req.params.messId, req.query, req.user);
  res.status(200).json({
    success: true,
    data: menus,
  });
});

export const handleGetTodayMenu = asyncHandler(async (req, res) => {
  const todayData = await messService.getTodayMenu(req.params.messId, req.user);
  res.status(200).json({
    success: true,
    data: todayData,
  });
});

export const handlePublishMenu = asyncHandler(async (req, res) => {
  const menu = await messService.publishMenu(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: 'Menu published successfully',
    data: menu,
  });
});

export const handleUnpublishMenu = asyncHandler(async (req, res) => {
  const menu = await messService.unpublishMenu(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: 'Menu unpublished',
    data: menu,
  });
});

// Dashboard & Analytics Handlers
export const handleGetMessDashboard = asyncHandler(async (req, res) => {
  const dashboard = await messService.getMessDashboard(req.user, req.query);
  res.status(200).json({
    success: true,
    data: dashboard,
  });
});

export const handleGetFoodQualityAnalytics = asyncHandler(async (req, res) => {
  const analytics = await messService.getFoodQualityAnalytics(req.user, req.query);
  res.status(200).json({
    success: true,
    data: analytics,
  });
});
