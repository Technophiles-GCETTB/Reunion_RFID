const mongoose = require('mongoose');

const accessLogSchema = new mongoose.Schema({
  personId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  zoneCode:  { type: String, required: true },
  scannerId: { type: String, required: true },
  status:    { type: String, enum: ['GRANTED', 'DENIED'], required: true },
  reason:    { type: String, default: '' },
  snapshot: {
    name:        String,
    type:        String,
    cardVersion: Number
  },
  timestamp: { type: Date, default: Date.now }
}, {
  // Prevent updates — logs are immutable
  timestamps: false
});

// Block all update operations to enforce immutability
accessLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function () {
  throw new Error('Access logs are immutable and cannot be modified.');
});

accessLogSchema.index({ personId: 1 });
accessLogSchema.index({ timestamp: -1 });
accessLogSchema.index({ status: 1 });
accessLogSchema.index({ zoneCode: 1 });

module.exports = mongoose.model('AccessLog', accessLogSchema);
