import type { RefObject, UIEvent } from "react";
import { PhotoPreview, VideoPreview } from "./MediaPreview";
import SummaryStatCard from "./SummaryStatCard";
import type {
  PreviewWindow,
  ProcessAction,
  ScanPreviewItem,
  ScanResult,
} from "./types";
import { getFileName } from "./utils";

function ManagerView({
  panelClass,
  desktopPanelHeightClass,
  baseButtonClass,
  loading,
  locationLoading,
  folder,
  canProcess,
  scanResult,
  message,
  previewLoadedCount,
  previewItems,
  visiblePreviewItems,
  previewWindow,
  previewScrollRef,
  onPickFolder,
  onScan,
  onProcess,
  onPreviewScroll,
}: {
  panelClass: string;
  desktopPanelHeightClass: string;
  baseButtonClass: string;
  loading: boolean;
  locationLoading: boolean;
  folder: string;
  canProcess: boolean;
  scanResult: ScanResult | null;
  message: string;
  previewLoadedCount: number;
  previewItems: ScanPreviewItem[];
  visiblePreviewItems: ScanPreviewItem[];
  previewWindow: PreviewWindow;
  previewScrollRef: RefObject<HTMLDivElement>;
  onPickFolder: () => void;
  onScan: () => void;
  onProcess: (action: ProcessAction) => void;
  onPreviewScroll: (event: UIEvent<HTMLDivElement>) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[1.28fr_1fr]">
      <div className="min-w-0">
        <section
          className={`${panelClass} ${desktopPanelHeightClass} overflow-hidden`}
        >
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">폴더 선택</p>
            <p className="mt-0.5 text-xs text-slate-500">
              정리할 루트 폴더를 선택한 뒤 스캔을 실행하세요.
            </p>
          </div>
          <div className="space-y-4 px-4 py-4">
            <div>
              <button
                className={baseButtonClass}
                type="button"
                onClick={onPickFolder}
                disabled={loading || locationLoading}
              >
                폴더 선택
              </button>
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm break-all text-slate-600">
                {folder || "선택된 폴더 없음"}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                작업
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className={baseButtonClass}
                  type="button"
                  onClick={onScan}
                  disabled={!folder || loading}
                >
                  다시 스캔
                </button>
                <button
                  className={baseButtonClass}
                  type="button"
                  onClick={() => onProcess("move-video")}
                  disabled={!canProcess}
                >
                  동영상 이동
                </button>
                <button
                  className={baseButtonClass}
                  type="button"
                  onClick={() => onProcess("delete-video")}
                  disabled={!canProcess}
                >
                  동영상 삭제
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">처리 방식 안내</p>
              <p className="mt-1">
                <span className="font-semibold">동영상 이동</span>: 매칭된
                동영상을 <code>_livephoto_videos</code> 폴더로 이동해
                보관합니다.
              </p>
              <p className="mt-1">
                <span className="font-semibold">동영상 삭제</span>: 대응되는
                동영상을 즉시 삭제합니다.
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                스캔 결과
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                {[
                  { label: "전체", value: scanResult?.totalFiles ?? "-" },
                  { label: "라이브쌍", value: scanResult?.pairCount ?? "-" },
                  {
                    label: "미매칭 사진",
                    value: scanResult?.orphanPhotos ?? "-",
                  },
                  {
                    label: "미매칭 영상",
                    value: scanResult?.orphanVideos ?? "-",
                  },
                  {
                    label: "처리후 파일",
                    value: scanResult
                      ? scanResult.totalFiles - scanResult.pairCount
                      : "-",
                  },
                ].map((item) => (
                  <SummaryStatCard
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    nowrap
                  />
                ))}
              </div>
            </div>

            {message && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm whitespace-pre-line text-slate-900">
                {message}
              </p>
            )}
          </div>
        </section>
      </div>

      <aside
        className={`${panelClass} ${desktopPanelHeightClass} max-h-[72vh] flex flex-col p-2.5 lg:sticky lg:top-4 lg:max-h-none`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-1 pb-2 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">미리보기</p>
          <p>
            {Math.min(previewLoadedCount, previewItems.length)}/
            {previewItems.length}개
          </p>
        </div>
        <p className="mt-1.5 px-1 text-xs text-slate-500">
          아래로 스크롤하면 20개씩 로드, 최대 100개만 렌더링합니다.
        </p>
        <div
          ref={previewScrollRef}
          className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70"
          onScroll={onPreviewScroll}
        >
          {previewItems.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">
              스캔 후 사진/동영상 썸네일이 표시됩니다.
            </div>
          ) : (
            <div className="px-1.5 py-1.5">
              {previewWindow.topPadding > 0 && (
                <div style={{ height: `${previewWindow.topPadding}px` }} />
              )}
              {visiblePreviewItems.map((item, index) => (
                <article
                  key={item.id}
                  className="mb-2 h-[180px] overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="truncate text-xs font-semibold text-slate-700">
                      {previewWindow.start + index + 1}. {item.baseName}
                    </div>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${item.photoPath && item.videoPath ? "bg-emerald-100 text-emerald-700" : item.videoPath ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {item.photoPath && item.videoPath
                        ? "쌍"
                        : item.videoPath
                          ? "동영상만"
                          : "사진만"}
                    </span>
                  </div>
                  <div className="grid h-[138px] grid-cols-2 gap-1.5">
                    <div className="overflow-hidden rounded border border-slate-200 bg-slate-100">
                      <PhotoPreview
                        photoPath={item.photoPath}
                        baseName={item.baseName}
                      />
                    </div>
                    <div className="overflow-hidden rounded border border-slate-200 bg-slate-100">
                      <VideoPreview videoPath={item.videoPath} />
                    </div>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-1.5 text-[10px] text-slate-500">
                    <span className="truncate">
                      {item.photoPath ? getFileName(item.photoPath) : "-"}
                    </span>
                    <span className="truncate">
                      {item.videoPath ? getFileName(item.videoPath) : "-"}
                    </span>
                  </div>
                </article>
              ))}
              {previewWindow.bottomPadding > 0 && (
                <div style={{ height: `${previewWindow.bottomPadding}px` }} />
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default ManagerView;
