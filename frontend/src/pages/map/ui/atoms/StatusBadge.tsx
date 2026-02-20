import React from "react";

export function StatusBadge({ s }: { s: "PENDING" | "CONFIRMED" | "DECLINED" | "WAITLISTED" | string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-800",
    CONFIRMED: "bg-emerald-50 text-emerald-700",
    DECLINED: "bg-red-50 text-red-600",
    WAITLISTED: "bg-blue-50 text-blue-700",
  };
  const cls = map[s] ?? "bg-gray-100 text-gray-600";
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium uppercase ${cls}`}>{s}</span>;
}
