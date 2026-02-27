import { useMemo } from "react";
import type { MediaLocationItem } from "./types";
import { formatCoordinate, getFileName } from "./utils";

function classifyCountry(latitude: number, longitude: number) {
  if (latitude >= 33 && latitude <= 39.5 && longitude >= 124 && longitude <= 132) {
    return "대한민국";
  }
  if (latitude >= 18 && latitude <= 54.5 && longitude >= 73 && longitude <= 135.5) {
    return "중국";
  }
  if (latitude >= 24 && latitude <= 46 && longitude >= 123 && longitude <= 146) {
    return "일본";
  }
  if (latitude >= 34 && latitude <= 43 && longitude >= 124 && longitude <= 131) {
    return "북한";
  }
  return "기타";
}

function CoordinateMap({ items }: { items: MediaLocationItem[] }) {
  const rows = useMemo(() => {
    return items.map((item) => ({
      ...item,
      country: classifyCountry(item.latitude, item.longitude),
    }));
  }, [items]);

  const countrySummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.country, (map.get(row.country) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex flex-wrap gap-2">
        {countrySummary.map(([country, count]) => (
          <span
            key={country}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
          >
            {country} {count}개
          </span>
        ))}
      </div>
      <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="sticky top-0 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">국가(추정)</th>
              <th className="px-3 py-2">파일명</th>
              <th className="px-3 py-2">위도</th>
              <th className="px-3 py-2">경도</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.filePath} className="border-t border-slate-200">
                <td className="px-3 py-2 font-semibold text-slate-900">{row.country}</td>
                <td className="px-3 py-2">{getFileName(row.filePath)}</td>
                <td className="px-3 py-2">{formatCoordinate(row.latitude)}</td>
                <td className="px-3 py-2">{formatCoordinate(row.longitude)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CoordinateMap;
