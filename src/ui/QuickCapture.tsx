"use client";

/**
 * Schnelles Erfassen.
 *
 * Eine Taste, sechs Arten: Hausübung, Behandelt, Mitbringen, Prüfung,
 * Notiz, Datei. Kurs und Ankündigungsstunde sind vorbelegt. Die Sichtbarkeit
 * ist immer sichtbar waehlbar.
 *
 * Der Wortlaut wird übernommen, wie er eingegeben wurde. Freier Text
 * genügt; es braucht kein Sprachmodell und keine Zerlegung.
 *
 * Nicht abgeschickter Text wird lokal gesichert, damit ein versehentliches
 * Schließen die Arbeit nicht vernichtet.
 */

import { useEffect, useMemo, useState } from "react";
import { Sheet, Field, inputClass, inputStyle, Notice, SaveIndicator, type SaveState } from "./primitives";
import { useDock } from "@/data/DockContext";
import { courseOf } from "@/data/store";
import type { LessonBlock } from "@/domain/recurrence";
import type { Audience, DueRule, EntryKind } from "@/domain/types";
import { describeDateRelative, formatTimeRange } from "@/domain/time";
import { nextMeetingAfter } from "@/domain/dueRules";
import { validateUpload, formatFileSize } from "@/data/repository";

const KINDS: ReadonlyArray<{ value: EntryKind; label: string; hint: string }> = [
  { value: "hausuebung", label: "Hausübung", hint: "Etwas, das du bis zu einer Stunde erledigst." },
  { value: "behandelt", label: "Behandelt", hint: "Was in dieser Stunde durchgenommen wurde." },
  { value: "mitbringen", label: "Mitbringen", hint: "Etwas, das du zu einer Stunde mitnimmst." },
  { value: "pruefung", label: "Prüfung", hint: "Eine angekündigte Prüfung oder Schularbeit." },
  { value: "notiz", label: "Notiz", hint: "Eine Notiz für dich." },
  { value: "datei", label: "Datei", hint: "Eine Datei an diese Stunde hängen." },
];

const DRAFT_PREFIX = "erfassen";

export function QuickCapture({
  open,
  onClose,
  onSaved,
  defaultLessonId,
  candidateBlocks,
}: {
  open: boolean;
  onClose: () => void;
  /** Meldet die gewählte Sichtbarkeit, damit der aufrufende Bildschirm den
   *  neuen Eintrag auch zeigt und nicht hinter einem Reiter versteckt. */
  onSaved?: (audience: Audience) => void;
  defaultLessonId: string | null;
  candidateBlocks: LessonBlock[];
}) {
  const { snapshot, store, mutate, today } = useDock();

  const [kind, setKind] = useState<EntryKind>("hausuebung");
  const [lessonId, setLessonId] = useState<string | null>(defaultLessonId);
  const [text, setText] = useState("");
  const [detail, setDetail] = useState("");
  const [audience, setAudience] = useState<Audience>("privat");
  const [dueKind, setDueKind] = useState<"nächste" | "datum" | "ohne">("nächste");
  const [dueDate, setDueDate] = useState(today);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("bereit");
  const [validationError, setValidationError] = useState<string | null>(null);

  const draftKey = `${DRAFT_PREFIX}:${kind}:${lessonId ?? "ohne"}`;

  useEffect(() => {
    if (!open) return;
    setLessonId(defaultLessonId);
  }, [open, defaultLessonId]);

  // Entwurf laden.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const draft = await store.getDraft(draftKey);
      if (!cancelled && draft !== null && text === "") setText(draft);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftKey, store]);

  // Entwurf sichern, kurz nachdem getippt wurde.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void store.saveDraft(draftKey, text);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [open, text, draftKey, store]);

  const lesson = useMemo(
    () => snapshot.lessons.find((l) => l.id === lessonId) ?? null,
    [snapshot.lessons, lessonId],
  );
  const course = lesson ? courseOf(snapshot, lesson.courseId) : undefined;

  // Wohin "nächste Stunde" zeigt – sichtbar und änderbar, nicht verborgen.
  const nextMeeting = useMemo(() => {
    if (!lesson) return null;
    return nextMeetingAfter(lesson, snapshot.lessons);
  }, [lesson, snapshot.lessons]);

  const braucht = {
    text: kind !== "datei",
    due: kind === "hausuebung" || kind === "mitbringen",
    detail: kind === "pruefung",
    file: kind === "datei",
  };

  function reset() {
    setText("");
    setDetail("");
    setFile(null);
    setFileError(null);
    setValidationError(null);
    setSaveState("bereit");
  }

  async function submit() {
    setValidationError(null);

    if (braucht.text && text.trim() === "") {
      setValidationError("Bitte gib einen Text ein.");
      return;
    }
    if (!lesson) {
      setValidationError("Bitte wähle eine Stunde.");
      return;
    }
    if (braucht.file && !file) {
      setValidationError("Bitte wähle eine Datei.");
      return;
    }

    setSaveState("speichert");

    let rule: DueRule | null = null;
    if (braucht.due) {
      if (dueKind === "nächste") rule = { kind: "NEXT_SUBJECT_LESSON", anchorLessonId: lesson.id };
      else if (dueKind === "datum") rule = { kind: "FIXED_DATE", date: dueDate };
      else rule = { kind: "NONE" };
    }

    const result = await mutate(async (s) => {
      if (kind === "pruefung") {
        await s.createAssessment({
          courseId: lesson.courseId,
          title: text.trim(),
          kind: "test",
          date: dueKind === "datum" ? dueDate : null,
          time: null,
          lessonId: dueKind === "nächste" ? (nextMeeting?.id ?? null) : null,
          scope: detail.trim(),
          audience,
        });
        return true;
      }

      if (kind === "datei" && file) {
        await s.attachFile({
          file,
          courseId: lesson.courseId,
          lessonId: lesson.id,
          entryId: null,
          assessmentId: null,
          audience,
        });
        return true;
      }

      await s.createEntry({
        kind,
        courseId: lesson.courseId,
        lessonId: lesson.id,
        blockKey: lesson.blockKey,
        text: text.trim(),
        detail: detail.trim() || null,
        audience,
        dueRule: rule,
      });
      return true;
    });

    if (result === undefined) {
      setSaveState("fehler");
      return;
    }

    await store.clearDraft(draftKey);
    setSaveState("gespeichert");
    onSaved?.(audience);
    reset();
    onClose();
  }

  const aktuelleArt = KINDS.find((k) => k.value === kind);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Erfassen"
      description={aktuelleArt?.hint}
      footer={
        <>
          <SaveIndicator state={saveState} />
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={submit}
            className="btn btn-primary"
            disabled={saveState === "speichert"}
          >
            Speichern
          </button>
        </>
      }
    >
      {/* Art */}
      <fieldset className="py-2">
        <legend className="t-small font-medium" style={{ color: "var(--ink-body)" }}>
          Art
        </legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {KINDS.map((option) => {
            const active = option.value === kind;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setKind(option.value)}
                className="min-h-[38px] rounded-lg px-3 text-[0.8125rem] font-medium"
                style={{
                  background: active ? "rgba(46, 74, 108, 0.85)" : "transparent",
                  color: active ? "var(--ink)" : "var(--ink-muted)",
                  border: active
                    ? "1px solid var(--line-strong)"
                    : "1px solid var(--line)",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Stunde – bei mehreren möglichen wird gefragt, nicht geraten. */}
      <Field
        label="Stunde"
        hint={
          candidateBlocks.length > 1
            ? "An der Grenze zwischen zwei Stunden kannst du wählen."
            : undefined
        }
      >
        {({ id, describedBy }) => (
          <select
            id={id}
            aria-describedby={describedBy}
            value={lessonId ?? ""}
            onChange={(event) => setLessonId(event.target.value || null)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">Keine Stunde gewählt</option>
            {candidateBlocks.map((block) => {
              const blockCourse = courseOf(snapshot, block.courseId);
              return (
                <option key={block.blockKey} value={block.lessons[0]?.id ?? ""}>
                  {formatTimeRange(block.startsAt, block.endsAt)} · {blockCourse?.displayName}
                </option>
              );
            })}
          </select>
        )}
      </Field>

      {braucht.text && (
        <Field
          label={kind === "behandelt" ? "Was wurde behandelt?" : "Text"}
          hint={
            kind === "hausuebung"
              ? "Schreib es so auf, wie es angesagt wurde, etwa: S. 84 Nr. 4–8"
              : undefined
          }
          error={validationError}
        >
          {({ id, describedBy }) => (
            <textarea
              id={id}
              aria-describedby={describedBy}
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              className={inputClass}
              style={inputStyle}
              placeholder={kind === "hausuebung" ? "S. 84 Nr. 4–8" : ""}
            />
          )}
        </Field>
      )}

      {braucht.detail && (
        <Field label="Stoff" hint="Was kommt in der Prüfung vor?">
          {({ id }) => (
            <textarea
              id={id}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              rows={2}
              className={inputClass}
              style={inputStyle}
            />
          )}
        </Field>
      )}

      {braucht.file && (
        <Field
          label="Datei"
          hint="PDF, DOCX, JPG, PNG oder WebP."
          error={fileError}
        >
          {({ id, describedBy }) => (
            <div>
              <input
                id={id}
                aria-describedby={describedBy}
                type="file"
                accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
                onChange={(event) => {
                  const chosen = event.target.files?.[0] ?? null;
                  setFileError(null);
                  if (!chosen) {
                    setFile(null);
                    return;
                  }
                  const check = validateUpload(chosen);
                  if (!check.ok) {
                    setFile(null);
                    setFileError(check.reason);
                    return;
                  }
                  setFile(chosen);
                }}
                className="w-full text-[0.875rem]"
              />
              {file && (
                <p className="t-caption mt-1.5">
                  {file.name} · {formatFileSize(file.size)}
                </p>
              )}
            </div>
          )}
        </Field>
      )}

      {braucht.due && (
        <Field label="Fällig">
          {({ id }) => (
            <div id={id}>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "nächste" as const, label: "Nächste Stunde" },
                  { value: "datum" as const, label: "Datum" },
                  { value: "ohne" as const, label: "Ohne" },
                ].map((option) => {
                  const active = option.value === dueKind;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDueKind(option.value)}
                      className="min-h-[38px] rounded-lg px-3 text-[0.8125rem] font-medium"
                      style={{
                        background: active
                          ? "rgba(46, 74, 108, 0.85)"
                          : "transparent",
                        color: active
                          ? "var(--ink)"
                          : "var(--ink-muted)",
                        border: active
                          ? "1px solid var(--line-strong)"
                          : "1px solid var(--line)",
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {/* Der vorgeschlagene Termin ist sichtbar und änderbar. */}
              {dueKind === "nächste" && (
                <p className="t-caption mt-2">
                  {nextMeeting
                    ? `Nächste ${course?.displayName ?? ""}stunde · ${describeDateRelative(nextMeeting.date, today)}, ${nextMeeting.startsAt}`
                    : "Nächste Stunde noch nicht geplant."}
                </p>
              )}

              {dueKind === "datum" && (
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className={`${inputClass} mt-2`}
                  style={inputStyle}
                  aria-label="Fälligkeitsdatum"
                />
              )}
            </div>
          )}
        </Field>
      )}

      {/* Sichtbarkeit – immer sichtbar, nie versteckt. */}
      <Field
        label="Sichtbar für"
        hint={
          audience === "privat"
            ? "Nur du siehst diesen Eintrag."
            : "Alle im Kurs sehen diesen Eintrag. Dein Erledigt-Status bleibt privat."
        }
      >
        {({ id }) => (
          <div id={id} className="flex gap-1.5">
            {[
              { value: "privat" as const, label: "Privat" },
              { value: "kurs" as const, label: "Klasse" },
            ].map((option) => {
              const active = option.value === audience;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setAudience(option.value)}
                  className="min-h-[40px] flex-1 rounded-lg px-3 text-[0.8125rem] font-medium"
                  style={{
                    background: active ? "rgba(46, 74, 108, 0.85)" : "transparent",
                    color: active ? "var(--ink)" : "var(--ink-muted)",
                    border: active
                      ? "1px solid var(--line-strong)"
                      : "1px solid var(--line)",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
      </Field>

      {audience === "kurs" && (
        <div className="pb-2">
          <Notice tone="warn">
            Im lokalen Modus bleibt auch ein Klassen-Eintrag auf diesem Gerät.
            Er wird nicht an Mitschüler übertragen.
          </Notice>
        </div>
      )}
    </Sheet>
  );
}
