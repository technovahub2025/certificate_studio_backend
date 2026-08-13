const mongoose = require('mongoose')

const generationSchema = new mongoose.Schema(
  {
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template',
      required: true,
      index: true,
    },
    dataFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DataFile',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    certificateId: String,
    certificateNumber: String,
    templateName: String,
    generatedFormat: String,
    generatedFilePath: String,
    fileUrl: String,
    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
    totalRecords: { type: Number, default: 0 },
    successfulRecords: { type: Number, default: 0 },
    failedRecords: { type: Number, default: 0 },
    outputFormat: {
      type: String,
      enum: ['pdf', 'png', 'jpg', 'jpeg', 'zip', 'pdf+jpg', 'pdf+zip', 'jpg+zip'],
      default: 'pdf',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    requestScope: {
      type: String,
      enum: ['single', 'selected', 'all'],
      default: 'all',
    },
    selectedRecordIds: { type: [String], default: [] },
    fieldMapping: {
      type: Map,
      of: String,
      default: {},
    },
    generatedFiles: {
      type: [
        {
          fileName: String,
          filePath: String,
          format: String,
          recordIndex: Number,
        },
      ],
      default: [],
    },
    errorMessage: String,
  },
  { timestamps: true },
)

generationSchema.index({ userId: 1, isArchived: 1, createdAt: -1 })
generationSchema.index({ createdBy: 1, isArchived: 1, createdAt: -1 })
generationSchema.index({ isArchived: 1, createdAt: 1 })

module.exports = mongoose.model('Generation', generationSchema)
