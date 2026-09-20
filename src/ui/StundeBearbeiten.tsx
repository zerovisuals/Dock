"use client";

/**
 * Eine Stunde ändern.
 *
 * Der Geltungsbereich wird ausdrücklich gewählt: nur diese Stunde oder diese
 * und alle künftigen. Vergangenes bleibt unangetastet, Inhalte bleiben an der
 * Stunde hängen.
 *
 * Ein Entfall ist ein selbst gepflegter Zustand, keine Mitteilung der Schule.
 */

import { useState } from "react";
import { Sheet, Field, inputClass, inputStyle, Notice, SaveIndicator, type SaveState } from "./primitives";
import { useDock } from "@/data/DockContext";
import type { LessonInstance } from "@/domain/types";
import { formatDateLong } from "@/domain/time";

type Bereich = "diese" | "kuenftige";

export function StundeBearbeiten({
  open,
  onClose,
  lesson,
}: {
  open: boolean;
  onClose: () => void;
  lesson: LessonInstance;
}) {
  const { mutate } = useDock();
  const [bereich, setBereich] = useState<Bereich>("diese");
  const [datum, setDatum] = useState(lesson.date);
  const [beginn, setBeginn] = useState(lesson.startsAt);
  const [ende, setEnde] = useState(lesson.endsAt);
  const [grund, setGrund] = useState("");
  const [zustand, setZustand] = useState<SaveState>("bereit");
  const [fehler, setFehler] = useState<string | null>(null);

  async function verschieben() {
    if (beginn >= ende) {
      setFehler("Das Ende muss nach dem Beginn liegen.");
      return;
    }
    setFehler(null);
    setZustand("speichert");

    const ergebnis = await mutate(async (store) => {
      if (bereich === "diese") {
        await store.moveLesson(lesson.id, datum, beginn, ende);
      } else if (lesson.seriesId) {
        // Ab dem Datum dieser Stunde gilt die neue Zeit für die ganze Serie.
        await store.editSeriesFrom(lesson.seriesId, lesson.date, {
          startsAt: beginn,
          endsAt: ende,
        });
      }
      return true;
    });

    if (ergebnis === undefined) {
      setZustand("fehler");
      return;
    }
    setZustand("gespeichert");
    onClose();
  }

  async function entfallen() {
    setZustand("speichert");
    const ergebnis = await mutate((store) =>
      store.setLessonStatus(lesson.id, "entfallen", grund.trim() || null),
    );
    if (ergebnis === undefined) {
      setZustand("fehler");
      return;
    }
    onClose();
  }

  async function wiederherstellen() {
    setZustand("speichert");
    const ergebnis = await mutate((store) =>
      store.setLessonStatus(lesson.id, "geplant", null),
    );
    if (ergebnis === undefined) {
      setZustand("fehler");
      return;
    }
    onClose();
  }

  const entfaellt = lesson.status === "entfallen";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Stunde ändern"
      description={formatDateLong(lesson.date)}
      footer={
        <>
          <SaveIndicator state={zustand} />
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={verschieben}
            className="btn btn-primary"
            disabled={zustand === "speichert"}
          >
            Speichern
          </button>
        </>
      }
    >
      {/* Geltungsbereich */}
      <fieldset className="py-2">
        <legend className="t-small font-medium" style={{ color: "var(--ink-body)" }}>
          Gilt für
        </legend>
        <div className="mt-2 flex gap-1.5">
          {[
            { value: "diese" as const, label: "Diese Stunde" },
            { value: "kuenftige" as const, label: "Diese und künftige" },
          ].map((option) => {
            const aktiv = option.value === bereich;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={aktiv}
                onClick={() => setBereich(option.value)}
                disabled={option.value === "kuenftige" && lesson.seriesId === null}
                className="min-h-[40px] flex-1 rounded-xl px-3 text-[0.8125rem] font-medium"
                style={{
                  background: aktiv ? "rgba(46, 74, 108, 0.85)" : "transparent",
                  color: aktiv ? "var(--ink)" : "var(--ink-muted)",
                  border: aktiv
                    ? "1px solid var(--line-strong)"
                    : "1px solid var(--line)",
                  opacity:
                    option.value === "kuenftige" && lesson.seriesId === null
                      ? 0.4
                      : 1,
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {bereich === "kuenftige" && (
          <p className="t-caption mt-2">
            Ab dem {formatDateLong(lesson.date)}. Frühere Stunden behalten ihre
            Zeiten und ihre Inhalte.
          </p>
        )}
      </fieldset>

      {bereich === "diese" && (
        <Field label="Datum">
          {({ id }) => (
            <input
              id={id}
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          )}
        </Field>
      )}

      <div className="flex flex-col gap-0 sm:flex-row sm:gap-4">
        <div className="min-w-0 flex-1">
          <Field label="Beginn" error={fehler}>
            {({ id }) => (
              <input
                id={id}
                type="time"
                value={beginn}
                onChange={(e) => setBeginn(e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            )}
          </Field>
        </div>
        <div className="min-w-0 flex-1">
          <Field label="Ende">
            {({ id }) => (
              <input
                id={id}
                type="time"
                value={ende}
                onChange={(e) => setEnde(e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            )}
          </Field>
        </div>
      </div>

      <div className="mt-4 pb-2" style={{ borderTop: "1px solid var(--line)" }}>
        <p className="t-heading mt-4">Entfall</p>
        {entfaellt ? (
          <>
            <p className="t-small mt-1">
              Diese Stunde ist als entfallen eingetragen
              {lesson.statusNote ? `: ${lesson.statusNote}` : "."}
            </p>
            <button
              type="button"
              onClick={wiederherstellen}
              className="btn btn-secondary mt-3"
            >
              Entfall zurücknehmen
            </button>
          </>
        ) : (
          <>
            <Field label="Grund" hint="Wird nur dir angezeigt. Freiwillig.">
              {({ id }) => (
                <input
                  id={id}
                  type="text"
                  value={grund}
                  onChange={(e) => setGrund(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              )}
            </Field>
            <button type="button" onClick={entfallen} className="btn btn-danger mt-2">
              Stunde entfällt
            </button>
            <div className="mt-3">
              <Notice>
                Notizen, Dateien und Aufgaben bleiben erhalten. Fällige Arbeit,
                die auf diese Stunde zeigt, bekommt ein neues Ziel und wird
                gekennzeichnet.
              </Notice>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
