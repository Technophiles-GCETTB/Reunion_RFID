const mongoose = require('mongoose');

const permissionZoneSchema = new mongoose.Schema({
  allowed: { type: Boolean, default: false },
  limit:   { type: Number, default: 1 },
  used:    { type: Number, default: 0 }
}, { _id: false });

const cardSchema = new mongoose.Schema({
  version:        { type: Number, default: 1 },
  isBlocked:      { type: Boolean, default: false },
  pendingUpgrade: { type: Boolean, default: false },
  issuedAt:       { type: Date, default: Date.now }
}, { _id: false });

const personSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone is required'],
    unique: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['alumni', 'student', 'teacher', 'guest'],
    required: [true, 'Type is required']
  },
  broughtBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person',
    default: null
  },
  guests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person'
  }],
  card: {
    type: cardSchema,
    default: () => ({})
  },
  permissions: {
    food:     { type: permissionZoneSchema, default: () => ({ allowed: true,  limit: 2, used: 0 }) },
    cultural: { type: permissionZoneSchema, default: () => ({ allowed: true,  limit: 1, used: 0 }) },
    vip:      { type: permissionZoneSchema, default: () => ({ allowed: false, limit: 1, used: 0 }) },
    entry:    { type: permissionZoneSchema, default: () => ({ allowed: true,  limit: 1, used: 0 }) }
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  meta: {
    address:  { type: String, default: '' },
    photo:    { type: String, default: '' },
    notes:    { type: String, default: '' }
  }
}, {
  timestamps: true
});

// Index for fast lookups
personSchema.index({ phone: 1 });
personSchema.index({ type: 1 });
personSchema.index({ status: 1 });

module.exports = mongoose.model('Person', personSchema);
