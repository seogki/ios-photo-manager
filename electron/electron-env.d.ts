/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  livePhotoApi: {
    pickFolder: () => Promise<string | null>
    scan: (folder: string) => Promise<{
      folder: string
      totalFiles: number
      pairCount: number
      orphanPhotos: number
      orphanVideos: number
      previews: { id: string; baseName: string; photoPath?: string; videoPath?: string }[]
    }>
    analyzeFolder: (folder: string) => Promise<{
      scan: {
        folder: string
        totalFiles: number
        pairCount: number
        orphanPhotos: number
        orphanVideos: number
        previews: { id: string; baseName: string; photoPath?: string; videoPath?: string }[]
      }
      locations: {
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
    }>
    process: (
      folder: string,
      action: 'delete-video' | 'move-video',
    ) => Promise<{
      folder: string
      action: 'delete-video' | 'move-video'
      processed: number
      failed: { filePath: string; reason: string }[]
      movedTo?: string
    }>
    getMediaLocations: (folder: string) => Promise<{
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
    }>
    getFileThumbnail: (
      filePath: string,
      width?: number,
      height?: number,
    ) => Promise<{
      ok: boolean
      dataUrl?: string
      reason?: string
    }>
    getVideoThumbnail: (videoPath: string) => Promise<{
      ok: boolean
      dataUrl?: string
      reason?: string
    }>
  }
}
