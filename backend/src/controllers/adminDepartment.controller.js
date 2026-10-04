import asyncHandler from '../utils/asyncHandler.js';
import Department from '../models/Department.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';

export const listDepartments = asyncHandler(async (req, res) => {
  const { search, status } = req.query;
  const filter = {};

  if (search) {
    const s = search.trim();
    filter.$or = [
      { name: { $regex: s, $options: 'i' } },
      { code: { $regex: s, $options: 'i' } },
    ];
  }

  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;

  const departments = await Department.find(filter).sort({ name: 1 }).lean();

  const deptIds = departments.map((d) => d._id);
  const memberCounts = await User.aggregate([
    { $match: { departmentId: { $in: deptIds } } },
    { $group: { _id: '$departmentId', count: { $sum: 1 } } },
  ]);

  const memberMap = Object.fromEntries(memberCounts.map((m) => [String(m._id), m.count]));

  const enriched = departments.map((d) => ({
    ...d,
    id: d._id,
    memberCount: memberMap[String(d._id)] || 0,
  }));

  res.status(200).json({
    success: true,
    data: { departments: enriched },
  });
});

export const getDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id).lean();
  if (!department) throw ApiError.notFound('Department not found');

  res.status(200).json({
    success: true,
    data: { department: { ...department, id: department._id } },
  });
});

export const createDepartment = asyncHandler(async (req, res) => {
  const { name, code, description, isActive } = req.body;

  if (!name || !code) {
    throw ApiError.badRequest('Department name and code are required.');
  }

  const existingCode = await Department.findOne({ code: code.trim().toUpperCase() });
  if (existingCode) {
    throw ApiError.conflict(`Department with code "${code}" already exists.`);
  }

  const existingName = await Department.findOne({ name: name.trim() });
  if (existingName) {
    throw ApiError.conflict(`Department with name "${name}" already exists.`);
  }

  const department = await Department.create({
    name: name.trim(),
    code: code.trim().toUpperCase(),
    description: description?.trim(),
    isActive: isActive !== undefined ? Boolean(isActive) : true,
  });

  res.status(201).json({
    success: true,
    message: 'Department created successfully',
    data: { department },
  });
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, code, description, isActive } = req.body;

  const department = await Department.findById(id);
  if (!department) throw ApiError.notFound('Department not found');

  if (code && code.trim().toUpperCase() !== department.code) {
    const existing = await Department.findOne({
      code: code.trim().toUpperCase(),
      _id: { $ne: id },
    });
    if (existing) {
      throw ApiError.conflict(`Department with code "${code}" already exists.`);
    }
    department.code = code.trim().toUpperCase();
  }

  if (name && name.trim() !== department.name) {
    const existing = await Department.findOne({
      name: name.trim(),
      _id: { $ne: id },
    });
    if (existing) {
      throw ApiError.conflict(`Department with name "${name}" already exists.`);
    }
    department.name = name.trim();
  }

  if (description !== undefined) department.description = description?.trim();
  if (isActive !== undefined) department.isActive = Boolean(isActive);

  await department.save();

  res.status(200).json({
    success: true,
    message: 'Department updated successfully',
    data: { department },
  });
});

export const toggleDepartmentStatus = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) throw ApiError.notFound('Department not found');

  department.isActive = !department.isActive;
  await department.save();

  res.status(200).json({
    success: true,
    message: `Department ${department.isActive ? 'activated' : 'deactivated'} successfully`,
    data: { department },
  });
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const hasUsers = await User.exists({ departmentId: id });
  if (hasUsers) {
    throw ApiError.badRequest('Cannot delete department with associated users.');
  }

  const deleted = await Department.findByIdAndDelete(id);
  if (!deleted) throw ApiError.notFound('Department not found');

  res.status(200).json({
    success: true,
    message: 'Department deleted successfully',
  });
});
