const jwt = require('jsonwebtoken')
const User = require('../models/User')
const ApiError = require('../utils/ApiError')

function signToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new ApiError(500, 'JWT_SECRET is required')
  }

  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

async function registerUser({ name, email, password, role }) {
  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email, and password are required')
  }

  if (password.length < 8) {
    throw new ApiError(422, 'Password must be at least 8 characters')
  }

  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) {
    throw new ApiError(409, 'Email already exists')
  }

  const user = await User.create({ name, email, password, role: role === 'admin' ? 'admin' : 'user' })
  const token = signToken(user)

  return { user, token }
}

async function loginUser({ email, password }) {
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required')
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password')
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password')
  }

  const token = signToken(user)
  user.password = undefined

  return { user, token }
}

module.exports = { registerUser, loginUser }
