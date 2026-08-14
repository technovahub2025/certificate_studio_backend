const express = require('express')
const cors = require('cors')
const path = require('path')
const authRoutes = require('./routes/authRoutes')
const templateRoutes = require('./routes/templateRoutes')
const dataRoutes = require('./routes/dataRoutes')
const generationRoutes = require('./routes/generationRoutes')
const historyRoutes = require('./routes/historyRoutes')
const { notFound, errorHandler } = require('./middleware/errorMiddleware')

const app = express()

const allowedOrigins = new Set([
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
].filter(Boolean))

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true)
    }

    return callback(new Error(`Origin not allowed by CORS: ${origin}`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders(res, filePath) {
    if (filePath.includes(`${path.sep}generated${path.sep}`)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
    }
  },
}))

  app.get("/", (req, res) => {
    res.send("Backend is running!");
  });

app.use('/api/auth', authRoutes)
app.use('/api/templates', templateRoutes)
app.use('/api/data', dataRoutes)
app.use('/api/generations', generationRoutes)
app.use('/api/history', historyRoutes)

app.use(notFound)
app.use(errorHandler)

module.exports = app
