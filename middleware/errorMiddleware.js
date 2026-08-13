const ApiError = require('../utils/ApiError')

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`))
}

function errorHandler(error, req, res, next) {
  let statusCode = error.statusCode || 500
  let message = error.message || 'Something went wrong'

  if (error.name === 'ValidationError') {
    statusCode = 422
    message = Object.values(error.errors).map((item) => item.message).join(', ')
  }

  if (error.code === 11000) {
    statusCode = 409
    const field = Object.keys(error.keyValue || {})[0] || 'field'
    message = `${field} already exists`
  }

  if (error.name === 'CastError') {
    statusCode = 400
    message = 'Invalid resource identifier'
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    statusCode = 400
    message = 'Invalid JSON payload'
  }

  res.status(statusCode).json({
    success: false,
    message,
  })
}

module.exports = { notFound, errorHandler }
