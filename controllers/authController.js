const jwt   = require('jsonwebtoken');
const Admin = require('../models/Admin');

// ── EJS Session Login ─────────────────────────────────────────────────────────
const showLogin = (req, res) => {
  if (req.session.adminId) return res.redirect('/admin/dashboard');
  res.render('admin/login', { title: 'Admin Login', error: null });
};

const sessionLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin || !await admin.comparePassword(password)) {
      return res.render('admin/login', {
        title: 'Admin Login',
        error: 'Invalid email or password'
      });
    }
    if (!admin.isActive) {
      return res.render('admin/login', {
        title: 'Admin Login',
        error: 'Account is deactivated'
      });
    }
    req.session.adminId   = admin._id.toString();
    req.session.adminName = admin.name;
    req.session.role      = admin.role;

    const returnTo = req.session.returnTo || '/admin/dashboard';
    delete req.session.returnTo;
    res.redirect(returnTo);
  } catch (err) {
    res.render('admin/login', { title: 'Admin Login', error: err.message });
  }
};

const sessionLogout = (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
};

// ── JWT API Login ─────────────────────────────────────────────────────────────
const apiLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin || !await admin.comparePassword(password)) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      success: true,
      token,
      admin: { name: admin.name, email: admin.email, role: admin.role }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { showLogin, sessionLogin, sessionLogout, apiLogin };
