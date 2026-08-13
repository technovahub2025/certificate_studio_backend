const asyncHandler = require('../utils/asyncHandler')
const { sendSuccess } = require('../utils/responses')
const templateService = require('../services/templateService')

const listTemplates = asyncHandler(async (req, res) => {
  const templates = await templateService.listTemplates(req.user)
  sendSuccess(res, 'Templates fetched successfully', templates)
})

const createTemplate = asyncHandler(async (req, res) => {
  const template = await templateService.createTemplate(req.user, req.body, req.file)
  sendSuccess(res, 'Template created successfully', template, 201)
})

const getTemplate = asyncHandler(async (req, res) => {
  const template = await templateService.getTemplate(req.user, req.params.id)
  sendSuccess(res, 'Template fetched successfully', template)
})

const updateTemplate = asyncHandler(async (req, res) => {
  const template = await templateService.updateTemplate(req.user, req.params.id, req.body, req.file)
  sendSuccess(res, 'Template updated successfully', template)
})

const deleteTemplate = asyncHandler(async (req, res) => {
  await templateService.deleteTemplate(req.user, req.params.id)
  sendSuccess(res, 'Template deleted successfully', {})
})

const duplicateTemplate = asyncHandler(async (req, res) => {
  const template = await templateService.duplicateTemplate(req.user, req.params.id)
  sendSuccess(res, 'Template duplicated successfully', template, 201)
})

const saveMapping = asyncHandler(async (req, res) => {
  const template = await templateService.saveMapping(req.user, req.params.id, req.body.mapping || req.body)
  sendSuccess(res, 'Template mapping saved successfully', template)
})

module.exports = {
  listTemplates,
  createTemplate,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  saveMapping,
}
