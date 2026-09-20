"use client";

/**
 * Aufgaben.
 *
 * Hausübungen und Mitbringsel in einer Liste, filterbar nach Fach und
 * Zustand. Der Erledigt-Stand gehört der Person, nicht der Aufgabe.
 *
 * "Ohne Fälligkeit" ist ein gültiger Zustand und wird nicht weggeräumt.
 */

import { useMemo, useState } from "react";
import { AppShell, ScreenHeader } from "@/ui/AppShell";
import { GroupedList, Badge, SectionTitle } from "@/ui/LessonList";
import {
  AudienceBadge,
  ChipGroup,
  CourseDot,
  EmptyState,
  LoadingLine,
  Notice,
} from "@/ui/primitives";
import { useDock } from "@/data/DockContext";
import {
  courseOf,
  currentVersion,
  latestResolution,
  openTasks,
  taskStateOf,
  completionIsStale,
} from "@/data/store";
import type { Entry } from "@/domain/types";
import { compareDates, describeDateRelative } from "@/domain/time";

type Filter = "offen" | "ueberfaellig" | "erledigt" | "alle";

const FILTER: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: "offen", label: "Offen" },
  { value: "ueberfaellig", label: "Überfällig" },
  { value: "erledigt", label: "Erledigt" },
  { value: "alle", label: "Alle" },
];

export default function AufgabenPage() {
  const { snapshot, status, today, nowTime, userId } = useDock();
  const [filter, setFilter] = useState<Filter>("offen");
  const [kurs, setKurs] = useState<string>("alle");

  const alle = useMemo(
    () => openTasks(snapshot, userId, today, nowTime),
    [snapshot, userId, today, nowTime],
  );

  const gefiltert = useMemo(() => {
    return alle
      .filter((t) => (kurs === "alle" ? true : t.entry.courseId === kurs))
      .filter((t) => {
        const erledigt = t.state?.done ?? false;
        if (filter === "offen") return !erledigt;
        if (filter === "erledigt") return erledigt;
        if (filter === "ueberfaellig") return !erledigt && t.overdue;
        return true;
      });
  }, [alle, filter, kurs]);

  // Nach Fälligkeit gruppieren – das ist die Frage, die man wirklich hat.
  const gruppen = useMemo(() => {
    const ueberfaellig = gefiltert.filter((t) => t.overdue && !t.state?.done);
    const mitDatum = gefiltert.filter(
      (t) =>
        !ueberfaellig.includes(t) &&
        t.resolution?.state === "aufgeloest" &&
        t.resolution.targetDate !== null,
    );
    const offenesZiel = gefiltert.filter(
      (t) => t.resolution?.state === "offen",
    );
    const ohneFaelligkeit = gefiltert.filter(
      (t) =>
        !ueberfaellig.includes(t) &&
        !mitDatum.includes(t) &&
        !offenesZiel.includes(t),
    );
    return { ueberfaellig, mitDatum, offenesZiel, ohneFaelligkeit };
  }, [gefiltert]);

  const kurseMitAufgaben = useMemo(() => {
    const ids = new Set(alle.map((t) => t.entry.courseId));
    return snapshot.courses.filter((c) => ids.has(c.id));
  }, [alle, snapshot.courses]);

  if (status === "laedt") {
    return (
      <AppShell>
        <LoadingLine />
      </AppShell>
    );
  }

  const offeneAnzahl = alle.filter((t) => !t.state?.done).length;

  return (
    <AppShell>
      <ScreenHeader
        title="Aufgaben"
        subtitle={
          offeneAnzahl === 0
            ? "Nichts offen"
            : `${offeneAnzahl} offen${
                alle.filter((t) => t.overdue && !t.state?.done).length > 0
                  ? `, davon ${alle.filter((t) => t.overdue && !t.state?.done).length} überfällig`
                  : ""
              }`
        }
      />

      <div className="flex flex-col gap-3">
        <ChipGroup
          label="Zustand"
          value={filter}
          onChange={setFilter}
          options={FILTER}
        />
        {kurseMitAufgaben.length > 1 && (
          <ChipGroup
            label="Fach"
            value={kurs}
            onChange={setKurs}
            options={[
              { value: "alle", label: "Alle Fächer" },
              ...kurseMitAufgaben.map((c) => ({
                value: c.id,
                label: c.displayName,
              })),
            ]}
          />
        )}
      </div>

      {gefiltert.length === 0 ? (
        <div className="card mt-6">
          <EmptyState
            title={
              filter === "offen"
                ? "Nichts offen"
                : filter === "ueberfaellig"
                  ? "Nichts überfällig"
                  : filter === "erledigt"
                    ? "Noch nichts erledigt"
                    : "Noch keine Aufgaben"
            }
            description={
              filter === "alle"
                ? "Erfasse eine Hausübung aus einer Stunde heraus – dann steht sie hier."
                : undefined
            }
          />
        </div>
      ) : (
        <>
          {gruppen.ueberfaellig.length > 0 && (
            <>
              <SectionTitle>Überfällig</SectionTitle>
              <GroupedList label="Überfällige Aufgaben">
                {gruppen.ueberfaellig.map((t) => (
                  <AufgabenZeile key={t.entry.id} entry={t.entry} overdue />
                ))}
              </GroupedList>
            </>
          )}

          {gruppen.mitDatum.length > 0 && (
            <>
              <SectionTitle>Mit Termin</SectionTitle>
              <GroupedList label="Aufgaben mit Termin">
                {[...gruppen.mitDatum]
                  .sort((a, b) =>
                    compareDates(
                      a.resolution?.targetDate ?? "9999-12-31",
                      b.resolution?.targetDate ?? "9999-12-31",
                    ),
                  )
                  .map((t) => (
                    <AufgabenZeile key={t.entry.id} entry={t.entry} />
                  ))}
              </GroupedList>
            </>
          )}

          {gruppen.offenesZiel.length > 0 && (
            <>
              <SectionTitle>Termin noch offen</SectionTitle>
              <GroupedList label="Aufgaben ohne geplanten Termin">
                {gruppen.offenesZiel.map((t) => (
                  <AufgabenZeile key={t.entry.id} entry={t.entry} />
                ))}
              </GroupedList>
              <p className="t-caption mt-2">
                Für diese Fächer ist noch keine nächste Stunde geplant. Die
                Aufgaben bleiben sichtbar.
              </p>
            </>
          )}

          {gruppen.ohneFaelligkeit.length > 0 && (
            <>
              <SectionTitle>Ohne Fälligkeit</SectionTitle>
              <GroupedList label="Aufgaben ohne Fälligkeit">
                {gruppen.ohneFaelligkeit.map((t) => (
                  <AufgabenZeile key={t.entry.id} entry={t.entry} />
                ))}
              </GroupedList>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}

export function AufgabenZeile({
  entry,
  overdue,
}: {
  entry: Entry;
  overdue?: boolean;
}) {
  const { snapshot, userId, mutate, today } = useDock();
  const version = currentVersion(snapshot, entry);
  const course = courseOf(snapshot, entry.courseId);
  const resolution = latestResolution(snapshot, entry.id);
  const state = taskStateOf(snapshot, entry.id, userId);
  const veraltet = completionIsStale(entry, state);
  const erledigt = state?.done ?? false;

  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <button
        type="button"
        role="checkbox"
        aria-checked={erledigt}
        aria-label={`${version?.text ?? "Aufgabe"} als erledigt markieren`}
        onClick={() => mutate((s) => s.setTaskDone(entry.id, !erledigt))}
        className="mt-0.5 flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[8px]"
        style={{
          border: erledigt ? "0" : "1.5px solid var(--line-strong)",
          background: erledigt ? "var(--accent)" : "var(--surface-sunken)",
        }}
      >
        {erledigt && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="none"
            stroke="#fff"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4.5 10.5l3.5 3.5 8-8.5" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className="text-[0.9375rem] leading-[1.45]"
          style={{
            color: erledigt ? "var(--ink-muted)" : "var(--ink)",
            textDecoration: erledigt ? "line-through" : undefined,
          }}
        >
          {version?.text}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <CourseDot color={course?.accent ?? "#8A8A8A"} size={7} />
            <span className="t-caption">{course?.displayName}</span>
          </span>
          {resolution?.state === "aufgeloest" && resolution.targetDate && (
            <span className="t-caption">
              · fällig {describeDateRelative(resolution.targetDate, today)}
            </span>
          )}
          {resolution?.state === "offen" && (
            <span className="t-caption">· Nächste Stunde noch nicht geplant</span>
          )}
          {entry.kind === "mitbringen" && <Badge>Mitbringen</Badge>}
          <AudienceBadge audience={entry.audience} />
        </div>

        {resolution?.state === "pruefen" && (
          <div className="mt-2">
            <Notice tone="warn">Ziel prüfen: {resolution.reason}</Notice>
          </div>
        )}

        {veraltet && (
          <div className="mt-2">
            <Notice tone="warn">
              Der Text wurde geändert, seit du abgehakt hast. Prüf, ob etwas
              dazugekommen ist.
            </Notice>
          </div>
        )}
      </div>

      {overdue && <Badge tone="overdue">Überfällig</Badge>}
    </div>
  );
}
