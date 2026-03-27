const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');

// ── List all admins ───────────────────────────────────────────────────────
const listAdmins = async (req, res) => {
  try {
    const admins = await Admin.find().select('-password').sort({ createdAt: -1 });
    res.render('admin/admins', {
      title: 'Admin Management',
      admins,
      query: req.query,
      error: null,
      currentAdminId: req.session.adminId
    });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

// ── Get single admin as JSON (for edit modal) ─────────────────────────────
const getAdmin = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id).select('-password');
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    res.json({ success: true, data: admin });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Create admin ──────────────────────────────────────────────────────────
const createAdmin = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role } = req.body;

    if (!name || !email || !password) {
      return res.redirect('/admin/admins?error=Name,+email+and+password+are+required');
    }
    if (password !== confirmPassword) {
      return res.redirect('/admin/admins?error=Passwords+do+not+match');
    }
    if (password.length < 6) {
      return res.redirect('/admin/admins?error=Password+must+be+at+least+6+characters');
    }

    await Admin.create({ name, email, password, role: role || 'admin', isActive: true });
    res.redirect('/admin/admins?success=Admin+created+successfully');
  } catch (err) {
    if (err.code === 11000) {
      return res.redirect('/admin/admins?error=Email+already+exists');
    }
    res.redirect('/admin/admins?error=' + encodeURIComponent(err.message));
  }
};

// ── Update admin ──────────────────────────────────────────────────────────
const updateAdmin = async (req, res) => {
  try {
    const { name, email, role, isActive, newPassword, confirmPassword } = req.body;
    const targetId = req.params.id;

    // Prevent superadmin from demoting themselves
    if (targetId === req.session.adminId && role !== 'superadmin') {
      return res.redirect('/admin/admins?error=You+cannot+change+your+own+role');
    }

    const updateData = { name, email, role, isActive: isActive === 'on' };

    // Only update password if provided
    if (newPassword && newPassword.trim()) {
      if (newPassword !== confirmPassword) {
        return res.redirect('/admin/admins?error=Passwords+do+not+match');
      }
      if (newPassword.length < 6) {
        return res.redirect('/admin/admins?error=Password+must+be+at+least+6+characters');
      }
      updateData.password = await bcrypt.hash(newPassword, 12);
    }

    await Admin.findByIdAndUpdate(targetId, updateData, { runValidators: true, new: true });
    res.redirect('/admin/admins?success=Admin+updated+successfully');
  } catch (err) {
    if (err.code === 11000) {
      return res.redirect('/admin/admins?error=Email+already+exists');
    }
    res.redirect('/admin/admins?error=' + encodeURIComponent(err.message));
  }
};

// ── Delete admin ──────────────────────────────────────────────────────────
const deleteAdmin = async (req, res) => {
  try {
    const targetId = req.params.id;

    // Prevent self-deletion
    if (targetId === req.session.adminId) {
      return res.redirect('/admin/admins?error=You+cannot+delete+your+own+account');
    }

    // Ensure at least one superadmin remains
    const target = await Admin.findById(targetId);
    if (!target) return res.redirect('/admin/admins?error=Admin+not+found');

    if (target.role === 'superadmin') {
      const superAdminCount = await Admin.countDocuments({ role: 'superadmin', _id: { $ne: targetId } });
      if (superAdminCount === 0) {
        return res.redirect('/admin/admins?error=Cannot+delete+the+only+Super+Admin');
      }
    }

    await Admin.findByIdAndDelete(targetId);
    res.redirect('/admin/admins?success=Admin+deleted');
  } catch (err) {
    res.redirect('/admin/admins?error=' + encodeURIComponent(err.message));
  }
};

// ── Toggle active status ──────────────────────────────────────────────────
const toggleAdminStatus = async (req, res) => {
  try {
    const targetId = req.params.id;

    if (targetId === req.session.adminId) {
      return res.redirect('/admin/admins?error=You+cannot+deactivate+your+own+account');
    }

    const admin = await Admin.findById(targetId);
    if (!admin) return res.redirect('/admin/admins?error=Admin+not+found');

    admin.isActive = !admin.isActive;
    await admin.save();
    res.redirect('/admin/admins?success=Admin+status+updated');
  } catch (err) {
    res.redirect('/admin/admins?error=' + encodeURIComponent(err.message));
  }
};

// ── Change own password ───────────────────────────────────────────────────
const changeOwnPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const admin = await Admin.findById(req.session.adminId);

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) return res.redirect('/admin/admins?error=Current+password+is+incorrect');

    if (newPassword !== confirmPassword) return res.redirect('/admin/admins?error=New+passwords+do+not+match');
    if (newPassword.length < 6) return res.redirect('/admin/admins?error=Password+must+be+at+least+6+characters');

    admin.password = newPassword;
    await admin.save();
    res.redirect('/admin/admins?success=Password+changed+successfully');
  } catch (err) {
    res.redirect('/admin/admins?error=' + encodeURIComponent(err.message));
  }
};

module.exports = { listAdmins, getAdmin, createAdmin, updateAdmin, deleteAdmin, toggleAdminStatus, changeOwnPassword };
