"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SortSelect({ options, label }: { options: Record<string, string>; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <select
        className="input !w-auto !py-2"
        value={params.get("sort") ?? "newest"}
        onChange={(e) => {
          const p = new URLSearchParams(params);
          p.set("sort", e.target.value);
          p.delete("page");
          router.push(`${pathname}?${p}`);
        }}
      >
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </label>
  );
}
