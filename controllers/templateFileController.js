const mongoose = require('mongoose')
const { downloadFromGridFS } = require('../utils/gridfs')
const ApiError = require('../utils/ApiError')

async function getTemplateFile(req, res) {
  const { id } = req.params

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid file id')
  }

  const stream = downloadFromGridFS(id)

  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(404).json({
        success: false,
        message: 'Template file not found',
      })
    }
  })

  stream.on('file', (file) => {
    if (file.contentType) {
      res.setHeader('Content-Type', file.contentType)
    }

    if (file.length !== undefined) {
      res.setHeader('Content-Length', file.length)
    }
  })

  stream.pipe(res)
}

module.exports = {
  getTemplateFile,
}
