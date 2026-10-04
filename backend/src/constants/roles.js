/**
 * User roles. Values are stored in MongoDB exactly as written here.
 */
export const ROLES = Object.freeze({
  STUDENT: 'STUDENT',
  WARDEN: 'WARDEN',
  HOSTEL_STAFF: 'HOSTEL_STAFF',
  AUTHORITY: 'AUTHORITY',
  SUPER_ADMIN: 'SUPER_ADMIN',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));
