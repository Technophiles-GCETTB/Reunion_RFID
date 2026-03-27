const Person    = require('../models/Person');
const AccessLog = require('../models/AccessLog');

// ── List all persons ──────────────────────────────────────────────────────────
const listPersons = async (req, res) => {
  try {
    const { type, status, search } = req.query;
    const filter = {};
    if (type)   filter.type   = type;
    if (status) filter.status = status;
    if (search) filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];

    const persons = await Person.find(filter)
      .populate('broughtBy', 'name phone')
      .sort({ createdAt: -1 });

    if (req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, data: persons });
    }

    res.render('admin/persons', {
      title: 'Persons',
      persons,
      query: req.query
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: err.message });
  }
};

// ── Show add person form ──────────────────────────────────────────────────────
const showAddForm = async (req, res) => {
  try {
    const hosts = await Person.find({ type: { $ne: 'guest' }, status: 'active' }, 'name phone type');
    res.render('admin/person-form', {
      title: 'Add Person',
      person: null,
      hosts,
      error: null
    });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

// ── Create person ─────────────────────────────────────────────────────────────
const createPerson = async (req, res) => {
  try {
    const {
      name, phone, type, broughtBy, address, notes, status,
      'permissions.food.allowed':     foodAllowed,
      'permissions.food.limit':       foodLimit,
      'permissions.cultural.allowed': culturalAllowed,
      'permissions.cultural.limit':   culturalLimit,
      'permissions.vip.allowed':      vipAllowed,
      'permissions.vip.limit':        vipLimit,
      'permissions.entry.allowed':    entryAllowed,
      'permissions.entry.limit':      entryLimit
    } = req.body;

    const personData = {
      name, phone, type, status: status || 'active',
      broughtBy: broughtBy || null,
      meta: { address: address || '', notes: notes || '' },
      permissions: {
        food:     { allowed: foodAllowed     === 'on', limit: parseInt(foodLimit)     || 2, used: 0 },
        cultural: { allowed: culturalAllowed === 'on', limit: parseInt(culturalLimit) || 1, used: 0 },
        vip:      { allowed: vipAllowed      === 'on', limit: parseInt(vipLimit)      || 1, used: 0 },
        entry:    { allowed: entryAllowed    === 'on', limit: parseInt(entryLimit)    || 1, used: 0 }
      }
    };

    const person = await Person.create(personData);

    // If guest, add to host's guest list
    if (type === 'guest' && broughtBy) {
      await Person.findByIdAndUpdate(broughtBy, { $addToSet: { guests: person._id } });
    }

    res.redirect('/admin/persons?success=Person+added+successfully');
  } catch (err) {
    const hosts = await Person.find({ type: { $ne: 'guest' }, status: 'active' }, 'name phone type');
    res.render('admin/person-form', {
      title: 'Add Person',
      person: null,
      hosts,
      error: err.code === 11000 ? 'Phone number already exists' : err.message
    });
  }
};

// ── Show edit form ────────────────────────────────────────────────────────────
const showEditForm = async (req, res) => {
  try {
    const person = await Person.findById(req.params.id).populate('broughtBy', 'name phone');
    if (!person) return res.redirect('/admin/persons');
    const hosts = await Person.find({ type: { $ne: 'guest' }, status: 'active', _id: { $ne: person._id } }, 'name phone type');
    res.render('admin/person-form', { title: 'Edit Person', person, hosts, error: null });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

// ── Update person ─────────────────────────────────────────────────────────────
const updatePerson = async (req, res) => {
  try {
    const {
      name, phone, type, address, notes, status,
      'permissions.food.allowed':     foodAllowed,
      'permissions.food.limit':       foodLimit,
      'permissions.cultural.allowed': culturalAllowed,
      'permissions.cultural.limit':   culturalLimit,
      'permissions.vip.allowed':      vipAllowed,
      'permissions.vip.limit':        vipLimit,
      'permissions.entry.allowed':    entryAllowed,
      'permissions.entry.limit':      entryLimit
    } = req.body;

    await Person.findByIdAndUpdate(req.params.id, {
      name, phone, type, status,
      'meta.address': address || '',
      'meta.notes':   notes   || '',
      'permissions.food.allowed':     foodAllowed     === 'on',
      'permissions.food.limit':       parseInt(foodLimit)     || 2,
      'permissions.cultural.allowed': culturalAllowed === 'on',
      'permissions.cultural.limit':   parseInt(culturalLimit) || 1,
      'permissions.vip.allowed':      vipAllowed      === 'on',
      'permissions.vip.limit':        parseInt(vipLimit)      || 1,
      'permissions.entry.allowed':    entryAllowed    === 'on',
      'permissions.entry.limit':      parseInt(entryLimit)    || 1
    }, { runValidators: true });

    res.redirect('/admin/persons?success=Person+updated');
  } catch (err) {
    res.status(400).render('error', { message: err.message });
  }
};

// ── Block / Unblock card ──────────────────────────────────────────────────────
const blockCard = async (req, res) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person) return res.status(404).json({ success: false, message: 'Not found' });
    person.card.isBlocked = true;
    person.card.pendingUpgrade = true;
    await person.save();
    res.redirect('/admin/persons?success=Card+blocked+and+upgrade+requested');
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

const unblockCard = async (req, res) => {
  try {
    await Person.findByIdAndUpdate(req.params.id, {
      'card.isBlocked': false
    });
    res.redirect('/admin/persons?success=Card+unblocked');
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

// ── Card upgrade requests (superadmin) ────────────────────────────────────────
const listUpgradeRequests = async (req, res) => {
  try {
    const requests = await Person.find({ 'card.pendingUpgrade': true }).sort({ updatedAt: -1 });
    res.render('admin/upgrades', { title: 'Card Upgrade Requests', requests });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

const approveUpgrade = async (req, res) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person) return res.status(404).render('error', { message: 'Person not found' });
    person.card.version        += 1;
    person.card.isBlocked       = false;
    person.card.pendingUpgrade  = false;
    await person.save();
    res.redirect('/admin/upgrades?success=Card+upgraded+to+v' + person.card.version);
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

// ── Person detail ─────────────────────────────────────────────────────────────
const viewPerson = async (req, res) => {
  try {
    const person = await Person.findById(req.params.id)
      .populate('broughtBy', 'name phone')
      .populate('guests', 'name phone type status');
    if (!person) return res.redirect('/admin/persons');

    const logs = await AccessLog.find({ personId: person._id })
      .sort({ timestamp: -1 })
      .limit(20);

    res.render('admin/person-detail', { title: person.name, person, logs });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

// ── Reset usage counts ────────────────────────────────────────────────────────
const resetUsage = async (req, res) => {
  try {
    await Person.findByIdAndUpdate(req.params.id, {
      'permissions.food.used':     0,
      'permissions.cultural.used': 0,
      'permissions.vip.used':      0,
      'permissions.entry.used':    0
    });
    res.redirect(`/admin/persons/${req.params.id}?success=Usage+reset`);
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

module.exports = {
  listPersons, showAddForm, createPerson,
  showEditForm, updatePerson, blockCard, unblockCard,
  listUpgradeRequests, approveUpgrade, viewPerson, resetUsage
};
