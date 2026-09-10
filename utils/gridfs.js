const mongoose = require('mongoose')

let bucket = null

function getGridFSBucket() {
  if (!bucket) {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB is not connected')
    }

    bucket = new mongoose.mongo.GridFSBucket(
      mongoose.connection.db,
      {
        bucketName: 'certificateFiles',
      },
    )
  }

  return bucket
}

function uploadToGridFS(buffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    const gridfsBucket = getGridFSBucket()

    const uploadStream =
      gridfsBucket.openUploadStream(filename, {
        contentType,
      })

    uploadStream.on('error', reject)

    uploadStream.on('finish', () => {
      resolve({
        fileId: uploadStream.id,
        filename,
      })
    })

    uploadStream.end(buffer)
  })
}

function downloadFromGridFS(fileId) {
  const gridfsBucket = getGridFSBucket()

  return gridfsBucket.openDownloadStream(
    new mongoose.Types.ObjectId(fileId),
  )
}

async function deleteFromGridFS(fileId) {
  if (!fileId) return

  const gridfsBucket = getGridFSBucket()

  try {
    await gridfsBucket.delete(
      new mongoose.Types.ObjectId(fileId),
    )
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
}

module.exports = {
  getGridFSBucket,
  uploadToGridFS,
  downloadFromGridFS,
  deleteFromGridFS,
}
