const fs = require('fs/promises')
const path = require('path')
const XLSX = require('xlsx')
const { parse } = require('csv-parse/sync')
const pdfParse = require('pdf-parse')
const ApiError = require('../utils/ApiError')

function normalizeHeader(header, index) {
  const value = String(header || '').trim()
  return value || `Column ${index + 1}`
}

function rowsFromMatrix(matrix) {
  if (!matrix.length) {
    return { columns: [], rows: [] }
  }

  const columns = matrix[0].map(normalizeHeader)
  const rows = matrix.slice(1).filter((row) => row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== ''))
    .map((row) => {
      const record = {}
      columns.forEach((column, index) => {
        record[column] = row[index] ?? ''
      })
      return record
    })

  return { columns, rows }
}

async function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true })
  const firstSheet = workbook.SheetNames[0]

  if (!firstSheet) {
    throw new ApiError(422, 'Workbook does not contain any sheets')
  }

  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: '' })
  const parsed = rowsFromMatrix(matrix)

  return {
    ...parsed,
    sheets: workbook.SheetNames,
    warnings: [],
  }
}

async function parseDelimited(filePath, delimiter) {
  const content = await fs.readFile(filePath, 'utf8')
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter,
  })

  return {
    columns: records.length ? Object.keys(records[0]) : [],
    rows: records,
    sheets: [],
    warnings: [],
  }
}

async function parseText(filePath) {
  const content = await fs.readFile(filePath, 'utf8')
  const delimiter = content.includes('\t') ? '\t' : content.includes(',') ? ',' : null

  if (delimiter) {
    return parseDelimited(filePath, delimiter)
  }

  const rows = content.split(/\r?\n/).filter(Boolean).map((line, index) => ({ lineNumber: index + 1, text: line }))

  return {
    columns: rows.length ? ['lineNumber', 'text'] : [],
    rows,
    sheets: [],
    warnings: ['TXT file did not contain obvious tabular delimiters; returned one text row per line.'],
  }
}

async function parsePdf(filePath) {
  const buffer = await fs.readFile(filePath)
  const result = await pdfParse(buffer)
  const rows = result.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((text, index) => ({
    lineNumber: index + 1,
    text,
  }))

  return {
    columns: rows.length ? ['lineNumber', 'text'] : [],
    rows,
    sheets: [],
    warnings: ['PDF parsing extracts text only; arbitrary PDF tables may require a specialized parser later.'],
  }
}

async function parseDataFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase()

  if (ext === '.xlsx' || ext === '.xls') return parseExcel(filePath)
  if (ext === '.csv') return parseDelimited(filePath, ',')
  if (ext === '.txt') return parseText(filePath)
  if (ext === '.pdf') return parsePdf(filePath)

  throw new ApiError(422, `Unsupported data file type: ${ext}`)
}

module.exports = { parseDataFile }
