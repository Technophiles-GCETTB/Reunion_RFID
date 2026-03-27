const express  = require('express');
const router   = express.Router();
const { requireSession, requireSuperAdmin } = require('../middlewares/auth');
const { showLogin, sessionLogin, sessionLogout } = require('../controllers/authController');
const { dashboard, logsPage }                   = require('../controllers/dashboardController');
const {
  listPersons, showAddForm, createPerson,
  showEditForm, updatePerson, blockCard, unblockCard,
  listUpgradeRequests, approveUpgrade, viewPerson, resetUsage
} = require('../controllers/personController');
const { listZones, createZone, getZone, updateZone, deleteZone, toggleZone } = require('../controllers/zoneController');
const { showBulkImport, previewImport, processBulkImport, viewImportResult }  = require('../controllers/bulkController');
const { listAdmins, getAdmin, createAdmin, updateAdmin, deleteAdmin, toggleAdminStatus, changeOwnPassword } = require('../controllers/adminController');
const { listWriterModules, getWriterModule, createWriterModule, updateWriterModule, deleteWriterModule, toggleWriterModule, getMyWriterModule } = require('../controllers/writerController');

// Auth
router.get('/login',  showLogin);
router.post('/login', sessionLogin);
router.get('/logout', sessionLogout);
router.use(requireSession);

// Dashboard + shared
router.get('/dashboard', dashboard);
router.get('/persons',              listPersons);
router.get('/persons/add',          showAddForm);
router.post('/persons/add',         createPerson);
router.get('/persons/:id',          viewPerson);
router.get('/persons/:id/edit',     showEditForm);
router.post('/persons/:id/edit',    updatePerson);
router.post('/persons/:id/block',   blockCard);
router.post('/persons/:id/unblock', unblockCard);
router.post('/persons/:id/reset',   resetUsage);
router.get('/logs', logsPage);

// Writer machine (for non-superadmin to get their own assigned machine)
router.get('/my-writer', getMyWriterModule);

// Super admin only
router.get('/upgrades',              requireSuperAdmin, listUpgradeRequests);
router.post('/upgrades/:id/approve', requireSuperAdmin, approveUpgrade);

router.get('/zones',              requireSuperAdmin, listZones);
router.post('/zones',             requireSuperAdmin, createZone);
router.get('/zones/:id',          requireSuperAdmin, getZone);
router.post('/zones/:id/update',  requireSuperAdmin, updateZone);
router.post('/zones/:id/delete',  requireSuperAdmin, deleteZone);
router.post('/zones/:id/toggle',  requireSuperAdmin, toggleZone);

router.get('/bulk-import',              requireSuperAdmin, showBulkImport);
router.post('/bulk-import/preview',     requireSuperAdmin, previewImport);
router.post('/bulk-import/process',     requireSuperAdmin, processBulkImport);
router.get('/bulk-import/result/:id',   requireSuperAdmin, viewImportResult);

router.get('/admins',                  requireSuperAdmin, listAdmins);
router.get('/admins/:id',              requireSuperAdmin, getAdmin);
router.post('/admins/create',          requireSuperAdmin, createAdmin);
router.post('/admins/:id/update',      requireSuperAdmin, updateAdmin);
router.post('/admins/:id/delete',      requireSuperAdmin, deleteAdmin);
router.post('/admins/:id/toggle',      requireSuperAdmin, toggleAdminStatus);
router.post('/admins/change-password', requireSession,    changeOwnPassword);

router.get('/writer-modules',                requireSuperAdmin, listWriterModules);
router.get('/writer-modules/:id',            requireSuperAdmin, getWriterModule);
router.post('/writer-modules/create',        requireSuperAdmin, createWriterModule);
router.post('/writer-modules/:id/update',    requireSuperAdmin, updateWriterModule);
router.post('/writer-modules/:id/delete',    requireSuperAdmin, deleteWriterModule);
router.post('/writer-modules/:id/toggle',    requireSuperAdmin, toggleWriterModule);

router.get('/', (req, res) => res.redirect('/admin/dashboard'));
module.exports = router;
