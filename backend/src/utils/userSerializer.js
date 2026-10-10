/**
 * Formats a User document or plain object into a safe, clean representation.
 * Explicitly excludes passwordHash, __v, and formats the id field.
 *
 * @param {object} user Mongoose Document or plain object
 * @returns {object} Safe user object
 */
export const sanitizeUser = (user) => {
  if (!user) return null;

  const raw = typeof user.toObject === 'function' ? user.toObject() : { ...user };

  delete raw.passwordHash;
  delete raw.__v;

  const id = raw.id || (raw._id ? String(raw._id) : undefined);

  return {
    id,
    _id: id,
    name: raw.name,
    email: raw.email,
    phone: raw.phone || undefined,
    role: raw.role,
    studentId: raw.studentId || undefined,
    employeeId: raw.employeeId || undefined,
    hostelId: raw.hostelId || undefined,
    blockId: raw.blockId || undefined,
    floorId: raw.floorId || undefined,
    roomId: raw.roomId || undefined,
    roomNumber: raw.roomNumber || (raw.roomId && typeof raw.roomId === 'object' ? raw.roomId.roomNumber : undefined),
    departmentId: raw.departmentId || undefined,
    isActive: Boolean(raw.isActive),
    mustChangePassword: Boolean(raw.mustChangePassword),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};
