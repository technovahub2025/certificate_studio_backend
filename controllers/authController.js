const asyncHandler = require('../utils/asyncHandler')
const { sendSuccess } = require('../utils/responses')
const { registerUser, loginUser } = require('../services/authService')

const register = asyncHandler(async (req, res) => {
  const data = await registerUser(req.body)
  sendSuccess(res, 'User registered successfully', data, 201)
})

const login = asyncHandler(async (req, res) => {
  const data = await loginUser(req.body)
  sendSuccess(res, 'User logged in successfully', data)
})

const me = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Current user fetched successfully', { user: req.user })
})

const logout = asyncHandler(async (req, res) => {
  sendSuccess(res, 'User logged out successfully', {})
})

module.exports = { register, login, me, logout }
