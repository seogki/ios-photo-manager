import CoordinateMap from "./CoordinateMap";
import SummaryStatCard from "./SummaryStatCard";
import type { MediaLocationResult } from "./types";

function MapView({
  panelClass,
  baseButtonClass,
  loading,
  locationLoading,
  folder,
  locationResult,
  locationMessage,
  locatedPhotos,
  locatedVideos,
  onPickFolder,
  onRefreshLocations,
}: {
  panelClass: string;
  baseButtonClass: string;
  loading: boolean;
  locationLoading: boolean;
  folder: string;
  locationResult: MediaLocationResult | null;
  locationMessage: string;
  locatedPhotos: number;
  locatedVideos: number;
  onPickFolder: () => void;
  onRefreshLocations: () => void;
}) {
  const locationItems = locationResult?.items ?? [];

  return (
    <section className={`${panelClass} overflow-hidden`}>
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">위치 국가 분류</p>
        <p className="mt-0.5 text-xs text-slate-500">
          폴더 안 미디어의 GPS 좌표를 기반으로 국가를 분류합니다.
        </p>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={baseButtonClass}
            onClick={onPickFolder}
            disabled={loading || locationLoading}
          >
            폴더 선택
          </button>
          <button
            type="button"
            className={baseButtonClass}
            onClick={onRefreshLocations}
            disabled={!folder || locationLoading}
          >
            위치정보 재분석
          </button>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs break-all text-slate-600">
            {folder || "선택된 폴더 없음"}
          </div>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-4">
          {[
            { label: "대상 파일", value: locationResult?.totalCandidates ?? "-" },
            { label: "좌표 추출됨", value: locationResult?.located ?? "-" },
            { label: "사진 위치", value: locationResult ? locatedPhotos : "-" },
            { label: "동영상 위치", value: locationResult ? locatedVideos : "-" },
          ].map((item) => (
            <SummaryStatCard key={item.label} label={item.label} value={item.value} />
          ))}
        </div>

        {locationMessage && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
            {locationMessage}
          </p>
        )}

        {locationResult && locationItems.length > 0 ? (
          <>
            <CoordinateMap items={locationItems} />
          </>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
            {folder
              ? "좌표가 있는 미디어를 찾지 못했습니다."
              : "먼저 폴더를 선택하세요."}
          </div>
        )}
      </div>
    </section>
  );
}

export default MapView;
