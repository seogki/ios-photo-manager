import { toFileSrc } from "./utils";

export function PhotoPreview({
  photoPath,
  baseName,
  fitMode = "contain",
}: {
  photoPath?: string;
  baseName: string;
  fitMode?: "contain" | "cover";
}) {
  if (!photoPath) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded bg-amber-50 px-2 text-center">
        <p className="text-xs font-bold text-amber-700">사진 파일 없음</p>
        <p className="mt-0.5 text-[11px] text-amber-600">
          같은 이름의 사진을 찾지 못함
        </p>
      </div>
    );
  }

  return (
    <img
      src={toFileSrc(photoPath)}
      alt={`photo-${baseName}`}
      loading="lazy"
      decoding="async"
      className={`h-full w-full ${fitMode === "cover" ? "object-cover" : "object-contain"}`}
    />
  );
}

export function VideoPreview({ videoPath }: { videoPath?: string }) {
  if (!videoPath) {
    return (
      <div className="flex h-full items-center justify-center rounded bg-slate-100 px-2 text-center text-xs font-semibold text-slate-600">
        동영상 파일 없음
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center rounded bg-rose-50 px-2 text-center">
      <p className="text-xs font-bold text-rose-700">동영상 재생 불가</p>
      <p className="mt-0.5 text-[11px] text-rose-600">
        지원되지 않는 포맷일 수 있습니다
      </p>
    </div>
  );
}
