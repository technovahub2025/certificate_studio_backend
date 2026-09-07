const mongoose = require('mongoose')

const designElementSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['text', 'dynamic-text', 'image', 'signature', 'qr-code', 'shape'],
    },
    text: String,
    field: String,
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    rotation: { type: Number, default: 0 },
    fontFamily: String,
    fontSize: Number,
    fontWeight: mongoose.Schema.Types.Mixed,
    fontStyle: String,
    underline: Boolean,
    color: String,
    textAlign: String,
    align: String,
    letterSpacing: Number,
    lineHeight: Number,
    fill: String,
    stroke: String,
    strokeWidth: Number,
    shape: String,
    source: String,
    src: String,
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
)

const designSchema = new mongoose.Schema(
  {
    width: { type: Number, default: 1600 },
    height: { type: Number, default: 1100 },
    background: { type: mongoose.Schema.Types.Mixed, default: null },
    elements: { type: [designElementSchema], default: [] },
    fabricJson: { type: mongoose.Schema.Types.Mixed, default: null },
    coordinateModel: { type: String, default: 'fabric' },
  },
  { _id: false },
)

const templateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      maxlength: 160,
    },
    description: { type: String, trim: true, default: '' },
    mode: {
      type: String,
      enum: ['single', 'bulk'],
      default: 'single',
    },
    originalFile: String,
    thumbnail: String,
    fileType: {
      type: String,
      enum: ['pdf', 'png', 'jpg', 'jpeg', 'svg', 'json', 'unknown'],
      default: 'unknown',
    },
    width: { type: Number, default: 1600 },
    height: { type: Number, default: 1100 },
    design: { type: designSchema, default: () => ({}) },
    fieldMapping: {
      type: Map,
      of: String,
      default: {},
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Template', templateSchema)
