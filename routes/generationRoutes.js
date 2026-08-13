const express = require('express')
const generationController = require('../controllers/generationController')
const { protect } = require('../middleware/authMiddleware')

const router = express.Router()

router.use(protect)

router.post('/', generationController.createGeneration)
router.get('/', generationController.listGenerations)
router.get('/:id', generationController.getGeneration)
router.get('/:id/download', generationController.downloadGeneration)
router.get('/:id/download/:recordIndex', generationController.downloadSingleCertificate)
router.post('/:id/download', generationController.downloadGeneration)

module.exports = router
