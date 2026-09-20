/**
 * Erfundene Daten für die Vorschau und die Demo.
 *
 * Bewusst getrennt vom echten Stundenplan: weder die Klasse 7c noch die
 * Schule noch persönliche Inhalte des Auftraggebers kommen hier vor. Die
 * Namen der Kurse sind allgemein, die Einträge erfunden.
 */

import { startOfWeek, type LocalDate, type Weekday } from "./time";
import { spanOfPeriods } from "./periods";
import type {
  AcademicYear,
  Course,
  Entry,
  EntryVersion,
  School,
  ScheduleSeries,
  SchoolClass,
  Timestamp,
} from "./types";

export const DEMO_SCHOOL_ID = "d0000000-0000-4000-8000-000000000001";
export const DEMO_YEAR_ID = "d0000000-0000-4000-8000-000000000002";
export const DEMO_CLASS_ID = "d0000000-0000-4000-8000-000000000003";
export const DEMO_USER_ID = "d0000000-0000-4000-8000-00000000000a";

function id(prefix: string, n: number): string {
  return `${prefix}0000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

interface DemoCourse {
  key: string;
  name: string;
  short: string;
  accent: string;
}

const DEMO_COURSES: readonly DemoCourse[] = [
  { key: "mathe", name: "Mathematik", short: "M", accent: "#0e9f9f" },
  { key: "deutsch", name: "Deutsch", short: "D", accent: "#b8860b" },
  { key: "englisch", name: "Englisch", short: "E", accent: "#c2456b" },
  { key: "biologie", name: "Biologie", short: "BIO", accent: "#3f8f45" },
  { key: "geschichte", name: "Geschichte", short: "GES", accent: "#8a5a7a" },
  { key: "physik", name: "Physik", short: "PH", accent: "#2f6be0" },
];

interface DemoSeries {
  courseKey: string;
  weekday: Weekday;
  periods: number[];
}

const DEMO_SERIES: readonly DemoSeries[] = [
  { courseKey: "mathe", weekday: 1, periods: [1] },
  { courseKey: "deutsch", weekday: 1, periods: [2] },
  { courseKey: "biologie", weekday: 1, periods: [3, 4] },
  { courseKey: "englisch", weekday: 2, periods: [1] },
  { courseKey: "physik", weekday: 2, periods: [2] },
  { courseKey: "mathe", weekday: 2, periods: [4] },
  { courseKey: "geschichte", weekday: 3, periods: [1] },
  { courseKey: "deutsch", weekday: 3, periods: [2] },
  { courseKey: "englisch", weekday: 3, periods: [3] },
  { courseKey: "mathe", weekday: 4, periods: [1] },
  { courseKey: "biologie", weekday: 4, periods: [2] },
  { courseKey: "physik", weekday: 4, periods: [3] },
  { courseKey: "deutsch", weekday: 5, periods: [1] },
  { courseKey: "geschichte", weekday: 5, periods: [2] },
  { courseKey: "englisch", weekday: 5, periods: [3] },
];

export interface DemoBundle {
  school: School;
  academicYear: AcademicYear;
  schoolClass: SchoolClass;
  courses: Course[];
  series: ScheduleSeries[];
  courseIds: Map<string, string>;
}

export function buildDemoSeed(today: LocalDate, now: Timestamp): DemoBundle {
  const effectiveFrom = startOfWeek(today);

  const school: School = {
    id: DEMO_SCHOOL_ID,
    name: "Beispielschule",
    timezone: "Europe/Vienna",
    locale: "de-AT",
  };

  const academicYear: AcademicYear = {
    id: DEMO_YEAR_ID,
    schoolId: DEMO_SCHOOL_ID,
    name: "Beispieljahr",
    startsOn: effectiveFrom,
    endsOn: null,
  };

  const schoolClass: SchoolClass = {
    id: DEMO_CLASS_ID,
    schoolId: DEMO_SCHOOL_ID,
    academicYearId: DEMO_YEAR_ID,
    name: "Beispielklasse",
  };

  const courseIds = new Map<string, string>();
  const courses: Course[] = DEMO_COURSES.map((course, index) => {
    const courseId = id("dc00", index + 1);
    courseIds.set(course.key, courseId);
    return {
      id: courseId,
      schoolId: DEMO_SCHOOL_ID,
      academicYearId: DEMO_YEAR_ID,
      classId: DEMO_CLASS_ID,
      displayName: course.name,
      sourceLabel: null,
      shortLabel: course.short,
      accent: course.accent,
      elective: false,
      unresolved: null,
      createdAt: now,
    };
  });

  const series: ScheduleSeries[] = DEMO_SERIES.map((entry, index) => {
    const courseId = courseIds.get(entry.courseKey);
    const grid = spanOfPeriods(entry.periods);
    if (!courseId || !grid) {
      throw new Error(`Unbekannter Demokurs: ${entry.courseKey}`);
    }
    return {
      id: id("ds00", index + 1),
      courseId,
      weekday: entry.weekday,
      periodIndexes: [...entry.periods],
      startsAt: grid.startsAt,
      endsAt: grid.endsAt,
      effectiveFrom,
      endsOn: null,
      intervalWeeks: 1,
      active: true,
      createdAt: now,
    };
  });

  return { school, academicYear, schoolClass, courses, series, courseIds };
}

/**
 * Erfundene Einträge für die Demo.
 *
 * Sie zeigen den Ablauf: was behandelt wurde, eine Hausübung zur nächsten
 * Stunde, etwas zum Mitbringen und eine private Notiz.
 */
export interface DemoEntrySeed {
  courseKey: string;
  kind: Entry["kind"];
  audience: Entry["audience"];
  text: string;
  detail?: string;
  /** Relativ zum ersten passenden Termin: 0 = die erste, 1 = die zweite. */
  meetingOffset: number;
  dueNextMeeting?: boolean;
}

export const DEMO_ENTRIES: readonly DemoEntrySeed[] = [
  {
    courseKey: "mathe",
    kind: "behandelt",
    audience: "kurs",
    text: "Ableitungsregeln wiederholt, Produktregel neu",
    meetingOffset: 0,
  },
  {
    courseKey: "mathe",
    kind: "hausuebung",
    audience: "kurs",
    text: "S. 84 Nr. 4–8",
    meetingOffset: 0,
    dueNextMeeting: true,
  },
  {
    courseKey: "biologie",
    kind: "mitbringen",
    audience: "kurs",
    text: "Geodreieck und Millimeterpapier",
    meetingOffset: 0,
    dueNextMeeting: true,
  },
  {
    courseKey: "deutsch",
    kind: "behandelt",
    audience: "kurs",
    text: "Erörterung: Aufbau und Gegenargumente",
    meetingOffset: 0,
  },
  {
    courseKey: "deutsch",
    kind: "notiz",
    audience: "privat",
    text: "Beim Schluss nachfragen – war mir nicht klar",
    meetingOffset: 0,
  },
  {
    courseKey: "englisch",
    kind: "behandelt",
    audience: "kurs",
    text: "Reported speech, Übungen 1 bis 3",
    meetingOffset: 0,
  },
];

export function demoVersion(
  entryId: string,
  versionId: string,
  text: string,
  detail: string | null,
  now: Timestamp,
): EntryVersion {
  return {
    id: versionId,
    entryId,
    revision: 1,
    text,
    detail,
    authorId: DEMO_USER_ID,
    createdAt: now,
    changeNote: null,
  };
}
