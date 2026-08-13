const asyncHandler = require('../utils/asyncHandler')
const { sendSuccess } = require('../utils/responses')
const generationService = require('../services/generationService')

const createGeneration = asyncHandler(async (req, res) => {
  const generation = await generationService.createGeneration(req.user, req.body)
  sendSuccess(res, 'Generation request created successfully', generation, 201)
})

const listGenerations = asyncHandler(async (req, res) => {
  const generations = await generationService.listGenerations(req.user)
  sendSuccess(res, 'Generations fetched successfully', generations)
})

const getGeneration = asyncHandler(async (req, res) => {
  const generation = await generationService.getGeneration(req.user, req.params.id)
  sendSuccess(res, 'Generation fetched successfully', generation)
})

const downloadGeneration = asyncHandler(async (req, res) => {
  if (req.method === 'GET') {
    const archive = await generationService.prepareDownloadArchive(req.user, req.params.id, req.query.format || 'pdf')
    res.setHeader('Content-Type', archive.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${archive.fileName}"`)
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    return res.send(archive.buffer)
  }

  const files = await generationService.prepareDownload(req.user, req.params.id)
  return sendSuccess(res, 'Generation files are ready for download', files)
})

const downloadSingleCertificate = asyncHandler(async (req, res) => {
  const file = await generationService.prepareSingleDownload(req.user, req.params.id, req.params.recordIndex, req.query.format || 'pdf')
  res.setHeader('Content-Type', file.mimeType)
  res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  return res.send(file.buffer)
})

module.exports = { createGeneration, listGenerations, getGeneration, downloadGeneration, downloadSingleCertificate }
