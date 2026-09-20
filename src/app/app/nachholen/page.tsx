"use client";

/**
 * Nachholen.
 *
 * Du wählst selbst, welche Tage du verpasst hast. Ein Grund wird nicht
 * erfasst und nicht erfragt. Abwesenheit wird nie aus Inaktivität, Standort
 * oder Sensoren abgeleitet.
 *
 * Wo nichts festgehalten wurde, steht das auch so. Eine leere Datenbank ist
 * kein Beleg dafür, dass nichts stattgefunden hat.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell, ScreenHeader } from "@/ui/AppShell";
import { GroupedList, Badge, SectionTitle } from "@/ui/LessonList";
import {
  CourseDot,
  Field,
  inputClass,
  LoadingLine,
  Notice,
} from "@/ui/primitives";
import { IconPlus, IconTrash } from "@/ui/icons";
import { useDock } from "@/data/DockContext";
import { courseOf, currentVersion } from "@/data/store";
import type { Entry } from "@/domain/types";
import {
  addDays,
  compareDates,
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

/** Was zu tun ist, gegenüber dem, was nur zur Kenntnis dient. */
const ZU_TUN = new Set<Entry["kind"]>(["hausuebung", "mitbringen"]);

export default function NachholenPage() {
  const { snapshot, status, today, mutate } = useDock();
  const [von, setVon] = useState(addDays(today, -1));
  const [bis, setBis] = useState(addDays(today, -1));
  const [fehler, setFehler] = useState<string | null>(null);

  const zeitraeume = useMemo(
    () =>
      [...snapshot.missedIntervals].sort((a, b) => compareDates(b.from, a.from)),
    [snapshot.missedIntervals],
  );

  /** Alle Stunden in den gewählten Zeiträumen, chronologisch. */
  const betroffen = useMemo(() => {
    const bloecke = new Map<string, (typeof snapshot.lessons)[number][]>();
    for (const lesson of snapshot.lessons) {
      const drin = zeitraeume.some(
        (z) =>
          compareDates(z.from, lesson.date) <= 0 &&
          compareDates(lesson.date, z.to) <= 0,
      );
      if (!drin) continue;
      const liste = bloecke.get(lesson.blockKey);
      if (liste) liste.push(lesson);
      else bloecke.set(lesson.blockKey, [lesson]);
    }
    return [...bloecke.values()]
      .map((g) => g.sort((a, b) => a.periodIndex - b.periodIndex))
      .sort((a, b) => {
        const x = a[0];
        const y = b[0];
        if (!x || !y) return 0;
        return x.date === y.date
          ? minutesOfDay(x.startsAt) - minutesOfDay(y.startsAt)
          : compareDates(x.date, y.date);
      });
  }, [snapshot.lessons, zeitraeume]);

  const eintraegeJeBlock = useMemo(() => {
    const karte = new Map<string, Entry[]>();
    for (const entry of snapshot.entries) {
      // Auch nachträglich erfasste Einträge zählen: der Zeitpunkt der
      // Erfassung spielt keine Rolle, nur die Stunde, zu der sie gehören.
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
  }, [snapshot.entries, snapshot.lessons]);

  const ohneInhalt = betroffen.filter(
    (g) => (eintraegeJeBlock.get(g[0]?.blockKey ?? "") ?? []).length === 0,
  ).length;

  async function hinzufuegen() {
    if (compareDates(von, bis) > 0) {
      setFehler("Das Ende darf nicht vor dem Beginn liegen.");
      return;
    }
    setFehler(null);
    await mutate((store) => store.addMissedInterval(von, bis));
  }

  if (status === "laedt") {
    return (
      <AppShell>
        <LoadingLine />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScreenHeader
        title="Nachholen"
        subtitle="Wähle die Tage, an denen du gefehlt hast. Einen Grund brauchst du nicht anzugeben."
      />

      {/* Zeitraum wählen */}
      <div className="card px-6 py-2">
        <div className="flex flex-col gap-0 sm:flex-row sm:gap-4">
          <div className="min-w-0 flex-1">
            <Field label="Von">
              {({ id }) => (
                <input
                  id={id}
                  type="date"
                  value={von}
                  onChange={(e) => setVon(e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
          </div>
          <div className="min-w-0 flex-1">
            <Field label="Bis" error={fehler}>
              {({ id }) => (
                <input
                  id={id}
                  type="date"
                  value={bis}
                  onChange={(e) => setBis(e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
          </div>
        </div>
        <div className="pb-5">
          <button
            type="button"
            onClick={hinzufuegen}
            className="btn btn-primary btn-block"
          >
            <IconPlus size={19} />
            Zeitraum hinzufügen
          </button>
        </div>
      </div>

      {zeitraeume.length > 0 && (
        <>
          <SectionTitle>Deine Zeiträume</SectionTitle>
          <GroupedList label="Gewählte Zeiträume">
            {zeitraeume.map((zeitraum) => (
              <div
                key={zeitraum.id}
                className="flex items-center gap-4 px-5 py-4"
              >
                <p
                  className="min-w-0 flex-1 text-[0.9375rem]"
                  style={{ color: "var(--ink)" }}
                >
                  {zeitraum.from === zeitraum.to
                    ? formatDateWithWeekday(zeitraum.from)
                    : `${formatDateWithWeekday(zeitraum.from)} bis ${formatDateWithWeekday(zeitraum.to)}`}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    mutate((store) => store.removeMissedInterval(zeitraum.id))
                  }
                  aria-label="Zeitraum entfernen"
                  className="btn btn-quiet px-2"
                >
                  <IconTrash size={17} />
                </button>
              </div>
            ))}
          </GroupedList>
        </>
      )}

      {zeitraeume.length === 0 ? (
        <div className="card mt-6 px-6 py-6">
          <p className="t-title">Noch kein Zeitraum gewählt</p>
          <p className="t-small mt-2">
            Wähle oben die Tage, die du nachholen möchtest. Dock zeigt dir dann,
            was für diese Stunden festgehalten wurde – und wo nichts steht.
          </p>
        </div>
      ) : (
        <>
          <SectionTitle>Was in dieser Zeit war</SectionTitle>

          {ohneInhalt > 0 && (
            <div className="mb-4">
              <Notice tone="warn">
                Für {ohneInhalt} von {betroffen.length} Stunden wurde nichts
                festgehalten. Das heißt nicht, dass nichts stattgefunden hat.
              </Notice>
            </div>
          )}

          {betroffen.length === 0 ? (
            <div className="card px-6 py-6">
              <p className="t-title">Kein Unterricht in diesem Zeitraum</p>
              <p className="t-small mt-2">
                In deinem Stundenplan sind für diese Tage keine Stunden
                eingetragen.
              </p>
            </div>
          ) : (
            <GroupedList label="Stunden im gewählten Zeitraum">
              {betroffen.map((gruppe) => {
                const erste = gruppe[0];
                const letzte = gruppe[gruppe.length - 1];
                if (!erste || !letzte) return null;
                const course = courseOf(snapshot, erste.courseId);
                const eintraege =
                  eintraegeJeBlock.get(erste.blockKey) ?? [];
                const aufgaben = eintraege.filter((e) => ZU_TUN.has(e.kind));
                const infos = eintraege.filter((e) => !ZU_TUN.has(e.kind));

                return (
                  <Link
                    key={erste.blockKey}
                    href={`/app/stunde/${erste.id}`}
                    className="block px-5 py-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="flex items-center gap-2 text-[0.9375rem] font-semibold" style={{ color: "var(--ink)" }}>
                        <CourseDot color={course?.accent ?? "#8A8A8A"} size={8} />
                        {course?.displayName}
                      </p>
                      <p className="t-caption t-num">
                        {formatTimeRange(erste.startsAt, letzte.endsAt)}
                      </p>
                    </div>
                    <p className="t-caption mt-0.5">
                      {formatDateWithWeekday(erste.date)}
                    </p>

                    {eintraege.length === 0 ? (
                      <p className="t-small mt-2">
                        Für diese Stunde wurde noch nichts festgehalten
                      </p>
                    ) : (
                      <>
                        {aufgaben.length > 0 && (
                          <div className="mt-2.5">
                            <p className="t-label mb-1">Zu erledigen</p>
                            <ul className="space-y-1">
                              {aufgaben.map((entry) => (
                                <li key={entry.id} className="flex items-start gap-2">
                                  <Badge tone="due">{ART_LABEL[entry.kind]}</Badge>
                                  <span className="t-small min-w-0 flex-1">
                                    {currentVersion(snapshot, entry)?.text}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {infos.length > 0 && (
                          <div className="mt-2.5">
                            <p className="t-label mb-1">Zur Kenntnis</p>
                            <ul className="space-y-1">
                              {infos.map((entry) => (
                                <li key={entry.id} className="flex items-start gap-2">
                                  <Badge>{ART_LABEL[entry.kind]}</Badge>
                                  <span className="t-small min-w-0 flex-1">
                                    {currentVersion(snapshot, entry)?.text}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </GroupedList>
          )}

          <p className="t-caption mt-4">
            Enthält auch Einträge, die erst später nachgetragen wurden. Deine
            gewählten Zeiträume sieht niemand ausser dir.
          </p>
        </>
      )}
    </AppShell>
  );
}
