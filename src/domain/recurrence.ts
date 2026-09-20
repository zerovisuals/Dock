/**
 * Erzeugen der einzelnen Stunden aus den wöchentlichen Vorlagen.
 *
 * Der Stundenplan wiederholt sich ohne Ende. Unendlich viele Zeilen lassen
 * sich nicht speichern, deshalb werden Stunden nur für einen gleitenden
 * Zeitraum erzeugt. Dieser Zeitraum ist ausschließlich eine Beschleunigung
 * und niemals das Ende des Stundenplans: Wird ein späterer Zeitraum
 * benötigt, wird er erzeugt.
 *
 * Das Erzeugen ist wiederholbar. Jede Stunde trägt einen Schlüssel aus
 * Serie, urspruenglichem Datum und Rasterstunde. Ein bereits vorhandener
 * Schlüssel wird nie ein zweites Mal angelegt und nie überschrieben –
 * dadurch bleiben Notizen, Dateien und Aufgabenbezuege erhalten, auch wenn
 * der Zeitraum erneut oder weiter erzeugt wird.
 */

import {
  addDays,
  compareDates,
  daysBetween,
  startOfWeek,
  weekdayOf,
  type LocalDate,
} from "./time";
import { periodAt, spanOfPeriods } from "./periods";
import type {
  LessonInstance,
  ScheduleException,
  ScheduleRevision,
  ScheduleSeries,
  Timestamp,
  Uuid,
} from "./types";

/** Wie weit im Voraus Stunden bereitgehalten werden. */
export const MATERIALIZATION_WEEKS_AHEAD = 16;

/** Wie weit zurück beim ersten Anlegen erzeugt wird. */
export const MATERIALIZATION_WEEKS_BEHIND = 2;

/**
 * Der Schlüssel einer Stunde.
 *
 * Er verwendet das *ursprüngliche* Datum, nicht das aktuelle. Wird eine
 * Stunde verschoben, bleibt ihr Schlüssel bestehen und sie wird beim
 * nächsten Erzeugen nicht erneut angelegt.
 */
export function occurrenceKeyFor(
  seriesId: Uuid,
  originalDate: LocalDate,
  periodIndex: number,
): string {
  return `${seriesId}:${originalDate}:${periodIndex}`;
}

/** Fasst zusammenhängende Stunden desselben Termins zu einem Block zusammen. */
export function blockKeyFor(
  seriesId: Uuid | null,
  originalDate: LocalDate,
): string {
  return `${seriesId ?? "einzel"}:${originalDate}`;
}

/**
 * Die Fassung einer Serie, die an einem bestimmten Tag gilt.
 *
 * Änderungen werden ab ihrem Stichtag wirksam. Frueher liegende Stunden
 * behalten die Angaben, mit denen sie erzeugt wurden.
 */
export function seriesAsOf(
  series: ScheduleSeries,
  revisions: readonly ScheduleRevision[],
  date: LocalDate,
): ScheduleSeries {
  const applicable = revisions
    .filter((r) => r.seriesId === series.id)
    .filter((r) => compareDates(r.effectiveFrom, date) <= 0)
    .sort((a, b) => compareDates(a.effectiveFrom, b.effectiveFrom));

  let result = series;
  for (const revision of applicable) {
    result = { ...result, ...revision.changes };
  }
  return result;
}

/** Faellt ein Datum in einen ausdruecklich erfassten unterrichtsfreien Zeitraum? */
export function isExcepted(
  date: LocalDate,
  exceptions: readonly ScheduleException[],
): boolean {
  return exceptions.some(
    (e) => compareDates(e.from, date) <= 0 && compareDates(date, e.to) <= 0,
  );
}

/**
 * Die Termine einer Serie in einem Zeitraum.
 *
 * Die Wiederholung wird auf Kalendertagen gerechnet. Dadurch bleibt eine
 * Stunde über die Zeitumstellung hinweg zur selben örtlichen Uhrzeit.
 */
export function occurrenceDates(
  series: ScheduleSeries,
  revisions: readonly ScheduleRevision[],
  from: LocalDate,
  to: LocalDate,
): LocalDate[] {
  if (!series.active) return [];
  const interval = Math.max(1, series.intervalWeeks);

  // Der erste mögliche Termin: der passende Wochentag ab dem Stichtag.
  const anchorStart = compareDates(series.effectiveFrom, from) > 0
    ? series.effectiveFrom
    : from;

  const dates: LocalDate[] = [];
  // Vom Montag der Woche aus suchen, damit der Wochentag zuverlässig
  // getroffen wird.
  let cursor = startOfWeek(anchorStart);

  while (compareDates(cursor, to) <= 0) {
    // Der Wochentag kann sich durch eine Änderung verschoben haben.
    const effective = seriesAsOf(series, revisions, cursor);
    const date = addDays(cursor, effective.weekday - 1);

    const withinWindow = compareDates(date, from) >= 0 &&
      compareDates(date, to) <= 0;
    const afterStart = compareDates(date, series.effectiveFrom) >= 0;
    const beforeEnd = series.endsOn === null ||
      compareDates(date, series.endsOn) <= 0;

    if (withinWindow && afterStart && beforeEnd) {
      // Bei einem Abstand größer als einer Woche zählt der Abstand zum
      // Stichtag in ganzen Wochen.
      const weeksSinceStart = Math.floor(
        daysBetween(startOfWeek(series.effectiveFrom), cursor) / 7,
      );
      if (weeksSinceStart % interval === 0) dates.push(date);
    }

    cursor = addDays(cursor, 7);
  }

  return dates;
}

export interface MaterializationInput {
  series: readonly ScheduleSeries[];
  revisions: readonly ScheduleRevision[];
  exceptions: readonly ScheduleException[];
  /** Bereits vorhandene Stunden, zur Erkennung von Doppelungen. */
  existing: readonly LessonInstance[];
  from: LocalDate;
  to: LocalDate;
  now: Timestamp;
  newId: () => Uuid;
}

export interface MaterializationResult {
  /** Neu anzulegende Stunden. Bereits vorhandene sind nicht enthalten. */
  created: LessonInstance[];
  /** Anzahl der Termine, die bereits vorhanden waren. */
  skippedExisting: number;
  /** Termine, die wegen eines unterrichtsfreien Zeitraums entfallen. */
  skippedExcepted: number;
}

/**
 * Erzeugt fehlende Stunden für einen Zeitraum.
 *
 * Wiederholtes Aufrufen mit demselben oder einem ueberlappenden Zeitraum
 * legt nichts doppelt an und aendert nichts Bestehendes.
 */
export function materialize(input: MaterializationInput): MaterializationResult {
  const { series, revisions, exceptions, existing, from, to, now, newId } =
    input;

  const known = new Set(existing.map((l) => l.occurrenceKey));
  const created: LessonInstance[] = [];
  let skippedExisting = 0;
  let skippedExcepted = 0;

  for (const s of series) {
    for (const date of occurrenceDates(s, revisions, from, to)) {
      // Unterrichtsfreie Zeiträume werden nur berücksichtigt, wenn sie
      // ausdruecklich erfasst wurden. Ferien werden nicht erraten.
      if (isExcepted(date, exceptions)) {
        skippedExcepted += 1;
        continue;
      }

      const effective = seriesAsOf(s, revisions, date);
      const indexes = [...effective.periodIndexes].sort((a, b) => a - b);
      if (indexes.length === 0) continue;

      // Bestaetigte Zeiten haben Vorrang vor dem Raster. Weicht die Serie vom
      // Raster ab, gilt ihre Zeit für den gesamten Block; die einzelnen
      // Rasterstunden behalten trotzdem ihre Identitaet.
      const gridSpan = spanOfPeriods(indexes);
      const usesGridTimes = gridSpan !== null &&
        gridSpan.startsAt === effective.startsAt &&
        gridSpan.endsAt === effective.endsAt;

      const blockKey = blockKeyFor(s.id, date);

      indexes.forEach((periodIndex, position) => {
        const key = occurrenceKeyFor(s.id, date, periodIndex);
        if (known.has(key)) {
          skippedExisting += 1;
          return;
        }
        known.add(key);

        const period = periodAt(periodIndex);
        let startsAt = period?.startsAt ?? effective.startsAt;
        let endsAt = period?.endsAt ?? effective.endsAt;

        if (!usesGridTimes) {
          // Die bestätigte Zeit deckt den ganzen Block ab. Die erste Stunde
          // beginnt zur bestätigten Zeit, die letzte endet zur bestätigten
          // Zeit; dazwischen bleibt das Raster maßgeblich.
          if (position === 0) startsAt = effective.startsAt;
          if (position === indexes.length - 1) endsAt = effective.endsAt;
        }

        created.push({
          id: newId(),
          courseId: s.courseId,
          seriesId: s.id,
          occurrenceKey: key,
          originalDate: date,
          date,
          startsAt,
          endsAt,
          periodIndex,
          blockKey,
          status: "geplant",
          statusNote: null,
          source: "manuell",
          createdAt: now,
          updatedAt: now,
        });
      });
    }
  }

  return { created, skippedExisting, skippedExcepted };
}

/**
 * Der Zeitraum, der bereitgehalten werden soll, damit ein bestimmtes Datum
 * sicher abgedeckt ist.
 *
 * Wird ein Datum jenseits des bisherigen Zeitraums angefragt – beim
 * Blaettern in eine spätere Woche oder beim Auflösen einer Fälligkeit –,
 * waechst der Zeitraum mit. Er endet nie endgueltig.
 */
export function windowFor(
  anchor: LocalDate,
  currentEnd: LocalDate | null,
): { from: LocalDate; to: LocalDate } {
  const from = addDays(
    startOfWeek(anchor),
    -7 * MATERIALIZATION_WEEKS_BEHIND,
  );
  const desiredEnd = addDays(
    startOfWeek(anchor),
    7 * MATERIALIZATION_WEEKS_AHEAD,
  );
  const to = currentEnd !== null && compareDates(currentEnd, desiredEnd) > 0
    ? currentEnd
    : desiredEnd;
  return { from, to };
}

/**
 * Muss der Zeitraum erweitert werden, um das Datum abzudecken?
 *
 * Eine fehlende Zeile bedeutet nie, dass es keinen Termin mehr gibt. Sie
 * bedeutet, dass noch nicht weit genug erzeugt wurde.
 */
export function needsExtension(
  date: LocalDate,
  materializedUntil: LocalDate | null,
): boolean {
  if (materializedUntil === null) return true;
  return compareDates(date, materializedUntil) > 0;
}

/** Stunden eines Blocks, in der Reihenfolge des Rasters. */
export function lessonsOfBlock(
  lessons: readonly LessonInstance[],
  blockKey: string,
): LessonInstance[] {
  return lessons
    .filter((l) => l.blockKey === blockKey)
    .sort((a, b) => a.periodIndex - b.periodIndex);
}

/**
 * Gruppiert Stunden eines Tages zu Bloecken.
 *
 * Zusammenhaengende Stunden desselben Kurses werden gemeinsam dargestellt.
 * Die einzelnen Stunden bleiben dabei erhalten und abrufbar.
 */
export interface LessonBlock {
  blockKey: string;
  courseId: Uuid;
  date: LocalDate;
  startsAt: string;
  endsAt: string;
  periodIndexes: number[];
  lessons: LessonInstance[];
  status: LessonInstance["status"];
}

export function groupIntoBlocks(
  lessons: readonly LessonInstance[],
): LessonBlock[] {
  const byKey = new Map<string, LessonInstance[]>();
  for (const lesson of lessons) {
    const list = byKey.get(lesson.blockKey);
    if (list) list.push(lesson);
    else byKey.set(lesson.blockKey, [lesson]);
  }

  const blocks: LessonBlock[] = [];
  for (const [blockKey, group] of byKey) {
    const sorted = [...group].sort((a, b) => a.periodIndex - b.periodIndex);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last) continue;

    // Eine entfallene Stunde faerbt den Block nur, wenn alle entfallen sind.
    const allCancelled = sorted.every((l) => l.status === "entfallen");

    blocks.push({
      blockKey,
      courseId: first.courseId,
      date: first.date,
      startsAt: first.startsAt,
      endsAt: last.endsAt,
      periodIndexes: sorted.map((l) => l.periodIndex),
      lessons: sorted,
      status: allCancelled ? "entfallen" : first.status,
    });
  }

  return blocks.sort((a, b) =>
    a.date === b.date
      ? a.startsAt.localeCompare(b.startsAt)
      : compareDates(a.date, b.date)
  );
}

export { weekdayOf };
