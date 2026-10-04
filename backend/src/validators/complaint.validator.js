import {
  COMPLAINT_CATEGORY_VALUES,
  COMPLAINT_PRIORITY_VALUES,
  CATEGORY_ISSUE_TYPES,
  ALL_ISSUE_TYPES,
} from '../constants/complaint.constants.js';

export const validateComplaintInput = ({ title, description, category, issueType, priority, locationDescription }) => {
  const errors = [];

  // Title
  if (!title || typeof title !== 'string' || !title.trim()) {
    errors.push('Complaint title is required');
  } else if (title.trim().length < 3 || title.trim().length > 120) {
    errors.push('Title must be between 3 and 120 characters');
  }

  // Description
  if (!description || typeof description !== 'string' || !description.trim()) {
    errors.push('Complaint description is required');
  } else if (description.trim().length < 10 || description.trim().length > 2000) {
    errors.push('Description must be between 10 and 2000 characters');
  }

  // Category
  if (!category || !COMPLAINT_CATEGORY_VALUES.includes(category)) {
    errors.push(`Category must be one of: ${COMPLAINT_CATEGORY_VALUES.join(', ')}`);
  }

  // Issue Type
  if (!issueType) {
    errors.push('Issue type is required');
  } else if (category && CATEGORY_ISSUE_TYPES[category]) {
    if (!CATEGORY_ISSUE_TYPES[category].includes(issueType)) {
      errors.push(
        `Issue type '${issueType}' is not valid for category '${category}'. Allowed: ${CATEGORY_ISSUE_TYPES[category].join(', ')}`
      );
    }
  } else if (!ALL_ISSUE_TYPES.includes(issueType)) {
    errors.push('Invalid issue type');
  }

  // Priority
  if (!priority || !COMPLAINT_PRIORITY_VALUES.includes(priority)) {
    errors.push(`Priority must be one of: ${COMPLAINT_PRIORITY_VALUES.join(', ')}`);
  }

  // Location description
  if (locationDescription && typeof locationDescription === 'string' && locationDescription.length > 200) {
    errors.push('Location description cannot exceed 200 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
