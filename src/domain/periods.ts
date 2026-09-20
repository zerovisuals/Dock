/**
 * Das Rasterstunden-Schema von BG/BRG Tulln.
 *
 * Die Zeiten der Stunden 1 bis 6 sind im Quelldokument beschriftet. Die
 * Beginnzeiten der Stunden 7 bis 11 folgen den zusammenhängenden
 * Zeilengrenzen des Quelldokuments; sie sind nicht eigenständig bestätigt.
 *
 * Bestaetigte Zeiten einzelner Termine haben Vorrang vor diesem Raster.
 */

import type { Period } from "./types";
import { minutesOfDay, type LocalTime } from "./time";

export const PERIODS: readonly Period[] = [
  { index: 1, startsAt: "08:00", endsAt: "08:50" },
  { index: 2, startsAt: "08:55", endsAt: "09:45" },
  { index: 3, startsAt: "10:00", endsAt: "10:50" },
  { index: 4, startsAt: "11:00", endsAt: "11:50" },
  { index: 5, startsAt: "11:55", endsAt: "12:45" },
  { index: 6, startsAt: "12:50", endsAt: "13:40" },
  { index: 7, startsAt: "13:40", endsAt: "14:30" },
  { index: 8, startsAt: "14:30", endsAt: "15:20" },
  { index: 9, startsAt: "15:20", endsAt: "16:10" },
  { index: 10, startsAt: "16:10", endsAt: "17:00" },
  { index: 11, startsAt: "17:00", endsAt: "17:50" },
] as const;

/** Die Rasterstunden, deren Zeiten im Quelldokument beschriftet sind. */
export const LABELLED_PERIODS = [1, 2, 3, 4, 5, 6] as const;

export const FIRST_PERIOD_START: LocalTime = "08:00";
export const LAST_PERIOD_END: LocalTime = "17:50";

export function periodAt(index: number): Period | undefined {
  return PERIODS.find((p) => p.index === index);
}

/** Beginn der ersten und Ende der letzten Rasterstunde einer Folge. */
export function spanOfPeriods(
  indexes: readonly number[],
): { startsAt: LocalTime; endsAt: LocalTime } | null {
  if (indexes.length === 0) return null;
  const sorted = [...indexes].sort((a, b) => a - b);
  const first = periodAt(sorted[0] as number);
  const last = periodAt(sorted[sorted.length - 1] as number);
  if (!first || !last) return null;
  return { startsAt: first.startsAt, endsAt: last.endsAt };
}

/**
 * Die Rasterstunden, die ein Zeitraum berührt. Startinklusiv, endexklusiv –
 * eine Stunde, die um 10:00 endet, belegt die um 10:00 beginnende
 * Rasterstunde nicht.
 */
export function periodsCovering(
  startsAt: LocalTime,
  endsAt: LocalTime,
): number[] {
  const from = minutesOfDay(startsAt);
  const to = minutesOfDay(endsAt);
  return PERIODS.filter(
    (p) => minutesOfDay(p.startsAt) < to && from < minutesOfDay(p.endsAt),
  ).map((p) => p.index);
}

/** Sind die Rasterstunden lückenlos aufeinanderfolgend? */
export function areContiguous(indexes: readonly number[]): boolean {
  if (indexes.length <= 1) return true;
  const sorted = [...indexes].sort((a, b) => a - b);
  return sorted.every((value, i) => i === 0 || value === (sorted[i - 1] as number) + 1);
}
