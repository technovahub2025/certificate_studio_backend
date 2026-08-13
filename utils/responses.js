function sendSuccess(res, message, data = {}, statusCode = 200, pagination) {
  const payload = { success: true, message, data }

  if (pagination) {
    payload.pagination = pagination
  }

  return res.status(statusCode).json(payload)
}

module.exports = { sendSuccess }
