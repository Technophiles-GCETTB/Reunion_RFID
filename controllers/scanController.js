const Person    = require('../models/Person');
const AccessLog = require('../models/AccessLog');
const Zone      = require('../models/Zone');

const processScan = async (req, res) => {
  const { personId, cardVersion, zoneCode, scannerId } = req.body;

  if (!personId || cardVersion === undefined || !zoneCode || !scannerId) {
    return res.status(400).json({ status: 'DENIED', reason: 'Missing required fields' });
  }

  let person = null, denyReason = null, granted = false;

  try {
    // Step 1: Zone valid and active
    const zone = await Zone.findOne({ code: zoneCode, isActive: true });
    if (!zone) denyReason = `Zone "${zoneCode}" does not exist or is inactive`;

    // Step 2: Person exists
    if (!denyReason) {
      person = await Person.findById(personId);
      if (!person) denyReason = 'Person not found';
    }

    // Step 3: Status active
    if (!denyReason && person.status !== 'active') denyReason = 'Person account is inactive';

    // Step 4: Card not blocked
    if (!denyReason && person.card.isBlocked) denyReason = 'Card is blocked. Please contact admin';

    // Step 5: Card version matches
    if (!denyReason && person.card.version !== Number(cardVersion))
      denyReason = `Card version mismatch. Expected v${person.card.version}, got v${cardVersion}`;

    // Step 6: Zone permission allowed
    if (!denyReason) {
      const perm = person.permissions?.[zoneCode];
      if (!perm || !perm.allowed) denyReason = `Access to zone "${zoneCode}" is not permitted`;
    }

    // Step 7: Usage count < limit
    if (!denyReason) {
      const perm = person.permissions[zoneCode];
      if (perm.used >= perm.limit)
        denyReason = `Zone "${zoneCode}" usage limit reached (${perm.used}/${perm.limit})`;
    }

    // Step 8: Grant
    if (!denyReason) {
      granted = true;
      await Person.findByIdAndUpdate(personId, { $inc: { [`permissions.${zoneCode}.used`]: 1 } });
    }
  } catch (err) {
    if (err.name === 'CastError') denyReason = 'Invalid person ID format';
    else { console.error('Scan error:', err); return res.status(500).json({ status: 'DENIED', reason: 'Internal server error' }); }
  }

  try {
    await AccessLog.create({
      personId: person?._id || personId, zoneCode, scannerId,
      status: granted ? 'GRANTED' : 'DENIED', reason: denyReason || '',
      snapshot: person ? { name: person.name, type: person.type, cardVersion: person.card.version } : {}
    });
  } catch (logErr) { console.error('Log error:', logErr.message); }

  if (granted) return res.json({ status: 'GRANTED', person: { name: person.name, type: person.type }, zone: zoneCode });
  return res.json({ status: 'DENIED', reason: denyReason });
};

module.exports = { processScan };
