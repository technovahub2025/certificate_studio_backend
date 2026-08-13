const express = require('express')
const historyController = require('../controllers/historyController')
const { protect } = require('../middleware/authMiddleware')

const router = express.Router()

router.use(protect)

router.get('/', historyController.listHistory)
router.post('/clear', historyController.clearHistory)
router.delete('/:id', historyController.archiveHistoryItem)

module.exports = router
