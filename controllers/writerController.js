const WriterModule = require('../models/WriterModule');
const Admin        = require('../models/Admin');

// ── List all writer modules (superadmin) ──────────────────────────────────
const listWriterModules = async (req, res) => {
  try {
    const modules = await WriterModule.find()
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 });

    // All admins for assignment dropdown
    const admins = await Admin.find({ isActive: true }).select('name email role').sort({ name: 1 });

    // Which admins already have a machine (for disabling in dropdown)
    const assignedAdminIds = modules
      .filter(m => m.assignedTo)
      .map(m => m.assignedTo._id.toString());

    res.render('admin/writer-modules', {
      title: 'Writer Modules',
      modules,
      admins,
      assignedAdminIds,
      query: req.query,
      error: null
    });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

// ── Get single module as JSON (for edit modal) ────────────────────────────
const getWriterModule = async (req, res) => {
  try {
    const mod = await WriterModule.findById(req.params.id).populate('assignedTo', 'name email');
    if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });
    res.json({ success: true, data: mod });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Create writer module ──────────────────────────────────────────────────
const createWriterModule = async (req, res) => {
  try {
    const { name, ip, assignedTo, notes } = req.body;

    // Enforce: each admin max 1 machine
    if (assignedTo) {
      const existing = await WriterModule.findOne({ assignedTo });
      if (existing) {
        return res.redirect('/admin/writer-modules?error=' + encodeURIComponent(`That admin is already assigned to machine "${existing.name}"`));
      }
    }

    await WriterModule.create({
      name,
      ip: ip.trim(),
      assignedTo: assignedTo || null,
      notes: notes || ''
    });

    res.redirect('/admin/writer-modules?success=Writer+module+created');
  } catch (err) {
    res.redirect('/admin/writer-modules?error=' + encodeURIComponent(err.message));
  }
};

// ── Update writer module ──────────────────────────────────────────────────
const updateWriterModule = async (req, res) => {
  try {
    const { name, ip, assignedTo, notes, isActive } = req.body;
    const moduleId = req.params.id;

    // Enforce: each admin max 1 machine (exclude current module)
    if (assignedTo) {
      const existing = await WriterModule.findOne({
        assignedTo,
        _id: { $ne: moduleId }
      });
      if (existing) {
        return res.redirect('/admin/writer-modules?error=' + encodeURIComponent(`That admin is already assigned to machine "${existing.name}"`));
      }
    }

    await WriterModule.findByIdAndUpdate(moduleId, {
      name,
      ip: ip.trim(),
      assignedTo: assignedTo || null,
      notes: notes || '',
      isActive: isActive === 'on'
    }, { runValidators: true });

    res.redirect('/admin/writer-modules?success=Writer+module+updated');
  } catch (err) {
    res.redirect('/admin/writer-modules?error=' + encodeURIComponent(err.message));
  }
};

// ── Delete writer module ──────────────────────────────────────────────────
const deleteWriterModule = async (req, res) => {
  try {
    await WriterModule.findByIdAndDelete(req.params.id);
    res.redirect('/admin/writer-modules?success=Writer+module+deleted');
  } catch (err) {
    res.redirect('/admin/writer-modules?error=' + encodeURIComponent(err.message));
  }
};

// ── Toggle active ─────────────────────────────────────────────────────────
const toggleWriterModule = async (req, res) => {
  try {
    const mod = await WriterModule.findById(req.params.id);
    if (!mod) return res.redirect('/admin/writer-modules?error=Module+not+found');
    mod.isActive = !mod.isActive;
    await mod.save();
    res.redirect('/admin/writer-modules?success=Module+status+updated');
  } catch (err) {
    res.redirect('/admin/writer-modules?error=' + encodeURIComponent(err.message));
  }
};

// ── Get assigned module for currently logged-in admin ─────────────────────
const getMyWriterModule = async (req, res) => {
  try {
    const mod = await WriterModule.findOne({
      assignedTo: req.session.adminId,
      isActive: true
    });
    res.json({ success: true, data: mod || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  listWriterModules, getWriterModule, createWriterModule,
  updateWriterModule, deleteWriterModule, toggleWriterModule, getMyWriterModule
};
