/**
 * Die Fachlogik über der Speicherung.
 *
 * Hier liegen alle Vorgaenge, die mehr tun als lesen und schreiben: das
 * erstmalige Anlegen, das Nacherzeugen von Stunden, das Erfassen von
 * Inhalten, das Auflösen von Fälligkeiten und das Ändern des Stundenplans.
 *
 * Alles hier ist ohne Oberfläche prüfbar.
 */

import {
  addDays,
  compareDates,
  localTimeOf,
  minDate,
  minutesOfDay,
  startOfWeek,
  todayLocal,
  weekDates,
  type LocalDate,
  type LocalTime,
  type Weekday,
} from "@/domain/time";
import {
  groupIntoBlocks,
  materialize,
  needsExtension,
  occurrenceKeyFor,
  windowFor,
  type LessonBlock,
} from "@/domain/recurrence";
import {
  buildResolution,
  isOverdue,
  resolveDue,
  type ResolvedDue,
} from "@/domain/dueRules";
import { spanOfPeriods } from "@/domain/periods";
import { buildSeed, LOCAL_USER_ID, SCHOOL_ID } from "@/domain/seed";
import type {
  Assessment,
  AssessmentKind,
  Audience,
  Confirmation,
  CorrectionProposal,
  Course,
  DocumentLink,
  Invite,
  DueResolution,
  DueRule,
  Entry,
  EntryKind,
  EntryVersion,
  LessonInstance,
  LessonStatus,
  MissedInterval,
  ScheduleException,
  ScheduleRevision,
  ScheduleSeries,
  StoredDocument,
  Timestamp,
  UserTaskState,
  Uuid,
} from "@/domain/types";
import type { Repository } from "./repository";

export function newId(): Uuid {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Rückfallebene für Umgebungen ohne Web-Crypto.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Ein Einladungscode aus gut unterscheidbaren Zeichen.
 *
 * Ohne 0/O und 1/I/L, damit niemand ihn falsch abtippt. Der Code allein
 * genügt nicht: er läuft ab und kann eine Freigabe erfordern.
 */
function inviteCode(): string {
  const zeichen = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    if (i === 4) code += "-";
    code += zeichen[Math.floor(Math.random() * zeichen.length)];
  }
  return code;
}

function nowStamp(): Timestamp {
  return new Date().toISOString();
}

/** Ein vollständig geladener Zustand, aus dem die Oberfläche liest. */
export interface DockSnapshot {
  courses: Course[];
  lessons: LessonInstance[];
  series: ScheduleSeries[];
  revisions: ScheduleRevision[];
  exceptions: ScheduleException[];
  entries: Entry[];
  versions: EntryVersion[];
  resolutions: DueResolution[];
  taskStates: UserTaskState[];
  assessments: Assessment[];
  documents: StoredDocument[];
  documentLinks: DocumentLink[];
  confirmations: Confirmation[];
  corrections: CorrectionProposal[];
  invites: Invite[];
  missedIntervals: MissedInterval[];
  materializedUntil: LocalDate | null;
  seeded: boolean;
}

const EMPTY_SNAPSHOT: DockSnapshot = {
  courses: [],
  lessons: [],
  series: [],
  revisions: [],
  exceptions: [],
  entries: [],
  versions: [],
  resolutions: [],
  taskStates: [],
  assessments: [],
  documents: [],
  documentLinks: [],
  confirmations: [],
  corrections: [],
  invites: [],
  missedIntervals: [],
  materializedUntil: null,
  seeded: false,
};

export class DockStore {
  constructor(
    private readonly repo: Repository,
    private readonly userId: Uuid = LOCAL_USER_ID,
  ) {}

  get mode() {
    return this.repo.mode;
  }

  /* ---------------------------------------------------------------------
     Laden
     --------------------------------------------------------------------- */

  async load(): Promise<DockSnapshot> {
    const [
      courses,
      lessons,
      series,
      revisions,
      exceptions,
      entries,
      versions,
      resolutions,
      taskStates,
      assessments,
      documents,
      documentLinks,
      confirmations,
      corrections,
      invites,
      missedIntervals,
      settings,
    ] = await Promise.all([
      this.repo.list("courses"),
      this.repo.list("lessons"),
      this.repo.list("series"),
      this.repo.list("revisions"),
      this.repo.list("exceptions"),
      this.repo.list("entries"),
      this.repo.list("entryVersions"),
      this.repo.list("resolutions"),
      this.repo.list("taskStates"),
      this.repo.list("assessments"),
      this.repo.list("documents"),
      this.repo.list("documentLinks"),
      this.repo.list("confirmations"),
      this.repo.list("corrections"),
      this.repo.list("invites"),
      this.repo.list("missedIntervals"),
      this.repo.get("settings", "settings"),
    ]);

    return {
      courses,
      lessons,
      series,
      revisions,
      exceptions,
      entries: entries.filter((e) => e.deletedAt === null),
      versions,
      resolutions,
      taskStates,
      assessments,
      documents,
      documentLinks,
      confirmations,
      corrections,
      invites,
      missedIntervals,
      materializedUntil: settings?.materializedUntil ?? null,
      seeded: settings?.seededAt != null,
    };
  }

  async settings() {
    return (await this.repo.get("settings", "settings")) ?? {
      id: "settings" as const,
      timezone: "Europe/Vienna",
      previewClock: { enabled: false, at: null },
      seededAt: null,
      materializedUntil: null,
    };
  }

  /* ---------------------------------------------------------------------
     Erstes Anlegen
     --------------------------------------------------------------------- */

  /**
   * Legt den bestätigten Stundenplan an, falls das noch nicht geschehen ist,
   * und erzeugt die Stunden der aktuellen Woche und der nächsten Monate.
   *
   * Es gibt bewusst keinen Schritt, in dem die Wiederholung bestätigt werden
   * muss. Der Plan ist sofort aktiv und läuft ohne Ende.
   */
  async ensureSeeded(today: LocalDate = todayLocal()): Promise<void> {
    const settings = await this.settings();
    if (settings.seededAt !== null) {
      await this.ensureMaterialized(today);
      return;
    }

    const now = nowStamp();
    const seed = buildSeed(today, now);

    await this.repo.put("schools", seed.school);
    await this.repo.put("academicYears", seed.academicYear);
    await this.repo.put("classes", seed.schoolClass);
    await this.repo.putMany("courses", seed.courses);
    await this.repo.putMany("series", seed.series);
    await this.repo.put("profiles", {
      id: this.userId,
      // Es wird kein Profil erfunden.
      displayName: "",
      classId: seed.schoolClass.id,
    });
    await this.repo.put("settings", {
      ...settings,
      seededAt: now,
      materializedUntil: null,
    });

    await this.ensureMaterialized(today);
  }

  /**
   * Stellt sicher, dass für das gewünschte Datum Stunden vorliegen.
   *
   * Der gespeicherte Zeitraum ist eine Beschleunigung, kein Ende. Fehlt ein
   * Datum, wird nacherzeugt – niemals gemeldet, es gebe keine Stunde mehr.
   */
  async ensureMaterialized(target: LocalDate): Promise<boolean> {
    const settings = await this.settings();
    if (!needsExtension(target, settings.materializedUntil)) return false;

    const [series, revisions, exceptions, existing] = await Promise.all([
      this.repo.list("series"),
      this.repo.list("revisions"),
      this.repo.list("exceptions"),
      this.repo.list("lessons"),
    ]);
    if (series.length === 0) return false;

    const desired = windowFor(target, settings.materializedUntil);

    // Der Zeitraum muss lückenlos anschliessen. Springt der Benutzer weit nach
    // vorne, wird ab dem bisherigen Ende weitererzeugt – sonst entstuenden
    // Wochen ohne Stunden zwischen altem und neuem Zeitraum.
    const from = settings.materializedUntil !== null
      ? minDate(desired.from, addDays(settings.materializedUntil, 1))
      : desired.from;
    const to = desired.to;
    const now = nowStamp();

    const result = materialize({
      series,
      revisions,
      exceptions,
      existing,
      from,
      to,
      now,
      newId,
    });

    if (result.created.length > 0) {
      await this.repo.putMany("lessons", result.created);
    }

    await this.repo.put("settings", {
      ...settings,
      materializedUntil:
        settings.materializedUntil !== null &&
          compareDates(settings.materializedUntil, to) > 0
          ? settings.materializedUntil
          : to,
    });

    // Neue Stunden können offene Fälligkeiten auflösen.
    if (result.created.length > 0) await this.reresolveOpenDues();
    return result.created.length > 0;
  }

  /* ---------------------------------------------------------------------
     Schule und Klasse
     --------------------------------------------------------------------- */

  /**
   * Setzt den Namen der Schule und der Klasse.
   *
   * Beides sind echte Felder des Datenmodells. Sie werden gespeichert und in
   * Einstellungen und Export wieder ausgegeben. Eine Verbindung zu einem
   * Schulsystem entsteht dadurch nicht.
   */
  async setSchoolAndClass(
    schoolName: string,
    className: string,
  ): Promise<void> {
    const [schools, classes] = await Promise.all([
      this.repo.list("schools"),
      this.repo.list("classes"),
    ]);

    const school = schools[0];
    if (school && schoolName.trim() !== "") {
      await this.repo.put("schools", { ...school, name: schoolName.trim() });
    }

    const schoolClass = classes[0];
    if (schoolClass && className.trim() !== "") {
      await this.repo.put("classes", {
        ...schoolClass,
        name: className.trim(),
      });
    }
  }

  async schoolAndClass(): Promise<{ school: string; klasse: string }> {
    const [schools, classes] = await Promise.all([
      this.repo.list("schools"),
      this.repo.list("classes"),
    ]);
    return {
      school: schools[0]?.name ?? "",
      klasse: classes[0]?.name ?? "",
    };
  }

  /* ---------------------------------------------------------------------
     Stundenplan ändern
     --------------------------------------------------------------------- */

  /** Setzt den Status einer einzelnen Stunde. Inhalte bleiben erhalten. */
  async setLessonStatus(
    lessonId: Uuid,
    status: LessonStatus,
    note: string | null = null,
  ): Promise<void> {
    const lesson = await this.repo.get("lessons", lessonId);
    if (!lesson) return;
    await this.repo.put("lessons", {
      ...lesson,
      status,
      statusNote: note,
      updatedAt: nowStamp(),
    });
    // Nur Fälligkeiten, die auf diese Stunde zeigen, werden neu bewertet.
    await this.reresolveAll();
  }

  /**
   * Verschiebt eine einzelne Stunde. Die Kennung bleibt, damit Notizen,
   * Dateien und Aufgabenbezuege erhalten bleiben.
   */
  async moveLesson(
    lessonId: Uuid,
    date: LocalDate,
    startsAt: LocalTime,
    endsAt: LocalTime,
  ): Promise<void> {
    const lesson = await this.repo.get("lessons", lessonId);
    if (!lesson) return;
    await this.ensureMaterialized(date);
    await this.repo.put("lessons", {
      ...lesson,
      date,
      startsAt,
      endsAt,
      status: lesson.status === "entfallen" ? "verschoben" : lesson.status,
      updatedAt: nowStamp(),
    });
    await this.reresolveAll();
  }

  /** Ein zusaetzlicher, einmaliger Termin ausserhalb der Serien. */
  async addOneOffLesson(
    courseId: Uuid,
    date: LocalDate,
    periodIndexes: number[],
    startsAt?: LocalTime,
    endsAt?: LocalTime,
  ): Promise<LessonInstance[]> {
    const grid = spanOfPeriods(periodIndexes);
    const now = nowStamp();
    const blockKey = `einzel:${newId()}`;
    const sorted = [...periodIndexes].sort((a, b) => a - b);

    const created: LessonInstance[] = sorted.map((periodIndex, position) => {
      const period = spanOfPeriods([periodIndex]);
      return {
        id: newId(),
        courseId,
        seriesId: null,
        occurrenceKey: `${blockKey}:${periodIndex}`,
        originalDate: date,
        date,
        startsAt: position === 0
          ? (startsAt ?? period?.startsAt ?? grid?.startsAt ?? "08:00")
          : (period?.startsAt ?? "08:00"),
        endsAt: position === sorted.length - 1
          ? (endsAt ?? period?.endsAt ?? grid?.endsAt ?? "08:50")
          : (period?.endsAt ?? "08:50"),
        periodIndex,
        blockKey,
        status: "zusatztermin",
        statusNote: null,
        source: "manuell",
        createdAt: now,
        updatedAt: now,
      };
    });

    await this.repo.putMany("lessons", created);
    await this.reresolveOpenDues();
    return created;
  }

  /**
   * Aendert eine Serie ab einem Stichtag.
   *
   * Vergangene Stunden behalten ihre Angaben. Kuenftige Stunden der Serie
   * werden abgeglichen, nicht doppelt angelegt: bestehende Stunden werden
   * angepasst, fehlende ergaenzt, weggefallene auf "entfallen" gesetzt statt
   * gelöscht.
   */
  async editSeriesFrom(
    seriesId: Uuid,
    effectiveFrom: LocalDate,
    changes: ScheduleRevision["changes"],
    note: string | null = null,
  ): Promise<void> {
    const series = await this.repo.get("series", seriesId);
    if (!series) return;

    const now = nowStamp();
    await this.repo.put("revisions", {
      id: newId(),
      seriesId,
      effectiveFrom,
      changes,
      note,
      createdAt: now,
    });

    await this.reconcileSeries(seriesId, effectiveFrom);
  }

  /**
   * Gleicht die kuenftigen Stunden einer Serie mit der Vorlage ab.
   *
   * Nichts wird hart gelöscht: Stunden, die es nicht mehr geben soll, werden
   * deaktiviert. Dadurch bleiben ihre Inhalte auffindbar.
   */
  private async reconcileSeries(
    seriesId: Uuid,
    from: LocalDate,
  ): Promise<void> {
    const settings = await this.settings();
    const [series, revisions, exceptions, allLessons] = await Promise.all([
      this.repo.list("series"),
      this.repo.list("revisions"),
      this.repo.list("exceptions"),
      this.repo.list("lessons"),
    ]);

    const target = series.find((s) => s.id === seriesId);
    if (!target) return;
    const to = settings.materializedUntil ?? addDays(from, 120);
    const now = nowStamp();

    const mine = allLessons.filter(
      (l) => l.seriesId === seriesId && compareDates(l.date, from) >= 0,
    );

    // Was die Vorlage ab dem Stichtag vorsieht.
    const wanted = materialize({
      series: [target],
      revisions,
      exceptions,
      existing: [],
      from,
      to,
      now,
      newId,
    }).created;

    const wantedByKey = new Map(wanted.map((l) => [l.occurrenceKey, l]));
    const mineByKey = new Map(mine.map((l) => [l.occurrenceKey, l]));

    const updates: LessonInstance[] = [];

    for (const [key, desired] of wantedByKey) {
      const existing = mineByKey.get(key);
      if (existing) {
        // Zeiten angleichen, Identitaet und Inhalte behalten.
        if (
          existing.startsAt !== desired.startsAt ||
          existing.endsAt !== desired.endsAt ||
          existing.date !== desired.date
        ) {
          updates.push({
            ...existing,
            date: desired.date,
            startsAt: desired.startsAt,
            endsAt: desired.endsAt,
            updatedAt: now,
          });
        }
      } else {
        updates.push(desired);
      }
    }

    for (const [key, existing] of mineByKey) {
      if (!wantedByKey.has(key) && existing.status === "geplant") {
        updates.push({
          ...existing,
          status: "entfallen",
          statusNote: "Durch eine Änderung der Serie entfallen.",
          updatedAt: now,
        });
      }
    }

    if (updates.length > 0) await this.repo.putMany("lessons", updates);
    await this.reresolveAll();
  }

  /** Deaktiviert eine Serie ab einem Stichtag. */
  async endSeries(seriesId: Uuid, from: LocalDate): Promise<void> {
    const series = await this.repo.get("series", seriesId);
    if (!series) return;
    await this.repo.put("series", {
      ...series,
      endsOn: addDays(from, -1),
    });
    await this.reconcileSeries(seriesId, from);
  }

  /** Ein ausdruecklich erfasster unterrichtsfreier Zeitraum. */
  async addException(
    from: LocalDate,
    to: LocalDate,
    label: string,
  ): Promise<void> {
    const exception: ScheduleException = {
      id: newId(),
      schoolId: SCHOOL_ID,
      from,
      to,
      label,
      createdAt: nowStamp(),
    };
    await this.repo.put("exceptions", exception);

    // Betroffene Stunden werden deaktiviert, nicht gelöscht.
    const lessons = await this.repo.list("lessons");
    const now = nowStamp();
    const affected = lessons
      .filter(
        (l) =>
          compareDates(from, l.date) <= 0 &&
          compareDates(l.date, to) <= 0 &&
          l.status === "geplant",
      )
      .map((l) => ({
        ...l,
        status: "entfallen" as const,
        statusNote: label,
        updatedAt: now,
      }));

    if (affected.length > 0) await this.repo.putMany("lessons", affected);
    await this.reresolveAll();
  }

  async removeException(exceptionId: Uuid): Promise<void> {
    await this.repo.remove("exceptions", exceptionId);
  }

  /* ---------------------------------------------------------------------
     Inhalte erfassen
     --------------------------------------------------------------------- */

  /**
   * Legt einen Eintrag an.
   *
   * Der Wortlaut wird unverändert übernommen. Es wird nichts uebersetzt,
   * nichts ersetzt und nichts geraten.
   */
  async createEntry(input: {
    kind: EntryKind;
    courseId: Uuid;
    lessonId: Uuid | null;
    blockKey?: string | null;
    text: string;
    detail?: string | null;
    audience: Audience;
    dueRule?: DueRule | null;
  }): Promise<Entry> {
    const now = nowStamp();
    const entryId = newId();
    const versionId = newId();

    const version: EntryVersion = {
      id: versionId,
      entryId,
      revision: 1,
      text: input.text,
      detail: input.detail ?? null,
      authorId: this.userId,
      createdAt: now,
      changeNote: null,
    };

    const entry: Entry = {
      id: entryId,
      kind: input.kind,
      courseId: input.courseId,
      announcedInLessonId: input.lessonId,
      announcedInBlockKey: input.blockKey ?? null,
      audience: input.audience,
      origin: "selbst",
      authorId: this.userId,
      currentVersionId: versionId,
      dueRule: input.dueRule ?? null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.repo.put("entryVersions", version);
    await this.repo.put("entries", entry);
    await this.resolveEntry(entry);
    return entry;
  }

  /**
   * Aendert den Text eines Eintrags.
   *
   * Es entsteht eine neue Fassung. Bisherige Bestätigungen bleiben als
   * Historie bestehen; sie gelten nicht für die neue Fassung. Ein bereits
   * erledigter persoenlicher Stand bleibt erhalten – er wird nicht
   * stillschweigend auf den neuen Umfang übertragen.
   */
  async reviseEntry(
    entryId: Uuid,
    text: string,
    detail: string | null,
    changeNote: string | null,
  ): Promise<void> {
    const entry = await this.repo.get("entries", entryId);
    if (!entry) return;

    const versions = (await this.repo.list("entryVersions")).filter(
      (v) => v.entryId === entryId,
    );
    const highest = versions.reduce((max, v) => Math.max(max, v.revision), 0);

    const now = nowStamp();
    const versionId = newId();
    await this.repo.put("entryVersions", {
      id: versionId,
      entryId,
      revision: highest + 1,
      text,
      detail,
      authorId: this.userId,
      createdAt: now,
      changeNote,
    });
    await this.repo.put("entries", {
      ...entry,
      currentVersionId: versionId,
      updatedAt: now,
    });
  }

  /** Aendert die Faelligkeitsregel und löst sie neu auf. */
  async setDueRule(entryId: Uuid, rule: DueRule | null): Promise<void> {
    const entry = await this.repo.get("entries", entryId);
    if (!entry) return;
    const updated = { ...entry, dueRule: rule, updatedAt: nowStamp() };
    await this.repo.put("entries", updated);
    await this.resolveEntry(updated);
  }

  /** Entfernt einen Eintrag, behält ihn aber für die Historie. */
  async deleteEntry(entryId: Uuid): Promise<void> {
    const entry = await this.repo.get("entries", entryId);
    if (!entry) return;
    await this.repo.put("entries", {
      ...entry,
      deletedAt: nowStamp(),
      updatedAt: nowStamp(),
    });
  }

  /* ---------------------------------------------------------------------
     Fälligkeiten
     --------------------------------------------------------------------- */

  private async resolutionContext() {
    const [lessons, settings] = await Promise.all([
      this.repo.list("lessons"),
      this.settings(),
    ]);
    return {
      lessons,
      materializedUntil: settings.materializedUntil,
      now: nowStamp(),
    };
  }

  private async currentResolution(
    entryId: Uuid,
  ): Promise<DueResolution | null> {
    const all = (await this.repo.list("resolutions")).filter(
      (r) => r.entryId === entryId,
    );
    if (all.length === 0) return null;
    return all.sort((a, b) => a.resolvedAt.localeCompare(b.resolvedAt))[
      all.length - 1
    ] ?? null;
  }

  /**
   * Loest die Fälligkeit eines Eintrags auf und hält das Ergebnis fest.
   *
   * Ein neuer Datensatz entsteht nur, wenn sich etwas geändert hat. Sonst
   * würde die Historie mit gleichlautenden Einträgen volllaufen.
   */
  async resolveEntry(entry: Entry): Promise<ResolvedDue> {
    const context = await this.resolutionContext();
    const resolved = resolveDue(entry.dueRule, context);

    // Reicht der erzeugte Zeitraum nicht aus, wird er erweitert und erneut
    // versucht – eine fehlende Zeile ist kein fehlender Termin.
    const rule = entry.dueRule;
    if (resolved.needsMoreLessons && rule?.kind === "NEXT_SUBJECT_LESSON") {
      const anchor = context.lessons.find((l) => l.id === rule.anchorLessonId);
      if (anchor && context.materializedUntil !== null) {
        const extended = await this.ensureMaterialized(
          addDays(context.materializedUntil, 1),
        );
        if (extended) {
          const retryContext = await this.resolutionContext();
          const retry = resolveDue(rule, retryContext);
          await this.storeResolution(entry.id, retry);
          return retry;
        }
      }
    }

    await this.storeResolution(entry.id, resolved);
    return resolved;
  }

  private async storeResolution(
    entryId: Uuid,
    resolved: ResolvedDue,
  ): Promise<void> {
    const previous = await this.currentResolution(entryId);
    const unchanged = previous !== null &&
      previous.state === resolved.state &&
      previous.targetLessonId === resolved.targetLessonId &&
      previous.targetDate === resolved.targetDate;
    if (unchanged) return;

    const record = buildResolution(
      entryId,
      resolved,
      previous,
      nowStamp(),
      newId,
    );
    await this.repo.put("resolutions", record);
  }

  /** Bewertet alle Fälligkeiten neu. */
  async reresolveAll(): Promise<void> {
    const entries = (await this.repo.list("entries")).filter(
      (e) => e.deletedAt === null && e.dueRule !== null,
    );
    for (const entry of entries) {
      const context = await this.resolutionContext();
      await this.storeResolution(entry.id, resolveDue(entry.dueRule, context));
    }
  }

  /** Bewertet nur die noch offenen Fälligkeiten neu. */
  private async reresolveOpenDues(): Promise<void> {
    const [entries, resolutions] = await Promise.all([
      this.repo.list("entries"),
      this.repo.list("resolutions"),
    ]);
    const latest = new Map<Uuid, DueResolution>();
    for (const r of resolutions.sort((a, b) =>
      a.resolvedAt.localeCompare(b.resolvedAt)
    )) {
      latest.set(r.entryId, r);
    }

    const open = entries.filter(
      (e) =>
        e.deletedAt === null &&
        e.dueRule !== null &&
        latest.get(e.id)?.state === "offen",
    );

    for (const entry of open) {
      const context = await this.resolutionContext();
      await this.storeResolution(entry.id, resolveDue(entry.dueRule, context));
    }
  }

  /* ---------------------------------------------------------------------
     Persoenlicher Stand
     --------------------------------------------------------------------- */

  /**
   * Hakt eine Aufgabe ab oder öffnet sie wieder.
   *
   * Der Stand gehört der Person, nicht der Aufgabe. Er wird zusammen mit der
   * Fassung festgehalten, die beim Abhaken galt.
   */
  async setTaskDone(entryId: Uuid, done: boolean): Promise<void> {
    const entry = await this.repo.get("entries", entryId);
    if (!entry) return;

    const existing = (await this.repo.list("taskStates")).find(
      (s) => s.entryId === entryId && s.userId === this.userId,
    );
    const now = nowStamp();

    const state: UserTaskState = {
      id: existing?.id ?? newId(),
      entryId,
      userId: this.userId,
      done,
      doneAt: done ? now : null,
      doneForVersionId: done ? entry.currentVersionId : null,
      updatedAt: now,
    };
    await this.repo.put("taskStates", state);
  }

  /* ---------------------------------------------------------------------
     Prüfungen
     --------------------------------------------------------------------- */

  async createAssessment(input: {
    courseId: Uuid;
    title: string;
    kind: AssessmentKind;
    date: LocalDate | null;
    time: LocalTime | null;
    lessonId: Uuid | null;
    scope: string;
    audience: Audience;
  }): Promise<Assessment> {
    const now = nowStamp();
    const assessment: Assessment = {
      id: newId(),
      courseId: input.courseId,
      entryId: null,
      title: input.title,
      kind: input.kind,
      date: input.date,
      time: input.time,
      lessonId: input.lessonId,
      scope: input.scope,
      audience: input.audience,
      origin: "selbst",
      authorId: this.userId,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.put("assessments", assessment);
    return assessment;
  }

  async deleteAssessment(id: Uuid): Promise<void> {
    await this.repo.remove("assessments", id);
  }

  /* ---------------------------------------------------------------------
     Dateien
     --------------------------------------------------------------------- */

  async attachFile(input: {
    file: File;
    courseId: Uuid | null;
    lessonId: Uuid | null;
    entryId: Uuid | null;
    assessmentId: Uuid | null;
    audience: Audience;
  }): Promise<StoredDocument> {
    const now = nowStamp();
    const document: StoredDocument = {
      id: newId(),
      name: input.file.name,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
      audience: input.audience,
      courseId: input.courseId,
      ownerId: this.userId,
      createdAt: now,
    };

    await this.repo.putBlob(document.id, input.file);
    await this.repo.put("documents", document);
    await this.repo.put("documentLinks", {
      id: newId(),
      documentId: document.id,
      lessonId: input.lessonId,
      entryId: input.entryId,
      assessmentId: input.assessmentId,
      courseId: input.courseId,
      createdAt: now,
    });
    return document;
  }

  /** Verknuepft eine bestehende Datei zusätzlich mit einer Stunde. */
  async linkDocument(
    documentId: Uuid,
    to: { lessonId?: Uuid; assessmentId?: Uuid; courseId?: Uuid },
  ): Promise<void> {
    await this.repo.put("documentLinks", {
      id: newId(),
      documentId,
      lessonId: to.lessonId ?? null,
      entryId: null,
      assessmentId: to.assessmentId ?? null,
      courseId: to.courseId ?? null,
      createdAt: nowStamp(),
    });
  }

  async getFile(documentId: Uuid): Promise<Blob | undefined> {
    return this.repo.getBlob(documentId);
  }

  /** Entfernt eine Datei einschließlich ihres Inhalts und aller Bezuege. */
  async deleteDocument(documentId: Uuid): Promise<void> {
    const links = (await this.repo.list("documentLinks")).filter(
      (l) => l.documentId === documentId,
    );
    for (const link of links) await this.repo.remove("documentLinks", link.id);
    await this.repo.removeBlob(documentId);
    await this.repo.remove("documents", documentId);
  }

  /* ---------------------------------------------------------------------
     Geteiltes Klassengedächtnis
     --------------------------------------------------------------------- */

  /**
   * Bestätigt genau eine Fassung.
   *
   * Eine Bestätigung sagt: "So war es, in dieser Fassung." Wird der Text
   * später geändert, bleibt sie als Historie stehen und gilt nicht für die
   * neue Fassung. Es werden keine Zahlen erfunden – gezählt wird, was
   * tatsächlich bestätigt wurde.
   */
  async confirmVersion(entryId: Uuid, versionId: Uuid): Promise<void> {
    const vorhandene = (await this.repo.list("confirmations")).find(
      (c) => c.versionId === versionId && c.userId === this.userId,
    );
    if (vorhandene) return;

    await this.repo.put("confirmations", {
      id: newId(),
      entryId,
      versionId,
      userId: this.userId,
      createdAt: nowStamp(),
    });
  }

  async withdrawConfirmation(versionId: Uuid): Promise<void> {
    const vorhandene = (await this.repo.list("confirmations")).find(
      (c) => c.versionId === versionId && c.userId === this.userId,
    );
    if (vorhandene) await this.repo.remove("confirmations", vorhandene.id);
  }

  /**
   * Schlägt eine Korrektur vor.
   *
   * Der Vorschlag ändert nichts. Er macht sichtbar, dass jemand den Inhalt
   * anders in Erinnerung hat – ein Widerspruch, den andere sehen sollen.
   */
  async proposeCorrection(
    entryId: Uuid,
    versionId: Uuid,
    proposedText: string,
    rationale: string | null,
  ): Promise<CorrectionProposal> {
    const vorschlag: CorrectionProposal = {
      id: newId(),
      entryId,
      versionId,
      proposedText,
      rationale,
      authorId: this.userId,
      state: "offen",
      createdAt: nowStamp(),
      resolvedAt: null,
    };
    await this.repo.put("corrections", vorschlag);
    return vorschlag;
  }

  /**
   * Übernimmt einen Vorschlag.
   *
   * Dabei entsteht eine neue Fassung. Bisherige Bestätigungen bleiben an
   * ihrer Fassung und gelten nicht für die neue.
   */
  async acceptCorrection(proposalId: Uuid): Promise<void> {
    const vorschlag = await this.repo.get("corrections", proposalId);
    if (!vorschlag || vorschlag.state !== "offen") return;

    await this.reviseEntry(
      vorschlag.entryId,
      vorschlag.proposedText,
      null,
      vorschlag.rationale ?? "Korrekturvorschlag übernommen",
    );

    await this.repo.put("corrections", {
      ...vorschlag,
      state: "uebernommen",
      resolvedAt: nowStamp(),
    });
  }

  async rejectCorrection(proposalId: Uuid): Promise<void> {
    const vorschlag = await this.repo.get("corrections", proposalId);
    if (!vorschlag || vorschlag.state !== "offen") return;
    await this.repo.put("corrections", {
      ...vorschlag,
      state: "abgelehnt",
      resolvedAt: nowStamp(),
    });
  }

  /**
   * Legt eine Einladung an.
   *
   * Sie läuft ab, lässt sich zurücknehmen und hat eine begrenzte Zahl an
   * Einlösungen. Das Erraten eines Klassennamens gewährt keinen Zugang.
   */
  async createInvite(options?: {
    gueltigTage?: number;
    maxUses?: number;
    requiresApproval?: boolean;
  }): Promise<Invite> {
    const classes = await this.repo.list("classes");
    const klasse = classes[0];
    if (!klasse) throw new Error("Keine Klasse vorhanden.");

    const tage = options?.gueltigTage ?? 7;
    const ablauf = new Date(Date.now() + tage * 86_400_000);

    const einladung: Invite = {
      id: newId(),
      classId: klasse.id,
      code: inviteCode(),
      createdBy: this.userId,
      expiresAt: ablauf.toISOString(),
      revokedAt: null,
      maxUses: options?.maxUses ?? 5,
      uses: 0,
      requiresApproval: options?.requiresApproval ?? true,
      createdAt: nowStamp(),
    };
    await this.repo.put("invites", einladung);
    return einladung;
  }

  async revokeInvite(inviteId: Uuid): Promise<void> {
    const einladung = await this.repo.get("invites", inviteId);
    if (!einladung || einladung.revokedAt !== null) return;
    await this.repo.put("invites", {
      ...einladung,
      revokedAt: nowStamp(),
    });
  }

  /* ---------------------------------------------------------------------
     Nachholen
     --------------------------------------------------------------------- */

  /** Ein privat gewaehlter Zeitraum. Ein Grund wird nicht erfasst. */
  async addMissedInterval(
    from: LocalDate,
    to: LocalDate,
  ): Promise<MissedInterval> {
    const interval: MissedInterval = {
      id: newId(),
      userId: this.userId,
      from,
      to,
      createdAt: nowStamp(),
    };
    await this.repo.put("missedIntervals", interval);
    return interval;
  }

  async removeMissedInterval(id: Uuid): Promise<void> {
    await this.repo.remove("missedIntervals", id);
  }

  /* ---------------------------------------------------------------------
     Entwuerfe
     --------------------------------------------------------------------- */

  /** Sichert einen nicht abgeschickten Text, damit er nicht verloren geht. */
  async saveDraft(key: string, text: string): Promise<void> {
    if (text.trim() === "") {
      await this.repo.remove("drafts", key);
      return;
    }
    await this.repo.put("drafts", {
      id: key,
      text,
      updatedAt: nowStamp(),
    });
  }

  async getDraft(key: string): Promise<string | null> {
    const draft = await this.repo.get("drafts", key);
    return draft?.text ?? null;
  }

  async clearDraft(key: string): Promise<void> {
    await this.repo.remove("drafts", key);
  }

  /* ---------------------------------------------------------------------
     Vorschau-Uhr
     --------------------------------------------------------------------- */

  /**
   * Stellt eine Vorschauzeit ein. Sie ist ausdruecklich gekennzeichnet und im
   * Normalbetrieb aus. Die Uhr des Benutzers wird nie stillschweigend
   * verändert, damit die Oberfläche voller aussieht.
   */
  async setPreviewClock(at: Timestamp | null): Promise<void> {
    const settings = await this.settings();
    await this.repo.put("settings", {
      ...settings,
      previewClock: { enabled: at !== null, at },
    });
  }

  /* ---------------------------------------------------------------------
     Daten mitnehmen und löschen
     --------------------------------------------------------------------- */

  /** Gibt alle Daten als lesbare Struktur aus, einschließlich der Dateien. */
  async exportAll(): Promise<{ json: string; files: Array<{ name: string; blob: Blob }> }> {
    const snapshot = await this.load();
    const documents = await this.repo.list("documents");
    const files: Array<{ name: string; blob: Blob }> = [];

    for (const document of documents) {
      const blob = await this.repo.getBlob(document.id);
      if (blob) files.push({ name: `${document.id}-${document.name}`, blob });
    }

    const payload = {
      exportiertAm: nowStamp(),
      hinweis:
        "Export aus Dock. Enthaelt den Stundenplan, eigene Einträge, Aufgaben und Dateiangaben.",
      ...snapshot,
      dateien: documents,
    };

    return { json: JSON.stringify(payload, null, 2), files };
  }

  /** Loescht alles, einschließlich der Dateiinhalte. */
  async deleteEverything(): Promise<void> {
    await this.repo.clear();
  }
}

/* -------------------------------------------------------------------------
   Abfragen für die Oberfläche
   ------------------------------------------------------------------------- */

export function lessonsOn(
  snapshot: DockSnapshot,
  date: LocalDate,
): LessonInstance[] {
  return snapshot.lessons
    .filter((l) => l.date === date)
    .sort((a, b) =>
      minutesOfDay(a.startsAt) - minutesOfDay(b.startsAt) ||
      a.periodIndex - b.periodIndex
    );
}

export function blocksOn(
  snapshot: DockSnapshot,
  date: LocalDate,
): LessonBlock[] {
  return groupIntoBlocks(lessonsOn(snapshot, date));
}

export function blocksInWeek(
  snapshot: DockSnapshot,
  anyDateInWeek: LocalDate,
): Map<LocalDate, LessonBlock[]> {
  const result = new Map<LocalDate, LessonBlock[]>();
  for (const date of weekDates(anyDateInWeek)) {
    result.set(date, blocksOn(snapshot, date));
  }
  return result;
}

export function courseOf(
  snapshot: DockSnapshot,
  courseId: Uuid,
): Course | undefined {
  return snapshot.courses.find((c) => c.id === courseId);
}

export function currentVersion(
  snapshot: DockSnapshot,
  entry: Entry,
): EntryVersion | undefined {
  return snapshot.versions.find((v) => v.id === entry.currentVersionId);
}

export function latestResolution(
  snapshot: DockSnapshot,
  entryId: Uuid,
): DueResolution | null {
  const all = snapshot.resolutions
    .filter((r) => r.entryId === entryId)
    .sort((a, b) => a.resolvedAt.localeCompare(b.resolvedAt));
  return all[all.length - 1] ?? null;
}

export function taskStateOf(
  snapshot: DockSnapshot,
  entryId: Uuid,
  userId: Uuid,
): UserTaskState | undefined {
  return snapshot.taskStates.find(
    (s) => s.entryId === entryId && s.userId === userId,
  );
}

/**
 * Hat sich der Umfang geändert, seit die Person abgehakt hat?
 *
 * Waechst eine Aufgabe von 4 bis 8 auf 4 bis 10, bleibt der persoenliche
 * Stand erhalten – aber es wird sichtbar gemacht, dass sich der Umfang
 * geändert hat. Die zusaetzliche Arbeit gilt nicht stillschweigend als
 * erledigt.
 */
export function completionIsStale(
  entry: Entry,
  state: UserTaskState | undefined,
): boolean {
  if (!state || !state.done) return false;
  if (state.doneForVersionId === null) return false;
  return state.doneForVersionId !== entry.currentVersionId;
}

export interface OpenTask {
  entry: Entry;
  version: EntryVersion | undefined;
  resolution: DueResolution | null;
  state: UserTaskState | undefined;
  overdue: boolean;
  stale: boolean;
}

/** Offene Aufgaben und Mitbringsel, nach Fälligkeit geordnet. */
export function openTasks(
  snapshot: DockSnapshot,
  userId: Uuid,
  today: LocalDate,
  nowTime: LocalTime,
): OpenTask[] {
  return snapshot.entries
    .filter((e) => e.kind === "hausuebung" || e.kind === "mitbringen")
    .map((entry) => {
      const resolution = latestResolution(snapshot, entry.id);
      const state = taskStateOf(snapshot, entry.id, userId);
      return {
        entry,
        version: currentVersion(snapshot, entry),
        resolution,
        state,
        overdue: isOverdue(resolution, today, nowTime),
        stale: completionIsStale(entry, state),
      };
    })
    .sort((a, b) => {
      const aDate = a.resolution?.targetDate ?? "9999-12-31";
      const bDate = b.resolution?.targetDate ?? "9999-12-31";
      return compareDates(aDate, bDate);
    });
}

/**
 * Die laufende und die nächste Stunde.
 *
 * Es wird keine laufende Stunde erfunden, um die Anzeige zu fuellen. Vor
 * Schulbeginn, in Pausen, nach Schulschluss und am Wochenende gibt es
 * schlicht keine – und genau das wird angezeigt.
 */
export function currentAndNext(
  snapshot: DockSnapshot,
  now: Date,
  timezone = "Europe/Vienna",
): { current: LessonBlock | null; next: LessonBlock | null } {
  const today = todayLocal(now, timezone);
  const time = minutesOfDay(localTimeOf(now, timezone));

  const todayBlocks = blocksOn(snapshot, today).filter(
    (b) => b.status !== "entfallen",
  );

  const current = todayBlocks.find(
    (b) =>
      minutesOfDay(b.startsAt) <= time && time < minutesOfDay(b.endsAt),
  ) ?? null;

  const laterToday = todayBlocks.find((b) => minutesOfDay(b.startsAt) > time);
  if (laterToday) return { current, next: laterToday };

  // In den nächsten Tagen suchen. Findet sich nichts, wird das gesagt –
  // nicht geraten.
  for (let offset = 1; offset <= 14; offset += 1) {
    const date = addDays(today, offset);
    const blocks = blocksOn(snapshot, date).filter(
      (b) => b.status !== "entfallen",
    );
    if (blocks.length > 0) return { current, next: blocks[0] ?? null };
  }

  return { current, next: null };
}

export { startOfWeek, weekDates, addDays, type Weekday };


/* -------------------------------------------------------------------------
   Geteiltes: Abfragen
   ------------------------------------------------------------------------- */

/** Wer hat die aktuell gültige Fassung bestätigt? Gezählt wird nur Echtes. */
export function confirmationsForCurrentVersion(
  snapshot: DockSnapshot,
  entry: Entry,
): Confirmation[] {
  return snapshot.confirmations.filter(
    (c) => c.versionId === entry.currentVersionId,
  );
}

/**
 * Bestätigungen, die sich auf frühere Fassungen beziehen.
 *
 * Sie bleiben Historie. Sie gelten ausdrücklich nicht für den heutigen Text.
 */
export function outdatedConfirmations(
  snapshot: DockSnapshot,
  entry: Entry,
): Confirmation[] {
  return snapshot.confirmations.filter(
    (c) => c.entryId === entry.id && c.versionId !== entry.currentVersionId,
  );
}

/** Offene Korrekturvorschläge – ein sichtbarer Widerspruch. */
export function openCorrections(
  snapshot: DockSnapshot,
  entryId: Uuid,
): CorrectionProposal[] {
  return snapshot.corrections.filter(
    (c) => c.entryId === entryId && c.state === "offen",
  );
}

/** Ist eine Einladung jetzt noch einlösbar? */
export function inviteIsUsable(invite: Invite, now: Date = new Date()): boolean {
  if (invite.revokedAt !== null) return false;
  if (invite.uses >= invite.maxUses) return false;
  return new Date(invite.expiresAt).getTime() > now.getTime();
}
