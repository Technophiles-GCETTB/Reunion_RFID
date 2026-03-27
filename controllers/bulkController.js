const Person     = require('../models/Person');
const Zone       = require('../models/Zone');
const BulkImport = require('../models/BulkImport');

// ── Show bulk import page ─────────────────────────────────────────────────
const showBulkImport = async (req, res) => {
  try {
    const recentImports = await BulkImport.find()
      .populate('importedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    const zones = await Zone.find({ isActive: true }).sort({ createdAt: 1 });

    res.render('admin/bulk-import', {
      title: 'Bulk Import',
      recentImports,
      zones,
      query: req.query,
      error: null
    });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

// ── Preview parsed CSV/JSON before importing ──────────────────────────────
const previewImport = async (req, res) => {
  try {
    const { rawData, format } = req.body;
    if (!rawData || !rawData.trim()) {
      return res.json({ success: false, message: 'No data provided' });
    }

    const rows = parseData(rawData.trim(), format || 'csv');
    const preview = rows.slice(0, 5).map((r, i) => ({ row: i + 1, ...r }));

    res.json({ success: true, total: rows.length, preview });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
};

// ── Process bulk import ───────────────────────────────────────────────────
const processBulkImport = async (req, res) => {
  try {
    const { rawData, format, defaultType, skipDuplicates } = req.body;

    if (!rawData || !rawData.trim()) {
      return res.redirect('/admin/bulk-import?error=No+data+provided');
    }

    // Parse zone permissions from form
    const zones = await Zone.find({ isActive: true });
    const zoneDefaults = {};
    zones.forEach(z => {
      zoneDefaults[z.code] = {
        allowed: req.body[`zone_${z.code}_allowed`] === 'on',
        limit:   parseInt(req.body[`zone_${z.code}_limit`]) || z.defaultLimit,
        used:    0
      };
    });

    // Create import record
    const importRecord = await BulkImport.create({
      importedBy:  req.session.adminId,
      fileName:    'paste',
      status:      'processing'
    });

    const rows    = parseData(rawData.trim(), format || 'csv');
    const results = [];
    let successCount = 0, failedCount = 0, skippedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!row.name || !row.phone) {
        results.push({ row: rowNum, name: row.name || '', phone: row.phone || '', status: 'failed', reason: 'Missing name or phone' });
        failedCount++;
        continue;
      }

      // Check for duplicate phone
      const existing = await Person.findOne({ phone: row.phone.trim() });
      if (existing) {
        if (skipDuplicates === 'on') {
          results.push({ row: rowNum, name: row.name, phone: row.phone, status: 'skipped', reason: 'Phone already exists' });
          skippedCount++;
          continue;
        } else {
          results.push({ row: rowNum, name: row.name, phone: row.phone, status: 'failed', reason: 'Phone number already exists' });
          failedCount++;
          continue;
        }
      }

      // Validate type
      const validTypes = ['alumni', 'student', 'teacher', 'guest'];
      const personType = (row.type || defaultType || 'alumni').toLowerCase();
      if (!validTypes.includes(personType)) {
        results.push({ row: rowNum, name: row.name, phone: row.phone, status: 'failed', reason: `Invalid type: ${row.type}` });
        failedCount++;
        continue;
      }

      // Build permissions object dynamically from active zones
      const permissions = {};
      zones.forEach(z => {
        // Row-level override takes priority, then form defaults
        const rowAllowed = row[`${z.code}_allowed`];
        const rowLimit   = row[`${z.code}_limit`];
        permissions[z.code] = {
          allowed: rowAllowed !== undefined ? (rowAllowed === 'true' || rowAllowed === true || rowAllowed === '1') : (zoneDefaults[z.code]?.allowed ?? z.defaultAllowed),
          limit:   rowLimit   !== undefined ? parseInt(rowLimit) : (zoneDefaults[z.code]?.limit ?? z.defaultLimit),
          used:    0
        };
      });

      try {
        const person = await Person.create({
          name:    row.name.trim(),
          phone:   row.phone.trim(),
          type:    personType,
          status:  row.status || 'active',
          permissions,
          meta: {
            address: row.address || '',
            notes:   row.notes   || `Bulk imported row ${rowNum}`
          }
        });
        results.push({ row: rowNum, name: row.name, phone: row.phone, status: 'success', personId: person._id });
        successCount++;
      } catch (createErr) {
        results.push({ row: rowNum, name: row.name, phone: row.phone, status: 'failed', reason: createErr.message });
        failedCount++;
      }
    }

    // Update import record
    await BulkImport.findByIdAndUpdate(importRecord._id, {
      totalRows: rows.length,
      successCount,
      failedCount,
      skippedCount,
      status: 'done',
      results
    });

    res.redirect(`/admin/bulk-import/result/${importRecord._id}`);
  } catch (err) {
    console.error('Bulk import error:', err);
    res.redirect('/admin/bulk-import?error=' + encodeURIComponent(err.message));
  }
};

// ── View import result ────────────────────────────────────────────────────
const viewImportResult = async (req, res) => {
  try {
    const importRecord = await BulkImport.findById(req.params.id)
      .populate('importedBy', 'name');
    if (!importRecord) return res.redirect('/admin/bulk-import');

    res.render('admin/bulk-result', {
      title: 'Import Result',
      importRecord,
      query: {}
    });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

// ── Parse helper: CSV or JSON ─────────────────────────────────────────────
function parseData(raw, format) {
  if (format === 'json') {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  // CSV parsing
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

  // Parse header — support both comma and semicolon delimiters
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers   = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/"/g, ''));

  return lines.slice(1).map(line => {
    const values = parseCSVLine(line, delimiter);
    const obj    = {};
    headers.forEach((h, i) => { obj[h] = (values[i] || '').replace(/"/g, '').trim(); });
    return obj;
  });
}

// Handle quoted CSV fields
function parseCSVLine(line, delimiter) {
  const result = [];
  let current  = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; }
    else if (line[i] === delimiter && !inQuotes) { result.push(current); current = ''; }
    else { current += line[i]; }
  }
  result.push(current);
  return result;
}

module.exports = { showBulkImport, previewImport, processBulkImport, viewImportResult };
