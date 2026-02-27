export function toFileSrc(filePath: string) {
  return `local-media://file?path=${encodeURIComponent(filePath)}`;
}

export function getFileName(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}

export function toMapPosition(latitude: number, longitude: number) {
  const x = ((longitude + 180) / 360) * 100;
  const y = ((90 - latitude) / 180) * 100;
  return {
    left: `${Math.max(0, Math.min(100, x))}%`,
    top: `${Math.max(0, Math.min(100, y))}%`,
  };
}

export function formatCoordinate(value: number) {
  return value.toFixed(6);
}
