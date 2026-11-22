const { AuditLog } = require('../models');
const { hashIp, so } = require('../utils/helpers');

const plain = (v) => {
  if (v === undefined || v === null) return v;
  const obj = typeof v.toObject === 'function' ? v.toObject() : v;
  return JSON.parse(JSON.stringify(obj));
};

/** Records an administrative change. Pass a session to make it part of a transaction. */
async function recordAudit({ req, adminId, action, entityType, entityId, previousValue, newValue, reason }, session) {
  const [log] = await AuditLog.create(
    [
      {
        adminId: adminId || req?.user?._id,
        action,
        entityType,
        entityId,
        previousValue: plain(previousValue),
        newValue: plain(newValue),
        reason,
        ipHash: req ? hashIp(req.ip) : undefined,
      },
    ],
    so(session)
  );
  return log;
}

module.exports = { recordAudit };
