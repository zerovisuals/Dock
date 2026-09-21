"use client";

/**
 * Ein Kurs im Verlauf.
 *
 * Die tatsächlich stattgefundenen Stunden in zeitlicher Folge, mit dem, was
 * festgehalten wurde. Geplante künftige Stunden sind davon getrennt: ein
 * Termin in der Zukunft ist kein Beleg dafür, dass er stattgefunden hat.
 *
 * Die Suche geht über den Wortlaut der Einträge.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppShell } from "@/ui/AppShell";
import { GroupedList, Badge, SectionTitle } from "@/ui/LessonList";
import {
  AudienceBadge,
  CourseDot,
  EmptyState,
  LoadingLine,
  Notice,
} from "@/ui/primitives";
import { IconChevronLeft, IconSearch } from "@/ui/icons";
import { useDock } from "@/data/DockContext";
import { courseOf, currentVersion } from "@/data/store";
import { DateiListe } from "@/ui/DateiListe";
import type { Entry } from "@/domain/types";
import {
  compareDates,
  describeDateRelative,
  formatDateWithWeekday,
  formatTimeRange,
  minutesOfDay,
} from "@/domain/time";

const ART_LABEL: Record<Entry["kind"], string> = {
  hausuebung: "Hausübung",
  behandelt: "Behandelt",
  mitbringen: "Mitbringen",
  pruefung: "Prüfung",
  notiz: "Notiz",
  datei: "Datei",
};

export default function KursPage() {
  const parameter = useParams<{ courseId: string }>();
  const router = useRouter();
  const { snapshot, status, today } = useDock();
  const [suche, setSuche] = useState("");

  const course = courseOf(snapshot, parameter.courseId);

  /** Ein Block je Begegnung, chronologisch absteigend. */
  const begegnungen = useMemo(() => {
    if (!course) return [];
    const bloecke = new Map<string, (typeof snapshot.lessons)[number][]>();
    for (const lesson of snapshot.lessons) {
      if (lesson.courseId !== course.id) continue;
      const liste = bloecke.get(lesson.blockKey);
      if (liste) liste.push(lesson);
      else bloecke.set(lesson.blockKey, [lesson]);
    }
    return [...bloecke.values()]
      .map((gruppe) => gruppe.sort((a, b) => a.periodIndex - b.periodIndex))
      .sort((a, b) => {
        const x = a[0];
        const y = b[0];
        if (!x || !y) return 0;
        return x.date === y.date
          ? minutesOfDay(y.startsAt) - minutesOfDay(x.startsAt)
          : compareDates(y.date, x.date);
      });
  }, [course, snapshot.lessons]);

  const eintraegeJeBlock = useMemo(() => {
    const karte = new Map<string, Entry[]>();
    for (const entry of snapshot.entries) {
      if (!course || entry.courseId !== course.id) continue;
      const lesson = snapshot.lessons.find(
        (l) => l.id === entry.announcedInLessonId,
      );
      const key = entry.announcedInBlockKey ?? lesson?.blockKey;
      if (!key) continue;
      const liste = karte.get(key);
      if (liste) liste.push(entry);
      else karte.set(key, [entry]);
    }
    return karte;
  }, [course, snapshot.entries, snapshot.lessons]);

  const kursDateien = useMemo(() => {
    if (!course) return [];
    return snapshot.documents.filter((d) => d.courseId === course.id);
  }, [course, snapshot.documents]);

  const begriff = suche.trim().toLowerCase();

  const gefilterteBegegnungen = useMemo(() => {
    if (begriff === "") return begegnungen;
    return begegnungen.filter((gruppe) => {
      const key = gruppe[0]?.blockKey;
      if (!key) return false;
      const eintraege = eintraegeJeBlock.get(key) ?? [];
      return eintraege.some((entry) => {
        const version = currentVersion(snapshot, entry);
        return (
          (version?.text ?? "").toLowerCase().includes(begriff) ||
          (version?.detail ?? "").toLowerCase().includes(begriff)
        );
      });
    });
  }, [begegnungen, begriff, eintraegeJeBlock, snapshot]);

  if (status === "laedt") {
    return (
      <AppShell>
        <LoadingLine />
      </AppShell>
    );
  }

  if (!course) {
    return (
      <AppShell>
        <div className="card mt-8">
          <EmptyState
            title="Diesen Kurs gibt es nicht"
            action={
              <Link href="/app/faecher" className="btn btn-primary">
                Zu den Fächern
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

  const vergangene = gefilterteBegegnungen.filter(
    (g) => g[0] && compareDates(g[0].date, today) < 0,
  );
  const kuenftige = gefilterteBegegnungen
    .filter((g) => g[0] && compareDates(g[0].date, today) >= 0)
    .reverse();

  return (
    <AppShell>
      <div className="pt-6 lg:pt-10">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Zurück"
          className="btn btn-round"
        >
          <IconChevronLeft size={20} />
        </button>
      </div>

      <div className="mt-5">
        <h1 className="t-section flex items-center gap-2.5">
          <CourseDot color={course.accent} size={12} />
          {course.displayName}
        </h1>
        <p className="t-small mt-1.5">
          {vergangene.length} Stunden bisher
          {course.elective ? " · Wahlpflichtfach" : ""}
        </p>
      </div>

      {course.unresolved && (
        <div className="mt-4">
          <Notice>
            {course.unresolved}
            {course.sourceLabel
              ? ` Quellbezeichnung: „${course.sourceLabel}“.`
              : ""}
          </Notice>
        </div>
      )}

      {/* Suche */}
      <div className="relative mt-6">
        <span
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
          style={{ color: "var(--ink-faint)" }}
        >
          <IconSearch size={18} />
        </span>
        <input
          type="search"
          value={suche}
          onChange={(event) => setSuche(event.target.value)}
          placeholder="Im Verlauf suchen"
          aria-label="Im Verlauf dieses Kurses suchen"
          className="dock-input min-h-[48px] w-full py-3 pl-11 pr-4 outline-none"
        />
      </div>

      {kursDateien.length > 0 && begriff === "" && (
        <>
          <SectionTitle>Unterlagen des Kurses</SectionTitle>
          <DateiListe
            dokumente={kursDateien}
            label="Unterlagen des Kurses"
          />
          <p className="t-caption mt-2">
            Unterlagen auf Kursebene gehören zu keiner bestimmten Stunde.
          </p>
        </>
      )}

      <SectionTitle>
        {begriff === "" ? "Verlauf" : `Treffer (${gefilterteBegegnungen.length})`}
      </SectionTitle>

      {vergangene.length === 0 ? (
        <div className="card px-6 py-6">
          <p className="t-title">
            {begriff === ""
              ? "Noch keine Stunde gehalten"
              : "Keine Treffer"}
          </p>
          <p className="t-small mt-2">
            {begriff === ""
              ? "Sobald die erste Stunde vorbei ist, steht sie hier."
              : "Kein Eintrag dieses Kurses enthält diesen Text."}
          </p>
        </div>
      ) : (
        <GroupedList label="Vergangene Stunden">
          {vergangene.map((gruppe) => {
            const erste = gruppe[0];
            const letzte = gruppe[gruppe.length - 1];
            if (!erste || !letzte) return null;
            const eintraege = eintraegeJeBlock.get(erste.blockKey) ?? [];
            return (
              <Link
                key={erste.blockKey}
                href={`/app/stunde/${erste.id}`}
                className="block px-5 py-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className="text-[0.9375rem] font-semibold"
                    style={{ color: "var(--ink)" }}
                  >
                    {formatDateWithWeekday(erste.date)}
                  </p>
                  <p className="t-caption t-num">
                    {formatTimeRange(erste.startsAt, letzte.endsAt)}
                  </p>
                </div>

                {erste.status === "entfallen" && (
                  <div className="mt-1.5">
                    <Badge tone="cancelled">Entfallen</Badge>
                  </div>
                )}

                {eintraege.length === 0 ? (
                  <p className="t-small mt-1.5">
                    Für diese Stunde wurde noch nichts festgehalten
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {eintraege.slice(0, 3).map((entry) => {
                      const version = currentVersion(snapshot, entry);
                      return (
                        <li key={entry.id} className="flex items-start gap-2">
                          <Badge>{ART_LABEL[entry.kind]}</Badge>
                          <span className="t-small min-w-0 flex-1">
                            {version?.text}
                          </span>
                        </li>
                      );
                    })}
                    {eintraege.length > 3 && (
                      <li className="t-caption">
                        und {eintraege.length - 3} weitere
                      </li>
                    )}
                  </ul>
                )}
              </Link>
            );
          })}
        </GroupedList>
      )}

      {/* Geplante Stunden sind ausdrücklich getrennt. */}
      {kuenftige.length > 0 && begriff === "" && (
        <>
          <SectionTitle>Geplant</SectionTitle>
          <GroupedList label="Geplante Stunden">
            {kuenftige.slice(0, 5).map((gruppe) => {
              const erste = gruppe[0];
              const letzte = gruppe[gruppe.length - 1];
              if (!erste || !letzte) return null;
              return (
                <Link
                  key={erste.blockKey}
                  href={`/app/stunde/${erste.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-4"
                >
                  <span
                    className="text-[0.9375rem]"
                    style={{ color: "var(--ink)" }}
                  >
                    {describeDateRelative(erste.date, today)}
                  </span>
                  <span className="t-caption t-num">
                    {formatTimeRange(erste.startsAt, letzte.endsAt)}
                  </span>
                </Link>
              );
            })}
          </GroupedList>
          <p className="t-caption mt-2">
            Geplante Termine. Sie sind kein Beleg dafür, dass Unterricht
            stattgefunden hat.
          </p>
        </>
      )}
    </AppShell>
  );
}
