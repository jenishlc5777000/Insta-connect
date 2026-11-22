const ApiError = require('../utils/ApiError');
const { Workshop, Lead } = require('../models');
const { slugify, parseListQuery, buildMeta, escapeRegex, randomToken } = require('../utils/helpers');
const { recordAudit } = require('./auditService');
const { seatsTaken } = require('./leadService');
const { getSettings } = require('./settingsService');

async function uniqueSlug(base, excludeId) {
  const root = slugify(base) || `workshop-${randomToken(3)}`;
  let slug = root;
  for (let i = 2; await Workshop.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }); i += 1) slug = `${root}-${i}`;
  return slug;
}

async function uniqueCampaignCode(slug) {
  const root = `CMP-${slug.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
  let code = root;
  for (let i = 2; await Workshop.exists({ campaignCode: code }); i += 1) code = `${root}${i}`;
  return code;
}

async function withSeats(workshop) {
  const obj = workshop.toJSON ? workshop.toJSON() : workshop;
  const taken = await seatsTaken(obj._id);
  return { ...obj, seatsTaken: taken, seatsLeft: obj.capacity > 0 ? Math.max(0, obj.capacity - taken) : null };
}

async function create(data, req) {
  const slug = data.slug ? await uniqueSlug(data.slug) : await uniqueSlug(data.title);
  const workshop = await Workshop.create({ ...data, slug, campaignCode: await uniqueCampaignCode(slug), createdBy: req.user._id });
  await recordAudit({ req, action: 'workshop.create', entityType: 'Workshop', entityId: workshop._id, newValue: { title: workshop.title, status: workshop.status } });
  return withSeats(workshop);
}

async function update(id, data, req) {
  const workshop = await Workshop.findById(id).select('+meetingLink');
  if (!workshop) throw ApiError.notFound('Workshop not found');
  const before = { title: workshop.title, price: workshop.price, discountPrice: workshop.discountPrice, commissionRate: workshop.commissionRate, status: workshop.status, startDate: workshop.startDate };
  if (data.slug && data.slug !== workshop.slug) data.slug = await uniqueSlug(data.slug, workshop._id);
  workshop.set(data);
  await workshop.save();
  await recordAudit({
    req,
    action: 'workshop.update',
    entityType: 'Workshop',
    entityId: workshop._id,
    previousValue: before,
    newValue: { title: workshop.title, price: workshop.price, discountPrice: workshop.discountPrice, commissionRate: workshop.commissionRate, status: workshop.status, startDate: workshop.startDate },
  });
  return withSeats(workshop);
}

async function remove(id, req) {
  const workshop = await Workshop.findById(id);
  if (!workshop) throw ApiError.notFound('Workshop not found');
  if (await Lead.exists({ workshopId: workshop._id })) {
    throw ApiError.conflict('This workshop has registrations. Set its status to cancelled instead of deleting it.');
  }
  await workshop.deleteOne();
  await recordAudit({ req, action: 'workshop.delete', entityType: 'Workshop', entityId: workshop._id, previousValue: { title: workshop.title } });
}

async function list(query, { admin = false } = {}) {
  const { page, limit, skip, sort } = parseListQuery(query, { allowedSort: ['startDate', 'createdAt', 'title', 'price'], defaultSort: admin ? '-createdAt' : 'startDate' });
  const filter = {};
  if (admin) {
    if (query.status) filter.status = query.status;
  } else {
    filter.status = 'published';
    if (query.upcoming !== 'false') filter.endDate = { $gte: new Date() };
  }
  if (query.mode) filter.mode = query.mode;
  if (query.search) filter.title = new RegExp(escapeRegex(query.search.slice(0, 100)), 'i');
  const [items, total] = await Promise.all([
    Workshop.find(filter).select(admin ? '+meetingLink' : '').sort(sort).skip(skip).limit(limit),
    Workshop.countDocuments(filter),
  ]);
  return { items: await Promise.all(items.map(withSeats)), meta: buildMeta(total, page, limit) };
}

async function getBySlug(slug, { admin = false } = {}) {
  const workshop = await Workshop.findOne({ slug: String(slug).toLowerCase() });
  if (!workshop || (!admin && workshop.status === 'draft')) throw ApiError.notFound('Workshop not found');
  return withSeats(workshop);
}

async function getById(id) {
  const workshop = await Workshop.findById(id).select('+meetingLink');
  if (!workshop) throw ApiError.notFound('Workshop not found');
  return withSeats(workshop);
}

/** The workshop promoted on the landing page: admin-selected, else featured, else the next upcoming */
async function getFeatured() {
  const settings = await getSettings();
  const now = new Date();
  let workshop = null;
  if (settings.featuredWorkshopId) {
    workshop = await Workshop.findOne({ _id: settings.featuredWorkshopId, status: 'published', endDate: { $gte: now } });
  }
  if (!workshop) workshop = await Workshop.findOne({ status: 'published', featured: true, endDate: { $gte: now } }).sort('startDate');
  if (!workshop) workshop = await Workshop.findOne({ status: 'published', endDate: { $gte: now } }).sort('startDate');
  return workshop ? withSeats(workshop) : null;
}

module.exports = { create, update, remove, list, getBySlug, getById, getFeatured };
