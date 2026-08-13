const express = require('express')
const dataController = require('../controllers/dataController')
const { protect } = require('../middleware/authMiddleware')
const { upload } = require('../middleware/uploadMiddleware')

const router = express.Router()

router.use(protect)

router.get('/', dataController.listDataFiles)
router.post('/upload', upload.single('dataFile'), dataController.uploadData)
router.get('/:id', dataController.getDataFile)
router.delete('/:id', dataController.deleteDataFile)
router.get('/:id/preview', dataController.previewDataFile)

module.exports = router
