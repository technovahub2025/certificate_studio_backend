const HISTORY_RETENTION_DAYS = Number(process.env.HISTORY_RETENTION_DAYS) || 30
const HISTORY_ARCHIVE_INTERVAL_MS = Number(process.env.HISTORY_ARCHIVE_INTERVAL_MS) || 6 * 60 * 60 * 1000

function historyRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000)
}

module.exports = {
  HISTORY_RETENTION_DAYS,
  HISTORY_ARCHIVE_INTERVAL_MS,
  historyRetentionCutoff,
}
