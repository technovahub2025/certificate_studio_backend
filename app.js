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

// ==========================================
// CORS - Allow All Origins
// ==========================================
app.use(cors({
  origin: true,
  credentials: true,
}))

// ==========================================
// Body Parser
// ==========================================
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// ==========================================
// REQUEST LOGGER
// Supports GET, POST, PUT, PATCH, DELETE
// ==========================================
app.use((req, res, next) => {
  const start = Date.now()

  console.log('\n=================================')
  console.log(`📥 ${req.method} REQUEST`)
  console.log(`URL: ${req.originalUrl}`)
  console.log(`Origin: ${req.headers.origin || 'No Origin'}`)
  console.log(`Time: ${new Date().toISOString()}`)

  res.on('finish', () => {
    const duration = Date.now() - start

    console.log(`📤 RESPONSE`)
    console.log(`Method: ${req.method}`)
    console.log(`Status: ${res.statusCode}`)
    console.log(`Duration: ${duration}ms`)
    console.log('=================================\n')
  })

  next()
})

// ==========================================
// Static Uploads
// ==========================================
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}generated${path.sep}`)) {
        res.setHeader(
          'Cache-Control',
          'no-store, no-cache, must-revalidate, proxy-revalidate'
        )
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')
      }
    },
  })
)

// ==========================================
// Health Check
// ==========================================
app.get('/', (req, res) => {
  res.send('Backend is running!')
})

// ==========================================
// API Routes
// ==========================================
app.use('/api/auth', authRoutes)
app.use('/api/templates', templateRoutes)
app.use('/api/data', dataRoutes)
app.use('/api/generations', generationRoutes)
app.use('/api/history', historyRoutes)

// ==========================================
// Error Handlers
// ==========================================
app.use(notFound)
app.use(errorHandler)

module.exports = app