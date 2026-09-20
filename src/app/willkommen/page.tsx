"use client";

/**
 * Willkommen.
 *
 * Kein Konto und keine Anmeldung: Der Stundenplan ist bereits angelegt und
 * aktiv. Dieser Ablauf zeigt, was schon da ist, nimmt Schule und Klasse auf
 * und lässt dich deine Auswahl prüfen.
 *
 * Er ist überspringbar. Nichts hier schaltet die Wiederholung frei und
 * nichts fragt nach einem Zeitraum – beides ist bereits gesetzt.
 *
 * Schule und Klasse sind echte Felder: sie werden gespeichert und in
 * Einstellungen und Export wieder ausgegeben. Eine Verbindung zu einem
 * Schulsystem entsteht dadurch nicht, und das wird auch so gesagt.
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DockProvider, useDock } from "@/data/DockContext";
import { blocksOn, courseOf } from "@/data/store";
import { CourseDot } from "@/ui/primitives";
import {
  IconAssessment,
  IconBring,
  IconCheck,
  IconChevronLeft,
  IconCovered,
  IconFile,
  IconNote,
  IconTasks,
} from "@/ui/icons";
import {
  addDays,
  startOfWeek,
  weekdayShortFor,
  type Weekday,
} from "@/domain/time";

const ABGESCHLOSSEN = "dock:willkommen";

/** Die Schritte nach dem Auftritt. */
const SCHRITTE = ["schule", "klasse", "plan", "auswahl", "erfassen"] as const;
type Schritt = (typeof SCHRITTE)[number];

export default function WillkommenPage() {
  return (
    <DockProvider>
      <Willkommen />
    </DockProvider>
  );
}

function Willkommen() {
  const router = useRouter();
  const { store, status } = useDock();

  const [auftritt, setAuftritt] = useState(true);
  const [index, setIndex] = useState(0);
  const [schule, setSchule] = useState("");
  const [klasse, setKlasse] = useState("");

  // Vorbelegen mit dem, was bereits gespeichert ist.
  useEffect(() => {
    if (status !== "bereit") return;
    let abgebrochen = false;
    void store.schoolAndClass().then((werte) => {
      if (abgebrochen) return;
      setSchule(werte.school);
      setKlasse(werte.klasse);
    });
    return () => {
      abgebrochen = true;
    };
  }, [store, status]);

  const schritt = SCHRITTE[index] as Schritt;

  async function fertig() {
    await store.setSchoolAndClass(schule, klasse);
    try {
      window.localStorage.setItem(ABGESCHLOSSEN, "1");
    } catch {
      // Ohne lokalen Speicher wird der Ablauf erneut angeboten. Unschön,
      // aber harmlos.
    }
    router.push("/app");
  }

  async function weiter() {
    if (index === SCHRITTE.length - 1) {
      await fertig();
      return;
    }
    // Schule und Klasse werden gleich beim Weitergehen gesichert.
    if (schritt === "klasse") await store.setSchoolAndClass(schule, klasse);
    setIndex((i) => i + 1);
  }

  if (auftritt) {
    return (
      <Splash onWeiter={() => setAuftritt(false)} onUeberspringen={fertig} />
    );
  }

  const letzter = index === SCHRITTE.length - 1;

  return (
    <div className="onb-screen" style={{ background: "var(--bg)" }}>
      <header className="flex items-center justify-between px-6 pt-safe">
        <button
          type="button"
          onClick={() => (index === 0 ? setAuftritt(true) : setIndex((i) => i - 1))}
          aria-label="Zurück"
          className="btn btn-round mt-4"
        >
          <IconChevronLeft size={20} />
        </button>
        <button type="button" onClick={fertig} className="btn btn-quiet mt-4">
          Überspringen
        </button>
      </header>

      <main className="flex flex-1 flex-col justify-center px-6 pb-4">
        {schritt === "schule" && (
          <SchrittFeld
            stage={<SchuleBuehne schule={schule} klasse={klasse} />}
            titel={
              <>
                An welcher Schule
                <br />
                bist du?
              </>
            }
            text="Steht in den Einstellungen und im Export. Dock verbindet sich mit keinem Schulsystem."
            label="Schule"
            wert={schule}
            onWert={setSchule}
            platzhalter="z. B. BG/BRG Tulln"
            autoFocus
          />
        )}

        {schritt === "klasse" && (
          <SchrittFeld
            stage={<SchuleBuehne schule={schule} klasse={klasse} />}
            titel={
              <>
                Und in welcher
                <br />
                Klasse?
              </>
            }
            text="Später kannst du deine Klasse einladen. Solange kein Backend eingerichtet ist, bleibt alles auf diesem Gerät."
            label="Klasse"
            wert={klasse}
            onWert={setKlasse}
            platzhalter="z. B. 7c"
          />
        )}

        {schritt === "plan" && <SchrittPlan />}
        {schritt === "auswahl" && <SchrittAuswahl />}
        {schritt === "erfassen" && <SchrittErfassen />}
      </main>

      <footer className="px-6 pb-8 pb-safe">
        <div
          className="mb-5 flex items-center justify-center gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={SCHRITTE.length}
          aria-valuenow={index + 1}
          aria-label={`Schritt ${index + 1} von ${SCHRITTE.length}`}
        >
          {SCHRITTE.map((name, i) => (
            <span key={name} className="onb-dot" data-active={i === index} />
          ))}
        </div>

        <button
          type="button"
          onClick={weiter}
          className="btn btn-primary btn-block"
        >
          {letzter ? "Dock öffnen" : "Weiter"}
        </button>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Der Auftritt
   ------------------------------------------------------------------------- */

function Splash({
  onWeiter,
  onUeberspringen,
}: {
  onWeiter: () => void;
  onUeberspringen: () => void;
}) {
  return (
    <div className="onb-screen onb-splash">
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8">
        <div className="onb-tile flex h-[108px] w-[108px] items-center justify-center">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "3.75rem",
              fontWeight: 700,
              letterSpacing: "-0.055em",
              lineHeight: 1,
              backgroundImage:
                "linear-gradient(150deg, #16b8ae 0%, #2f6be0 50%, #6b4bd6 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            D
          </span>
        </div>

        <p
          className="mt-8 text-[2.25rem] font-bold text-white"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.04em" }}
        >
          Dock
        </p>
        <p
          className="mt-3 max-w-[20ch] text-center text-[1.125rem] leading-[1.4]"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          Dein Schultag.
          <br />
          Alles an seinem Platz.
        </p>
      </div>

      <div className="relative z-10 px-6 pb-10 pb-safe">
        <button
          type="button"
          onClick={onWeiter}
          className="btn btn-block"
          style={{
            background: "#ffffff",
            color: "#16225c",
            boxShadow:
              "0 2px 6px rgba(6,22,60,0.24), 0 14px 32px rgba(6,22,60,0.3)",
          }}
        >
          Los geht’s
        </button>
        <button
          type="button"
          onClick={onUeberspringen}
          className="btn btn-block mt-2"
          style={{
            background: "transparent",
            color: "rgba(255,255,255,0.9)",
            boxShadow: "none",
          }}
        >
          Direkt zur App
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Ein Schritt mit Eingabefeld
   ------------------------------------------------------------------------- */

function SchrittFeld({
  stage,
  titel,
  text,
  label,
  wert,
  onWert,
  platzhalter,
  autoFocus,
}: {
  stage: React.ReactNode;
  titel: React.ReactNode;
  text: string;
  label: string;
  wert: string;
  onWert: (wert: string) => void;
  platzhalter: string;
  autoFocus?: boolean;
}) {
  return (
    <>
      <div className="onb-stage mt-3">
        <div className="onb-stage-inner">{stage}</div>
      </div>

      <h1
        className="t-display mt-7"
        style={{ fontSize: "2.125rem", lineHeight: 1.04 }}
      >
        {titel}
      </h1>
      <p className="t-body mt-3 max-w-[36ch]">{text}</p>

      <label className="t-label mt-6 block" htmlFor="onb-feld">
        {label}
      </label>
      <input
        id="onb-feld"
        type="text"
        value={wert}
        onChange={(event) => onWert(event.target.value)}
        placeholder={platzhalter}
        autoFocus={autoFocus}
        autoComplete="off"
        className="dock-input mt-2 min-h-[52px] w-full px-4 py-3 text-[1.0625rem] font-semibold"
      />
    </>
  );
}

/** Eine Karte, die zeigt, wofür Schule und Klasse stehen. */
function SchuleBuehne({ schule, klasse }: { schule: string; klasse: string }) {
  return (
    <div className="px-5 py-6">
      <p className="t-label">Deine Angaben</p>
      <p
        className="mt-2 text-[1.375rem] font-bold leading-tight"
        style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.028em", color: "var(--ink)" }}
      >
        {schule.trim() === "" ? "Noch keine Schule" : schule}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-[0.8125rem] font-semibold"
          style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
        >
          {klasse.trim() === "" ? "Klasse offen" : `Klasse ${klasse}`}
        </span>
        <span className="t-caption">wird gespeichert</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Der Stundenplan ist schon da
   ------------------------------------------------------------------------- */

function SchrittPlan() {
  const { snapshot, today } = useDock();

  const woche = useMemo(() => {
    const montag = startOfWeek(today);
    return Array.from({ length: 5 }, (_, i) => {
      const datum = addDays(montag, i);
      return {
        weekday: (i + 1) as Weekday,
        blocks: blocksOn(snapshot, datum).slice(0, 4),
      };
    });
  }, [snapshot, today]);

  return (
    <>
      <div className="onb-stage mt-3">
        <div className="onb-stage-inner p-3.5">
          <div className="grid grid-cols-5 gap-1.5">
            {woche.map((tag) => (
              <div key={tag.weekday}>
                <p className="t-caption mb-1.5 text-center font-semibold">
                  {weekdayShortFor(tag.weekday)}
                </p>
                <div className="space-y-1.5">
                  {tag.blocks.map((block) => {
                    const kurs = courseOf(snapshot, block.courseId);
                    return (
                      <div
                        key={block.blockKey}
                        className="rounded-[9px] px-1.5 py-2"
                        style={{
                          background: `color-mix(in srgb, ${kurs?.accent ?? "#999"} 13%, var(--surface))`,
                          boxShadow: `inset 2.5px 0 0 0 ${kurs?.accent ?? "#999"}`,
                        }}
                      >
                        <p
                          className="truncate text-[0.625rem] font-bold leading-tight"
                          style={{ color: "var(--ink)" }}
                        >
                          {kurs?.shortLabel}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h1 className="t-display mt-7" style={{ fontSize: "2.125rem", lineHeight: 1.04 }}>
        Dein Stundenplan
        <br />
        ist schon da.
      </h1>
      <p className="t-body mt-3 max-w-[36ch]">
        Ab dieser Woche aktiv. Er wiederholt sich jede Woche – ohne Enddatum
        und ohne dass du etwas bestätigen musst.
      </p>
    </>
  );
}

/* -------------------------------------------------------------------------
   Die getroffene Auswahl
   ------------------------------------------------------------------------- */

const AUSWAHL: ReadonlyArray<{ titel: string; text: string }> = [
  { titel: "Spanisch statt Latein", text: "Dienstag, Donnerstag, Freitag" },
  { titel: "Kein Religionsunterricht, keine Ethik", text: "Diese Stunden bleiben frei" },
  { titel: "Sport von 08:00 bis 10:00", text: "Montag, bestätigte Endzeit" },
  { titel: "KUG von 13:40 bis 15:20", text: "Dienstag, Kursname noch offen" },
  { titel: "Mathematik Wahlpflichtfach", text: "Mittwoch, eigener Kurs" },
];

function SchrittAuswahl() {
  return (
    <>
      <div className="onb-stage mt-3">
        <div className="onb-stage-inner">
          <ul className="dock-divided">
            {AUSWAHL.map((eintrag) => (
              <li key={eintrag.titel} className="flex items-start gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
                  style={{ background: "var(--ok-soft)", color: "var(--ok)" }}
                >
                  <IconCheck size={13} />
                </span>
                <span className="min-w-0">
                  <span
                    className="block text-[0.8125rem] font-semibold leading-snug"
                    style={{ color: "var(--ink)" }}
                  >
                    {eintrag.titel}
                  </span>
                  <span className="t-caption block">{eintrag.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h1 className="t-display mt-7" style={{ fontSize: "2.125rem", lineHeight: 1.04 }}>
        Deine Auswahl
        <br />
        ist übernommen.
      </h1>
      <p className="t-body mt-3 max-w-[36ch]">
        Du wirst nicht noch einmal danach gefragt. Ändern kannst du alles
        jederzeit in der jeweiligen Stunde.
      </p>
    </>
  );
}

/* -------------------------------------------------------------------------
   Was du festhalten kannst
   ------------------------------------------------------------------------- */

const ARTEN = [
  { label: "Hausübung", Icon: IconTasks },
  { label: "Behandelt", Icon: IconCovered },
  { label: "Mitbringen", Icon: IconBring },
  { label: "Prüfung", Icon: IconAssessment },
  { label: "Notiz", Icon: IconNote },
  { label: "Datei", Icon: IconFile },
] as const;

function SchrittErfassen() {
  return (
    <>
      <div className="onb-stage mt-3">
        <div className="onb-stage-inner p-4">
          <div className="grid grid-cols-3 gap-2">
            {ARTEN.map(({ label, Icon }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center gap-1.5 rounded-[13px] px-1.5 py-3"
                style={{ background: "var(--surface-sunken)" }}
              >
                <span style={{ color: "var(--accent)" }}>
                  <Icon size={19} />
                </span>
                <span
                  className="text-[0.6875rem] font-semibold"
                  style={{ color: "var(--ink-body)" }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div
            className="mt-3 rounded-[13px] px-4 py-3"
            style={{ background: "var(--accent-soft)" }}
          >
            <p
              className="text-[0.9375rem] font-bold"
              style={{ color: "var(--ink)" }}
            >
              S. 84 Nr. 4–8
            </p>
            <p
              className="t-caption mt-0.5"
              style={{ color: "var(--accent-ink)" }}
            >
              Nächste Mathematikstunde · Mittwoch, 08:55
            </p>
          </div>
        </div>
      </div>

      <h1 className="t-display mt-7" style={{ fontSize: "2.125rem", lineHeight: 1.04 }}>
        Halt fest,
        <br />
        was gesagt wird.
      </h1>
      <p className="t-body mt-3 max-w-[36ch]">
        Aus der Stunde heraus, in ein paar Sekunden. Kurs und Termin sind schon
        vorbelegt.
      </p>
    </>
  );
}
