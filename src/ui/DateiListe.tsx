"use client";

/**
 * Angehängte Dateien: ansehen, herunterladen, löschen.
 *
 * Der Inhalt liegt im lokalen Speicher und wird erst beim Öffnen geladen.
 * Für Bilder und PDF gibt es eine Vorschau, für alles andere den ehrlichen
 * Weg über das Herunterladen.
 *
 * Dateiinhalte werden nie ausgeführt und nie ausgewertet. Die Vorschau läuft
 * in einem abgeschotteten Rahmen.
 */

import { useEffect, useState } from "react";
import { GroupedList } from "./LessonList";
import { AudienceBadge, Notice, Sheet } from "./primitives";
import { IconFile, IconTrash } from "./icons";
import { useDock } from "@/data/DockContext";
import { formatFileSize } from "@/data/repository";
import type { StoredDocument } from "@/domain/types";

const VORSCHAU_FAEHIG = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export function DateiListe({
  dokumente,
  label = "Dateien",
}: {
  dokumente: StoredDocument[];
  label?: string;
}) {
  const { store, mutate } = useDock();
  const [offen, setOffen] = useState<StoredDocument | null>(null);
  const [quelle, setQuelle] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState<StoredDocument | null>(null);

  // Die Adresse des Inhalts wird wieder freigegeben, sobald sie nicht mehr
  // gebraucht wird – sonst bleibt der Speicher belegt.
  useEffect(() => {
    if (!offen) return;
    let verworfen = false;
    let adresse: string | null = null;

    (async () => {
      setFehler(null);
      setQuelle(null);
      try {
        const inhalt = await store.getFile(offen.id);
        if (!inhalt) {
          if (!verworfen) {
            setFehler("Der Inhalt dieser Datei ist nicht mehr vorhanden.");
          }
          return;
        }
        adresse = URL.createObjectURL(inhalt);
        if (verworfen) {
          URL.revokeObjectURL(adresse);
          return;
        }
        setQuelle(adresse);
      } catch {
        if (!verworfen) setFehler("Die Datei konnte nicht geladen werden.");
      }
    })();

    return () => {
      verworfen = true;
      if (adresse) URL.revokeObjectURL(adresse);
    };
  }, [offen, store]);

  async function herunterladen(dokument: StoredDocument) {
    try {
      const inhalt = await store.getFile(dokument.id);
      if (!inhalt) {
        setFehler("Der Inhalt dieser Datei ist nicht mehr vorhanden.");
        return;
      }
      const adresse = URL.createObjectURL(inhalt);
      const verweis = document.createElement("a");
      verweis.href = adresse;
      verweis.download = dokument.name;
      verweis.click();
      URL.revokeObjectURL(adresse);
    } catch {
      setFehler("Die Datei konnte nicht geladen werden.");
    }
  }

  if (dokumente.length === 0) return null;

  return (
    <>
      <GroupedList label={label}>
        {dokumente.map((dokument) => (
          <div key={dokument.id} className="flex items-center gap-3 px-5 py-3.5">
            <button
              type="button"
              onClick={() => setOffen(dokument)}
              className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
            >
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                <IconFile size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-[0.9375rem] font-semibold"
                  style={{ color: "var(--ink)" }}
                >
                  {dokument.name}
                </span>
                <span className="t-caption mt-0.5 block">
                  {formatFileSize(dokument.sizeBytes)}
                </span>
              </span>
            </button>

            <AudienceBadge audience={dokument.audience} />

            <button
              type="button"
              onClick={() => setLoeschen(dokument)}
              aria-label={`${dokument.name} löschen`}
              className="btn btn-quiet shrink-0 px-2"
            >
              <IconTrash size={17} />
            </button>
          </div>
        ))}
      </GroupedList>

      {fehler && (
        <div className="mt-3">
          <Notice tone="danger">{fehler}</Notice>
        </div>
      )}

      {/* Ansehen */}
      <Sheet
        open={offen !== null}
        onClose={() => setOffen(null)}
        title={offen?.name ?? "Datei"}
        description={
          offen ? `${formatFileSize(offen.sizeBytes)} · auf diesem Gerät` : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => offen && herunterladen(offen)}
              className="btn btn-primary btn-block"
            >
              Herunterladen
            </button>
            <button
              type="button"
              onClick={() => setOffen(null)}
              className="btn btn-quiet btn-block"
            >
              Schließen
            </button>
          </>
        }
      >
        <div className="pb-2">
          {offen && !VORSCHAU_FAEHIG.includes(offen.mimeType) ? (
            <Notice>
              Für diesen Dateityp gibt es keine Vorschau. Lad die Datei herunter,
              um sie zu öffnen.
            </Notice>
          ) : quelle === null ? (
            <p className="t-small py-6" role="status">
              Wird geladen …
            </p>
          ) : offen?.mimeType === "application/pdf" ? (
            // Abgeschottet: der Inhalt darf nichts ausführen.
            <iframe
              src={quelle}
              title={offen.name}
              sandbox=""
              className="h-[60vh] w-full rounded-[14px]"
              style={{ border: "1px solid var(--line)" }}
            />
          ) : (
            <img
              src={quelle}
              alt={offen?.name ?? ""}
              className="w-full rounded-[14px]"
              style={{ border: "1px solid var(--line)" }}
            />
          )}
        </div>
      </Sheet>

      {/* Löschen – mit Rückfrage, weil es nicht rückgängig zu machen ist. */}
      <Sheet
        open={loeschen !== null}
        onClose={() => setLoeschen(null)}
        title="Datei löschen?"
        description={loeschen?.name}
        footer={
          <>
            <button
              type="button"
              onClick={async () => {
                if (!loeschen) return;
                await mutate((s) => s.deleteDocument(loeschen.id));
                setLoeschen(null);
              }}
              className="btn btn-danger btn-block"
            >
              Endgültig löschen
            </button>
            <button
              type="button"
              onClick={() => setLoeschen(null)}
              className="btn btn-quiet btn-block"
            >
              Abbrechen
            </button>
          </>
        }
      >
        <div className="pb-2">
          <Notice tone="warn">
            Die Datei und ihr Inhalt werden von diesem Gerät entfernt. Das lässt
            sich nicht rückgängig machen.
          </Notice>
        </div>
      </Sheet>
    </>
  );
}
