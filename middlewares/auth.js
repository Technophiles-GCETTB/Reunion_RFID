const jwt          = require('jsonwebtoken');
const Admin        = require('../models/Admin');
const WriterModule = require('../models/WriterModule');

const requireSession = (req, res, next) => {
  if (req.session && req.session.adminId) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/admin/login');
};

const requireSuperAdmin = (req, res, next) => {
  if (req.session && req.session.role === 'superadmin') return next();
  res.redirect('/admin/dashboard');
};

const requireJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'No token provided' });
    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin   = await Admin.findById(decoded.id).select('-password');
    if (!admin || !admin.isActive)
      return res.status(401).json({ success: false, message: 'Invalid token' });
    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token expired or invalid' });
  }
};

// Attach session + writer module info to all EJS views
const attachLocals = async (req, res, next) => {
  res.locals.admin        = req.session.adminId ? { name: req.session.adminName, role: req.session.role } : null;
  res.locals.isSuperAdmin = req.session.role === 'superadmin';
  res.locals.currentPath  = req.path;
  res.locals.writerModule = null;

  // Attach assigned writer module if logged in
  if (req.session.adminId) {
    try {
      const mod = await WriterModule.findOne({ assignedTo: req.session.adminId, isActive: true });
      res.locals.writerModule = mod || null;
    } catch (e) { /* ignore */ }
  }
  next();
};

module.exports = { requireSession, requireSuperAdmin, requireJWT, attachLocals };
