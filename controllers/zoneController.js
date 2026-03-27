const Zone   = require('../models/Zone');
const Person = require('../models/Person');

// ── List zones ────────────────────────────────────────────────────────────
const listZones = async (req, res) => {
  try {
    const zones = await Zone.find().sort({ createdAt: 1 });
    res.render('admin/zones', {
      title: 'Zone Management',
      zones,
      query: req.query,
      error: null
    });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

// ── Create zone ───────────────────────────────────────────────────────────
const createZone = async (req, res) => {
  try {
    const { code, name, description, icon, defaultLimit, defaultAllowed, color, scannerIds } = req.body;

    // Parse scanner IDs from comma-separated string
    const scanners = scannerIds
      ? scannerIds.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    await Zone.create({
      code: code.toLowerCase().replace(/\s+/g, '_'),
      name,
      description: description || '',
      icon: icon || '📍',
      defaultLimit: parseInt(defaultLimit) || 1,
      defaultAllowed: defaultAllowed === 'on',
      color: color || '#3b82f6',
      scannerIds: scanners
    });

    res.redirect('/admin/zones?success=Zone+created+successfully');
  } catch (err) {
    const zones = await Zone.find().sort({ createdAt: 1 });
    res.render('admin/zones', {
      title: 'Zone Management',
      zones,
      query: {},
      error: err.code === 11000 ? 'Zone code already exists' : err.message
    });
  }
};

// ── Get zone for edit (JSON) ───────────────────────────────────────────────
const getZone = async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id);
    if (!zone) return res.status(404).json({ success: false, message: 'Zone not found' });
    res.json({ success: true, data: zone });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Update zone ───────────────────────────────────────────────────────────
const updateZone = async (req, res) => {
  try {
    const { name, description, icon, defaultLimit, defaultAllowed, color, isActive, scannerIds } = req.body;

    const scanners = scannerIds
      ? scannerIds.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    await Zone.findByIdAndUpdate(req.params.id, {
      name,
      description: description || '',
      icon: icon || '📍',
      defaultLimit: parseInt(defaultLimit) || 1,
      defaultAllowed: defaultAllowed === 'on',
      color: color || '#3b82f6',
      isActive: isActive === 'on',
      scannerIds: scanners
    }, { runValidators: true });

    res.redirect('/admin/zones?success=Zone+updated+successfully');
  } catch (err) {
    res.status(400).render('error', { message: err.message });
  }
};

// ── Delete zone ───────────────────────────────────────────────────────────
const deleteZone = async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id);
    if (!zone) return res.redirect('/admin/zones?error=Zone+not+found');

    // Prevent deleting core zones
    const coreCodes = ['entry', 'food', 'cultural', 'vip'];
    if (coreCodes.includes(zone.code)) {
      return res.redirect('/admin/zones?error=Cannot+delete+a+core+zone.+Deactivate+it+instead.');
    }

    await Zone.findByIdAndDelete(req.params.id);
    res.redirect('/admin/zones?success=Zone+deleted');
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

// ── Toggle active status ──────────────────────────────────────────────────
const toggleZone = async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id);
    if (!zone) return res.status(404).json({ success: false });
    zone.isActive = !zone.isActive;
    await zone.save();
    res.redirect('/admin/zones?success=Zone+status+updated');
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

// ── API: list active zones (for ESP8266/scan validation) ──────────────────
const apiListZones = async (req, res) => {
  try {
    const zones = await Zone.find({ isActive: true }).select('code name defaultLimit defaultAllowed');
    res.json({ success: true, data: zones });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { listZones, createZone, getZone, updateZone, deleteZone, toggleZone, apiListZones };
