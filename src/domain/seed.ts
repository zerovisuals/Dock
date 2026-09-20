/**
 * Der bestätigte Stundenplan der Klasse 7c.
 *
 * Quelle: "Stundenplan – Klasse: 7c, 12. Oktober – 16. Oktober 2026".
 * Die Daten des Quelldokuments sind reine Herkunftsangabe und *kein*
 * Anfang oder Ende des Stundenplans.
 *
 * Der Plan wiederholt sich jede Woche ohne Ende. Es gibt keine Abfrage zur
 * Wiederholung, kein Pflichtformular für einen Zeitraum und keinen Ablauf
 * am Schuljahresende.
 *
 * Beruecksichtigte Festlegungen des Auftraggebers:
 *  - Spanisch statt Latein.
 *  - Kein Religionsunterricht und keine Ethik.
 *  - Mathematik Wahlpflichtfach als eigener Kurs neben regulärer Mathematik.
 *  - KUG am Dienstag von 13:40 bis 15:20.
 *  - Sport am Montag von 08:00 bis 10:00.
 *  - Nicht gewählte Wahlfaecher bleiben aussen vor.
 *
 * Räume kommen nicht vor. Lehrpersonen kommen nicht vor.
 */

import { startOfWeek, type LocalDate, type Weekday } from "./time";
import { spanOfPeriods } from "./periods";
import type {
  AcademicYear,
  Course,
  School,
  ScheduleSeries,
  SchoolClass,
  Timestamp,
} from "./types";

/* Feste Kennungen. Dadurch bleibt erneutes Anlegen wirkungsfrei und
   bestehende Inhalte behalten ihre Bezuege. */
export const SCHOOL_ID = "11111111-0000-4000-8000-000000000001";
export const YEAR_ID = "11111111-0000-4000-8000-000000000002";
export const CLASS_ID = "11111111-0000-4000-8000-000000000003";
export const LOCAL_USER_ID = "11111111-0000-4000-8000-00000000000a";

export const SOURCE_WEEK_START: LocalDate = "2026-10-12";
export const SOURCE_WEEK_END: LocalDate = "2026-10-16";
export const SOURCE_DOCUMENT_TITLE =
  "Stundenplan – Klasse: 7c, 12. Oktober – 16. Oktober 2026";

function courseId(n: number): string {
  return `22222222-0000-4000-8000-${String(n).padStart(12, "0")}`;
}
function seriesId(n: number): string {
  return `33333333-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

/**
 * Ruhige, gut unterscheidbare Akzente je Fach.
 *
 * Die stark gesaettigten Streifen des Quelldokuments sind ein Hinweis auf die
 * Datenherkunft, keine gestalterische Vorgabe – sie werden bewusst nicht
 * übernommen.
 */
interface CourseSeed {
  key: string;
  displayName: string;
  sourceLabel: string | null;
  shortLabel: string;
  accent: string;
  elective: boolean;
  unresolved: string | null;
}

const COURSE_SEEDS: readonly CourseSeed[] = [
  {
    key: "sport",
    displayName: "Bewegung und Sport",
    sourceLabel: "Be…",
    shortLabel: "BSP",
    accent: "#4ED4A8",
    elective: false,
    unresolved:
      "Die vollständige Bezeichnung ist im Quelldokument abgeschnitten.",
  },
  {
    key: "physik",
    displayName: "Physik",
    sourceLabel: "PHYSIK MIT S…",
    shortLabel: "PH",
    accent: "#5B9DFF",
    elective: false,
    unresolved: null,
  },
  {
    key: "labor",
    displayName: "Labor",
    sourceLabel: "Labor 7. Klass…",
    shortLabel: "LAB",
    accent: "#9AA8D4",
    elective: false,
    unresolved:
      "Die vollständige Bezeichnung und die Gruppenzuordnung sind im Quelldokument abgeschnitten.",
  },
  {
    key: "spanisch",
    displayName: "Spanisch",
    sourceLabel: "SPA…",
    shortLabel: "SPA",
    accent: "#FFA86B",
    elective: false,
    unresolved: null,
  },
  {
    key: "geschichte",
    displayName: "Geschichte",
    sourceLabel: "Geschichte un…",
    shortLabel: "GSK",
    accent: "#E39ACF",
    elective: false,
    unresolved: null,
  },
  {
    key: "englisch",
    displayName: "Englisch",
    sourceLabel: "Englisch (E)",
    shortLabel: "E",
    accent: "#FF8FA8",
    elective: false,
    unresolved: null,
  },
  {
    key: "deutsch",
    displayName: "Deutsch",
    sourceLabel: "DEUTSCH (D)",
    shortLabel: "D",
    accent: "#E8C765",
    elective: false,
    unresolved: null,
  },
  {
    key: "mathematik",
    displayName: "Mathematik",
    sourceLabel: "MATHEMATIK…",
    shortLabel: "M",
    accent: "#3BE0D4",
    elective: false,
    unresolved: null,
  },
  {
    key: "kug",
    displayName: "KUG",
    sourceLabel: "K…",
    shortLabel: "KUG",
    accent: "#A98BFF",
    elective: false,
    unresolved:
      "Die vollständige Kursbezeichnung ist nicht bestätigt. Die Zeit von 13:40 bis 15:20 ist bestätigt.",
  },
  {
    key: "chemie",
    displayName: "Chemie",
    sourceLabel: "CHEMIE (CH)",
    shortLabel: "CH",
    accent: "#A6BBC7",
    elective: false,
    unresolved: null,
  },
  {
    key: "psychologie",
    displayName: "Psychologie",
    sourceLabel: "Psychologie u…",
    shortLabel: "PP",
    accent: "#86D68A",
    elective: false,
    unresolved: null,
  },
  {
    key: "geographie",
    displayName: "Geographie",
    sourceLabel: "Geographie u…",
    shortLabel: "GW",
    accent: "#D9A86A",
    elective: false,
    unresolved: null,
  },
  {
    key: "mathematik-wpf",
    displayName: "Mathematik (Wahlpflichtfach)",
    sourceLabel: "Mathematik …",
    shortLabel: "M-WPF",
    accent: "#7FB2FF",
    elective: true,
    unresolved: null,
  },
  {
    key: "biologie",
    displayName: "Biologie",
    sourceLabel: "Biologie und …",
    shortLabel: "BIU",
    accent: "#8FD98A",
    elective: false,
    unresolved: null,
  },
];

/**
 * Die wöchentlichen Termine.
 *
 * `startsAt`/`endsAt` bleiben leer, wenn das Raster gilt. Nur die beiden
 * ausdruecklich bestätigten Termine setzen eigene Zeiten.
 */
interface SeriesSeed {
  courseKey: string;
  weekday: Weekday;
  periods: number[];
  /** Nur gesetzt, wenn der Auftraggeber die Zeit ausdruecklich bestätigt hat. */
  confirmedStart?: string;
  confirmedEnd?: string;
}

const SERIES_SEEDS: readonly SeriesSeed[] = [
  // Montag
  {
    courseKey: "sport",
    weekday: 1,
    periods: [1, 2],
    // Bestaetigt: bis 10:00, nicht bis 09:45. Physik beginnt um 10:00;
    // durch endexklusive Intervalle entsteht kein Konflikt.
    confirmedStart: "08:00",
    confirmedEnd: "10:00",
  },
  { courseKey: "physik", weekday: 1, periods: [3] },
  { courseKey: "labor", weekday: 1, periods: [5, 6] },

  // Dienstag
  { courseKey: "spanisch", weekday: 2, periods: [1] },
  { courseKey: "geschichte", weekday: 2, periods: [2] },
  { courseKey: "englisch", weekday: 2, periods: [3] },
  { courseKey: "deutsch", weekday: 2, periods: [4] },
  { courseKey: "mathematik", weekday: 2, periods: [5] },
  {
    courseKey: "kug",
    weekday: 2,
    periods: [7, 8],
    // Bestaetigt.
    confirmedStart: "13:40",
    confirmedEnd: "15:20",
  },

  // Mittwoch
  { courseKey: "chemie", weekday: 3, periods: [1] },
  { courseKey: "mathematik", weekday: 3, periods: [2] },
  { courseKey: "physik", weekday: 3, periods: [3] },
  { courseKey: "psychologie", weekday: 3, periods: [4] },
  { courseKey: "deutsch", weekday: 3, periods: [5] },
  { courseKey: "geographie", weekday: 3, periods: [6] },
  { courseKey: "mathematik-wpf", weekday: 3, periods: [8, 9] },

  // Donnerstag
  { courseKey: "spanisch", weekday: 4, periods: [1] },
  { courseKey: "mathematik", weekday: 4, periods: [2] },
  { courseKey: "chemie", weekday: 4, periods: [3] },
  { courseKey: "englisch", weekday: 4, periods: [4] },
  { courseKey: "biologie", weekday: 4, periods: [5] },

  // Freitag
  { courseKey: "geographie", weekday: 5, periods: [1] },
  { courseKey: "deutsch", weekday: 5, periods: [2] },
  { courseKey: "spanisch", weekday: 5, periods: [3] },
  { courseKey: "biologie", weekday: 5, periods: [4] },
  { courseKey: "englisch", weekday: 5, periods: [5] },
  { courseKey: "psychologie", weekday: 5, periods: [6] },
];

export interface SeedBundle {
  school: School;
  academicYear: AcademicYear;
  schoolClass: SchoolClass;
  courses: Course[];
  series: ScheduleSeries[];
  /** Der technische Ankerpunkt der Speicherung. */
  effectiveFrom: LocalDate;
}

/**
 * Baut den Stundenplan auf.
 *
 * `today` bestimmt nur den technischen Ankerpunkt: den Montag der aktuellen
 * örtlichen Woche. Das ist keine Aussage darueber, seit wann es den
 * Unterricht gibt. Der Plan ist ab diesem Montag aktiv und läuft ohne Ende
 * weiter.
 */
export function buildSeed(today: LocalDate, now: Timestamp): SeedBundle {
  const effectiveFrom = startOfWeek(today);

  const school: School = {
    id: SCHOOL_ID,
    name: "BG/BRG Tulln",
    timezone: "Europe/Vienna",
    locale: "de-AT",
  };

  const academicYear: AcademicYear = {
    id: YEAR_ID,
    schoolId: SCHOOL_ID,
    name: "2026/27",
    startsOn: effectiveFrom,
    // Ohne Ende. Der Stundenplan läuft nicht zum Schuljahresende ab.
    endsOn: null,
  };

  const schoolClass: SchoolClass = {
    id: CLASS_ID,
    schoolId: SCHOOL_ID,
    academicYearId: YEAR_ID,
    name: "7c",
  };

  const courseIds = new Map<string, string>();
  const courses: Course[] = COURSE_SEEDS.map((seed, index) => {
    const id = courseId(index + 1);
    courseIds.set(seed.key, id);
    return {
      id,
      schoolId: SCHOOL_ID,
      academicYearId: YEAR_ID,
      classId: CLASS_ID,
      displayName: seed.displayName,
      sourceLabel: seed.sourceLabel,
      shortLabel: seed.shortLabel,
      accent: seed.accent,
      elective: seed.elective,
      unresolved: seed.unresolved,
      createdAt: now,
    };
  });

  const series: ScheduleSeries[] = SERIES_SEEDS.map((seed, index) => {
    const course = courseIds.get(seed.courseKey);
    if (!course) {
      throw new Error(`Unbekannter Kurs im Stundenplan: ${seed.courseKey}`);
    }
    const grid = spanOfPeriods(seed.periods);
    if (!grid) {
      throw new Error(`Unbekannte Rasterstunden: ${seed.periods.join(", ")}`);
    }
    return {
      id: seriesId(index + 1),
      courseId: course,
      weekday: seed.weekday,
      periodIndexes: [...seed.periods],
      startsAt: seed.confirmedStart ?? grid.startsAt,
      endsAt: seed.confirmedEnd ?? grid.endsAt,
      effectiveFrom,
      // Ohne Ende – ausdrueckliche Festlegung des Auftraggebers.
      endsOn: null,
      intervalWeeks: 1,
      active: true,
      createdAt: now,
    };
  });

  return { school, academicYear, schoolClass, courses, series, effectiveFrom };
}

/**
 * Angebote der Klasse, die *nicht* gewählt wurden.
 *
 * Sie gehören in einen Vorlagen-Editor, nicht als gleichzeitige Pflichtstunden
 * in den Tagesplan. Sie werden hier nur vorgehalten, damit der Benutzer die
 * Auswahl später nachvollziehen und ändern kann.
 */
export interface UnselectedOffering {
  weekday: Weekday;
  periods: number[];
  sourceLabel: string;
  note: string;
}

export const UNSELECTED_OFFERINGS: readonly UnselectedOffering[] = [
  {
    weekday: 1,
    periods: [4],
    sourceLabel: "RELIGION KA…",
    note: "Kein Religionsunterricht gewählt.",
  },
  {
    weekday: 1,
    periods: [8, 9],
    sourceLabel: "Phy… oder GE…",
    note: "Nachmittagsangebot, nicht gewählt.",
  },
  {
    weekday: 1,
    periods: [10, 11],
    sourceLabel: "BIOLOGIE WA…",
    note: "Wahlfach, nicht gewählt.",
  },
  {
    weekday: 2,
    periods: [1],
    sourceLabel: "LAT…",
    note: "Latein – Spanisch wurde gewählt.",
  },
  {
    weekday: 2,
    periods: [9, 10],
    sourceLabel: "PHI…",
    note: "Angebot, nicht gewählt.",
  },
  {
    weekday: 2,
    periods: [10, 11],
    sourceLabel: "Cer…",
    note: "Angebot, nicht gewählt.",
  },
  {
    weekday: 4,
    periods: [1],
    sourceLabel: "LAT…",
    note: "Latein – Spanisch wurde gewählt.",
  },
  {
    weekday: 4,
    periods: [6],
    sourceLabel: "REL… oder Ethi…",
    note: "Weder Religion noch Ethik gewählt.",
  },
  {
    weekday: 5,
    periods: [3],
    sourceLabel: "LAT…",
    note: "Latein – Spanisch wurde gewählt.",
  },
  {
    weekday: 5,
    periods: [7],
    sourceLabel: "RELIGION ISL…",
    note: "Kein Religionsunterricht gewählt.",
  },
];
