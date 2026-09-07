const path = require('path')
const Template = require('../models/Template')
const ApiError = require('../utils/ApiError')

function canModify(user, template) {
  return user.role === 'admin' || template.createdBy.toString() === user._id.toString()
}

function parseDesign(input) {
  if (!input) return undefined
  if (typeof input === 'object') return input

  try {
    return JSON.parse(input)
  } catch {
    throw new ApiError(422, 'Design must be valid JSON')
  }
}

function publicUploadUrl(filePath) {
  return filePath ? `/uploads/${path.basename(filePath)}` : undefined
}

function defaultDesign(width, height, file) {
  const imageTypes = new Set(['.png', '.jpg', '.jpeg', '.svg'])
  const fileExt = file ? path.extname(file.originalname).toLowerCase() : ''
  const src = publicUploadUrl(file?.path)

  return {
    width,
    height,
    background: file && imageTypes.has(fileExt)
      ? { type: 'image', src }
      : fileExt === '.pdf'
        ? { type: 'pdf', src }
        : null,
    elements: [],
  }
}

async function listTemplates(user) {
  const query = user.role === 'admin' ? {} : { createdBy: user._id }
  return Template.find(query).sort({ updatedAt: -1 })
}

async function createTemplate(user, payload, file) {
  const width = Number(payload.width) || 1600
  const height = Number(payload.height) || 1100
  const design = parseDesign(payload.design) || defaultDesign(width, height, file)

  const template = await Template.create({
    name: payload.name,
    description: payload.description || '',
    mode: payload.mode || 'single',
    originalFile: file?.path,
    fileType: file ? path.extname(file.originalname).slice(1).toLowerCase() : payload.fileType || 'json',
    width,
    height,
    thumbnail: payload.thumbnail,
    design,
    createdBy: user._id,
  })

  return template
}

async function getTemplate(user, id) {
  const template = await Template.findById(id)
  if (!template) throw new ApiError(404, 'Template not found')
  if (!canModify(user, template)) throw new ApiError(403, 'You do not have access to this template')
  if (!template.design?.background && template.originalFile && template.fileType === 'pdf') {
    template.design = {
      ...(template.design?.toObject?.() || template.design || {}),
      width: template.width || 1600,
      height: template.height || 1100,
      background: { type: 'pdf', src: publicUploadUrl(template.originalFile) },
      elements: template.design?.elements || [],
    }
  }
  return template
}

async function updateTemplate(user, id, payload, file) {
  const template = await getTemplate(user, id)
  const next = {
    name: payload.name ?? template.name,
    description: payload.description ?? template.description,
    mode: payload.mode ?? (template.mode || 'single'),
    width: payload.width === undefined ? template.width : Number(payload.width),
    height: payload.height === undefined ? template.height : Number(payload.height),
    thumbnail: payload.thumbnail ?? template.thumbnail,
  }

  const design = parseDesign(payload.design)
  if (design) next.design = design

  if (file) {
    next.originalFile = file.path
    next.fileType = path.extname(file.originalname).slice(1).toLowerCase()
    const fileExt = path.extname(file.originalname).toLowerCase()
    if (['.png', '.jpg', '.jpeg', '.svg'].includes(fileExt)) {
      const currentDesign = next.design || template.design || defaultDesign(next.width, next.height)
      next.design = {
        ...currentDesign,
        background: { type: 'image', src: publicUploadUrl(file.path) },
      }
    } else if (fileExt === '.pdf') {
      const currentDesign = next.design || template.design || defaultDesign(next.width, next.height)
      next.design = {
        ...currentDesign,
        background: { type: 'pdf', src: publicUploadUrl(file.path) },
      }
    }
  }

  Object.assign(template, next)
  return template.save()
}

async function deleteTemplate(user, id) {
  const template = await getTemplate(user, id)
  await template.deleteOne()
  return template
}

async function duplicateTemplate(user, id) {
  const template = await getTemplate(user, id)
  const duplicate = template.toObject()
  delete duplicate._id
  delete duplicate.createdAt
  delete duplicate.updatedAt
  duplicate.name = `${template.name} Copy`
  duplicate.createdBy = user._id

  return Template.create(duplicate)
}

async function saveMapping(user, id, mapping) {
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    throw new ApiError(422, 'Mapping must be an object')
  }

  const template = await getTemplate(user, id)
  template.fieldMapping = mapping
  return template.save()
}

module.exports = {
  listTemplates,
  createTemplate,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  saveMapping,
}
