const mongoose = require('mongoose')

const dataFileSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    fileType: {
      type: String,
      enum: ['xlsx', 'xls', 'csv', 'txt', 'pdf'],
      required: true,
    },
    filePath: { type: String, required: true },
    recordCount: { type: Number, default: 0 },
    columns: { type: [String], default: [] },
    rows: { type: [mongoose.Schema.Types.Mixed], default: [] },
    sheets: { type: [String], default: [] },
    parserWarnings: { type: [String], default: [] },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model('DataFile', dataFileSchema)
