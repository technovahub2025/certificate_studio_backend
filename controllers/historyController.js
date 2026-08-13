const asyncHandler = require('../utils/asyncHandler')
const { sendSuccess } = require('../utils/responses')
const historyService = require('../services/historyService')
const { HISTORY_RETENTION_DAYS } = require('../config/history')

const listHistory = asyncHandler(async (req, res) => {
  const history = await historyService.listHistory(req.user, { limit: req.query.limit })
  sendSuccess(res, 'History fetched successfully', {
    retentionDays: HISTORY_RETENTION_DAYS,
    records: history,
  })
})

const clearHistory = asyncHandler(async (req, res) => {
  const result = await historyService.clearHistory(req.user)
  sendSuccess(res, 'History cleared successfully', result)
})

const archiveHistoryItem = asyncHandler(async (req, res) => {
  const history = await historyService.archiveHistoryItem(req.user, req.params.id)
  sendSuccess(res, 'History record archived successfully', history)
})

module.exports = { listHistory, clearHistory, archiveHistoryItem }
