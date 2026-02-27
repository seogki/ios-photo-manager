export type ScanPreviewItem = {
  id: string;
  baseName: string;
  photoPath?: string;
  videoPath?: string;
};

export type ScanResult = {
  folder: string;
  totalFiles: number;
  pairCount: number;
  orphanPhotos: number;
  orphanVideos: number;
  previews: ScanPreviewItem[];
};

export type MediaLocationItem = {
  filePath: string;
  type: "photo" | "video";
  latitude: number;
  longitude: number;
};

export type MediaLocationResult = {
  folder: string;
  totalCandidates: number;
  located: number;
  locatedPhotos: number;
  locatedVideos: number;
  items: MediaLocationItem[];
};

export type ProcessAction = "delete-video" | "move-video";

export type PreviewWindow = {
  start: number;
  end: number;
  topPadding: number;
  bottomPadding: number;
};
