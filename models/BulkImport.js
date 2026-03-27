const mongoose = require('mongoose');

const bulkImportSchema = new mongoose.Schema({
  importedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  fileName:     { type: String, default: 'paste' },
  totalRows:    { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failedCount:  { type: Number, default: 0 },
  skippedCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['processing', 'done', 'failed'],
    default: 'processing'
  },
  results: [{
    row:     Number,
    name:    String,
    phone:   String,
    status:  { type: String, enum: ['success', 'failed', 'skipped'] },
    reason:  String,
    personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' }
  }],
  errors: [String]
}, { timestamps: true });

module.exports = mongoose.model('BulkImport', bulkImportSchema);
