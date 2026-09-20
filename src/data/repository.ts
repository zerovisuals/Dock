/**
 * Die Grenze zur Speicherung.
 *
 * Darueber liegt die Fachlogik, darunter entweder IndexedDB ("Auf diesem
 * Gerät") oder eine gehostete Datenbank. Die Fachlogik kennt den Unterschied
 * nicht.
 *
 * Schreibvorgaenge laufen über die Kennung und sind damit wiederholbar: ein
 * erneut gesendeter Schreibvorgang erzeugt keinen zweiten Datensatz.
 */

import type {
  AcademicYear,
  AppSettings,
  Assessment,
  Confirmation,
  CorrectionProposal,
  Course,
  CorrectionState,
  DocumentLink,
  Draft,
  DueResolution,
  Entry,
  EntryVersion,
  Invite,
  LessonInstance,
  Membership,
  MissedInterval,
  ScheduleException,
  ScheduleRevision,
  ScheduleSeries,
  School,
  SchoolClass,
  StoredDocument,
  UserProfile,
  UserTaskState,
} from "@/domain/types";

export interface Collections {
  schools: School;
  academicYears: AcademicYear;
  classes: SchoolClass;
  courses: Course;
  memberships: Membership;
  series: ScheduleSeries;
  revisions: ScheduleRevision;
  lessons: LessonInstance;
  exceptions: ScheduleException;
  entries: Entry;
  entryVersions: EntryVersion;
  resolutions: DueResolution;
  taskStates: UserTaskState;
  assessments: Assessment;
  documents: StoredDocument;
  documentLinks: DocumentLink;
  confirmations: Confirmation;
  corrections: CorrectionProposal;
  invites: Invite;
  missedIntervals: MissedInterval;
  profiles: UserProfile;
  drafts: Draft;
  settings: AppSettings;
}

export type CollectionName = keyof Collections;

export const COLLECTION_NAMES: readonly CollectionName[] = [
  "schools",
  "academicYears",
  "classes",
  "courses",
  "memberships",
  "series",
  "revisions",
  "lessons",
  "exceptions",
  "entries",
  "entryVersions",
  "resolutions",
  "taskStates",
  "assessments",
  "documents",
  "documentLinks",
  "confirmations",
  "corrections",
  "invites",
  "missedIntervals",
  "profiles",
  "drafts",
  "settings",
] as const;

/** Wo die Daten tatsächlich liegen. */
export type StorageMode = "lokal" | "geteilt";

export interface Repository {
  readonly mode: StorageMode;

  list<K extends CollectionName>(name: K): Promise<Collections[K][]>;
  get<K extends CollectionName>(
    name: K,
    id: string,
  ): Promise<Collections[K] | undefined>;
  put<K extends CollectionName>(name: K, value: Collections[K]): Promise<void>;
  putMany<K extends CollectionName>(
    name: K,
    values: readonly Collections[K][],
  ): Promise<void>;
  remove(name: CollectionName, id: string): Promise<void>;

  /** Dateiinhalte. Getrennt von den Metadaten gespeichert. */
  putBlob(id: string, blob: Blob): Promise<void>;
  getBlob(id: string): Promise<Blob | undefined>;
  removeBlob(id: string): Promise<void>;

  /** Loescht saemtliche Daten, einschließlich der Dateien. */
  clear(): Promise<void>;
}

/* -------------------------------------------------------------------------
   Dateien
   ------------------------------------------------------------------------- */

export const ALLOWED_MIME_TYPES: readonly string[] = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
];

/**
 * Ausfuehrbare Inhalte und Dateien mit Makros werden abgelehnt. Dateiinhalte
 * werden nie ausgeführt und nie ausgewertet.
 */
const BLOCKED_EXTENSIONS = [
  ".exe", ".msi", ".bat", ".cmd", ".com", ".scr", ".ps1", ".sh", ".app",
  ".jar", ".js", ".mjs", ".vbs", ".docm", ".xlsm", ".pptm", ".dotm", ".xlam",
  ".html", ".htm", ".svg",
];

export function defaultMaxUploadBytes(): number {
  const configured = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB);
  const megabytes = Number.isFinite(configured) && configured > 0
    ? configured
    : 10;
  return Math.round(megabytes * 1024 * 1024);
}

export interface FileRejection {
  ok: false;
  reason: string;
}
export interface FileAccepted {
  ok: true;
}

export function validateUpload(
  file: { name: string; type: string; size: number },
  maxBytes: number = defaultMaxUploadBytes(),
): FileAccepted | FileRejection {
  const lower = file.name.toLowerCase();

  if (BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return {
      ok: false,
      reason: "Dieser Dateityp ist nicht erlaubt.",
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      ok: false,
      reason: "Erlaubt sind PDF, DOCX, JPG, PNG und WebP.",
    };
  }

  if (file.size > maxBytes) {
    const limit = Math.round(maxBytes / (1024 * 1024));
    return {
      ok: false,
      reason: `Die Datei ist größer als ${limit} MB.`,
    };
  }

  if (file.size === 0) {
    return { ok: false, reason: "Die Datei ist leer." };
  }

  return { ok: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export type { CorrectionState };
