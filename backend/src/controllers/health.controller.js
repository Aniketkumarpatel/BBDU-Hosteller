import { getDbStatus } from '../config/db.js';

export const getHealth = (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'BBDU Hosteller API is running',
    database: getDbStatus(),
  });
};
