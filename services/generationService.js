const fs = require('fs/promises')
const path = require('path')
const fabric = require('fabric/node')
const Generation = require('../models/Generation')
const Template = require('../models/Template')
const DataFile = require('../models/DataFile')
const ApiError = require('../utils/ApiError')
const { historyRetentionCutoff } = require('../config/history')

const GENERATED_DIR = path.join(
  __dirname,
  '..',
  'uploads',
  'generated',
)

// Keep this at 2 for Render to avoid excessive RAM/CPU usage.
const GENERATION_CONCURRENCY = Math.max(
  1,
  Number(process.env.GENERATION_CONCURRENCY) || 2,
)

const FABRIC_CUSTOM_PROPERTIES = [
  'certId',
  'certType',
  'certField',
  'certSource',
  'certShape',
  'elementType',
  'fieldKey',
  'textFit',
  'isBackground',
  'desiredWidth',
  'desiredHeight',
]

fabric.FabricObject.customProperties =
  FABRIC_CUSTOM_PROPERTIES

const CRC_TABLE = Array.from(
  { length: 256 },
  (_, index) => {
    let value = index

    for (let bit = 0; bit < 8; bit += 1) {
      value =
        value & 1
          ? 0xedb88320 ^
            (value >>> 1)
          : value >>> 1
    }

    return value >>> 0
  },
)

function canAccess(user, ownerId) {
  return (
    user.role === 'admin' ||
    ownerId.toString() ===
      user._id.toString()
  )
}

function crc32(buffer) {
  let value = 0xffffffff

  for (const byte of buffer) {
    value =
      CRC_TABLE[
        (value ^ byte) & 0xff
      ] ^
      (value >>> 8)
  }

  return (
    value ^
    0xffffffff
  ) >>> 0
}

function dosDateTime(
  date = new Date(),
) {
  const year = Math.max(
    date.getFullYear(),
    1980,
  )

  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(
      date.getSeconds() / 2,
    )

  const dosDate =
    ((year - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate()

  return {
    dosTime,
    dosDate,
  }
}

function createZip(files) {
  const localParts = []
  const centralParts = []
  let offset = 0

  const {
    dosTime,
    dosDate,
  } = dosDateTime()

  for (const file of files) {
    const nameBuffer =
      Buffer.from(file.name)

    const checksum =
      crc32(file.buffer)

    const localHeader =
      Buffer.alloc(30)

    localHeader.writeUInt32LE(
      0x04034b50,
      0,
    )

    localHeader.writeUInt16LE(
      20,
      4,
    )

    localHeader.writeUInt16LE(
      0,
      6,
    )

    localHeader.writeUInt16LE(
      0,
      8,
    )

    localHeader.writeUInt16LE(
      dosTime,
      10,
    )

    localHeader.writeUInt16LE(
      dosDate,
      12,
    )

    localHeader.writeUInt32LE(
      checksum,
      14,
    )

    localHeader.writeUInt32LE(
      file.buffer.length,
      18,
    )

    localHeader.writeUInt32LE(
      file.buffer.length,
      22,
    )

    localHeader.writeUInt16LE(
      nameBuffer.length,
      26,
    )

    localHeader.writeUInt16LE(
      0,
      28,
    )

    localParts.push(
      localHeader,
      nameBuffer,
      file.buffer,
    )

    const centralHeader =
      Buffer.alloc(46)

    centralHeader.writeUInt32LE(
      0x02014b50,
      0,
    )

    centralHeader.writeUInt16LE(
      20,
      4,
    )

    centralHeader.writeUInt16LE(
      20,
      6,
    )

    centralHeader.writeUInt16LE(
      0,
      8,
    )

    centralHeader.writeUInt16LE(
      0,
      10,
    )

    centralHeader.writeUInt16LE(
      dosTime,
      12,
    )

    centralHeader.writeUInt16LE(
      dosDate,
      14,
    )

    centralHeader.writeUInt32LE(
      checksum,
      16,
    )

    centralHeader.writeUInt32LE(
      file.buffer.length,
      20,
    )

    centralHeader.writeUInt32LE(
      file.buffer.length,
      24,
    )

    centralHeader.writeUInt16LE(
      nameBuffer.length,
      28,
    )

    centralHeader.writeUInt16LE(
      0,
      30,
    )

    centralHeader.writeUInt16LE(
      0,
      32,
    )

    centralHeader.writeUInt16LE(
      0,
      34,
    )

    centralHeader.writeUInt16LE(
      0,
      36,
    )

    centralHeader.writeUInt32LE(
      0,
      38,
    )

    centralHeader.writeUInt32LE(
      offset,
      42,
    )

    centralParts.push(
      centralHeader,
      nameBuffer,
    )

    offset +=
      localHeader.length +
      nameBuffer.length +
      file.buffer.length
  }

  const centralDirectory =
    Buffer.concat(
      centralParts,
    )

  const end =
    Buffer.alloc(22)

  end.writeUInt32LE(
    0x06054b50,
    0,
  )

  end.writeUInt16LE(
    0,
    4,
  )

  end.writeUInt16LE(
    0,
    6,
  )

  end.writeUInt16LE(
    files.length,
    8,
  )

  end.writeUInt16LE(
    files.length,
    10,
  )

  end.writeUInt32LE(
    centralDirectory.length,
    12,
  )

  end.writeUInt32LE(
    offset,
    16,
  )

  end.writeUInt16LE(
    0,
    20,
  )

  return Buffer.concat([
    ...localParts,
    centralDirectory,
    end,
  ])
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      '_',
    )
    .replace(
      /^_+|_+$/g,
      '',
    )
}

function humanizeField(field) {
  return (field || 'dynamic field')
    .replace(
      /[_-]+/g,
      ' ',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    )
}

function isSingleGeneration(
  generation,
) {
  return !!(
    generation &&
    (
      generation.mode ===
        'single' ||
      !generation.dataFileId
    )
  )
}

function resolveRowValue(
  row,
  field,
  mapping,
) {
  const mappedColumn =
    mapping?.[field] ||
    field

  if (
    row[mappedColumn] !==
      undefined &&
    row[mappedColumn] !== null
  ) {
    return row[mappedColumn]
  }

  const matchingColumn =
    Object.keys(row).find(
      (column) =>
        normalizeKey(column) ===
        normalizeKey(
          mappedColumn,
        ),
    )

  return matchingColumn
    ? row[matchingColumn]
    : ''
}

function fileToDataUri(
  filePath,
) {
  const ext =
    path
      .extname(filePath)
      .slice(1)
      .toLowerCase()

  const mime =
    ext === 'jpg' ||
    ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'svg'
        ? 'image/svg+xml'
        : 'image/png'

  const buffer =
    require('fs').readFileSync(
      filePath,
    )

  return `data:${mime};base64,${buffer.toString(
    'base64',
  )}`
}

function uploadSourcePath(src) {
  if (
    !src ||
    src.startsWith('data:')
  ) {
    return ''
  }

  let source = src

  if (
    /^https?:\/\//i.test(
      source,
    )
  ) {
    try {
      const url = new URL(
        source,
      )

      source =
        url.pathname
    } catch {
      return ''
    }
  }

  const relative =
    source.startsWith(
      '/uploads/',
    )
      ? source.replace(
          /^\/uploads\//,
          '',
        )
      : path.basename(
          source,
        )

  return path.join(
    __dirname,
    '..',
    'uploads',
    relative,
  )
}

function dataUrlToBuffer(
  dataUrl,
) {
  return Buffer.from(
    String(dataUrl).split(
      ',',
    )[1] || '',
    'base64',
  )
}

function legacyElementToFabricObject(
  element,
) {
  const base = {
    left:
      Number(element.x) || 0,

    top:
      Number(element.y) || 0,

    originX:
      element.originX ||
      'left',

    originY:
      element.originY ||
      'top',

    angle:
      Number(element.rotation) ||
      0,

    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    visible: true,

    certId:
      element.id,

    certType:
      element.type,

    certField:
      element.field || '',

    certSource:
      element.src ||
      element.source ||
      '',

    certShape:
      element.shape || '',

    elementType:
      element.type,

    fieldKey:
      element.field || '',
  }

  if (
    element.type === 'text' ||
    element.type ===
      'dynamic-text'
  ) {
    return {
      ...base,

      type: 'Textbox',

      text:
        element.type ===
        'dynamic-text'
          ? `{{${element.field || 'field'}}}`
          : element.text ||
            'Text',

      width:
        Number(element.width) ||
        520,

      height:
        Number(element.height) ||
        70,

      fontFamily:
        element.fontFamily ||
        'Inter',

      fontSize:
        Number(element.fontSize) ||
        42,

      fontWeight:
        element.fontWeight ||
        '600',

      fontStyle:
        element.fontStyle ||
        'normal',

      underline:
        Boolean(
          element.underline,
        ),

      fill:
        element.color ||
        '#172033',

      textAlign:
        element.textAlign ||
        element.align ||
        'center',

      charSpacing:
        Number(
          element.letterSpacing,
        ) || 0,

      lineHeight:
        Number(
          element.lineHeight,
        ) || 1.2,
    }
  }

  if (
    element.type === 'image' ||
    element.type ===
      'signature'
  ) {
    return {
      ...base,

      type: 'Image',

      src:
        element.src ||
        element.source ||
        '',

      width:
        Number(element.width) ||
        240,

      height:
        Number(element.height) ||
        120,

      desiredWidth:
        Number(element.width) ||
        240,

      desiredHeight:
        Number(element.height) ||
        120,
    }
  }

  if (
    element.type ===
    'shape'
  ) {
    return {
      ...base,

      type: 'Rect',

      width:
        Number(element.width) ||
        220,

      height:
        Number(element.height) ||
        120,

      fill:
        element.fill ||
        '#ffffff',

      stroke:
        element.stroke ||
        '#172033',

      strokeWidth:
        Number(
          element.strokeWidth,
        ) || 1,
    }
  }

  return {
    ...base,

    type: 'Textbox',

    text: 'QR',

    width:
      Number(element.width) ||
      150,

    height:
      Number(element.height) ||
      150,

    fontSize: 34,
    fontWeight: '700',
    textAlign: 'center',
    fill: '#172033',
  }
}

function designToFabricJson(
  template,
) {
  const design =
    template.design?.toObject?.() ||
    template.design ||
    {}

  const width =
    Number(
      design.width ||
        template.width,
    ) || 1600

  const height =
    Number(
      design.height ||
        template.height,
    ) || 1100

  if (
    design.fabricJson?.objects
      ?.length
  ) {
    return {
      width,
      height,

      json: JSON.parse(
        JSON.stringify(
          design.fabricJson,
        ),
      ),
    }
  }

  const objects = []

  if (
    design.background
      ?.type === 'image' &&
    design.background.src
  ) {
    objects.push({
      type: 'Image',

      src:
        design.background.src,

      left: 0,
      top: 0,

      originX: 'left',
      originY: 'top',

      scaleX: 1,
      scaleY: 1,

      width,
      height,

      desiredWidth: width,
      desiredHeight: height,

      selectable: false,
      evented: false,

      isBackground: true,

      certType:
        'background',

      elementType:
        'background',
    })
  }

  objects.push(
    ...(design.elements ||
      []
    ).map(
      legacyElementToFabricObject,
    ),
  )

  return {
    width,
    height,

    json: {
      version: '7.4.0',
      objects,
    },
  }
}

async function normalizeAssetSource(src) {
  if (!src || src.startsWith('data:')) {
    return src
  }

  const gridfsMatch = src.match(
    /\/api\/templates\/file\/([a-f0-9]{24})$/i,
  )

  if (gridfsMatch) {
    const { downloadFromGridFS } =
      require('../utils/gridfs')

    const stream = downloadFromGridFS(
      gridfsMatch[1],
    )

    const chunks = []

    for await (const chunk of stream) {
      chunks.push(chunk)
    }

    const buffer = Buffer.concat(chunks)

    let mime = 'image/png'

    return `data:${mime};base64,${buffer.toString('base64')}`
  }

  const absolutePath =
    uploadSourcePath(src)

  return absolutePath
    ? fileToDataUri(absolutePath)
    : src
}

async function hydrateFabricAssetSources(value) {
  if (Array.isArray(value)) {
    return Promise.all(
      value.map(hydrateFabricAssetSources),
    )
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const next = {}

  for (const [key, child] of Object.entries(value)) {
    next[key] =
      key === 'src'
        ? await normalizeAssetSource(child)
        : await hydrateFabricAssetSources(child)
  }

  return next
}

async function prepareRenderTemplate(template) {
  const {
    width,
    height,
    json,
  } = designToFabricJson(template)

  return {
    width,
    height,
    json: await hydrateFabricAssetSources(json),
  }
}

function resolveFabricDynamicText(
  canvas,
  row,
  mapping,
  isSingle,
) {
  canvas
    .getObjects()
    .forEach(
      (object) => {
        if (
          object.elementType ===
            'dynamic-text' ||
          object.certType ===
            'dynamic-text'
        ) {
          const field =
            object.fieldKey ||
            object.certField

          const resolved =
            String(
              resolveRowValue(
                row,
                field,
                mapping,
              ) || '',
            )

          object.set(
            'text',
            isSingle &&
            !resolved
              ? humanizeField(
                  field,
                )
              : resolved,
          )

          object.setCoords()
        }
      },
    )
}

/*
 * Creates ONE Fabric canvas for a worker.
 *
 * The certificate background/template is loaded
 * only once and then reused for multiple rows.
 */
async function createFabricWorkerRenderer({
  preparedTemplate,
  format,
  singleMode = false,
}) {
  const {
    width,
    height,
    json,
  } = preparedTemplate

  const canvas =
    new fabric.StaticCanvas(
      null,
      {
        width,
        height,

        backgroundColor:
          '#ffffff',

        enableRetinaScaling:
          false,
      },
    )

  try {
    await canvas.loadFromJSON(
      JSON.parse(
        JSON.stringify(json),
      ),
    )

    canvas
      .getObjects()
      .forEach(
        (object) => {
          if (
            object.isBackground ||
            object.elementType ===
              'background' ||
            object.certType ===
              'background'
          ) {
            object.set({
              left: 0,
              top: 0,

              originX: 'left',
              originY: 'top',

              scaleX:
                width /
                (
                  object.width ||
                  width
                ),

              scaleY:
                height /
                (
                  object.height ||
                  height
                ),

              selectable: false,
              evented: false,
            })

            canvas.sendObjectToBack(
              object,
            )
          } else if (
            (
              object.elementType ===
                'image' ||
              object.certType ===
                'image' ||
              object.elementType ===
                'signature'
            ) &&
            object.desiredWidth &&
            object.desiredHeight
          ) {
            object.set({
              scaleX:
                object.desiredWidth /
                (
                  object.width ||
                  object.desiredWidth
                ),

              scaleY:
                object.desiredHeight /
                (
                  object.height ||
                  object.desiredHeight
                ),
            })
          }

          object.setCoords()
        },
      )

    return {
      canvas,
      width,
      height,
      format,
      singleMode,
    }
  } catch (error) {
    canvas.dispose()
    throw error
  }
}

/*
 * Reuses an existing Fabric canvas.
 *
 * Only dynamic text is changed for each row.
 */
function renderFromFabricWorker(
  renderer,
  row,
  mapping,
) {
  const {
    canvas,
    width,
    height,
    format,
    singleMode,
  } = renderer

  resolveFabricDynamicText(
    canvas,
    row,
    mapping,
    singleMode,
  )

  canvas.renderAll()

  return {
    width,
    height,

    dataUrl:
      canvas.toDataURL({
        format:
          format === 'jpeg' ||
          format === 'jpg'
            ? 'jpeg'
            : 'png',

        quality: 0.95,

        multiplier: 1,
      }),
  }
}

async function renderFabricDataUrl({
  template,
  preparedTemplate,
  row,
  mapping,
  format = 'png',
  multiplier = 1,
  singleMode = false,
}) {
  const prepared =
    preparedTemplate ||
    await prepareRenderTemplate(
      template,
    )

  const {
    width,
    height,
    json,
  } = prepared

  const canvas =
    new fabric.StaticCanvas(
      null,
      {
        width,
        height,

        backgroundColor:
          '#ffffff',

        enableRetinaScaling:
          false,
      },
    )

  try {
    await canvas.loadFromJSON(
      JSON.parse(
        JSON.stringify(json),
      ),
    )

    canvas
      .getObjects()
      .forEach(
        (object) => {
          if (
            object.isBackground ||
            object.elementType ===
              'background' ||
            object.certType ===
              'background'
          ) {
            object.set({
              left: 0,
              top: 0,

              originX: 'left',
              originY: 'top',

              scaleX:
                width /
                (
                  object.width ||
                  width
                ),

              scaleY:
                height /
                (
                  object.height ||
                  height
                ),

              selectable: false,
              evented: false,
            })

            canvas.sendObjectToBack(
              object,
            )
          } else if (
            (
              object.elementType ===
                'image' ||
              object.certType ===
                'image' ||
              object.elementType ===
                'signature'
            ) &&
            object.desiredWidth &&
            object.desiredHeight
          ) {
            object.set({
              scaleX:
                object.desiredWidth /
                (
                  object.width ||
                  object.desiredWidth
                ),

              scaleY:
                object.desiredHeight /
                (
                  object.height ||
                  object.desiredHeight
                ),
            })
          }

          object.setCoords()
        },
      )

    resolveFabricDynamicText(
      canvas,
      row,
      mapping,
      singleMode,
    )

    canvas.renderAll()

    return {
      width,
      height,

      dataUrl:
        canvas.toDataURL({
          format:
            format === 'jpeg' ||
            format === 'jpg'
              ? 'jpeg'
              : 'png',

          quality: 0.95,

          multiplier,
        }),
    }
  } finally {
    canvas.dispose()
  }
}

async function buildPdf({
  template,
  preparedTemplate,
  row,
  mapping,
  singleMode = false,
}) {
  const rendered =
    await renderFabricDataUrl({
      template,
      preparedTemplate,
      row,
      mapping,

      format: 'jpeg',

      singleMode,
    })

  const width =
    rendered.width

  const height =
    rendered.height

  const imageBuffer =
    dataUrlToBuffer(
      rendered.dataUrl,
    )

  const content = [
    `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`,
  ]

  const contentBuffer =
    Buffer.from(
      content.join('\n'),
      'utf8',
    )

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',

    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',

    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`,

    `<< /Length ${contentBuffer.length} >>\nstream\n${contentBuffer.toString(
      'binary',
    )}\nendstream`,
  ]

  objects.push(
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBuffer.length} >>\nstream\n${imageBuffer.toString(
      'binary',
    )}\nendstream`,
  )

  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  )

  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  )

  const chunks = [
    '%PDF-1.4\n',
  ]

  const offsets = [0]

  for (
    const [
      index,
      object,
    ] of objects.entries()
  ) {
    offsets.push(
      Buffer.byteLength(
        chunks.join(''),
        'binary',
      ),
    )

    chunks.push(
      `${index + 1} 0 obj\n${object}\nendobj\n`,
    )
  }

  const xrefOffset =
    Buffer.byteLength(
      chunks.join(''),
      'binary',
    )

  chunks.push(
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`,
  )

  for (
    let index = 1;
    index <=
    objects.length;
    index += 1
  ) {
    chunks.push(
      `${String(
        offsets[index],
      ).padStart(
        10,
        '0',
      )} 00000 n \n`,
    )
  }

  chunks.push(
    `trailer\n<< /Size ${
      objects.length + 1
    } /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  )

  return Buffer.from(
    chunks.join(''),
    'binary',
  )
}

function outputExtension(
  format,
) {
  if (
    format === 'jpg' ||
    format === 'jpeg'
  ) {
    return format
  }

  if (format === 'png') {
    return 'png'
  }

  return 'pdf'
}

async function renderGeneratedBuffer({
  template,
  preparedTemplate,
  row,
  mapping,
  format,
  singleMode = false,
}) {
  if (format === 'pdf') {
    return buildPdf({
      template,
      preparedTemplate,
      row,
      mapping,
      singleMode,
    })
  }

  if (
    format === 'png' ||
    format === 'jpg' ||
    format === 'jpeg'
  ) {
    const rendered =
      await renderFabricDataUrl({
        template,
        preparedTemplate,
        row,
        mapping,
        format,
        singleMode,
      })

    return dataUrlToBuffer(
      rendered.dataUrl,
    )
  }

  throw new ApiError(
    400,
    'Unsupported download format',
  )
}

/*
 * Optimized bulk generation.
 *
 * Each worker creates ONE Fabric canvas and reuses it
 * for all certificates assigned to that worker.
 */
async function createGeneratedFiles(
  generation,
  template,
  dataFile,
  mapping,
  requestScope,
  selectedRecordIds,
) {
  await fs.mkdir(
    GENERATED_DIR,
    {
      recursive: true,
    },
  )

  const single =
    isSingleGeneration(
      generation,
    )

  let rows

  if (!dataFile) {
    rows = [{}]
  } else if (single) {
    rows = [{}]
  } else {
    const selectedSet =
      new Set(
        selectedRecordIds || [],
      )

    rows =
      requestScope ===
      'selected'
        ? dataFile.rows.filter(
            (row, index) =>
              selectedSet.has(
                String(
                  row._id ||
                    index,
                ),
              ) ||
              selectedSet.has(
                String(index),
              ),
          )
        : dataFile.rows
  }

  const safeFormat =
    [
      'pdf',
      'png',
      'jpg',
      'jpeg',
    ].includes(
      generation.outputFormat,
    )
      ? generation.outputFormat
      : 'pdf'

  const renderTemplate =
    generation.design
      ? {
          design:
            generation.design,

          width:
            template.width,

          height:
            template.height,
        }
      : template

  /*
   * Prepare Fabric JSON and local image
   * assets only once for the entire generation.
   */
  const preparedTemplate =
    await prepareRenderTemplate(
      renderTemplate,
    )

  const results =
    new Array(rows.length)

  let nextIndex = 0

  async function worker() {
    let renderer = null

    try {
      /*
       * IMPORTANT:
       *
       * Load the template/background only once
       * for this worker.
       */
      renderer =
        await createFabricWorkerRenderer({
          preparedTemplate,

          format:
            safeFormat,

          singleMode:
            single,
        })

      while (true) {
        const index =
          nextIndex

        if (
          index >=
          rows.length
        ) {
          return
        }

        nextIndex += 1

        const row =
          rows[index]

        const extension =
          outputExtension(
            safeFormat,
          )

        const fileName =
          `${generation._id}-${index + 1}.${extension}`

        const absolutePath =
          path.join(
            GENERATED_DIR,
            fileName,
          )

        try {
          await fs.rm(
            absolutePath,
            {
              force: true,
            },
          )

          const rendered =
            renderFromFabricWorker(
              renderer,
              row,
              mapping,
            )

          let buffer

          /*
           * PDF generation.
           *
           * Reuse the already-rendered JPEG
           * instead of creating another Fabric canvas.
           */
          if (
            safeFormat === 'pdf'
          ) {
            const imageBuffer =
              dataUrlToBuffer(
                rendered.dataUrl,
              )

            const width =
              rendered.width

            const height =
              rendered.height

            const contentBuffer =
              Buffer.from(
                `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`,
                'utf8',
              )

            const objects = [
              '<< /Type /Catalog /Pages 2 0 R >>',

              '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',

              `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`,

              `<< /Length ${contentBuffer.length} >>\nstream\n${contentBuffer.toString(
                'binary',
              )}\nendstream`,

              `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBuffer.length} >>\nstream\n${imageBuffer.toString(
                'binary',
              )}\nendstream`,

              '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',

              '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
            ]

            const chunks = [
              '%PDF-1.4\n',
            ]

            const offsets = [0]

            for (
              const [
                objectIndex,
                object,
              ] of objects.entries()
            ) {
              offsets.push(
                Buffer.byteLength(
                  chunks.join(''),
                  'binary',
                ),
              )

              chunks.push(
                `${objectIndex + 1} 0 obj\n${object}\nendobj\n`,
              )
            }

            const xrefOffset =
              Buffer.byteLength(
                chunks.join(''),
                'binary',
              )

            chunks.push(
              `xref\n0 ${
                objects.length + 1
              }\n0000000000 65535 f \n`,
            )

            for (
              let objectIndex = 1;
              objectIndex <=
              objects.length;
              objectIndex += 1
            ) {
              chunks.push(
                `${String(
                  offsets[
                    objectIndex
                  ],
                ).padStart(
                  10,
                  '0',
                )} 00000 n \n`,
              )
            }

            chunks.push(
              `trailer\n<< /Size ${
                objects.length + 1
              } /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
            )

            buffer =
              Buffer.from(
                chunks.join(''),
                'binary',
              )
          } else {
            buffer =
              dataUrlToBuffer(
                rendered.dataUrl,
              )
          }

          await fs.writeFile(
            absolutePath,
            buffer,
          )

          results[index] = {
            fileName,

            filePath:
              `/uploads/generated/${fileName}`,

            format:
              safeFormat,

            recordIndex:
              index,
          }
        } catch (error) {
          results[index] = {
            error,

            recordIndex:
              index,
          }
        }
      }
    } catch (error) {
      /*
       * If a worker cannot create its Fabric canvas,
       * mark the records assigned to it as failed.
       */
      while (true) {
        const index =
          nextIndex

        if (
          index >=
          rows.length
        ) {
          break
        }

        nextIndex += 1

        results[index] = {
          error,
          recordIndex:
            index,
        }
      }
    } finally {
      if (renderer?.canvas) {
        renderer.canvas.dispose()
      }
    }
  }

  const workerCount =
    Math.min(
      GENERATION_CONCURRENCY,
      Math.max(
        rows.length,
        1,
      ),
    )

  await Promise.all(
    Array.from(
      {
        length:
          workerCount,
      },
      () => worker(),
    ),
  )

  const generatedFiles =
    results.filter(
      (result) =>
        result &&
        !result.error,
    )

  const failedFiles =
    results.filter(
      (result) =>
        result &&
        result.error,
    )

  for (
    const failed of
    failedFiles
  ) {
    console.error(
      `Failed to generate certificate ${
        failed.recordIndex + 1
      }:`,
      failed.error?.message ||
        failed.error,
    )
  }

  return generatedFiles
}

async function runGeneration(
  generation,
  template,
  dataFile,
  mapping,
) {
  /*
   * Prevent duplicate generation.
   */
  if (
    generation.status ===
      'completed' ||
    generation.status ===
      'failed'
  ) {
    return generation
  }

  generation.status =
    'processing'

  await generation.save()

  try {
    const generatedFiles =
      await createGeneratedFiles(
        generation,
        template,
        dataFile,
        mapping,
        generation.requestScope,
        generation.selectedRecordIds,
      )

    generation.generatedFiles =
      generatedFiles

    generation.successfulRecords =
      generatedFiles.length

    generation.totalRecords =
      generation.totalRecords ||
      (
        dataFile
          ? dataFile.recordCount
          : 1
      ) ||
      generatedFiles.length

    generation.failedRecords =
      Math.max(
        (
          generation.totalRecords ||
          0
        ) -
          generatedFiles.length,
        0,
      )

    generation.generatedFilePath =
      generatedFiles[0]
        ?.filePath || ''

    generation.fileUrl =
      generatedFiles[0]
        ?.filePath || ''

    generation.status =
      'completed'

    generation.errorMessage =
      ''

    await generation.save()
  } catch (error) {
    console.error(
      'Generation failed:',
      error,
    )

    generation.status =
      'failed'

    generation.errorMessage =
      error.message

    await generation.save()
  }

  return generation
}

async function createGeneration(
  user,
  payload,
) {
  const {
    templateId,
    mode = 'bulk',
    dataFileId,
    outputFormat = 'pdf',
    requestScope = 'all',
    selectedRecordIds = [],
    fieldMapping,
    design: designOverride,
  } = payload

  if (!templateId) {
    throw new ApiError(
      400,
      'templateId is required',
    )
  }

  const template =
    await Template.findById(
      templateId,
    )

  if (!template) {
    throw new ApiError(
      404,
      'Template not found',
    )
  }

  if (
    !canAccess(
      user,
      template.createdBy,
    )
  ) {
    throw new ApiError(
      403,
      'You do not have access to this template',
    )
  }

  const isSingle =
    mode === 'single'

  let dataFile = null

  if (!isSingle) {
    if (!dataFileId) {
      throw new ApiError(
        400,
        'dataFileId is required for bulk generation',
      )
    }

    dataFile =
      await DataFile.findById(
        dataFileId,
      )

    if (!dataFile) {
      throw new ApiError(
        404,
        'Data file not found',
      )
    }

    if (
      !canAccess(
        user,
        dataFile.uploadedBy,
      )
    ) {
      throw new ApiError(
        403,
        'You do not have access to this data file',
      )
    }
  }

  const effectiveMapping =
    isSingle
      ? fieldMapping || {}
      : fieldMapping ||
        Object.fromEntries(
          template.fieldMapping ||
            [],
        )

  const generation =
    await Generation.create({
      templateId,

      dataFileId:
        dataFile
          ? dataFile._id
          : null,

      mode:
        isSingle
          ? 'single'
          : 'bulk',

      design:
        isSingle &&
        designOverride
          ? designOverride
          : null,

      createdBy:
        user._id,

      userId:
        user._id,

      templateName:
        template.name,

      generatedFormat:
        outputFormat,

      isArchived: false,

      archivedAt: null,

      totalRecords:
        isSingle
          ? 1
          : requestScope ===
              'selected'
            ? selectedRecordIds.length
            : dataFile.recordCount,

      outputFormat,

      requestScope,

      selectedRecordIds,

      fieldMapping:
        effectiveMapping,

      status:
        'processing',
    })

  /*
   * IMPORTANT:
   *
   * Do NOT await runGeneration().
   *
   * The generation can take several seconds,
   * especially when Fabric is rendering many
   * certificates.
   *
   * Return the generation immediately and let
   * the result page poll its status.
   */
  runGeneration(
    generation,
    template,
    dataFile,
    effectiveMapping,
  ).catch(
    async (error) => {
      console.error(
        `Background generation failed for ${generation._id}:`,
        error,
      )

      try {
        await Generation.findByIdAndUpdate(
          generation._id,
          {
            status:
              'failed',

            errorMessage:
              error.message ||
              'Generation failed',
          },
        )
      } catch (
        updateError
      ) {
        console.error(
          'Failed to update generation failure status:',
          updateError,
        )
      }
    },
  )

  return generation
}

async function listGenerations(
  user,
) {
  const activeHistoryQuery = {
    $or: [
      {
        isArchived: false,
      },

      {
        isArchived: {
          $exists: false,
        },
      },
    ],

    createdAt: {
      $gte:
        historyRetentionCutoff(),
    },
  }

  const query =
    user.role === 'admin'
      ? activeHistoryQuery
      : {
          $and: [
            activeHistoryQuery,

            {
              $or: [
                {
                  userId:
                    user._id,
                },

                {
                  userId: {
                    $exists: false,
                  },

                  createdBy:
                    user._id,
                },

                {
                  userId: null,

                  createdBy:
                    user._id,
                },
              ],
            },
          ],
        }

  return Generation.find(
    query,
  )
    .populate(
      'templateId',
      'name',
    )
    .populate(
      'dataFileId',
      'originalName recordCount',
    )
    .sort({
      updatedAt: -1,
    })
}

async function getGeneration(
  user,
  id,
) {
  const generation =
    await Generation.findById(
      id,
    )
      .populate(
        'templateId',
      )
      .populate(
        'dataFileId',
      )

  if (!generation) {
    throw new ApiError(
      404,
      'Generation not found',
    )
  }

  if (
    !canAccess(
      user,
      generation.createdBy,
    )
  ) {
    throw new ApiError(
      403,
      'You do not have access to this generation',
    )
  }

  /*
   * IMPORTANT:
   *
   * Do NOT call runGeneration()
   * here.
   *
   * The frontend polls this endpoint
   * while generation is processing.
   */
  return generation
}

function renderTemplateForGeneration(
  generation,
) {
  if (
    generation &&
    generation.design
  ) {
    return {
      design:
        generation.design,

      width:
        generation.templateId
          ?.width,

      height:
        generation.templateId
          ?.height,
    }
  }

  return generation.templateId
}

function rowsForGeneration(
  generation,
) {
  if (
    generation.dataFileId
  ) {
    return (
      generation.dataFileId
        .rows || []
    )
  }

  return [{}]
}

async function prepareDownload(
  user,
  id,
) {
  const generation =
    await Generation.findById(
      id,
    )

  if (!generation) {
    throw new ApiError(
      404,
      'Generation not found',
    )
  }

  if (
    !canAccess(
      user,
      generation.createdBy,
    )
  ) {
    throw new ApiError(
      403,
      'You do not have access to this generation',
    )
  }

  if (
    generation.status !==
    'completed'
  ) {
    throw new ApiError(
      409,
      'Generation is not completed yet',
    )
  }

  if (
    !generation.generatedFiles
      ?.length
  ) {
    throw new ApiError(
      404,
      'No generated files are available',
    )
  }

  return generation.generatedFiles
}

async function prepareDownloadArchive(
  user,
  id,
  format = 'pdf',
) {
  const safeFormat =
    [
      'pdf',
      'png',
      'jpg',
      'jpeg',
    ].includes(format)
      ? format
      : 'pdf'

  const generation =
    await Generation.findById(
      id,
    )

  if (!generation) {
    throw new ApiError(
      404,
      'Generation not found',
    )
  }

  if (
    !canAccess(
      user,
      generation.createdBy,
    )
  ) {
    throw new ApiError(
      403,
      'You do not have access to this generation',
    )
  }

  if (
    generation.status !==
    'completed'
  ) {
    throw new ApiError(
      409,
      'Generation is not completed yet',
    )
  }

  if (
    !generation.generatedFiles
      ?.length
  ) {
    throw new ApiError(
      404,
      'No files are available',
    )
  }

  /*
   * Download All NEVER renders certificates again.
   * It only reads the already-generated files.
   */
  const generatedFormat =
    generation.outputFormat ||
    generation.generatedFormat ||
    'pdf'

  if (
    safeFormat !==
    generatedFormat
  ) {
    throw new ApiError(
      400,
      `This generation was created as ${generatedFormat.toUpperCase()}. Please download it in the generated format.`,
    )
  }

  const archiveFiles = []

  for (
    const file of
    generation.generatedFiles
  ) {
    if (!file.filePath) {
      continue
    }

    const absolutePath =
      uploadSourcePath(
        file.filePath,
      )

    if (!absolutePath) {
      continue
    }

    try {
      const buffer =
        await fs.readFile(
          absolutePath,
        )

      archiveFiles.push({
        name:
          file.fileName ||
          `certificate-${
            (
              file.recordIndex ||
              0
            ) + 1
          }.${outputExtension(
            generatedFormat,
          )}`,

        buffer,
      })
    } catch (error) {
      console.error(
        `Unable to read generated file: ${absolutePath}`,
        error.message,
      )
    }
  }

  if (
    !archiveFiles.length
  ) {
    throw new ApiError(
      404,
      'Generated files could not be found on the server',
    )
  }

  return {
    fileName:
      `certificates-${generation._id}-${generatedFormat}.zip`,

    mimeType:
      'application/zip',

    buffer:
      createZip(
        archiveFiles,
      ),
  }
}

async function prepareSingleDownload(
  user,
  id,
  recordIndex = 0,
  format = 'pdf',
) {
  const safeFormat =
    [
      'pdf',
      'png',
      'jpg',
      'jpeg',
    ].includes(format)
      ? format
      : 'pdf'

  /*
   * IMPORTANT:
   *
   * Get the generation document directly.
   * Do NOT use getGeneration() here because
   * downloads do not need template/dataFile
   * population.
   */
  const generation =
    await Generation.findById(
      id,
    )

  if (!generation) {
    throw new ApiError(
      404,
      'Generation not found',
    )
  }

  if (
    !canAccess(
      user,
      generation.createdBy,
    )
  ) {
    throw new ApiError(
      403,
      'You do not have access to this generation',
    )
  }

  if (
    generation.status !==
    'completed'
  ) {
    throw new ApiError(
      409,
      'Generation is not completed yet',
    )
  }

  const index =
    Number(recordIndex) || 0

  /*
   * IMPORTANT:
   *
   * Find the already-generated certificate.
   *
   * DO NOT render it again.
   */
  const file =
    generation.generatedFiles?.find(
      (item) =>
        Number(
          item.recordIndex,
        ) === index,
    )

  if (!file) {
    throw new ApiError(
      404,
      'Certificate file not found',
    )
  }

  const generatedFormat =
    file.format ||
    generation.outputFormat ||
    generation.generatedFormat ||
    'pdf'

  if (
    safeFormat !==
    generatedFormat
  ) {
    throw new ApiError(
      400,
      `This certificate was generated as ${generatedFormat.toUpperCase()}. Please download it in the generated format.`,
    )
  }

  if (!file.filePath) {
    throw new ApiError(
      404,
      'Certificate file path not found',
    )
  }

  const absolutePath =
    uploadSourcePath(
      file.filePath,
    )

  if (!absolutePath) {
    throw new ApiError(
      404,
      'Certificate file path is invalid',
    )
  }

  let buffer

  try {
    buffer =
      await fs.readFile(
        absolutePath,
      )
  } catch (error) {
    console.error(
      `Unable to read generated certificate: ${absolutePath}`,
      error,
    )

    throw new ApiError(
      404,
      'Generated certificate file is no longer available on the server',
    )
  }

  return {
    fileName:
      file.fileName ||
      `certificate-${index + 1}.${outputExtension(
        generatedFormat,
      )}`,

    mimeType:
      mimeForFormat(
        generatedFormat,
      ),

    buffer,
  }
}

module.exports = {
  createGeneration,
  listGenerations,
  getGeneration,
  prepareDownload,
  prepareDownloadArchive,
  prepareSingleDownload,
}
function mimeForFormat(format) {
  switch (format) {
    case 'png':
      return 'image/png'

    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'

    case 'pdf':
      return 'application/pdf'

    default:
      return 'application/octet-stream'
  }
}