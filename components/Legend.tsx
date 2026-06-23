export default function Legend() {
  const items = [
    { c: "bg-gradient-to-br from-emerald-400 to-green-600", label: "All good — dry & calm in your window" },
    { c: "bg-gradient-to-br from-amber-300 to-yellow-500", label: "Mixed — some bad hours" },
    { c: "bg-gradient-to-br from-rose-400 to-red-600", label: "Mostly bad — rain or wind ≥ 20 mph" },
    { c: "bg-white/50 border border-white/70", label: "No forecast (beyond ~16 days / past)" },
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-700">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded ${i.c}`} />
          {i.label}
        </div>
      ))}
    </div>
  );
}
