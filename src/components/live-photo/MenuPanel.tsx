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
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Navigation
        </p>
        <p className="mt-0.5 text-sm font-semibold text-slate-900">작업 메뉴</p>
      </div>
      <div className="space-y-1 px-2 py-2">
        <button
          type="button"
          onClick={onSelectManager}
          className={`w-full rounded-md border px-2.5 py-2 text-left text-sm transition-colors ${
            activeTab === "manager"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50"
          }`}
        >
          Live Photo 정리
        </button>
        <button
          type="button"
          onClick={onSelectMap}
          className={`w-full rounded-md border px-2.5 py-2 text-left text-sm transition-colors ${
            activeTab === "map"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50"
          }`}
        >
          위치 국가 분류
        </button>
      </div>
    </>
  );
}

export default MenuPanel;
