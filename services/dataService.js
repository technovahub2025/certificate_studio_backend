const path = require('path')
const DataFile = require('../models/DataFile')
const ApiError = require('../utils/ApiError')
const { parseDataFile } = require('../parsers/dataParser')

function canAccess(user, dataFile) {
  return user.role === 'admin' || dataFile.uploadedBy.toString() === user._id.toString()
}

async function uploadDataFile(user, file) {
  if (!file) {
    throw new ApiError(400, 'Data file is required')
  }

  const fileType = path.extname(file.originalname).slice(1).toLowerCase()
  const parsed = await parseDataFile(file.path, file.originalname)

  return DataFile.create({
    fileName: file.filename,
    originalName: file.originalname,
    fileType,
    filePath: file.path,
    recordCount: parsed.rows.length,
    columns: parsed.columns,
    rows: parsed.rows,
    sheets: parsed.sheets,
    parserWarnings: parsed.warnings,
    uploadedBy: user._id,
  })
}

async function listDataFiles(user) {
  const query = user.role === 'admin' ? {} : { uploadedBy: user._id }
  return DataFile.find(query).select('-rows').sort({ updatedAt: -1 })
}

async function getDataFile(user, id) {
  const dataFile = await DataFile.findById(id)
  if (!dataFile) throw new ApiError(404, 'Data file not found')
  if (!canAccess(user, dataFile)) throw new ApiError(403, 'You do not have access to this data file')
  return dataFile
}

async function deleteDataFile(user, id) {
  const dataFile = await getDataFile(user, id)
  await dataFile.deleteOne()
  return dataFile
}

async function previewDataFile(user, id, page = 1, limit = 20) {
  const dataFile = await getDataFile(user, id)
  const safePage = Math.max(Number(page) || 1, 1)
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100)
  const start = (safePage - 1) * safeLimit
  const rows = dataFile.rows.slice(start, start + safeLimit)
  const total = dataFile.recordCount

  return {
    columns: dataFile.columns,
    rows,
    recordCount: total,
    warnings: dataFile.parserWarnings,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  }
}

module.exports = { uploadDataFile, listDataFiles, getDataFile, deleteDataFile, previewDataFile }
