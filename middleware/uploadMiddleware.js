const fs = require('fs')
const path = require('path')
const multer = require('multer')
const ApiError = require('../utils/ApiError')

const uploadDir = path.join(__dirname, '..', 'uploads')
fs.mkdirSync(uploadDir, { recursive: true })

const allowedExtensions = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.svg', '.xlsx', '.xls', '.csv', '.txt'])

function safeFileName(originalName) {
  const ext = path.extname(originalName).toLowerCase()
  const base = path.basename(originalName, ext).replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '')
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base || 'upload'}${ext}`
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir)
  },
  filename(req, file, cb) {
    cb(null, safeFileName(file.originalname))
  },
})

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase()

  if (!allowedExtensions.has(ext)) {
    return cb(new ApiError(422, `Unsupported file type: ${ext || 'unknown'}`))
  }

  cb(null, true)
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
})

module.exports = { upload, allowedExtensions }
