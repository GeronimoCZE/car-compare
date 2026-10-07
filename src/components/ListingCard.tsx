import Link from "next/link";
import type { Listing } from "@/db/schema";
import type { Dict, Locale } from "@/i18n/dictionaries";
import { money, num, relativeDays } from "@/lib/format";
import { listingPath } from "@/lib/paths";
import { ConditionBadge, DealBadge } from "./Badges";
import { CarPlaceholder } from "./CarPlaceholder";
import { CompareButton } from "./CompareButton";

export function ListingCard({
  l,
  sourceName,
  locale,
  t,
  eurRate,
}: {
  l: Listing;
  sourceName: string;
  locale: Locale;
  t: Dict;
  eurRate: number;
}) {
  const specs = [
    l.year,
    l.mileageKm != null ? `${num(l.mileageKm, locale)} km` : null,
    l.fuel !== "unknown" ? t.fuel[l.fuel] : null,
    l.transmission !== "unknown" ? t.transmission[l.transmission] : null,
    l.powerKw ? `${l.powerKw} kW` : null,
  ].filter(Boolean);
  return (
    <article className="card group relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={listingPath(locale, l)} className="absolute inset-0 z-10" aria-label={l.title} />
      <div className="relative aspect-[16/10] overflow-hidden">
        {l.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
        ) : (
          <CarPlaceholder className="h-full w-full" />
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <ConditionBadge condition={l.condition} t={t} />
        </div>
        <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">{l.country === "SK" ? "🇸🇰" : "🇨🇿"} {sourceName}</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug">{l.title}</h3>
        <p className="mt-1 text-sm text-muted">{specs.join(" · ")}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div>
            <div className="text-xl font-extrabold tracking-tight">{l.priceCzk != null ? money(l.priceCzk, locale, eurRate) : <span className="text-base text-muted">{t.listing.priceOnRequest}</span>}</div>
            <div className="mt-1"><DealBadge score={l.dealScore} condition={l.condition} t={t} /></div>
          </div>
          <div className="relative z-20">
            <CompareButton id={l.id} labels={{ add: t.listing.compare, added: t.listing.inCompare }} compact />
          </div>
        </div>
        <p className="mt-3 truncate text-xs text-muted">
          {l.location ?? ""}{l.location ? " · " : ""}{relativeDays(l.postedAt ?? l.firstSeenAt, locale)}
        </p>
      </div>
    </article>
  );
}
