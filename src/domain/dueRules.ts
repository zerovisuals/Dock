/**
 * Auflösen von Fälligkeiten.
 *
 * Die Regel und ihr aufgeloestes Ziel werden beide gespeichert. Das Ziel ist
 * kein Nebenprodukt der Anzeige, sondern ein festgehaltenes Ergebnis mit
 * Zeitpunkt und Vorgaenger.
 *
 * Die wichtigste Regel: "nächste Stunde" wird relativ zum festen Ankerpunkt
 * der Ankündigung aufgelöst, niemals relativ zum heutigen Tag. Sonst würde
 * eine unerledigte Aufgabe mit jedem Seitenaufruf weiterwandern und nie
 * überfällig werden.
 */

import { compareDates, minutesOfDay, type LocalDate } from "./time";
import type {
  DueResolution,
  DueResolutionState,
  DueRule,
  LessonInstance,
  Timestamp,
  Uuid,
} from "./types";

export interface ResolutionContext {
  /** Alle bekannten Stunden. Muss den Ankerpunkt enthalten. */
  lessons: readonly LessonInstance[];
  /** Bis zu welchem Datum Stunden erzeugt wurden. */
  materializedUntil: LocalDate | null;
  now: Timestamp;
}

export interface ResolvedDue {
  state: DueResolutionState;
  targetLessonId: Uuid | null;
  targetDate: LocalDate | null;
  targetTime: string | null;
  /** Wahr, wenn der Zeitraum erweitert werden muss, um sicher zu sein. */
  needsMoreLessons: boolean;
  reason: string | null;
}

const NOT_DUE: ResolvedDue = {
  state: "ohne",
  targetLessonId: null,
  targetDate: null,
  targetTime: null,
  needsMoreLessons: false,
  reason: null,
};

/** Sortiert Stunden nach tatsaechlichem Datum und Beginn. */
function chronologically(
  a: LessonInstance,
  b: LessonInstance,
): number {
  const byDate = compareDates(a.date, b.date);
  if (byDate !== 0) return byDate;
  const byTime = minutesOfDay(a.startsAt) - minutesOfDay(b.startsAt);
  if (byTime !== 0) return byTime;
  return a.periodIndex - b.periodIndex;
}

/** Liegt `a` zeitlich streng vor `b`? */
function isBefore(a: LessonInstance, b: LessonInstance): boolean {
  return chronologically(a, b) < 0;
}

/**
 * Die nächste Unterrichtsbegegnung desselben Kurses nach dem Ankerpunkt.
 *
 * "Nächste Stunde" bedeutet die nächste *Begegnung*, nicht die zweite
 * Stunde eines Doppels am selben Tag. Stunden desselben Blocks wie der Anker
 * zählen deshalb nicht als Ziel.
 *
 * Entfallene Stunden sind keine gültigen Ziele.
 */
export function nextMeetingAfter(
  anchor: LessonInstance,
  lessons: readonly LessonInstance[],
): LessonInstance | null {
  const candidates = lessons
    .filter((l) => l.courseId === anchor.courseId)
    .filter((l) => l.id !== anchor.id)
    .filter((l) => l.blockKey !== anchor.blockKey)
    .filter((l) => l.status !== "entfallen")
    .filter((l) => isBefore(anchor, l))
    .sort(chronologically);

  return candidates[0] ?? null;
}

/**
 * Loest eine Regel zu einem Ziel auf.
 *
 * Der heutige Tag spielt dabei bewusst keine Rolle.
 */
export function resolveDue(
  rule: DueRule | null,
  context: ResolutionContext,
): ResolvedDue {
  if (rule === null || rule.kind === "NONE") return NOT_DUE;

  switch (rule.kind) {
    case "FIXED_DATE": {
      // Ein Datum ohne Uhrzeit bleibt ein Datum. Es wird keine Mitternacht
      // erfunden.
      return {
        state: "aufgeloest",
        targetLessonId: null,
        targetDate: rule.date,
        targetTime: null,
        needsMoreLessons: false,
        reason: null,
      };
    }

    case "FIXED_DATETIME": {
      return {
        state: "aufgeloest",
        targetLessonId: null,
        targetDate: rule.date,
        targetTime: rule.time,
        needsMoreLessons: false,
        reason: null,
      };
    }

    case "SPECIFIC_LESSON": {
      const lesson = context.lessons.find((l) => l.id === rule.lessonId);
      if (!lesson) {
        return {
          state: "offen",
          targetLessonId: rule.lessonId,
          targetDate: null,
          targetTime: null,
          needsMoreLessons: true,
          reason: "Die gewählte Stunde ist noch nicht geladen.",
        };
      }
      if (lesson.status === "entfallen") {
        // Eine ausdruecklich gewählte Stunde wird nicht stillschweigend
        // durch eine andere ersetzt. Der Benutzer entscheidet.
        return {
          state: "pruefen",
          targetLessonId: lesson.id,
          targetDate: lesson.date,
          targetTime: lesson.startsAt,
          needsMoreLessons: false,
          reason: "Die gewählte Stunde ist entfallen.",
        };
      }
      // Einer verschobenen Stunde wird gefolgt: die Identitaet bleibt.
      return {
        state: "aufgeloest",
        targetLessonId: lesson.id,
        targetDate: lesson.date,
        targetTime: lesson.startsAt,
        needsMoreLessons: false,
        reason: null,
      };
    }

    case "NEXT_SUBJECT_LESSON": {
      const anchor = context.lessons.find((l) => l.id === rule.anchorLessonId);
      if (!anchor) {
        return {
          state: "offen",
          targetLessonId: null,
          targetDate: null,
          targetTime: null,
          needsMoreLessons: true,
          reason: "Die Ankündigungsstunde ist noch nicht geladen.",
        };
      }

      const target = nextMeetingAfter(anchor, context.lessons);
      if (target) {
        return {
          state: "aufgeloest",
          targetLessonId: target.id,
          targetDate: target.date,
          targetTime: target.startsAt,
          needsMoreLessons: false,
          reason: null,
        };
      }

      // Kein Treffer im bekannten Bereich. Das heißt nicht, dass es keine
      // Stunde mehr gibt – es heißt, dass noch nicht weit genug erzeugt
      // wurde. Die Regel bleibt erhalten, die Aufgabe bleibt sichtbar.
      return {
        state: "offen",
        targetLessonId: null,
        targetDate: null,
        targetTime: null,
        needsMoreLessons: true,
        reason: "Nächste Stunde noch nicht geplant.",
      };
    }
  }
}

/**
 * Bildet einen gespeicherten Datensatz aus einer Auflösung und vergleicht
 * ihn mit der bisherigen Auflösung.
 *
 * Aendert sich das Ziel, wird der Vorgaenger festgehalten und in Klartext
 * begruendet. Nur so lässt sich anzeigen, dass sich eine Fälligkeit
 * verschoben hat.
 */
export function buildResolution(
  entryId: Uuid,
  resolved: ResolvedDue,
  previous: DueResolution | null,
  now: Timestamp,
  newId: () => Uuid,
): DueResolution {
  const targetChanged = previous !== null &&
    previous.targetLessonId !== resolved.targetLessonId;

  let reason = resolved.reason;
  if (targetChanged && reason === null && previous.targetDate !== null) {
    reason = "Das Ziel hat sich geändert.";
  }

  return {
    id: newId(),
    entryId,
    state: resolved.state,
    targetLessonId: resolved.targetLessonId,
    targetDate: resolved.targetDate,
    targetTime: resolved.targetTime,
    previousTargetLessonId: targetChanged ? previous.targetLessonId : null,
    previousTargetDate: targetChanged ? previous.targetDate : null,
    reason,
    resolvedAt: now,
  };
}

/**
 * Ist eine Fälligkeit überschritten?
 *
 * Bezugspunkt ist das festgehaltene Ziel, nicht die Regel. Eine Aufgabe, die
 * ihren Termin verpasst hat, bleibt überfällig; sie springt nicht in die
 * nächste Woche.
 */
export function isOverdue(
  resolution: DueResolution | null,
  today: LocalDate,
  nowTime: string,
): boolean {
  if (!resolution) return false;
  if (resolution.state !== "aufgeloest") return false;
  if (resolution.targetDate === null) return false;

  const byDate = compareDates(resolution.targetDate, today);
  if (byDate < 0) return true;
  if (byDate > 0) return false;

  // Am Zieltag zählt die Uhrzeit, sofern eine bekannt ist. Ein reines
  // Datum gilt bis zum Ende des Tages.
  if (resolution.targetTime === null) return false;
  return minutesOfDay(nowTime) >= minutesOfDay(resolution.targetTime);
}

/** Ist die Fälligkeit heute? */
export function isDueToday(
  resolution: DueResolution | null,
  today: LocalDate,
): boolean {
  return resolution?.state === "aufgeloest" &&
    resolution.targetDate === today;
}

/**
 * Nach dem Entfall einer Stunde: welche Fälligkeiten brauchen eine neue
 * Auflösung?
 *
 * Betroffen sind nur Regeln, deren Ziel die entfallene Stunde ist. Feste
 * Termine bleiben unberührt.
 */
export function affectedByCancellation(
  cancelledLessonId: Uuid,
  resolutions: readonly DueResolution[],
): Uuid[] {
  return resolutions
    .filter((r) => r.targetLessonId === cancelledLessonId)
    .map((r) => r.entryId);
}

/**
 * Beschreibt eine Fälligkeit in Worten, für die Anzeige.
 */
export function describeRule(rule: DueRule | null): string {
  if (rule === null || rule.kind === "NONE") return "Ohne Fälligkeit";
  switch (rule.kind) {
    case "NEXT_SUBJECT_LESSON":
      return "Zur nächsten Stunde";
    case "SPECIFIC_LESSON":
      return "Zu einer bestimmten Stunde";
    case "FIXED_DATE":
      return "Zu einem Datum";
    case "FIXED_DATETIME":
      return "Zu einem Zeitpunkt";
  }
}
