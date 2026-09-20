/**
 * Fachliche Typen für Dock.
 *
 * Grundsaetze, die auch kuenftige Importquellen überstehen müssen:
 *
 *  - Jede Einheit hat eine interne, dauerhafte Kennung (UUID). Datum und
 *    Uhrzeit sind veränderliche Eigenschaften, niemals die Identitaet.
 *  - Jede einzelne Stunde ist eine eigene Einheit, auch innerhalb einer
 *    Doppelstunde.
 *  - Zielgruppe ("wer darf das sehen") und Herkunft ("wer behauptet das")
 *    werden getrennt geführt.
 *  - Räume kommen bewusst nicht vor. Entscheidung des Auftraggebers.
 */

import type { LocalDate, LocalTime, Weekday } from "./time";

export type Uuid = string;

/** Zeitpunkt als ISO-8601-Zeichenkette in UTC. */
export type Timestamp = string;

/* -------------------------------------------------------------------------
   Schule, Jahrgang, Klasse
   ------------------------------------------------------------------------- */

export interface School {
  id: Uuid;
  name: string;
  timezone: string;
  locale: string;
}

export interface AcademicYear {
  id: Uuid;
  schoolId: Uuid;
  name: string;
  startsOn: LocalDate;
  /** Offen, solange kein Ende gesetzt ist. */
  endsOn: LocalDate | null;
}

export interface SchoolClass {
  id: Uuid;
  schoolId: Uuid;
  academicYearId: Uuid;
  name: string;
}

/* -------------------------------------------------------------------------
   Kurse und Zugehörigkeit
   ------------------------------------------------------------------------- */

/**
 * Ein Kurs ist eine tatsächliche Unterrichtsgruppe, nicht die Kombination
 * aus Klasse und Fach. Regulaere Mathematik und das Wahlpflichtfach
 * Mathematik sind zwei verschiedene Kurse, auch wenn die Bezeichnungen
 * einander ähneln. Eine Gruppe kann Schuelerinnen und Schüler aus mehreren
 * Klassen umfassen.
 */
export interface Course {
  id: Uuid;
  schoolId: Uuid;
  academicYearId: Uuid;
  /** Fuehrende Klasse. Weitere Klassen können über Zugehörigkeiten kommen. */
  classId: Uuid | null;
  /** Anzeigename, vom Benutzer änderbar. */
  displayName: string;
  /** Die ursprüngliche Bezeichnung der Quelle, unverändert aufbewahrt. */
  sourceLabel: string | null;
  /** Kurzform für enge Spalten, etwa "M" oder "SPA". */
  shortLabel: string;
  /** Feste, zurückhaltende Akzentfarbe des Fachs als Hex-Wert. */
  accent: string;
  /** Ist es ein Wahlpflicht- oder Wahlfach? Nur zur Kennzeichnung. */
  elective: boolean;
  /** Offene Punkte, die der Benutzer später ergaenzen kann. */
  unresolved: string | null;
  createdAt: Timestamp;
}

export interface Membership {
  id: Uuid;
  courseId: Uuid;
  userId: Uuid;
  role: "mitglied" | "moderation";
  effectiveFrom: LocalDate;
  effectiveTo: LocalDate | null;
}

/* -------------------------------------------------------------------------
   Stundenplan
   ------------------------------------------------------------------------- */

/** Eine Unterrichtseinheit des Rasters. */
export interface Period {
  index: number;
  startsAt: LocalTime;
  endsAt: LocalTime;
}

/**
 * Eine wöchentlich wiederkehrende Vorlage.
 *
 * `endsOn === null` bedeutet: ohne Ende. Das ist der Normalfall und wird
 * nicht abgefragt. Es gibt keine Begrenzung der Anzahl der Termine.
 */
export interface ScheduleSeries {
  id: Uuid;
  courseId: Uuid;
  weekday: Weekday;
  /** Die belegten Rasterstunden, aufsteigend. Bleibt auch dann erhalten,
   *  wenn abweichende Zeiten gesetzt sind. */
  periodIndexes: number[];
  /** Tatsaechliche Beginnzeit. Kann vom Raster abweichen, wenn der Benutzer
   *  sie bestätigt hat – etwa Sport von 08:00 bis 10:00. */
  startsAt: LocalTime;
  endsAt: LocalTime;
  /** Technischer Ankerpunkt der Speicherung, keine Aussage darueber, seit
   *  wann es den Unterricht gibt. */
  effectiveFrom: LocalDate;
  endsOn: LocalDate | null;
  /** Immer 1: jede Woche. Vorbereitet für spätere Quellen. */
  intervalWeeks: number;
  active: boolean;
  createdAt: Timestamp;
}

/** Änderung einer Serie ab einem Stichtag. Die Historie bleibt erhalten. */
export interface ScheduleRevision {
  id: Uuid;
  seriesId: Uuid;
  effectiveFrom: LocalDate;
  changes: Partial<
    Pick<ScheduleSeries, "weekday" | "periodIndexes" | "startsAt" | "endsAt">
  >;
  note: string | null;
  createdAt: Timestamp;
}

export type LessonStatus =
  | "geplant"
  | "entfallen"
  | "verschoben"
  | "zusatztermin";

/**
 * Eine einzelne, konkrete Stunde.
 *
 * Die Kennung ist dauerhaft. Verschieben, Entfall oder eine Änderung der
 * Uhrzeit ändern Eigenschaften, niemals die Identitaet – damit bleiben
 * Notizen, Dateien und Aufgabenbezuege erhalten.
 */
export interface LessonInstance {
  id: Uuid;
  courseId: Uuid;
  /** Die Serie, aus der die Stunde entstanden ist. `null` bei Einzelterminen. */
  seriesId: Uuid | null;
  /**
   * Eindeutiger Schlüssel aus Serie, urspruenglichem Datum und Rasterstunde.
   * Er macht das Erzeugen wiederholbar: derselbe Schlüssel wird nie ein
   * zweites Mal angelegt.
   */
  occurrenceKey: string;
  /** Das Datum, an dem die Stunde ursprünglich erzeugt wurde. */
  originalDate: LocalDate;
  date: LocalDate;
  startsAt: LocalTime;
  endsAt: LocalTime;
  /** Die Rasterstunde. Bleibt auch in einer Doppelstunde eigenständig. */
  periodIndex: number;
  /**
   * Gruppiert zusammenhängende Stunden zu einem Block. Die einzelnen
   * Stunden behalten ihre Identitaet; der Block dient nur der Darstellung
   * und der Zuordnung gemeinsamer Inhalte.
   */
  blockKey: string;
  status: LessonStatus;
  /** Grund für Entfall oder Verschiebung, vom Benutzer erfasst. */
  statusNote: string | null;
  /** Herkunft der Stunde. Derzeit immer der manuelle Stundenplan. */
  source: "manuell";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Ein schulfreier Tag oder ein Zeitraum ohne Unterricht. */
export interface ScheduleException {
  id: Uuid;
  schoolId: Uuid;
  from: LocalDate;
  to: LocalDate;
  label: string;
  createdAt: Timestamp;
}

/* -------------------------------------------------------------------------
   Inhalte
   ------------------------------------------------------------------------- */

export type EntryKind =
  | "hausuebung"
  | "behandelt"
  | "mitbringen"
  | "pruefung"
  | "notiz"
  | "datei";

/** Wer den Eintrag sehen darf. */
export type Audience = "privat" | "kurs";

/** Woher die Aussage stammt. Bestätigung durch Mitschüler ist keine
 *  Freigabe durch die Schule. */
export type Origin = "selbst" | "klasse";

/**
 * Ein erfasster Inhalt an einer Stunde.
 *
 * Der Text lebt in Fassungen (`EntryVersion`). Wird ein bestätigter Eintrag
 * geändert, entsteht eine neue Fassung; bisherige Bestätigungen bleiben als
 * Historie bestehen, gelten aber nicht für die neue Fassung.
 */
export interface Entry {
  id: Uuid;
  kind: EntryKind;
  courseId: Uuid;
  /** Die Stunde, in der es angekündigt wurde. Dieser Anker ist fest. */
  announcedInLessonId: Uuid | null;
  /** Der Block, falls der Inhalt für eine ganze Doppelstunde gilt. */
  announcedInBlockKey: string | null;
  audience: Audience;
  origin: Origin;
  authorId: Uuid;
  /** Kennung der aktuell gültigen Fassung. */
  currentVersionId: Uuid;
  /** Fälligkeit. Nur bei Hausübungen und Mitbringen belegt. */
  dueRule: DueRule | null;
  deletedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EntryVersion {
  id: Uuid;
  entryId: Uuid;
  /** Fortlaufend ab 1. */
  revision: number;
  /** Der Wortlaut, unverändert so gespeichert, wie er erfasst wurde. */
  text: string;
  /** Zusatzangaben je nach Art, etwa Umfang einer Prüfung. */
  detail: string | null;
  authorId: Uuid;
  createdAt: Timestamp;
  /** Kurze Begruendung bei einer Korrektur. */
  changeNote: string | null;
}

/* -------------------------------------------------------------------------
   Fälligkeiten
   ------------------------------------------------------------------------- */

export type DueRuleKind =
  | "NEXT_SUBJECT_LESSON"
  | "SPECIFIC_LESSON"
  | "FIXED_DATE"
  | "FIXED_DATETIME"
  | "NONE";

/**
 * Die Regel, nach der sich die Fälligkeit bestimmt. Sie wird zusammen mit
 * ihrem aufgeloesten Ziel gespeichert.
 *
 * Wichtig: "nächste Stunde" wird relativ zum festen Ankerpunkt der
 * Ankündigung aufgelöst, niemals relativ zum heutigen Tag. Sonst würde
 * eine unerledigte Aufgabe endlos weiterwandern.
 */
export type DueRule =
  | { kind: "NEXT_SUBJECT_LESSON"; anchorLessonId: Uuid }
  | { kind: "SPECIFIC_LESSON"; lessonId: Uuid }
  | { kind: "FIXED_DATE"; date: LocalDate }
  | { kind: "FIXED_DATETIME"; date: LocalDate; time: LocalTime }
  | { kind: "NONE" };

export type DueResolutionState =
  /** Ein Ziel steht fest. */
  | "aufgeloest"
  /** Es gibt noch keinen passenden Termin im bekannten Bereich. */
  | "offen"
  /** Das gewählte Ziel ist entfallen und braucht eine Entscheidung. */
  | "pruefen"
  /** Keine Fälligkeit. */
  | "ohne";

/**
 * Das Ergebnis der Auflösung. Wird gespeichert, damit nachvollziehbar
 * bleibt, wann und worauf eine Aufgabe fällig wurde.
 */
export interface DueResolution {
  id: Uuid;
  entryId: Uuid;
  state: DueResolutionState;
  /** Die Zielstunde, falls aufgelöst. */
  targetLessonId: Uuid | null;
  targetDate: LocalDate | null;
  targetTime: LocalTime | null;
  /** Die zuvor gültige Auflösung, für die Nachvollziehbarkeit. */
  previousTargetLessonId: Uuid | null;
  previousTargetDate: LocalDate | null;
  /** Warum sich die Auflösung geändert hat, in Klartext. */
  reason: string | null;
  resolvedAt: Timestamp;
}

/**
 * Der persoenliche Bearbeitungsstand. Er ist von der geteilten Aufgabe
 * getrennt: der Stand einer Person sagt nichts über den Stand einer anderen.
 */
export interface UserTaskState {
  id: Uuid;
  entryId: Uuid;
  userId: Uuid;
  done: boolean;
  doneAt: Timestamp | null;
  /** Die Fassung, die beim Abhaken gegolten hat. Aendert sich der Text
   *  später, lässt sich so anzeigen, dass der Umfang gewachsen ist. */
  doneForVersionId: Uuid | null;
  updatedAt: Timestamp;
}

/* -------------------------------------------------------------------------
   Prüfungen
   ------------------------------------------------------------------------- */

export type AssessmentKind =
  | "schularbeit"
  | "test"
  | "wiederholung"
  | "referat"
  | "mitarbeit"
  | "sonstiges";

export interface Assessment {
  id: Uuid;
  courseId: Uuid;
  entryId: Uuid | null;
  title: string;
  kind: AssessmentKind;
  /** Entweder ein fester Termin oder eine Zielstunde. */
  date: LocalDate | null;
  time: LocalTime | null;
  lessonId: Uuid | null;
  /** Der Stoff, in den Worten der erfassenden Person. */
  scope: string;
  audience: Audience;
  origin: Origin;
  authorId: Uuid;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/* -------------------------------------------------------------------------
   Dateien
   ------------------------------------------------------------------------- */

export interface StoredDocument {
  id: Uuid;
  name: string;
  mimeType: string;
  sizeBytes: number;
  audience: Audience;
  courseId: Uuid | null;
  ownerId: Uuid;
  createdAt: Timestamp;
}

/**
 * Eine Datei kann zu mehreren Stunden oder zu einer Prüfung gehören. Eine
 * Unterlage auf Kursebene braucht keine willkuerlich gewählte Stunde.
 */
export interface DocumentLink {
  id: Uuid;
  documentId: Uuid;
  lessonId: Uuid | null;
  entryId: Uuid | null;
  assessmentId: Uuid | null;
  courseId: Uuid | null;
  createdAt: Timestamp;
}

/* -------------------------------------------------------------------------
   Geteiltes Klassengedächtnis
   ------------------------------------------------------------------------- */

/** Eine Bestätigung gilt für genau eine Fassung. */
export interface Confirmation {
  id: Uuid;
  entryId: Uuid;
  versionId: Uuid;
  userId: Uuid;
  createdAt: Timestamp;
}

export type CorrectionState = "offen" | "uebernommen" | "abgelehnt";

export interface CorrectionProposal {
  id: Uuid;
  entryId: Uuid;
  /** Die Fassung, auf die sich der Vorschlag bezieht. */
  versionId: Uuid;
  proposedText: string;
  rationale: string | null;
  authorId: Uuid;
  state: CorrectionState;
  createdAt: Timestamp;
  resolvedAt: Timestamp | null;
}

export interface Invite {
  id: Uuid;
  classId: Uuid;
  code: string;
  createdBy: Uuid;
  expiresAt: Timestamp;
  revokedAt: Timestamp | null;
  /** Begrenzte Anzahl Einloesungen. */
  maxUses: number;
  uses: number;
  /** Erfordert eine Freigabe durch die Moderation. */
  requiresApproval: boolean;
  createdAt: Timestamp;
}

/* -------------------------------------------------------------------------
   Nachholen
   ------------------------------------------------------------------------- */

/**
 * Ein privat gewaehlter Zeitraum, in dem der Benutzer gefehlt hat. Ein Grund
 * wird nicht erfasst und nicht erfragt. Abwesenheit wird nie aus
 * Inaktivitaet, Standort oder Sensoren abgeleitet.
 */
export interface MissedInterval {
  id: Uuid;
  userId: Uuid;
  from: LocalDate;
  to: LocalDate;
  createdAt: Timestamp;
}

/* -------------------------------------------------------------------------
   Sonstiges
   ------------------------------------------------------------------------- */

export interface UserProfile {
  id: Uuid;
  /** Anzeigename. Standardmaessig leer – es wird kein Profil erfunden. */
  displayName: string;
  classId: Uuid | null;
}

/** Ein nicht abgeschickter Text, lokal gesichert. */
export interface Draft {
  id: string;
  text: string;
  updatedAt: Timestamp;
}

export interface AppSettings {
  id: "settings";
  timezone: string;
  /** Vorschau-Uhr für Gestaltung und Prüfung. Im Normalbetrieb aus. */
  previewClock: { enabled: boolean; at: Timestamp | null };
  seededAt: Timestamp | null;
  /** Bis zu welchem Datum Stunden bereits erzeugt wurden. Reine
   *  Beschleunigung, keine Aussage über das Ende des Stundenplans. */
  materializedUntil: LocalDate | null;
}
