import { ipcRenderer, contextBridge } from 'electron'

type ScanResult = {
  folder: string
  totalFiles: number
  pairCount: number
  orphanPhotos: number
  orphanVideos: number
  previews: { id: string; baseName: string; photoPath?: string; videoPath?: string }[]
}

type ProcessResult = {
  folder: string
  action: 'delete-video' | 'move-video'
  processed: number
  failed: { filePath: string; reason: string }[]
  movedTo?: string
}

type MediaLocationResult = {
  folder: string
  totalCandidates: number
  located: number
  locatedPhotos: number
  locatedVideos: number
  items: {
    filePath: string
    type: 'photo' | 'video'
    latitude: number
    longitude: number
  }[]
}

type AnalyzeResult = {
  scan: ScanResult
  locations: MediaLocationResult
}

contextBridge.exposeInMainWorld('livePhotoApi', {
  pickFolder() {
    return ipcRenderer.invoke('live-photo:pick-folder') as Promise<string | null>
  },
  scan(folder: string) {
    return ipcRenderer.invoke('live-photo:scan', folder) as Promise<ScanResult>
  },
  analyzeFolder(folder: string) {
    return ipcRenderer.invoke('live-photo:analyze-folder', folder) as Promise<AnalyzeResult>
  },
  process(folder: string, action: 'delete-video' | 'move-video') {
    return ipcRenderer.invoke('live-photo:process', { folder, action }) as Promise<ProcessResult>
  },
  getMediaLocations(folder: string) {
    return ipcRenderer.invoke('live-photo:media-locations', folder) as Promise<MediaLocationResult>
  },
  getFileThumbnail(filePath: string, width = 480, height = 270) {
    return ipcRenderer.invoke('live-photo:file-thumbnail', { filePath, width, height }) as Promise<{
      ok: boolean
      dataUrl?: string
      reason?: string
    }>
  },
  // Kept for compatibility with existing renderer calls.
  getVideoThumbnail(videoPath: string) {
    return ipcRenderer.invoke('live-photo:video-thumbnail', videoPath) as Promise<{
      ok: boolean
      dataUrl?: string
      reason?: string
    }>
  },
})
