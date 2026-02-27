function MenuPanel({
  activeTab,
  onSelectManager,
  onSelectMap,
}: {
  activeTab: "manager" | "map";
  onSelectManager: () => void;
  onSelectMap: () => void;
}) {
  return (
    <>
      <div className="border-b border-slate-200 bg-slate-50/70 px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Workspace
        </p>
        <p className="mt-1 text-sm font-bold text-slate-900">기능 메뉴</p>
      </div>
      <div className="space-y-2 px-2 py-2">
        <button
          type="button"
          onClick={onSelectManager}
          className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
            activeTab === "manager"
              ? "border-slate-900 bg-slate-900 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <p className="text-sm font-semibold leading-tight">Live Photo Manager</p>
          <p
            className={`mt-1 text-[11px] ${
              activeTab === "manager" ? "text-slate-300" : "text-slate-500"
            }`}
          >
            사진/동영상 쌍을 탐색하고 정리
          </p>
        </button>
        <button
          type="button"
          onClick={onSelectMap}
          className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
            activeTab === "map"
              ? "border-slate-900 bg-slate-900 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <p className="text-sm font-semibold leading-tight">위치 국가 분류</p>
          <p
            className={`mt-1 text-[11px] ${
              activeTab === "map" ? "text-slate-300" : "text-slate-500"
            }`}
          >
            위도/경도로 국가를 추정해 분류
          </p>
        </button>
      </div>
    </>
  );
}

export default MenuPanel;
