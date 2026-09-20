/**
 * Zeitrechnung für Dock.
 *
 * Grundsatz: Der Stundenplan lebt in örtlicher Zivilzeit (Europe/Vienna).
 * Wiederholungen werden auf Kalendertagen erzeugt, nicht durch Addition von
 * 168 UTC-Stunden. Dadurch bleibt eine Stunde über die Zeitumstellung hinweg
 * zur selben örtlichen Uhrzeit.
 *
 * Zeitpunkte werden zusätzlich als UTC-Instant geführt, damit sich
 * Intervalle vergleichen und sortieren lassen. Intervalle sind
 * startinklusiv und endexklusiv.
 */

export const SCHOOL_TIMEZONE = "Europe/Vienna";
export const LOCALE = "de-AT";

/** Ein Kalendertag ohne Uhrzeit, als `JJJJ-MM-TT`. */
export type LocalDate = string;

/** Eine örtliche Uhrzeit ohne Datum, als `HH:MM` im 24-Stunden-Format. */
export type LocalTime = string;

/** Montag = 1 ... Sonntag = 7, wie ISO 8601. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isLocalDate(value: string): value is LocalDate {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

export function isLocalTime(value: string): value is LocalTime {
  return TIME_PATTERN.test(value);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function assertDate(date: LocalDate): void {
  if (!isLocalDate(date)) {
    throw new RangeError(`Ungültiges Datum: ${date}`);
  }
}

function assertTime(time: LocalTime): void {
  if (!isLocalTime(time)) {
    throw new RangeError(`Ungültige Uhrzeit: ${time}`);
  }
}

/**
 * Rechnet ein Kalenderdatum in eine Tageszahl um. Bezugspunkt ist beliebig;
 * nur Differenzen und die Reihenfolge sind von Bedeutung. Die Rechnung läuft
 * über UTC-Mitternacht und ist damit frei von Zeitzonen-Effekten.
 */
function toDayNumber(date: LocalDate): number {
  assertDate(date);
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function fromDayNumber(dayNumber: number): LocalDate {
  const ms = dayNumber * 86_400_000;
  const dt = new Date(ms);
  return formatParts(
    dt.getUTCFullYear(),
    dt.getUTCMonth() + 1,
    dt.getUTCDate(),
  );
}

function formatParts(year: number, month: number, day: number): LocalDate {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Verschiebt ein Datum um ganze Kalendertage. */
export function addDays(date: LocalDate, days: number): LocalDate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Anzahl ganzer Kalendertage von `from` bis `to`. Negativ, wenn `to` früher liegt. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** Wochentag nach ISO 8601: Montag = 1 ... Sonntag = 7. */
export function weekdayOf(date: LocalDate): Weekday {
  const jsDay = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sonntag
  return (jsDay === 0 ? 7 : jsDay) as Weekday;
}

/** Montag der Kalenderwoche, in der `date` liegt. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, -(weekdayOf(date) - 1));
}

/** Die sieben Tage der Kalenderwoche, beginnend mit Montag. */
export function weekDates(anyDateInWeek: LocalDate): LocalDate[] {
  const monday = startOfWeek(anyDateInWeek);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a <= b ? a : b;
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a >= b ? a : b;
}

/* -------------------------------------------------------------------------
   Zeitzone
   ------------------------------------------------------------------------- */

const offsetFormatterCache = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = offsetFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    offsetFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Der Versatz der Zone gegenueber UTC in Minuten, gültig für den gegebenen
 * Zeitpunkt. Wird durch Rückrechnung der formatierten Ortszeit bestimmt und
 * kommt damit ohne Zeitzonentabelle aus.
 */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = offsetFormatter(timeZone).formatToParts(instant);
  const lookup: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(
    lookup.year ?? 1970,
    (lookup.month ?? 1) - 1,
    lookup.day ?? 1,
    lookup.hour === 24 ? 0 : (lookup.hour ?? 0),
    lookup.minute ?? 0,
    lookup.second ?? 0,
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * Wandelt örtliche Zivilzeit in einen echten Zeitpunkt um.
 *
 * Der Versatz der Zone hängt selbst vom Zeitpunkt ab. Deshalb werden beide
 * plausiblen Kandidaten gebildet und danach geprüft, welcher beim
 * Zurueckrechnen wieder die gewünschte Ortszeit ergibt.
 *
 * Die beiden Sonderfaelle der Zeitumstellung:
 *  - Uebersprungene Ortszeit (Frühjahr, 02:00 bis 03:00): kein Kandidat
 *    passt. Es wird der Zeitpunkt unmittelbar nach dem Sprung gewählt, die
 *    Ortszeit also um die Lücke nach vorne verschoben.
 *  - Doppelte Ortszeit (Herbst, 02:00 bis 03:00): beide Kandidaten passen.
 *    Es wird das erste Auftreten gewählt.
 */
export function toInstant(
  date: LocalDate,
  time: LocalTime,
  timeZone: string = SCHOOL_TIMEZONE,
): Date {
  assertDate(date);
  assertTime(time);
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0);

  // Der Versatz hängt vom Zeitpunkt ab, den wir erst suchen. Deshalb werden
  // mehrere Versatzwerte aus der Umgebung des gesuchten Tages erprobt. Ein
  // Tag Abstand genügt, um beide Seiten einer Umstellung zu erfassen.
  const probes = [
    naive - 86_400_000,
    naive,
    naive + 86_400_000,
  ];

  const candidates = new Set<number>();
  for (const probe of probes) {
    const offset = zoneOffsetMinutes(new Date(probe), timeZone);
    candidates.add(naive - offset * 60_000);
  }

  // Gueltig ist ein Kandidat, der zurückgerechnet wieder die gewünschte
  // Ortszeit ergibt.
  const valid: number[] = [];
  for (const candidate of candidates) {
    const instant = new Date(candidate);
    if (
      localDateOf(instant, timeZone) === date &&
      localTimeOf(instant, timeZone) === time
    ) {
      valid.push(candidate);
    }
  }

  // Doppelte Ortszeit im Herbst: das erste Auftreten.
  if (valid.length > 0) return new Date(Math.min(...valid));

  // Uebersprungene Ortszeit im Frühjahr: es gibt keinen gültigen Kandidaten.
  // Gewaehlt wird der Zeitpunkt hinter dem Sprung, die Ortszeit wandert also
  // um die Länge der Lücke nach vorne.
  return new Date(Math.max(...candidates));
}

/** Das örtliche Kalenderdatum, an dem ein Zeitpunkt liegt. */
export function localDateOf(
  instant: Date,
  timeZone: string = SCHOOL_TIMEZONE,
): LocalDate {
  const parts = offsetFormatter(timeZone).formatToParts(instant);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = part.value;
  }
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

/** Die örtliche Uhrzeit, zu der ein Zeitpunkt liegt. */
export function localTimeOf(
  instant: Date,
  timeZone: string = SCHOOL_TIMEZONE,
): LocalTime {
  const parts = offsetFormatter(timeZone).formatToParts(instant);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = part.value;
  }
  const hour = lookup.hour === "24" ? "00" : lookup.hour;
  return `${hour}:${lookup.minute}`;
}

/** Heutiges oertliches Datum in der Schulzeitzone. */
export function todayLocal(
  now: Date = new Date(),
  timeZone: string = SCHOOL_TIMEZONE,
): LocalDate {
  return localDateOf(now, timeZone);
}

/* -------------------------------------------------------------------------
   Rechnen mit Uhrzeiten
   ------------------------------------------------------------------------- */

export function minutesOfDay(time: LocalTime): number {
  assertTime(time);
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  return hh * 60 + mm;
}

export function timeFromMinutes(minutes: number): LocalTime {
  const clamped = ((minutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
  const mm = String(clamped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Dauer in Minuten zwischen zwei Uhrzeiten desselben Tages. */
export function durationMinutes(from: LocalTime, to: LocalTime): number {
  return minutesOfDay(to) - minutesOfDay(from);
}

/**
 * Ueberschneiden sich zwei Intervalle desselben Tages?
 * Startinklusiv, endexklusiv – zwei aneinander grenzende Stunden
 * überschneiden sich also nicht.
 */
export function overlaps(
  aStart: LocalTime,
  aEnd: LocalTime,
  bStart: LocalTime,
  bEnd: LocalTime,
): boolean {
  return minutesOfDay(aStart) < minutesOfDay(bEnd) &&
    minutesOfDay(bStart) < minutesOfDay(aEnd);
}

/* -------------------------------------------------------------------------
   Darstellung
   ------------------------------------------------------------------------- */

const WEEKDAY_LONG = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
] as const;

const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

const MONTH_LONG = [
  "Jänner",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

/**
 * Monatsnamen werden bewusst selbst geführt: `de-AT` liefert in manchen
 * Laufzeitumgebungen "Januar" statt "Jänner" und "März" statt "März".
 */
export function monthName(date: LocalDate): string {
  const [, m] = date.split("-").map(Number) as [number, number];
  return MONTH_LONG[m - 1] ?? "";
}

export function weekdayName(date: LocalDate): string {
  return WEEKDAY_LONG[weekdayOf(date) - 1] ?? "";
}

export function weekdayShort(date: LocalDate): string {
  return WEEKDAY_SHORT[weekdayOf(date) - 1] ?? "";
}

export function weekdayNameFor(weekday: Weekday): string {
  return WEEKDAY_LONG[weekday - 1] ?? "";
}

export function weekdayShortFor(weekday: Weekday): string {
  return WEEKDAY_SHORT[weekday - 1] ?? "";
}

/** `12. Oktober 2026` */
export function formatDateLong(date: LocalDate): string {
  const [y, , d] = date.split("-").map(Number) as [number, number, number];
  return `${d}. ${monthName(date)} ${y}`;
}

/** `Mo, 12. Oktober` */
export function formatDateWithWeekday(date: LocalDate): string {
  const [, , d] = date.split("-").map(Number) as [number, number, number];
  return `${weekdayShort(date)}, ${d}. ${monthName(date)}`;
}

/** `12.10.2026` */
export function formatDateNumeric(date: LocalDate): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
}

/** `12.10.` – für enge Spalten. */
export function formatDayMonth(date: LocalDate): string {
  const [, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.`;
}

/** `08:00–09:45` mit Halbgeviertstrich. */
export function formatTimeRange(from: LocalTime, to: LocalTime): string {
  return `${from}–${to}`;
}

/**
 * Beschreibt einen Tag in Bezug auf heute: "Heute", "Morgen", "Gestern",
 * sonst das Datum mit Wochentag.
 */
export function describeDateRelative(
  date: LocalDate,
  today: LocalDate,
): string {
  const delta = daysBetween(today, date);
  if (delta === 0) return "Heute";
  if (delta === 1) return "Morgen";
  if (delta === -1) return "Gestern";
  if (delta === 2) return "Übermorgen";
  return formatDateWithWeekday(date);
}

/** Kalenderwoche nach ISO 8601. */
export function isoWeekNumber(date: LocalDate): number {
  const thursday = addDays(startOfWeek(date), 3);
  const [year] = thursday.split("-").map(Number) as [number];
  const firstThursday = addDays(startOfWeek(`${year}-01-04`), 3);
  return Math.round(daysBetween(firstThursday, thursday) / 7) + 1;
}

/**
 * Beschreibt eine Zeitspanne in Worten, etwa "in 2 Std 15 min" oder
 * "noch 23 min". Ohne erfundene Genauigkeit: ab einem Tag wird in Tagen
 * gezählt.
 */
export function describeDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 1) return "gleich";
  if (total < 60) return `${total} min`;

  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours < 24) {
    return rest === 0 ? `${hours} Std` : `${hours} Std ${rest} min`;
  }

  const days = Math.round(hours / 24);
  return days === 1 ? "1 Tag" : `${days} Tage`;
}

/** Minuten zwischen zwei Zeitpunkten. */
export function minutesBetweenInstants(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 60_000;
}
