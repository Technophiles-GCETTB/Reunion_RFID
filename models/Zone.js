const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Zone code is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9_]+$/, 'Code can only contain lowercase letters, numbers and underscores']
  },
  name: {
    type: String,
    required: [true, 'Zone name is required'],
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: '📍'
  },
  defaultLimit: {
    type: Number,
    default: 1,
    min: 1
  },
  defaultAllowed: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  color: {
    type: String,
    default: '#3b82f6'
  },
  scannerIds: [{
    type: String,
    trim: true
  }]
}, { timestamps: true });

module.exports = mongoose.model('Zone', zoneSchema);
