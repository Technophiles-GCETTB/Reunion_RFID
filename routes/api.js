const express    = require('express');
const router     = express.Router();
const { processScan }           = require('../controllers/scanController');
const { apiLogin }              = require('../controllers/authController');
const { requireJWT }            = require('../middlewares/auth');
const Person    = require('../models/Person');
const AccessLog = require('../models/AccessLog');

// Public
router.post('/auth/login', apiLogin);

// Scan endpoint — called by ESP32 (JWT protected)
router.post('/scan', requireJWT, processScan);

// Person lookup by ID (for ESP32 verification)
router.get('/person/:id', requireJWT, async (req, res) => {
  try {
    const person = await Person.findById(req.params.id).select('name type status card.version card.isBlocked');
    if (!person) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: person });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Stats endpoint
router.get('/stats', requireJWT, async (req, res) => {
  try {
    const [total, active, scans, granted] = await Promise.all([
      Person.countDocuments(),
      Person.countDocuments({ status: 'active' }),
      AccessLog.countDocuments(),
      AccessLog.countDocuments({ status: 'GRANTED' })
    ]);
    res.json({ success: true, data: { total, active, scans, granted } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

// Dynamic zones list (for ESP8266)
const { apiListZones } = require('../controllers/zoneController');
router.get('/zones', requireJWT, apiListZones);
