"use client";

/**
 * Ein geteilter Eintrag mit Bestätigungen und Korrekturvorschlägen.
 *
 * Eine Bestätigung gilt für genau die Fassung, die bestätigt wurde. Wird der
 * Text geändert, bleibt sie als Historie stehen und gilt nicht weiter – das
 * wird hier ausdrücklich angezeigt.
 *
 * Es werden nur echte Bestätigungen gezählt. Wo keine sind, steht null.
 */

import { useState } from "react";
import { Badge } from "./LessonList";
import { Field, inputClass, Notice, Sheet } from "./primitives";
import { IconCheck, IconEdit } from "./icons";
import { useDock } from "@/data/DockContext";
import {
  confirmationsForCurrentVersion,
  openCorrections,
  outdatedConfirmations,
} from "@/data/store";
import type { Entry } from "@/domain/types";

export function KlassenEintragFuss({ entry }: { entry: Entry }) {
  const { snapshot, userId, mutate } = useDock();
  const [vorschlagOffen, setVorschlagOffen] = useState(false);
  const [text, setText] = useState("");
  const [grund, setGrund] = useState("");

  if (entry.audience !== "kurs") return null;

  const aktuell = confirmationsForCurrentVersion(snapshot, entry);
  const veraltet = outdatedConfirmations(snapshot, entry);
  const offeneVorschlaege = openCorrections(snapshot, entry.id);
  const selbstBestaetigt = aktuell.some((c) => c.userId === userId);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            mutate((store) =>
              selbstBestaetigt
                ? store.withdrawConfirmation(entry.currentVersionId)
                : store.confirmVersion(entry.id, entry.currentVersionId),
            )
          }
          className="btn btn-secondary"
          style={
            selbstBestaetigt
              ? { background: "var(--ok-soft)", color: "var(--ok)" }
              : undefined
          }
          aria-pressed={selbstBestaetigt}
        >
          <IconCheck size={16} />
          {selbstBestaetigt ? "Bestätigt" : "Stimmt so"}
        </button>

        <button
          type="button"
          onClick={() => {
            setText("");
            setGrund("");
            setVorschlagOffen(true);
          }}
          className="btn btn-quiet"
        >
          <IconEdit size={16} />
          Korrektur vorschlagen
        </button>

        {/* Nur echte Zahlen. Ohne Bestätigung steht hier nichts. */}
        {aktuell.length > 0 && (
          <Badge tone="due">
            {aktuell.length === 1
              ? "1 Bestätigung"
              : `${aktuell.length} Bestätigungen`}
          </Badge>
        )}
      </div>

      {veraltet.length > 0 && (
        <p className="t-caption mt-2">
          {veraltet.length === 1
            ? "1 frühere Bestätigung"
            : `${veraltet.length} frühere Bestätigungen`}{" "}
          galt einer älteren Fassung und zählt für diesen Text nicht.
        </p>
      )}

      {offeneVorschlaege.length > 0 && (
        <div className="mt-3 space-y-2">
          {offeneVorschlaege.map((vorschlag) => (
            <div
              key={vorschlag.id}
              className="rounded-[14px] px-4 py-3"
              style={{ background: "var(--warn-soft)" }}
            >
              <p className="t-label" style={{ color: "var(--warn)" }}>
                Widerspruch
              </p>
              <p
                className="mt-1 text-[0.875rem] font-semibold"
                style={{ color: "var(--ink)" }}
              >
                {vorschlag.proposedText}
              </p>
              {vorschlag.rationale && (
                <p className="t-caption mt-1">{vorschlag.rationale}</p>
              )}
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    mutate((store) => store.acceptCorrection(vorschlag.id))
                  }
                  className="btn btn-secondary"
                >
                  Übernehmen
                </button>
                <button
                  type="button"
                  onClick={() =>
                    mutate((store) => store.rejectCorrection(vorschlag.id))
                  }
                  className="btn btn-quiet"
                >
                  Ablehnen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet
        open={vorschlagOffen}
        onClose={() => setVorschlagOffen(false)}
        title="Korrektur vorschlagen"
        description="Der Vorschlag ändert nichts. Er macht sichtbar, dass du es anders in Erinnerung hast."
        footer={
          <>
            <button
              type="button"
              onClick={async () => {
                if (text.trim() === "") return;
                await mutate((store) =>
                  store.proposeCorrection(
                    entry.id,
                    entry.currentVersionId,
                    text.trim(),
                    grund.trim() || null,
                  ),
                );
                setVorschlagOffen(false);
              }}
              className="btn btn-primary btn-block"
            >
              Vorschlag abschicken
            </button>
            <button
              type="button"
              onClick={() => setVorschlagOffen(false)}
              className="btn btn-quiet btn-block"
            >
              Abbrechen
            </button>
          </>
        }
      >
        <Field label="So sollte es heißen">
          {({ id }) => (
            <textarea
              id={id}
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Warum?" hint="Freiwillig.">
          {({ id }) => (
            <input
              id={id}
              type="text"
              value={grund}
              onChange={(event) => setGrund(event.target.value)}
              className={inputClass}
            />
          )}
        </Field>
        <div className="pb-2">
          <Notice>
            Wird der Vorschlag übernommen, entsteht eine neue Fassung.
            Bisherige Bestätigungen bleiben bei ihrer Fassung.
          </Notice>
        </div>
      </Sheet>
    </div>
  );
}
