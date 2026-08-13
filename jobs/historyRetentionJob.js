const historyService = require('../services/historyService')
const { HISTORY_ARCHIVE_INTERVAL_MS, HISTORY_RETENTION_DAYS } = require('../config/history')

let timer = null

async function runHistoryArchiveJob() {
  try {
    const result = await historyService.archiveExpiredHistory()
    if (result.modifiedCount) {
      console.log(`Archived ${result.modifiedCount} generation history records older than ${HISTORY_RETENTION_DAYS} days`)
    }
  } catch (error) {
    console.error('History archive job failed:', error.message)
  }
}

function startHistoryRetentionJob() {
  if (timer) return timer
  runHistoryArchiveJob()
  timer = setInterval(runHistoryArchiveJob, HISTORY_ARCHIVE_INTERVAL_MS)
  timer.unref?.()
  return timer
}

module.exports = { startHistoryRetentionJob, runHistoryArchiveJob }
