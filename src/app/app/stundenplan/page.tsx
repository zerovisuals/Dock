"use client";

/**
 * Stundenplan.
 *
 * Am Schreibtisch die Wochenansicht als Raster: fünf Spalten, die Zeiten als
 * Achse links. Auf dem Telefon der Tag mit Wochentagswahl – fünf Spalten auf
 * 360 Pixel wären unlesbar.
 *
 * Der Plan wiederholt sich jede Woche ohne Ende. Blättert man in eine
 * spätere Woche, werden die Stunden dafür erzeugt.
 */

import { useEffect, useMemo, useState } from "react";
import { AppShell, ScreenHeader } from "@/ui/AppShell";
import { GroupedList, LessonRow, Badge } from "@/ui/LessonList";
import { LoadingLine } from "@/ui/primitives";
import { IconChevronLeft, IconChevronRight } from "@/ui/icons";
import { useBlockBadges } from "@/ui/useTaskBadges";
import { useDock, useEnsureMaterialized } from "@/data/DockContext";
import { blocksOn, courseOf } from "@/data/store";
import { PERIODS } from "@/domain/periods";
import type { LessonBlock } from "@/domain/recurrence";
import {
  addDays,
  formatDayMonth,
  formatTimeRange,
  isoWeekNumber,
  minutesOfDay,
  startOfWeek,
  weekdayShort,
  weekdayName,
  type LocalDate,
} from "@/domain/time";
import Link from "next/link";

const TAGESBEGINN = minutesOfDay(PERIODS[0]?.startsAt ?? "08:00");

export default function StundenplanPage() {
  const { snapshot, status, today } = useDock();
  const [anker, setAnker] = useState<LocalDate>(today);
  const [gewaehlterTag, setGewaehlterTag] = useState<LocalDate>(today);
  const [selbstGeblaettert, setSelbstGeblaettert] = useState(false);

  // Die Vorschau-Uhr wird erst nach dem ersten Rendern geladen. Solange
  // nicht selbst geblättert wurde, folgt die Ansicht dem heutigen Tag.
  useEffect(() => {
    if (selbstGeblaettert) return;
    setAnker(today);
    setGewaehlterTag(today);
  }, [today, selbstGeblaettert]);

  const montag = startOfWeek(anker);
  const wochentage = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(montag, i)),
    [montag],
  );

  // Beim Blättern wird der Zeitraum erweitert – er endet nie endgültig.
  useEnsureMaterialized(addDays(montag, 6));

  if (status === "laedt") {
    return (
      <AppShell>
        <LoadingLine />
      </AppShell>
    );
  }

  function woche(schritt: number) {
    const neu = addDays(montag, schritt * 7);
    setSelbstGeblaettert(true);
    setAnker(neu);
    setGewaehlterTag(neu);
  }

  const inDieserWoche = wochentage.some((t) => t === today);

  return (
    <AppShell>
      <ScreenHeader
        title="Stundenplan"
        subtitle={
          <span className="t-num">
            KW {isoWeekNumber(montag)} · {formatDayMonth(montag)} bis{" "}
            {formatDayMonth(addDays(montag, 4))}
          </span>
        }
        actions={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => woche(-1)}
              aria-label="Vorherige Woche"
              className="btn btn-quiet min-h-[44px] px-2"
            >
              <IconChevronLeft />
            </button>
            {!inDieserWoche && (
              <button
                type="button"
                onClick={() => {
                  setSelbstGeblaettert(false);
                  setAnker(today);
                  setGewaehlterTag(today);
                }}
                className="btn btn-secondary"
              >
                Diese Woche
              </button>
            )}
            <button
              type="button"
              onClick={() => woche(1)}
              aria-label="Nächste Woche"
              className="btn btn-quiet min-h-[44px] px-2"
            >
              <IconChevronRight />
            </button>
          </div>
        }
      />

      {/* Telefon: Tageswahl und Tagesliste */}
      <div className="lg:hidden">
        <TagesWahl
          tage={wochentage}
          gewaehlt={gewaehlterTag}
          onWaehlen={setGewaehlterTag}
          today={today}
        />
        <TagesListe datum={gewaehlterTag} />
      </div>

      {/* Schreibtisch: Wochenraster */}
      <div className="mt-5 hidden lg:block">
        <WochenRaster tage={wochentage} today={today} />
      </div>

      <p className="t-caption mt-6">
        Der Plan wiederholt sich jede Woche ohne Enddatum. Änderungen an einer
        einzelnen Stunde oder ab einem Stichtag triffst du in der Stunde selbst.
      </p>
    </AppShell>
  );
}

/** Die Wochentagswahl auf dem Telefon. */
function TagesWahl({
  tage,
  gewaehlt,
  onWaehlen,
  today,
}: {
  tage: LocalDate[];
  gewaehlt: LocalDate;
  onWaehlen: (datum: LocalDate) => void;
  today: LocalDate;
}) {
  const { snapshot } = useDock();

  return (
    <div
      role="tablist"
      aria-label="Wochentag wählen"
      className="mt-4 grid grid-cols-5 gap-1.5"
    >
      {tage.map((tag) => {
        const aktiv = tag === gewaehlt;
        const istHeute = tag === today;
        const anzahl = blocksOn(snapshot, tag).filter(
          (b) => b.status !== "entfallen",
        ).length;

        return (
          <button
            key={tag}
            type="button"
            role="tab"
            aria-selected={aktiv}
            onClick={() => onWaehlen(tag)}
            className="relative flex min-h-[66px] flex-col items-center justify-center gap-0.5 rounded-[16px]"
            style={{
              background: aktiv ? "var(--surface-contrast)" : "var(--surface)",
              color: aktiv ? "var(--on-contrast)" : "var(--ink-muted)",
              boxShadow: aktiv ? "var(--shadow-sm)" : "var(--shadow-xs)",
            }}
          >
            <span className="text-[0.6875rem] font-medium">
              {weekdayShort(tag)}
            </span>
            <span
              className="t-num text-[0.9375rem] font-semibold"
              style={{ color: aktiv ? "var(--ink)" : undefined }}
            >
              {tag.slice(8)}
            </span>
            {/* Ein Punkt je Stunde wäre Unfug – ein Strich zeigt, dass der
                Tag belegt ist. */}
            <span
              aria-hidden
              className="absolute bottom-1.5 h-[2px] w-4 rounded-full"
              style={{
                background: istHeute
                  ? aktiv
                    ? "var(--on-contrast)"
                    : "var(--accent)"
                  : anzahl > 0
                    ? aktiv
                      ? "rgba(255,255,255,0.4)"
                      : "var(--line-strong)"
                    : "transparent",
              }}
            />
            <span className="sr-only">
              {weekdayName(tag)}, {anzahl} Stunden
              {istHeute ? ", heute" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TagesListe({ datum }: { datum: LocalDate }) {
  const { snapshot } = useDock();
  const blocks = blocksOn(snapshot, datum);

  if (blocks.length === 0) {
    return (
      <div className="card mt-4 px-5 py-4">
        <p className="t-heading">Kein Unterricht</p>
        <p className="t-small mt-1">
          Für {weekdayName(datum)} ist nichts eingetragen.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <GroupedList label={`Stunden am ${weekdayName(datum)}`}>
        {blocks.map((block) => (
          <TagesZeile key={block.blockKey} block={block} />
        ))}
      </GroupedList>
    </div>
  );
}

function TagesZeile({ block }: { block: LessonBlock }) {
  const { snapshot, userId } = useDock();
  const course = courseOf(snapshot, block.courseId);
  const badges = useBlockBadges(snapshot, block, userId);

  return (
    <LessonRow
      block={block}
      course={course}
      badges={
        <>
          {block.status === "entfallen" && <Badge tone="cancelled">Entfällt</Badge>}
          {block.status === "zusatztermin" && <Badge>Zusatztermin</Badge>}
          {block.periodIndexes.length > 1 && (
            <Badge>{block.periodIndexes.length} Einheiten</Badge>
          )}
          {badges.dueCount > 0 && <Badge tone="due">Hausübung fällig</Badge>}
          {badges.assessment && <Badge tone="due">Prüfung</Badge>}
        </>
      }
    />
  );
}

/**
 * Das Wochenraster.
 *
 * Die Höhe einer Stunde folgt ihrer Dauer, damit Doppelstunden und die
 * bestätigten Sonderzeiten richtig aussehen. Der Bereich scrollt bewusst
 * innerhalb seiner Fläche, statt die ganze Seite breit zu machen.
 */
function WochenRaster({ tage, today }: { tage: LocalDate[]; today: LocalDate }) {
  const { snapshot } = useDock();

  const letzteStunde = useMemo(() => {
    let ende = minutesOfDay("13:40");
    for (const tag of tage) {
      for (const block of blocksOn(snapshot, tag)) {
        ende = Math.max(ende, minutesOfDay(block.endsAt));
      }
    }
    return ende;
  }, [snapshot, tage]);

  const gesamtMinuten = letzteStunde - TAGESBEGINN;
  const PIXEL_PRO_MINUTE = 1.05;
  const hoehe = gesamtMinuten * PIXEL_PRO_MINUTE;

  const stundenMarken = PERIODS.filter(
    (p) => minutesOfDay(p.startsAt) < letzteStunde,
  );

  return (
    <div className="card overflow-hidden">
      {/* Die Wochentage stehen über ihren Spalten. */}
      <div
        className="grid grid-cols-5"
        style={{
          marginLeft: 62,
          borderBottom: "1px solid var(--line)",
        }}
      >
        {tage.map((tag) => {
          const istHeute = tag === today;
          return (
            <div key={tag} className="px-2 py-2.5 text-center">
              <span
                className="text-[0.8125rem] font-semibold"
                style={{
                  color: istHeute ? "var(--accent)" : "var(--ink)",
                }}
              >
                {weekdayShort(tag)}
              </span>{" "}
              <span
                className="t-caption t-num"
                style={{ color: istHeute ? "var(--accent)" : undefined }}
              >
                {formatDayMonth(tag)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex">
        {/* Zeitachse */}
        <div
          className="relative w-[62px] shrink-0"
          style={{ height: hoehe, borderRight: "1px solid var(--line)" }}
        >
          {stundenMarken.map((periode) => (
            <div
              key={periode.index}
              className="absolute left-0 right-0 px-2"
              style={{
                top: (minutesOfDay(periode.startsAt) - TAGESBEGINN) * PIXEL_PRO_MINUTE,
              }}
            >
              <span className="t-caption t-num block leading-none">
                {periode.startsAt}
              </span>
              <span
                className="t-caption block leading-none"
                style={{ color: "var(--ink-faint)", fontSize: "0.6875rem" }}
              >
                {periode.index}.
              </span>
            </div>
          ))}
        </div>

        {/* Tagesspalten */}
        <div className="grid flex-1 grid-cols-5">
          {tage.map((tag, spalte) => (
            <div
              key={tag}
              className="relative"
              style={{
                height: hoehe,
                borderRight:
                  spalte < 4 ? "1px solid var(--line)" : undefined,
              }}
            >
              {/* Stundenlinien als ruhiger Hintergrund */}
              {stundenMarken.map((periode) => (
                <div
                  key={periode.index}
                  aria-hidden
                  className="absolute left-0 right-0"
                  style={{
                    top:
                      (minutesOfDay(periode.startsAt) - TAGESBEGINN) *
                      PIXEL_PRO_MINUTE,
                    borderTop: "1px solid var(--line)",
                  }}
                />
              ))}

              {blocksOn(snapshot, tag).map((block) => (
                <RasterStunde
                  key={block.blockKey}
                  block={block}
                  pixelProMinute={PIXEL_PRO_MINUTE}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

function RasterStunde({
  block,
  pixelProMinute,
}: {
  block: LessonBlock;
  pixelProMinute: number;
}) {
  const { snapshot, userId } = useDock();
  const course = courseOf(snapshot, block.courseId);
  const badges = useBlockBadges(snapshot, block, userId);
  const entfallen = block.status === "entfallen";

  const top = (minutesOfDay(block.startsAt) - TAGESBEGINN) * pixelProMinute;
  const hoehe =
    (minutesOfDay(block.endsAt) - minutesOfDay(block.startsAt)) * pixelProMinute;

  return (
    <Link
      href={`/app/stunde/${block.lessons[0]?.id ?? ""}`}
      className="absolute left-1.5 right-1.5 overflow-hidden rounded-[12px] px-2.5 py-2"
      style={{
        top: top + 1,
        height: Math.max(26, hoehe - 2),
        background: entfallen ? "var(--surface-sunken)" : "var(--surface)",
        // Die Fachfarbe steht links als schmale Kante – ein Strich, keine
        // eingefärbte Fläche.
        boxShadow: entfallen
          ? `inset 3px 0 0 0 var(--line-strong)`
          : `inset 3px 0 0 0 ${course?.accent ?? "#8A8A8A"}, var(--shadow-xs)`,
        opacity: entfallen ? 0.7 : 1,
      }}
    >
      <p
        className="truncate text-[0.8125rem] font-semibold leading-tight"
        style={{
          color: "var(--ink)",
          textDecoration: entfallen ? "line-through" : undefined,
        }}
      >
        {course?.shortLabel ?? "?"}
      </p>
      {hoehe > 46 && (
        <p className="t-caption t-num mt-0.5 truncate leading-tight">
          {formatTimeRange(block.startsAt, block.endsAt)}
        </p>
      )}
      {hoehe > 70 && (badges.dueCount > 0 || badges.assessment) && (
        <span
          aria-hidden
          className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--accent)" }}
        />
      )}
      <span className="sr-only">
        {course?.displayName}, {formatTimeRange(block.startsAt, block.endsAt)}
        {entfallen ? ", entfällt" : ""}
        {badges.dueCount > 0 ? `, ${badges.dueCount} Hausübungen fällig` : ""}
        {badges.assessment ? ", Prüfung angekündigt" : ""}
      </span>
    </Link>
  );
}
