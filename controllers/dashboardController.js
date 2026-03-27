const Person    = require('../models/Person');
const AccessLog = require('../models/AccessLog');

const dashboard = async (req, res) => {
  try {
    const [
      totalPersons,
      activePersons,
      totalAlumni,
      totalStudents,
      totalTeachers,
      totalGuests,
      totalScans,
      grantedScans,
      deniedScans,
      blockedCards,
      pendingUpgrades,
      recentLogs,
      zoneStats
    ] = await Promise.all([
      Person.countDocuments(),
      Person.countDocuments({ status: 'active' }),
      Person.countDocuments({ type: 'alumni' }),
      Person.countDocuments({ type: 'student' }),
      Person.countDocuments({ type: 'teacher' }),
      Person.countDocuments({ type: 'guest' }),
      AccessLog.countDocuments(),
      AccessLog.countDocuments({ status: 'GRANTED' }),
      AccessLog.countDocuments({ status: 'DENIED' }),
      Person.countDocuments({ 'card.isBlocked': true }),
      Person.countDocuments({ 'card.pendingUpgrade': true }),
      AccessLog.find().sort({ timestamp: -1 }).limit(10).populate('personId', 'name type'),
      AccessLog.aggregate([
        { $group: { _id: '$zoneCode', total: { $sum: 1 }, granted: { $sum: { $cond: [{ $eq: ['$status', 'GRANTED'] }, 1, 0] } } } },
        { $sort: { total: -1 } }
      ])
    ]);

    res.render('admin/dashboard', {
      title: 'Dashboard',
      stats: {
        totalPersons, activePersons,
        totalAlumni, totalStudents, totalTeachers, totalGuests,
        totalScans, grantedScans, deniedScans,
        blockedCards, pendingUpgrades
      },
      recentLogs,
      zoneStats
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: err.message });
  }
};

const logsPage = async (req, res) => {
  try {
    const { zone, status, search, page = 1 } = req.query;
    const limit  = 30;
    const skip   = (page - 1) * limit;
    const filter = {};
    if (zone)   filter.zoneCode = zone;
    if (status) filter.status   = status;

    const [logs, total] = await Promise.all([
      AccessLog.find(filter)
        .populate('personId', 'name type phone')
        .sort({ timestamp: -1 })
        .skip(skip).limit(limit),
      AccessLog.countDocuments(filter)
    ]);

    res.render('admin/logs', {
      title: 'Access Logs',
      logs,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      query: req.query
    });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

module.exports = { dashboard, logsPage };
