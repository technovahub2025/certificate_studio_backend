const Generation = require('../models/Generation')
const ApiError = require('../utils/ApiError')
const { historyRetentionCutoff } = require('../config/history')

function ownerFilter(user) {
  return {
    $or: [
      { userId: user._id },
      { userId: { $exists: false }, createdBy: user._id },
      { userId: null, createdBy: user._id },
    ],
  }
}

function activeArchiveFilter() {
  return {
    $or: [
      { isArchived: false },
      { isArchived: { $exists: false } },
    ],
  }
}

async function archiveExpiredHistory(now = new Date()) {
  const cutoff = historyRetentionCutoff(now)
  return Generation.updateMany(
    {
      ...activeArchiveFilter(),
      createdAt: { $lt: cutoff },
    },
    {
      $set: {
        isArchived: true,
        archivedAt: now,
      },
    },
  )
}

async function listHistory(user, options = {}) {
  await archiveExpiredHistory()
  const cutoff = historyRetentionCutoff()
  const limit = Math.min(Number(options.limit) || 100, 200)

  const query = {
    $and: [
      ownerFilter(user),
      activeArchiveFilter(),
    ],
    createdAt: { $gte: cutoff },
  }

  return Generation.find(query)
    .populate('templateId', 'name')
    .populate('dataFileId', 'originalName recordCount')
    .sort({ createdAt: -1 })
    .limit(limit)
}

async function clearHistory(user) {
  const now = new Date()
  const result = await Generation.updateMany(
    {
      $and: [
        ownerFilter(user),
        activeArchiveFilter(),
      ],
    },
    {
      $set: {
        isArchived: true,
        archivedAt: now,
      },
    },
  )

  return { archivedCount: result.modifiedCount || 0 }
}

async function archiveHistoryItem(user, id) {
  const generation = await Generation.findOne({
    _id: id,
    ...ownerFilter(user),
  })

  if (!generation) throw new ApiError(404, 'History record not found')

  generation.isArchived = true
  generation.archivedAt = new Date()
  await generation.save()
  return generation
}

module.exports = {
  archiveExpiredHistory,
  listHistory,
  clearHistory,
  archiveHistoryItem,
}
