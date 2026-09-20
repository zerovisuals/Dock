"use client";

/**
 * Einstellungen.
 *
 * Wo die Daten liegen, wie du sie mitnimmst und wie du sie löschst. Dazu
 * Darstellung, Vorschau-Uhr und die Angaben zum Stundenplan.
 *
 * Über die Installation wird nur gesagt, was in diesem Browser wirklich
 * möglich ist.
 */

import { useEffect, useMemo, useState } from "react";
import { AppShell, ScreenHeader } from "@/ui/AppShell";
import { GroupedList, SectionTitle, Badge } from "@/ui/LessonList";
import {
  ChipGroup,
  Field,
  inputClass,
  LoadingLine,
  Notice,
  SaveIndicator,
  type SaveState,
} from "@/ui/primitives";
import { useDock } from "@/data/DockContext";
import { SOURCE_DOCUMENT_TITLE, UNSELECTED_OFFERINGS } from "@/domain/seed";
import { PERIODS } from "@/domain/periods";
import { formatDateLong, weekdayNameFor } from "@/domain/time";

type Thema = "system" | "hell" | "dunkel";

export default function EinstellungenPage() {
  const {
    snapshot,
    status,
    store,
    today,
    previewClock,
    setPreviewClock,
    mutate,
  } = useDock();

  const [thema, setThema] = useState<Thema>("system");
  const [exportZustand, setExportZustand] = useState<SaveState>("bereit");
  const [loeschBestaetigung, setLoeschBestaetigung] = useState("");
  const [installierbar, setInstallierbar] = useState<boolean | null>(null);
  const [vorschauZeit, setVorschauZeit] = useState("2026-10-12T09:15");

  // Darstellung merken – nur diese eine Vorliebe, lokal.
  useEffect(() => {
    const gespeichert = window.localStorage.getItem("dock:thema") as Thema | null;
    if (gespeichert) {
      setThema(gespeichert);
      anwenden(gespeichert);
    }
  }, []);

  function anwenden(wert: Thema) {
    const wurzel = document.documentElement;
    if (wert === "system") wurzel.removeAttribute("data-theme");
    else wurzel.setAttribute("data-theme", wert === "hell" ? "light" : "dark");
  }

  function themaWaehlen(wert: Thema) {
    setThema(wert);
    anwenden(wert);
    try {
      window.localStorage.setItem("dock:thema", wert);
    } catch {
      // Ohne lokalen Speicher bleibt die Wahl für diese Sitzung bestehen.
    }
  }

  // Ob die Installation angeboten werden kann, entscheidet der Browser.
  useEffect(() => {
    const bereitsInstalliert =
      window.matchMedia("(display-mode: standalone)").matches;
    if (bereitsInstalliert) {
      setInstallierbar(false);
      return;
    }
    const handler = () => setInstallierbar(true);
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const kennzahlen = useMemo(
    () => ({
      kurse: snapshot.courses.length,
      stunden: snapshot.lessons.length,
      eintraege: snapshot.entries.length,
      dateien: snapshot.documents.length,
    }),
    [snapshot],
  );

  async function exportieren() {
    setExportZustand("speichert");
    try {
      const { json, files } = await store.exportAll();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dock-export-${today}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Dateien einzeln, damit nichts stillschweigend fehlt.
      for (const datei of files) {
        const dateiUrl = URL.createObjectURL(datei.blob);
        const link = document.createElement("a");
        link.href = dateiUrl;
        link.download = datei.name;
        link.click();
        URL.revokeObjectURL(dateiUrl);
      }
      setExportZustand("gespeichert");
    } catch {
      setExportZustand("fehler");
    }
  }

  async function allesLoeschen() {
    if (loeschBestaetigung !== "LÖSCHEN") return;
    await mutate((s) => s.deleteEverything());
    window.location.href = "/app";
  }

  if (status === "laedt") {
    return (
      <AppShell>
        <LoadingLine />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScreenHeader title="Einstellungen" />

      {/* Daten */}
      <SectionTitle>Deine Daten</SectionTitle>
      <div className="card px-6 py-6">
        <p className="t-title">Auf diesem Gerät</p>
        <p className="t-small mt-2">
          Alles liegt im Speicher dieses Browsers. Es überlebt das Neuladen und
          das Schließen des Browsers. Es wird nicht synchronisiert und nicht
          mit anderen geteilt.
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-4">
          {[
            ["Kurse", kennzahlen.kurse],
            ["Stunden", kennzahlen.stunden],
            ["Einträge", kennzahlen.eintraege],
            ["Dateien", kennzahlen.dateien],
          ].map(([label, wert]) => (
            <div key={String(label)} className="sunken px-4 py-3">
              <dt className="t-label">{label}</dt>
              <dd className="t-data mt-1" style={{ fontSize: "1.5rem" }}>
                {wert}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={exportieren}
            className="btn btn-secondary btn-block"
          >
            Daten exportieren
          </button>
          <SaveIndicator
            state={exportZustand}
            error="Der Export ist fehlgeschlagen."
          />
          <p className="t-caption">
            Der Export enthält den Stundenplan, deine Einträge, Aufgaben und
            alle Dateien. Die Dateien werden einzeln geladen.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Notice>
          Geteilter Klassenmodus braucht ein eingerichtetes Backend. Solange
          keines verbunden ist, bleibt auch ein Eintrag mit der Sichtbarkeit
          „Klasse“ auf diesem Gerät.
        </Notice>
      </div>

      {/* Darstellung */}
      <SectionTitle>Darstellung</SectionTitle>
      <div className="card px-6 py-6">
        <p className="t-label mb-3">Erscheinungsbild</p>
        <ChipGroup
          label="Erscheinungsbild"
          value={thema}
          onChange={themaWaehlen}
          options={[
            { value: "system", label: "Wie das System" },
            { value: "hell", label: "Hell" },
            { value: "dunkel", label: "Dunkel" },
          ]}
        />
      </div>

      {/* Stundenplan */}
      <SectionTitle>Stundenplan</SectionTitle>
      <div className="card px-6 py-6">
        <p className="t-title">Wiederholt sich wöchentlich, ohne Ende</p>
        <p className="t-small mt-2">
          Der Plan ist seit dem {formatDateLong(snapshot.series[0]?.effectiveFrom ?? today)}{" "}
          aktiv und läuft ohne Enddatum weiter. Es gibt kein Schuljahresende, an
          dem er abläuft.
        </p>
        <p className="t-caption mt-3">
          Quelle: {SOURCE_DOCUMENT_TITLE}. Die Daten des Quelldokuments sind
          reine Herkunftsangabe, kein Anfang und kein Ende.
        </p>
      </div>

      <div className="mt-4">
        <details className="card px-6 py-5">
          <summary className="t-heading cursor-pointer">
            Nicht gewählte Angebote der Klasse
          </summary>
          <p className="t-small mt-3">
            Diese Angebote stehen im Quelldokument, gehören aber nicht zu
            deinem Plan. Sie sind hier nur, damit die Auswahl nachvollziehbar
            bleibt.
          </p>
          <ul className="mt-4 space-y-2.5">
            {UNSELECTED_OFFERINGS.map((angebot, i) => (
              <li key={i} className="flex items-start gap-3">
                <Badge>
                  {weekdayNameFor(angebot.weekday).slice(0, 2)}{" "}
                  {angebot.periods.join("–")}
                </Badge>
                <span className="t-small min-w-0 flex-1">
                  {angebot.sourceLabel} — {angebot.note}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <div className="mt-4">
        <details className="card px-6 py-5">
          <summary className="t-heading cursor-pointer">Stundenraster</summary>
          <p className="t-small mt-3">
            Die Zeiten der Stunden 1 bis 6 sind im Quelldokument beschriftet.
            Die Beginnzeiten ab der 7. Stunde folgen den Zeilengrenzen und sind
            nicht eigenständig bestätigt.
          </p>
          <ul className="mt-4 space-y-1.5">
            {PERIODS.map((periode) => (
              <li key={periode.index} className="flex items-baseline gap-3">
                <span className="t-caption w-6 shrink-0">{periode.index}.</span>
                <span className="t-num t-small">
                  {periode.startsAt}–{periode.endsAt}
                </span>
                {periode.index >= 7 && (
                  <span className="t-caption">nicht bestätigt</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      </div>

      {/* Installation */}
      <SectionTitle>Installation</SectionTitle>
      <div className="card px-6 py-6">
        {installierbar === true ? (
          <>
            <p className="t-title">Dock lässt sich installieren</p>
            <p className="t-small mt-2">
              Dein Browser bietet die Installation an. Suche im Menü nach
              „Zum Startbildschirm hinzufügen“ oder „App installieren“.
            </p>
          </>
        ) : (
          <>
            <p className="t-title">So legst du Dock auf den Startbildschirm</p>
            <p className="t-small mt-2">
              Dieser Browser bietet keine automatische Installation an. Auf
              iPhone und iPad: in Safari auf „Teilen“ und dann auf „Zum
              Home-Bildschirm“. In Chrome auf Android: im Menü auf „App
              installieren“.
            </p>
            <p className="t-caption mt-3">
              Eine als Web-App installierte Anwendung kann nicht alles, was
              eine aus dem App Store kann. Im Browser funktioniert Dock
              vollständig.
            </p>
          </>
        )}
      </div>

      {/* Vorschau-Uhr */}
      <SectionTitle>Vorschau-Uhr</SectionTitle>
      <div className="card px-6 py-2">
        <p className="t-small pt-4">
          Für Gestaltung und Prüfung. Sie stellt nur die Anzeige um und ist
          immer sichtbar gekennzeichnet. Deine echte Uhr bleibt unberührt.
        </p>
        <Field label="Zeitpunkt">
          {({ id }) => (
            <input
              id={id}
              type="datetime-local"
              value={vorschauZeit}
              onChange={(e) => setVorschauZeit(e.target.value)}
              className={inputClass}
            />
          )}
        </Field>
        <div className="flex flex-col gap-3 pb-5">
          <button
            type="button"
            onClick={() => {
              const [datum, zeit] = vorschauZeit.split("T");
              if (datum && zeit) {
                window.location.href = `/app?vorschau=${datum}T${zeit.slice(0, 5)}`;
              }
            }}
            className="btn btn-secondary btn-block"
          >
            Vorschau-Uhr stellen
          </button>
          {previewClock && (
            <button
              type="button"
              onClick={async () => {
                await setPreviewClock(null);
                window.location.href = "/app";
              }}
              className="btn btn-quiet btn-block"
            >
              Vorschau-Uhr ausschalten
            </button>
          )}
        </div>
      </div>

      {/* Löschen */}
      <SectionTitle>Alles löschen</SectionTitle>
      <div className="card px-6 py-6">
        <p className="t-title">Daten unwiderruflich löschen</p>
        <p className="t-small mt-2">
          Löscht den Stundenplan, alle Einträge, Aufgaben und Dateien von
          diesem Gerät. Das lässt sich nicht rückgängig machen. Exportiere
          vorher, wenn du etwas behalten willst.
        </p>
        <Field
          label="Tipp LÖSCHEN, um zu bestätigen"
          hint="Die Eingabe verhindert ein Löschen aus Versehen."
        >
          {({ id }) => (
            <input
              id={id}
              type="text"
              value={loeschBestaetigung}
              onChange={(e) => setLoeschBestaetigung(e.target.value)}
              className={inputClass}
              autoComplete="off"
            />
          )}
        </Field>
        <button
          type="button"
          onClick={allesLoeschen}
          disabled={loeschBestaetigung !== "LÖSCHEN"}
          className="btn btn-danger btn-block mt-2"
        >
          Alle Daten löschen
        </button>
      </div>

      <p className="t-caption mt-8">
        Dock speichert keine Schulpasswörter, keine Noten und keine Angaben zu
        Lehrpersonen.
      </p>
    </AppShell>
  );
}
