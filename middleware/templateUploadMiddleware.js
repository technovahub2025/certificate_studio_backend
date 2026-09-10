const multer = require('multer')
const ApiError = require('../utils/ApiError')
const path = require('path')

const allowedExtensions = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
])

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase()

  if (!allowedExtensions.has(ext)) {
    return cb(
      new ApiError(
        422,
        `Unsupported template file type: ${ext || 'unknown'}`,
      ),
    )
  }

  cb(null, true)
}

const uploadTemplate = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
})

module.exports = {
  uploadTemplate,
}
