function SummaryStatCard({
  label,
  value,
  nowrap = false,
}: {
  label: string;
  value: number | string;
  nowrap?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <p
        className={`${nowrap ? "whitespace-nowrap " : ""}text-[11px] text-slate-500`}
      >
        {label}
      </p>
      <p className="mt-0.5 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default SummaryStatCard;
