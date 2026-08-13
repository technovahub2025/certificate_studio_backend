const asyncHandler = require('../utils/asyncHandler')
const { sendSuccess } = require('../utils/responses')
const dataService = require('../services/dataService')

const uploadData = asyncHandler(async (req, res) => {
  const dataFile = await dataService.uploadDataFile(req.user, req.file)
  sendSuccess(res, 'Data file uploaded successfully', dataFile, 201)
})

const listDataFiles = asyncHandler(async (req, res) => {
  const files = await dataService.listDataFiles(req.user)
  sendSuccess(res, 'Data files fetched successfully', files)
})

const getDataFile = asyncHandler(async (req, res) => {
  const file = await dataService.getDataFile(req.user, req.params.id)
  sendSuccess(res, 'Data file fetched successfully', file)
})

const deleteDataFile = asyncHandler(async (req, res) => {
  await dataService.deleteDataFile(req.user, req.params.id)
  sendSuccess(res, 'Data file deleted successfully', {})
})

const previewDataFile = asyncHandler(async (req, res) => {
  const preview = await dataService.previewDataFile(req.user, req.params.id, req.query.page, req.query.limit)
  sendSuccess(res, 'Data preview fetched successfully', {
    columns: preview.columns,
    rows: preview.rows,
    recordCount: preview.recordCount,
    warnings: preview.warnings,
  }, 200, preview.pagination)
})

module.exports = { uploadData, listDataFiles, getDataFile, deleteDataFile, previewDataFile }
