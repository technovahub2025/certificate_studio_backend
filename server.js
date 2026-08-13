require('dotenv').config({ quiet: true })

const app = require('./app')
const connectDB = require('./config/db')
const { startHistoryRetentionJob } = require('./jobs/historyRetentionJob')

const port = process.env.PORT || 5000

async function startServer() {
  try {
    await connectDB()
    startHistoryRetentionJob()
    app.listen(port, () => {
      console.log(`API server running on port ${port}`)
    })
  } catch {
    console.error('Server startup failed')
    process.exit(1)
  }
}

startServer()
