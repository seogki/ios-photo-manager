import { app, BrowserWindow, dialog, ipcMain, nativeImage, net, protocol } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

const PHOTO_EXTENSIONS = new Set(['.heic', '.jpg', '.jpeg', '.png'])
const VIDEO_EXTENSIONS = new Set(['.mov', '.mp4', '.m4v'])

type LivePhotoPair = {
  photoPath: string
  videoPath: string
}

type PreviewItem = {
  id: string
  baseName: string
  photoPath?: string
  videoPath?: string
}

type ScanResult = {
  folder: string
  totalFiles: number
  pairCount: number
  orphanPhotos: number
  orphanVideos: number
  previews: PreviewItem[]
}

type ScanArtifacts = {
  scan: ScanResult
  pairs: LivePhotoPair[]
}

type ProcessResult = {
  folder: string
  action: 'delete-video' | 'move-video'
  processed: number
  failed: { filePath: string; reason: string }[]
  movedTo?: string
}

type ThumbnailResult = {
  ok: boolean
  dataUrl?: string
  reason?: 'thumbnail-empty' | 'thumbnail-failed'
}

type MediaLocationItem = {
  filePath: string
  type: 'photo' | 'video'
  latitude: number
  longitude: number
}

type MediaLocationResult = {
  folder: string
  totalCandidates: number
  located: number
  locatedPhotos: number
  locatedVideos: number
  items: MediaLocationItem[]
}

type AnalyzeFolderResult = {
  scan: ScanResult
  locations: MediaLocationResult
}

const THUMBNAIL_CACHE_LIMIT = 500
const THUMBNAIL_CONCURRENCY = 4
const MEDIA_LOCATION_CONCURRENCY = 6
const JPEG_PROBE_BYTES = 1024 * 1024
const thumbnailCache = new Map<string, ThumbnailResult>()
const thumbnailInFlight = new Map<string, Promise<ThumbnailResult>>()
let thumbnailWorkers = 0
const thumbnailQueue: Array<() => void> = []

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'app-icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

async function getAllFiles(rootDir: string): Promise<string[]> {
  const stack = [rootDir]
  const files: string[] = []

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) {
      continue
    }

    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
        continue
      }

      if (entry.isFile()) {
        files.push(fullPath)
      }
    }
  }

  return files
}

function getAsciiFromTagValue(
  buffer: Buffer,
  tiffOffset: number,
  valueType: number,
  count: number,
  valueOffset: number,
  littleEndian: boolean,
): string | null {
  if (valueType !== 2 || count <= 0) {
    return null
  }

  let start = valueOffset
  if (count > 4) {
    start = tiffOffset + (littleEndian ? buffer.readUInt32LE(valueOffset) : buffer.readUInt32BE(valueOffset))
  }

  const end = Math.min(buffer.length, start + count)
  if (start < 0 || start >= end) {
    return null
  }

  return buffer.toString('ascii', start, end).replace(/\0/g, '').trim() || null
}

function readRational(buffer: Buffer, absoluteOffset: number, littleEndian: boolean): number | null {
  if (absoluteOffset < 0 || absoluteOffset + 7 >= buffer.length) {
    return null
  }
  const numerator = littleEndian ? buffer.readUInt32LE(absoluteOffset) : buffer.readUInt32BE(absoluteOffset)
  const denominator = littleEndian
    ? buffer.readUInt32LE(absoluteOffset + 4)
    : buffer.readUInt32BE(absoluteOffset + 4)
  if (denominator === 0) {
    return null
  }
  return numerator / denominator
}

function readGpsCoordinate(
  buffer: Buffer,
  tiffOffset: number,
  valueOffset: number,
  littleEndian: boolean,
): number | null {
  const offset = tiffOffset + valueOffset
  const deg = readRational(buffer, offset, littleEndian)
  const min = readRational(buffer, offset + 8, littleEndian)
  const sec = readRational(buffer, offset + 16, littleEndian)
  if (deg === null || min === null || sec === null) {
    return null
  }
  return deg + min / 60 + sec / 3600
}

function extractJpegGps(fileBuffer: Buffer): { latitude: number; longitude: number } | null {
  if (fileBuffer.length < 4 || fileBuffer[0] !== 0xff || fileBuffer[1] !== 0xd8) {
    return null
  }

  let offset = 2
  while (offset + 4 < fileBuffer.length) {
    if (fileBuffer[offset] !== 0xff) {
      break
    }
    const marker = fileBuffer[offset + 1]
    if (marker === 0xda || marker === 0xd9) {
      break
    }

    const segmentLength = fileBuffer.readUInt16BE(offset + 2)
    if (segmentLength < 2 || offset + 2 + segmentLength > fileBuffer.length) {
      break
    }

    if (marker === 0xe1) {
      const exifStart = offset + 4
      const exifHeader = fileBuffer.toString('ascii', exifStart, exifStart + 6)
      if (exifHeader !== 'Exif\0\0') {
        offset += 2 + segmentLength
        continue
      }

      const tiffOffset = exifStart + 6
      if (tiffOffset + 8 >= fileBuffer.length) {
        return null
      }

      const byteOrder = fileBuffer.toString('ascii', tiffOffset, tiffOffset + 2)
      const littleEndian = byteOrder === 'II'
      if (!littleEndian && byteOrder !== 'MM') {
        return null
      }

      const readUInt16 = (position: number) => (littleEndian ? fileBuffer.readUInt16LE(position) : fileBuffer.readUInt16BE(position))
      const readUInt32 = (position: number) => (littleEndian ? fileBuffer.readUInt32LE(position) : fileBuffer.readUInt32BE(position))

      const ifd0Offset = tiffOffset + readUInt32(tiffOffset + 4)
      if (ifd0Offset + 1 >= fileBuffer.length) {
        return null
      }

      const ifd0Entries = readUInt16(ifd0Offset)
      let gpsIfdRelativeOffset = 0
      for (let i = 0; i < ifd0Entries; i += 1) {
        const entryOffset = ifd0Offset + 2 + i * 12
        if (entryOffset + 11 >= fileBuffer.length) {
          break
        }
        const tag = readUInt16(entryOffset)
        if (tag === 0x8825) {
          gpsIfdRelativeOffset = readUInt32(entryOffset + 8)
          break
        }
      }

      if (!gpsIfdRelativeOffset) {
        return null
      }

      const gpsIfdOffset = tiffOffset + gpsIfdRelativeOffset
      if (gpsIfdOffset + 1 >= fileBuffer.length) {
        return null
      }

      const gpsEntries = readUInt16(gpsIfdOffset)
      let latRef = 'N'
      let lonRef = 'E'
      let latValue: number | null = null
      let lonValue: number | null = null

      for (let i = 0; i < gpsEntries; i += 1) {
        const entryOffset = gpsIfdOffset + 2 + i * 12
        if (entryOffset + 11 >= fileBuffer.length) {
          break
        }

        const tag = readUInt16(entryOffset)
        const valueType = readUInt16(entryOffset + 2)
        const count = readUInt32(entryOffset + 4)
        const valueOffset = entryOffset + 8
        const valueRelativeOffset = readUInt32(valueOffset)

        if (tag === 0x0001) {
          const value = getAsciiFromTagValue(fileBuffer, tiffOffset, valueType, count, valueOffset, littleEndian)
          if (value === 'S' || value === 'N') {
            latRef = value
          }
        } else if (tag === 0x0002 && valueType === 5 && count >= 3) {
          latValue = readGpsCoordinate(fileBuffer, tiffOffset, valueRelativeOffset, littleEndian)
        } else if (tag === 0x0003) {
          const value = getAsciiFromTagValue(fileBuffer, tiffOffset, valueType, count, valueOffset, littleEndian)
          if (value === 'W' || value === 'E') {
            lonRef = value
          }
        } else if (tag === 0x0004 && valueType === 5 && count >= 3) {
          lonValue = readGpsCoordinate(fileBuffer, tiffOffset, valueRelativeOffset, littleEndian)
        }
      }

      if (latValue === null || lonValue === null) {
        return null
      }

      const latitude = latRef === 'S' ? -latValue : latValue
      const longitude = lonRef === 'W' ? -lonValue : lonValue
      if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        return null
      }
      return { latitude, longitude }
    }

    offset += 2 + segmentLength
  }

  return null
}

async function readVideoProbeChunks(filePath: string, chunkSize = 1024 * 1024): Promise<Buffer> {
  const handle = await fs.open(filePath, 'r')
  try {
    const stat = await handle.stat()
    const size = stat.size
    if (size <= chunkSize * 2) {
      return await handle.readFile()
    }

    const head = Buffer.allocUnsafe(chunkSize)
    const tail = Buffer.allocUnsafe(chunkSize)
    await handle.read(head, 0, chunkSize, 0)
    await handle.read(tail, 0, chunkSize, size - chunkSize)
    return Buffer.concat([head, tail])
  } finally {
    await handle.close()
  }
}

async function readFileHead(filePath: string, maxBytes: number): Promise<Buffer> {
  const handle = await fs.open(filePath, 'r')
  try {
    const stat = await handle.stat()
    const size = Math.min(stat.size, maxBytes)
    const buffer = Buffer.allocUnsafe(size)
    const { bytesRead } = await handle.read(buffer, 0, size, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

async function extractVideoGps(filePath: string): Promise<{ latitude: number; longitude: number } | null> {
  const probe = await readVideoProbeChunks(filePath)
  const ascii = probe.toString('latin1')
  const match = ascii.match(/([+-]\d{1,2}\.\d+)([+-]\d{1,3}\.\d+)\//)
  if (!match) {
    return null
  }

  const latitude = Number.parseFloat(match[1])
  const longitude = Number.parseFloat(match[2])
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null
  }

  return { latitude, longitude }
}

async function extractMediaLocation(filePath: string): Promise<{ latitude: number; longitude: number } | null> {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') {
    const fileBuffer = await readFileHead(filePath, JPEG_PROBE_BYTES)
    return extractJpegGps(fileBuffer)
  }

  if (ext === '.mov' || ext === '.mp4' || ext === '.m4v') {
    return extractVideoGps(filePath)
  }

  return null
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return []
  }

  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const worker = async () => {
    while (true) {
      const current = nextIndex
      nextIndex += 1
      if (current >= items.length) {
        return
      }
      results[current] = await mapper(items[current])
    }
  }

  await Promise.all(Array.from({ length: safeConcurrency }, () => worker()))
  return results
}

function getMediaFiles(files: string[]) {
  return files.filter((filePath) => {
    const ext = path.extname(filePath).toLowerCase()
    return PHOTO_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext)
  })
}

async function collectMediaLocationsFromFiles(
  folder: string,
  mediaFiles: string[],
): Promise<MediaLocationResult> {
  const resolved = await mapWithConcurrency(
    mediaFiles,
    MEDIA_LOCATION_CONCURRENCY,
    async (filePath) => {
      try {
        const location = await extractMediaLocation(filePath)
        if (!location) {
          return null
        }

        const ext = path.extname(filePath).toLowerCase()
        return {
          filePath,
          type: VIDEO_EXTENSIONS.has(ext) ? 'video' : 'photo',
          latitude: location.latitude,
          longitude: location.longitude,
        } satisfies MediaLocationItem
      } catch {
        // Ignore parse failures; we only return successfully located media.
        return null
      }
    },
  )

  const items = resolved.filter((item) => item !== null)
  let locatedPhotos = 0
  let locatedVideos = 0
  for (const item of items) {
    if (item.type === 'video') {
      locatedVideos += 1
    } else {
      locatedPhotos += 1
    }
  }

  return {
    folder,
    totalCandidates: mediaFiles.length,
    located: items.length,
    locatedPhotos,
    locatedVideos,
    items,
  }
}

function buildScanArtifacts(folder: string, files: string[]): ScanArtifacts {
  const grouped = new Map<
    string,
    {
      photos: string[]
      videos: string[]
    }
  >()

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase()
    if (!PHOTO_EXTENSIONS.has(ext) && !VIDEO_EXTENSIONS.has(ext)) {
      continue
    }

    const base = path.parse(filePath).name.toLowerCase()
    const key = base

    const bucket = grouped.get(key) ?? { photos: [], videos: [] }
    if (PHOTO_EXTENSIONS.has(ext)) {
      bucket.photos.push(filePath)
    } else {
      bucket.videos.push(filePath)
    }

    grouped.set(key, bucket)
  }

  const pairs: LivePhotoPair[] = []
  const previews: PreviewItem[] = []
  let orphanPhotos = 0
  let orphanVideos = 0

  for (const [key, bucket] of grouped.entries()) {
    const pairCount = Math.min(bucket.photos.length, bucket.videos.length)
    for (let i = 0; i < pairCount; i += 1) {
      pairs.push({
        photoPath: bucket.photos[i],
        videoPath: bucket.videos[i],
      })
    }

    const previewCount = Math.max(bucket.photos.length, bucket.videos.length)
    for (let i = 0; i < previewCount; i += 1) {
      const photoPath = bucket.photos[i]
      const videoPath = bucket.videos[i]
      const sourcePath = photoPath ?? videoPath
      if (!sourcePath) {
        continue
      }

      previews.push({
        id: `${key}:${i}`,
        baseName: path.parse(sourcePath).name,
        photoPath,
        videoPath,
      })
    }

    if (bucket.photos.length > bucket.videos.length) {
      orphanPhotos += bucket.photos.length - bucket.videos.length
    } else if (bucket.videos.length > bucket.photos.length) {
      orphanVideos += bucket.videos.length - bucket.photos.length
    }
  }

  return {
    scan: {
      folder,
      totalFiles: files.length,
      pairCount: pairs.length,
      orphanPhotos,
      orphanVideos,
      previews,
    },
    pairs,
  }
}

async function scanLivePhotos(folder: string): Promise<ScanResult> {
  const files = await getAllFiles(folder)
  return buildScanArtifacts(folder, files).scan
}

async function collectMediaLocations(folder: string): Promise<MediaLocationResult> {
  const files = await getAllFiles(folder)
  return collectMediaLocationsFromFiles(folder, getMediaFiles(files))
}

async function analyzeFolder(folder: string): Promise<AnalyzeFolderResult> {
  const files = await getAllFiles(folder)
  const scanArtifacts = buildScanArtifacts(folder, files)
  const locations = await collectMediaLocationsFromFiles(folder, getMediaFiles(files))
  return {
    scan: scanArtifacts.scan,
    locations,
  }
}

async function withThumbnailSlot<T>(task: () => Promise<T>): Promise<T> {
  if (thumbnailWorkers >= THUMBNAIL_CONCURRENCY) {
    await new Promise<void>((resolve) => {
      thumbnailQueue.push(resolve)
    })
  }

  thumbnailWorkers += 1
  try {
    return await task()
  } finally {
    thumbnailWorkers -= 1
    const next = thumbnailQueue.shift()
    if (next) {
      next()
    }
  }
}

function setThumbnailCache(key: string, value: ThumbnailResult) {
  if (thumbnailCache.has(key)) {
    thumbnailCache.delete(key)
  }
  thumbnailCache.set(key, value)

  if (thumbnailCache.size > THUMBNAIL_CACHE_LIMIT) {
    const firstKey = thumbnailCache.keys().next().value
    if (typeof firstKey === 'string') {
      thumbnailCache.delete(firstKey)
    }
  }
}

async function createFileThumbnail(filePath: string, width: number, height: number): Promise<ThumbnailResult> {
  const cacheKey = `${filePath}::${width}x${height}`
  const cached = thumbnailCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const inFlight = thumbnailInFlight.get(cacheKey)
  if (inFlight) {
    return inFlight
  }

  const task = withThumbnailSlot(async () => {
    try {
      const thumbnail = await nativeImage.createThumbnailFromPath(filePath, { width, height })
      const result = thumbnail.isEmpty()
        ? { ok: false, reason: 'thumbnail-empty' as const }
        : { ok: true, dataUrl: thumbnail.toDataURL() }
      setThumbnailCache(cacheKey, result)
      return result
    } catch {
      const result = { ok: false, reason: 'thumbnail-failed' as const }
      setThumbnailCache(cacheKey, result)
      return result
    }
  }).finally(() => {
    thumbnailInFlight.delete(cacheKey)
  })

  thumbnailInFlight.set(cacheKey, task)
  return task
}

function registerLocalMediaProtocol() {
  protocol.handle('local-media', (request) => {
    const url = new URL(request.url)
    const rawPath = url.searchParams.get('path')
    if (!rawPath) {
      return new Response('Missing path query', { status: 400 })
    }

    const filePath = decodeURIComponent(rawPath)
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

async function getAvailablePath(targetPath: string): Promise<string> {
  let candidate = targetPath
  let index = 1
  let exists = true

  while (exists) {
    try {
      await fs.access(candidate)
      const ext = path.extname(targetPath)
      const name = path.basename(targetPath, ext)
      const dir = path.dirname(targetPath)
      candidate = path.join(dir, `${name} (${index})${ext}`)
      index += 1
    } catch {
      exists = false
    }
  }

  return candidate
}

ipcMain.handle('live-photo:pick-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

ipcMain.handle('live-photo:scan', async (_event, folder: string) => {
  return scanLivePhotos(folder)
})

ipcMain.handle('live-photo:analyze-folder', async (_event, folder: string) => {
  return analyzeFolder(folder)
})

ipcMain.handle('live-photo:media-locations', async (_event, folder: string) => {
  return collectMediaLocations(folder)
})

ipcMain.handle(
  'live-photo:file-thumbnail',
  async (
    _event,
    args: { filePath: string; width?: number; height?: number },
  ) => {
    const { filePath, width = 480, height = 270 } = args
    return createFileThumbnail(filePath, width, height)
  },
)

ipcMain.handle('live-photo:video-thumbnail', async (_event, videoPath: string) => {
  return createFileThumbnail(videoPath, 480, 270)
})

ipcMain.handle(
  'live-photo:process',
  async (_event, args: { folder: string; action: 'delete-video' | 'move-video' }) => {
    const { folder, action } = args
    const files = await getAllFiles(folder)
    const scanArtifacts = buildScanArtifacts(folder, files)
    const failed: { filePath: string; reason: string }[] = []

    let movedTo: string | undefined
    if (action === 'move-video') {
      movedTo = path.join(folder, '_livephoto_videos')
      await fs.mkdir(movedTo, { recursive: true })
    }

    let processed = 0
    for (const pair of scanArtifacts.pairs) {
      try {
        if (action === 'delete-video') {
          await fs.unlink(pair.videoPath)
        } else if (movedTo) {
          const relativePath = path.relative(folder, pair.videoPath)
          const destination = await getAvailablePath(path.join(movedTo, relativePath))
          await fs.mkdir(path.dirname(destination), { recursive: true })
          await fs.rename(pair.videoPath, destination)
        }

        processed += 1
      } catch (error) {
        failed.push({
          filePath: pair.videoPath,
          reason: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const result: ProcessResult = {
      folder,
      action,
      processed,
      failed,
      movedTo,
    }

    return result
  },
)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  registerLocalMediaProtocol()
  createWindow()
})


