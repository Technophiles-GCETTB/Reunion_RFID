const mongoose = require('mongoose');

const writerModuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Module name is required'],
    trim: true
  },
  ip: {
    type: String,
    required: [true, 'IP address is required'],
    trim: true
  },
  // The admin who can access this machine (max 1 machine per admin)
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('WriterModule', writerModuleSchema);
