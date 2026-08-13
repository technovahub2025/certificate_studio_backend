const express = require('express')
const templateController = require('../controllers/templateController')
const { protect } = require('../middleware/authMiddleware')
const { upload } = require('../middleware/uploadMiddleware')

const router = express.Router()

router.use(protect)

router.get('/', templateController.listTemplates)
router.post('/', upload.single('template'), templateController.createTemplate)
router.get('/:id', templateController.getTemplate)
router.put('/:id', upload.single('template'), templateController.updateTemplate)
router.delete('/:id', templateController.deleteTemplate)
router.post('/:id/duplicate', templateController.duplicateTemplate)
router.post('/:id/mapping', templateController.saveMapping)

module.exports = router
