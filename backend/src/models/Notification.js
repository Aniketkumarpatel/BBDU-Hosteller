import mongoose from 'mongoose';
import { buildSchemaOptions } from './schemaOptions.js';
import {
  NOTIFICATION_TYPE_VALUES,
  NOTIFICATION_ENTITY_TYPE_VALUES,
} from '../constants/notification.constants.js';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification recipient is required'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      enum: {
        values: NOTIFICATION_TYPE_VALUES,
        message: 'Invalid notification type: {VALUE}',
      },
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      minlength: [2, 'Message must be at least 2 characters'],
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    relatedEntityType: {
      type: String,
      enum: {
        values: NOTIFICATION_ENTITY_TYPE_VALUES,
        message: 'Invalid related entity type: {VALUE}',
      },
      default: 'COMPLAINT',
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      default: null,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  buildSchemaOptions()
);

// Compound indexes for querying recipient unread and chronological listings efficiently
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;
