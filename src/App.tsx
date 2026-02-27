import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import ManagerView from "./components/live-photo/ManagerView";
import MapView from "./components/live-photo/MapView";
import MenuPanel from "./components/live-photo/MenuPanel";
import type {
  MediaLocationResult,
  PreviewWindow,
  ProcessAction,
  ScanResult,
} from "./components/live-photo/types";

const ITEM_HEIGHT_SINGLE = 188;
const ITEM_HEIGHT_DOUBLE = 172;
const ITEM_HEIGHT_TRIPLE = 172;
const PREVIEW_PAGE_SIZE = 20;
const MAX_RENDERED_PREVIEWS = 100;

function App({ activeTab }: { activeTab: "manager" | "map" }) {
  const navigate = useNavigate();
  const [folder, setFolder] = useState<string>("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationResult, setLocationResult] =
    useState<MediaLocationResult | null>(null);
  const [locationMessage, setLocationMessage] = useState<string>("");
  const [previewLoadedCount, setPreviewLoadedCount] =
    useState(PREVIEW_PAGE_SIZE);
  const [previewScrollTop, setPreviewScrollTop] = useState(0);
  const [previewLayout, setPreviewLayout] = useState<
    "single" | "double" | "triple"
  >("single");
  const [previewFitMode, setPreviewFitMode] = useState<"contain" | "cover">(
    "contain",
  );
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const previewScrollFrameRef = useRef<number | null>(null);
  const pendingPreviewScrollRef = useRef<HTMLDivElement | null>(null);
  const previousPreviewMetricsRef = useRef({
    itemsLength: 0,
    columns: 1,
    itemHeight: ITEM_HEIGHT_SINGLE,
  });
  const baseButtonClass =
    "rounded-lg border border-slate-200 bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-300";
  const panelClass =
    "rounded-2xl border border-slate-200 bg-white/95 shadow-sm";
  const desktopPanelHeightClass = "lg:h-[calc(100vh-7.5rem)]";
  const previewItems = scanResult?.previews ?? [];
  const previewColumns =
    previewLayout === "triple" ? 3 : previewLayout === "double" ? 2 : 1;
  const previewItemHeight =
    previewLayout === "triple"
      ? ITEM_HEIGHT_TRIPLE
      : previewLayout === "double"
        ? ITEM_HEIGHT_DOUBLE
        : ITEM_HEIGHT_SINGLE;
  const previewPageRows = Math.max(
    1,
    Math.ceil(PREVIEW_PAGE_SIZE / previewColumns),
  );
  const maxRenderedRows = Math.max(
    1,
    Math.ceil(MAX_RENDERED_PREVIEWS / previewColumns),
  );
  const tabDescription =
    activeTab === "manager"
      ? "사진+동영상 쌍을 탐색하고 정리합니다."
      : "GPS 좌표를 읽어 국가 단위로 분류합니다.";

  const canProcess = useMemo(() => {
    const pairCount = scanResult?.pairCount ?? 0;
    return Boolean(folder) && pairCount > 0 && !loading;
  }, [folder, scanResult, loading]);

  async function handlePickFolder() {
    if (loading || locationLoading) {
      return;
    }

    setMessage("");
    const picked = await window.livePhotoApi.pickFolder();
    if (!picked) {
      return;
    }

    setFolder(picked);
    setLocationResult(null);
    setLocationMessage("");
    setLoading(true);
    setLocationLoading(true);
    setMessage("스캔/위치정보 분석 중...");
    setLocationMessage("위치정보를 읽는 중...");
    try {
      const result = await window.livePhotoApi.analyzeFolder(picked);
      setScanResult(result.scan);
      setLocationResult(result.locations);
      setMessage(`스캔 완료: Live Photo 쌍 ${result.scan.pairCount}개 발견`);
      setLocationMessage(
        `위치정보 로드 완료: ${result.locations.located}개 / 대상 ${result.locations.totalCandidates}개`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "폴더 분석 중 오류가 발생했습니다.";
      setMessage(errorMessage);
      setLocationMessage(errorMessage);
    } finally {
      setLoading(false);
      setLocationLoading(false);
    }
  }

  async function handleLoadLocations(targetFolder = folder) {
    if (!targetFolder) {
      return;
    }

    setLocationLoading(true);
    setLocationMessage("위치정보를 읽는 중...");
    try {
      const result = await window.livePhotoApi.getMediaLocations(targetFolder);
      setLocationResult(result);
      setLocationMessage(
        `위치정보 로드 완료: ${result.located}개 / 대상 ${result.totalCandidates}개`,
      );
    } catch (error) {
      setLocationMessage(
        error instanceof Error
          ? error.message
          : "위치정보를 읽는 중 오류가 발생했습니다.",
      );
    } finally {
      setLocationLoading(false);
    }
  }

  async function handleScan(targetFolder = folder) {
    if (!targetFolder) {
      return;
    }

    setLoading(true);
    setMessage("스캔 중...");
    try {
      const result = await window.livePhotoApi.scan(targetFolder);
      setScanResult(result);
      setMessage(`스캔 완료: Live Photo 쌍 ${result.pairCount}개 발견`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "스캔 중 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleProcess(action: ProcessAction) {
    if (loading || !folder) {
      return;
    }

    const isDelete = action === "delete-video";
    const ok = window.confirm(
      isDelete
        ? "Live Photo에 대응되는 동영상을 삭제합니다. 계속할까요?"
        : "Live Photo에 대응되는 동영상을 _livephoto_videos 폴더로 이동합니다. 계속할까요?",
    );

    if (!ok) {
      return;
    }

    setLoading(true);
    setLocationLoading(true);
    setMessage(isDelete ? "동영상 삭제 중..." : "동영상 이동 중...");
    try {
      const result = await window.livePhotoApi.process(folder, action);
      const failedCount = result.failed.length;
      const movedText = result.movedTo ? `\n이동 폴더: ${result.movedTo}` : "";
      const refreshed = await window.livePhotoApi.analyzeFolder(folder);
      setScanResult(refreshed.scan);
      setLocationResult(refreshed.locations);
      setLocationMessage(
        `위치정보 로드 완료: ${refreshed.locations.located}개 / 대상 ${refreshed.locations.totalCandidates}개`,
      );
      setMessage(
        `완료: ${result.processed}개 처리${
          failedCount > 0 ? `, 실패 ${failedCount}개` : ""
        }${movedText}`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.",
      );
      setLocationMessage(
        error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
      setLocationLoading(false);
    }
  }

  function handlePreviewScroll(event: UIEvent<HTMLDivElement>) {
    pendingPreviewScrollRef.current = event.currentTarget;
    if (previewScrollFrameRef.current !== null) {
      return;
    }

    previewScrollFrameRef.current = window.requestAnimationFrame(() => {
      previewScrollFrameRef.current = null;
      const element = pendingPreviewScrollRef.current;
      if (!element) {
        return;
      }

      const nextScrollTop = element.scrollTop;
      setPreviewScrollTop((prev) =>
        prev === nextScrollTop ? prev : nextScrollTop,
      );

      const visibleBottomRow = Math.floor(
        (nextScrollTop + element.clientHeight) / previewItemHeight,
      );
      const requiredLoadedRows =
        Math.ceil((visibleBottomRow + previewPageRows) / previewPageRows) *
        previewPageRows;
      const requiredLoadedCount = Math.min(
        previewItems.length,
        requiredLoadedRows * previewColumns,
      );

      setPreviewLoadedCount((prev) => {
        if (requiredLoadedCount > prev) {
          return requiredLoadedCount;
        }

        const loadedRows = Math.ceil(
          Math.min(prev, previewItems.length) / previewColumns,
        );
        const stepCount = previewPageRows * previewColumns;
        if (
          visibleBottomRow >= loadedRows - previewPageRows / 2 &&
          prev < previewItems.length
        ) {
          return Math.min(previewItems.length, prev + stepCount);
        }

        return prev;
      });
    });
  }

  useEffect(() => {
    const prev = previousPreviewMetricsRef.current;
    const element = previewScrollRef.current;
    const itemsLengthChanged = prev.itemsLength !== previewItems.length;
    const layoutChanged =
      prev.columns !== previewColumns || prev.itemHeight !== previewItemHeight;

    if (itemsLengthChanged) {
      setPreviewLoadedCount(Math.min(PREVIEW_PAGE_SIZE, previewItems.length));
      setPreviewScrollTop(0);
      if (element) {
        element.scrollTop = 0;
      }
    } else if (layoutChanged && element) {
      const prevTotalRows = Math.ceil(
        Math.max(1, previewItems.length) / prev.columns,
      );
      const nextTotalRows = Math.ceil(
        Math.max(1, previewItems.length) / previewColumns,
      );
      const prevScrollable = Math.max(
        0,
        prevTotalRows * prev.itemHeight - element.clientHeight,
      );
      const nextScrollable = Math.max(
        0,
        nextTotalRows * previewItemHeight - element.clientHeight,
      );
      const progress =
        prevScrollable > 0 ? element.scrollTop / prevScrollable : 0;
      const nextScrollTop = Math.max(
        0,
        Math.min(nextScrollable, nextScrollable * progress),
      );
      element.scrollTop = nextScrollTop;
      setPreviewScrollTop(nextScrollTop);
      setPreviewLoadedCount((current) =>
        Math.min(previewItems.length, Math.max(current, PREVIEW_PAGE_SIZE)),
      );
    }

    previousPreviewMetricsRef.current = {
      itemsLength: previewItems.length,
      columns: previewColumns,
      itemHeight: previewItemHeight,
    };
  }, [previewColumns, previewItemHeight, previewItems.length]);

  useEffect(() => {
    return () => {
      if (previewScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(previewScrollFrameRef.current);
      }
    };
  }, []);

  const previewWindow = useMemo<PreviewWindow>(() => {
    const totalCount = previewItems.length;
    const loadedCount = Math.min(previewLoadedCount, totalCount);
    if (loadedCount === 0) {
      return {
        start: 0,
        end: 0,
        topPadding: 0,
        bottomPadding: 0,
      };
    }

    const totalRows = Math.ceil(totalCount / previewColumns);
    const loadedRows = Math.ceil(loadedCount / previewColumns);
    const maxStartRow = Math.max(0, loadedRows - maxRenderedRows);
    const pageBaseRow =
      Math.floor(previewScrollTop / previewItemHeight / previewPageRows) *
      previewPageRows;
    const desiredStartRow = Math.max(0, pageBaseRow - previewPageRows);
    const startRow = Math.min(desiredStartRow, maxStartRow);
    const endRow = Math.min(loadedRows, startRow + maxRenderedRows);
    const start = startRow * previewColumns;
    const end = Math.min(loadedCount, endRow * previewColumns);

    return {
      start,
      end,
      topPadding: startRow * previewItemHeight,
      bottomPadding: (totalRows - endRow) * previewItemHeight,
    };
  }, [
    maxRenderedRows,
    previewColumns,
    previewItemHeight,
    previewItems.length,
    previewLoadedCount,
    previewPageRows,
    previewScrollTop,
  ]);

  const visiblePreviewItems = useMemo(() => {
    return previewItems.slice(previewWindow.start, previewWindow.end);
  }, [previewItems, previewWindow.end, previewWindow.start]);

  return (
    <main className="relative min-h-screen bg-slate-100 px-2 py-2 text-slate-800 sm:px-3 sm:py-3 lg:h-screen lg:overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/25">
          <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
            {message || "처리 중..."}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1400px] font-['Segoe_UI','Apple_SD_Gothic_Neo',sans-serif] leading-relaxed">
        <header className="mb-2 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
            <button
              type="button"
              aria-label="메뉴 열기"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 sm:hidden"
              onClick={() => setDrawerOpen(true)}
            >
              <span className="sr-only">메뉴 열기</span>
              <span className="flex w-4 flex-col gap-0.5">
                <span className="h-0.5 w-full rounded bg-current" />
                <span className="h-0.5 w-full rounded bg-current" />
                <span className="h-0.5 w-full rounded bg-current" />
              </span>
            </button>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
              {activeTab === "manager"
                ? "iOS Live Photo Manager"
                : "iOS 미디어 위치 국가 분류"}
            </h1>
            <nav className="ml-3 hidden items-center gap-1 sm:flex">
              <button
                type="button"
                className={`rounded px-2.5 py-1 text-sm font-semibold ${
                  activeTab === "manager"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
                onClick={() => {
                  void navigate({ to: "/" });
                }}
              >
                Live Photo 정리
              </button>
              <button
                type="button"
                className={`rounded px-2.5 py-1 text-sm font-semibold ${
                  activeTab === "map"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
                onClick={() => {
                  void navigate({ to: "/map" });
                }}
              >
                위치 국가 분류
              </button>
            </nav>
            <span className="ml-auto text-xs font-semibold text-slate-500">
              v0.0.0
            </span>
          </div>
          <p className="px-3 py-1.5 text-xs text-slate-600">{tabDescription}</p>
        </header>
        <div className="lg:h-[calc(100vh-7.5rem)]">
          <div className="min-w-0 flex-1 lg:h-full">
            {activeTab === "manager" ? (
              <ManagerView
                panelClass={panelClass}
                desktopPanelHeightClass={desktopPanelHeightClass}
                baseButtonClass={baseButtonClass}
                loading={loading}
                locationLoading={locationLoading}
                folder={folder}
                canProcess={canProcess}
                scanResult={scanResult}
                message={message}
                previewLoadedCount={previewLoadedCount}
                previewItems={previewItems}
                visiblePreviewItems={visiblePreviewItems}
                previewWindow={previewWindow}
                previewLayout={previewLayout}
                previewFitMode={previewFitMode}
                previewScrollRef={previewScrollRef}
                onPickFolder={handlePickFolder}
                onScan={() => {
                  void handleScan();
                }}
                onProcess={(action) => {
                  void handleProcess(action);
                }}
                onPreviewScroll={handlePreviewScroll}
                onSetPreviewLayout={setPreviewLayout}
                onSetPreviewFitMode={setPreviewFitMode}
              />
            ) : (
              <MapView
                panelClass={panelClass}
                desktopPanelHeightClass={desktopPanelHeightClass}
                baseButtonClass={baseButtonClass}
                loading={loading}
                locationLoading={locationLoading}
                folder={folder}
                locationResult={locationResult}
                locationMessage={locationMessage}
                locatedPhotos={locationResult?.locatedPhotos ?? 0}
                locatedVideos={locationResult?.locatedVideos ?? 0}
                onPickFolder={handlePickFolder}
                onRefreshLocations={() => {
                  void handleLoadLocations();
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-20 sm:hidden ${drawerOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        <button
          type="button"
          aria-label="메뉴 닫기"
          className={`absolute inset-0 bg-slate-900/35 transition-opacity ${drawerOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          className={`absolute left-0 top-0 h-full w-72 max-w-[85vw] overflow-hidden border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <MenuPanel
            activeTab={activeTab}
            onSelectManager={() => {
              void navigate({ to: "/" });
              setDrawerOpen(false);
            }}
            onSelectMap={() => {
              void navigate({ to: "/map" });
              setDrawerOpen(false);
            }}
          />
        </aside>
      </div>
    </main>
  );
}

export default App;
