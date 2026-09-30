const mongoose = require('mongoose');
const Detection = require('../models/Detection');
const ApiError = require('../utils/ApiError');
const detectionService = require('../services/detectionService');
const { sendSuccess } = require('../utils/response');

const RECENT_EVENTS_LIMIT = 5;
const TOP_OBJECTS_LIMIT = 5;
const ALL_TIME_OBJECTS_LIMIT = 12;

// [{ objectClass, count }] - most frequent object classes for a filter.
function countByClass(match, limit) {
  return Detection.aggregate([
    { $match: match },
    { $group: { _id: '$objectClass', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 0, objectClass: '$_id', count: 1 } },
  ]);
}

// "Today" depends on the user's timezone, so the browser sends its local
// midnight as ?since=. Without it we fall back to the server's midnight.
function resolveSince(since) {
  if (!since) {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return midnight;
  }
  const date = new Date(since);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest('since must be a valid date');
  return date;
}

// GET /api/dashboard/stats
async function getStats(req, res) {
  const since = resolveSince(req.query.since);
  // aggregate() doesn't auto-cast like find(), so convert the id explicitly.
  const userId = new mongoose.Types.ObjectId(req.user.id);

  const [detectionsToday, totalDetections, topObjectsToday, topObjects, statusGroups, failedUploads, recentDetections] =
    await Promise.all([
      Detection.countDocuments({ userId, timestamp: { $gte: since } }),
      Detection.countDocuments({ userId }),
      countByClass({ userId, timestamp: { $gte: since } }, TOP_OBJECTS_LIMIT),
      countByClass({ userId }, ALL_TIME_OBJECTS_LIMIT),
      Detection.aggregate([{ $match: { userId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Detection.countDocuments({ userId, imageStatus: 'failed' }),
      Detection.find({ userId }).sort({ timestamp: -1 }).limit(RECENT_EVENTS_LIMIT),
    ]);

  const statusCounts = { new: 0, reviewed: 0, dismissed: 0 };
  statusGroups.forEach(({ _id, count }) => {
    statusCounts[_id] = count;
  });

  sendSuccess(res, {
    detectionsToday,
    totalDetections,
    topObjectsToday,
    topObjects,
    statusCounts,
    failedUploads,
    recentEvents: await Promise.all(recentDetections.map(detectionService.toDetectionResponse)),
    lastDetectionAt: recentDetections[0]?.timestamp ?? null,
  });
}

module.exports = { getStats };
