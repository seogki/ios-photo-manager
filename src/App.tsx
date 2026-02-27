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

const ITEM_HEIGHT = 188;
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
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const previewScrollFrameRef = useRef<number | null>(null);
  const pendingPreviewScrollRef = useRef<HTMLDivElement | null>(null);
  const baseButtonClass =
    "rounded-lg border border-slate-200 bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-300";
  const panelClass = "rounded-2xl border border-slate-200 bg-white/95 shadow-sm";
  const desktopPanelHeightClass = "lg:h-[calc(74vh+4.5rem)]";
  const previewItems = scanResult?.previews ?? [];

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
      setPreviewScrollTop((prev) => (prev === nextScrollTop ? prev : nextScrollTop));

      const visibleBottomIndex = Math.floor(
        (nextScrollTop + element.clientHeight) / ITEM_HEIGHT,
      );
      const requiredLoadedCount = Math.min(
        previewItems.length,
        Math.ceil((visibleBottomIndex + PREVIEW_PAGE_SIZE) / PREVIEW_PAGE_SIZE) *
          PREVIEW_PAGE_SIZE,
      );

      setPreviewLoadedCount((prev) => {
        if (requiredLoadedCount > prev) {
          return requiredLoadedCount;
        }

        if (
          visibleBottomIndex >=
            Math.min(prev, previewItems.length) - PREVIEW_PAGE_SIZE / 2 &&
          prev < previewItems.length
        ) {
          return Math.min(previewItems.length, prev + PREVIEW_PAGE_SIZE);
        }

        return prev;
      });
    });
  }

  useEffect(() => {
    setPreviewLoadedCount(Math.min(PREVIEW_PAGE_SIZE, previewItems.length));
    setPreviewScrollTop(0);
    const element = previewScrollRef.current;
    if (element) {
      element.scrollTop = 0;
    }
  }, [previewItems.length]);

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

    const maxStart = Math.max(0, loadedCount - MAX_RENDERED_PREVIEWS);
    const pageBase =
      Math.floor(previewScrollTop / ITEM_HEIGHT / PREVIEW_PAGE_SIZE) *
      PREVIEW_PAGE_SIZE;
    const desiredStart = Math.max(0, pageBase - PREVIEW_PAGE_SIZE);
    const start = Math.min(desiredStart, maxStart);
    const end = Math.min(loadedCount, start + MAX_RENDERED_PREVIEWS);

    return {
      start,
      end,
      topPadding: start * ITEM_HEIGHT,
      bottomPadding: (totalCount - end) * ITEM_HEIGHT,
    };
  }, [previewItems.length, previewLoadedCount, previewScrollTop]);

  const visiblePreviewItems = useMemo(() => {
    return previewItems.slice(previewWindow.start, previewWindow.end);
  }, [previewItems, previewWindow.end, previewWindow.start]);

  return (
    <main className="relative min-h-screen bg-slate-100 px-3 py-4 text-slate-800">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/25">
          <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
            {message || "처리 중..."}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1400px] font-['Segoe_UI','Apple_SD_Gothic_Neo',sans-serif] leading-relaxed">
        <div className="flex gap-3">
          <aside
            className={`${panelClass} sticky top-4 hidden w-56 shrink-0 self-start overflow-hidden lg:block`}
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

          <div className="min-w-0 flex-1">
            <header className="mb-3 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-4 shadow-sm sm:px-5">
              <button
                type="button"
                aria-label="메뉴 열기"
                className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 lg:hidden"
                onClick={() => setDrawerOpen(true)}
              >
                <span className="sr-only">메뉴 열기</span>
                <span className="flex w-5 flex-col gap-1">
                  <span className="h-0.5 w-full rounded bg-current" />
                  <span className="h-0.5 w-full rounded bg-current" />
                  <span className="h-0.5 w-full rounded bg-current" />
                </span>
              </button>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                  {activeTab === "manager"
                    ? "iOS Live Photo Manager"
                    : "iOS 미디어 위치 국가 분류"}
                </h1>
                <p className="mt-1.5 text-sm text-slate-600">
                  {activeTab === "manager"
                    ? "아이폰 Live Photo ZIP 압축 해제 후 생기는 사진+동영상 중복을 정리합니다."
                    : "선택한 폴더의 GPS 좌표를 읽어 국가 단위로 분류해 보여줍니다."}
                </p>
              </div>
            </header>

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
                previewScrollRef={previewScrollRef}
                onPickFolder={handlePickFolder}
                onScan={() => {
                  void handleScan();
                }}
                onProcess={(action) => {
                  void handleProcess(action);
                }}
                onPreviewScroll={handlePreviewScroll}
              />
            ) : (
              <MapView
                panelClass={panelClass}
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
        className={`fixed inset-0 z-20 lg:hidden ${drawerOpen ? "pointer-events-auto" : "pointer-events-none"}`}
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
