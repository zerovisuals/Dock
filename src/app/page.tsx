/**
 * Die öffentliche Seite.
 *
 * Sie beschreibt das, was tatsächlich funktioniert. Keine erfundenen Stimmen,
 * keine Abzeichen, keine Nutzerzahlen, keine Behauptung einer Verbindung zu
 * einem Schulsystem.
 *
 * Die Vorschau zeigt erfundene Beispieldaten – nie den echten Stundenplan.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "@/ui/Wordmark";
import {
  IconBring,
  IconCatchUp,
  IconCheck,
  IconCovered,
  IconLock,
  IconTasks,
} from "@/ui/icons";

export const metadata: Metadata = {
  title: "Dock – Dein Schultag. Alles an seinem Platz.",
  description:
    "Dock hält Stundenplan, Notizen, Hausübungen und das Klassengedächtnis an der Stunde fest, zu der sie gehören.",
};

/* Erfundene Beispieldaten. Sie stammen aus keiner echten Klasse. */
const BEISPIELTAG = [
  { zeit: "08:00", bis: "08:50", fach: "Mathematik", kurz: "M", farbe: "#0e9f9f", jetzt: true },
  { zeit: "08:55", bis: "09:45", fach: "Deutsch", kurz: "D", farbe: "#b8860b" },
  { zeit: "10:00", bis: "11:40", fach: "Biologie", kurz: "BIO", farbe: "#3f8f45" },
];

export default function Startseite() {
  return (
    <div style={{ background: "var(--bg)" }}>
      <Kopfzeile />
      <main>
        <Hero />
        <Nutzen />
        <VonDerStundeZurAufgabe />
        <Klassengedaechtnis />
        <Start />
        <Schluss />
      </main>
      <Fusszeile />
    </div>
  );
}

function Kopfzeile() {
  return (
    <header className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-5">
      <Wordmark />
      <nav aria-label="Hauptnavigation" className="flex items-center gap-2">
        <Link href="/app" className="btn btn-quiet">
          Demo ansehen
        </Link>
        <Link href="/willkommen" className="btn btn-primary">
          Dock öffnen
        </Link>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-[1100px] overflow-hidden px-6 pt-10 pb-16 text-center sm:pt-16">
      <h1 className="t-display mx-auto max-w-[20ch]">
        Dein Schultag.
        <br />
        Alles an seinem Platz.
      </h1>
      <p className="t-body mx-auto mt-6 max-w-[46ch] text-[1.0625rem]">
        Die Schule hat längst Struktur. Dock baut sie nicht nach, sondern hängt
        Notizen, Hausübungen und Unterlagen genau an die Stunde, zu der sie
        gehören.
      </p>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/willkommen"
          className="btn btn-primary btn-pill w-full sm:w-auto"
        >
          Dock öffnen
        </Link>
        <Link
          href="/app"
          className="btn btn-secondary btn-pill w-full sm:w-auto"
        >
          Demo ansehen
        </Link>
      </div>

      <p className="t-caption mt-4">
        Läuft im Browser. Deine Daten bleiben auf deinem Gerät.
      </p>

      <Vorschau />
    </section>
  );
}

/** Ein Ausschnitt der App mit erfundenen Daten. */
function Vorschau() {
  return (
    <div className="relative mx-auto mt-14 max-w-[420px]">
      {/* Weiches Umgebungslicht hinter der Vorschau. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-10 -inset-y-8 -z-10"
        style={{
          background:
            "radial-gradient(50% 50% at 30% 20%, rgba(14,159,159,0.18), transparent 70%), radial-gradient(50% 50% at 75% 30%, rgba(107,75,214,0.16), transparent 70%)",
          filter: "blur(30px)",
        }}
      />

      <div className="card-raised overflow-hidden p-5 text-left">
        <p className="t-label">Beispieltag</p>
        <p className="t-title mt-1">Heute</p>

        <div className="sunken mt-4 px-4 py-4">
          <div className="flex items-baseline justify-between">
            <span
              className="t-label font-semibold"
              style={{ color: "var(--accent)" }}
            >
              Jetzt
            </span>
            <span className="t-label t-num">noch 32 min</span>
          </div>
          <p className="t-heading mt-1.5">Mathematik</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="t-num text-[1.5rem] font-bold" style={{ color: "var(--ink)" }}>
              08:00
            </span>
            <span className="relative h-[3px] flex-1 rounded-full" style={{ background: "var(--line-strong)" }}>
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: "36%", background: "#0e9f9f" }}
              />
            </span>
            <span className="t-num text-[1.5rem] font-bold" style={{ color: "var(--ink)" }}>
              08:50
            </span>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-[18px]" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="dock-divided">
            {BEISPIELTAG.map((stunde) => (
              <div
                key={stunde.fach}
                className="flex items-center gap-3.5 px-4 py-3"
                style={{
                  background: stunde.jetzt
                    ? "var(--accent-soft)"
                    : `color-mix(in srgb, ${stunde.farbe} 6%, var(--surface))`,
                }}
              >
                <span className="w-[3rem] shrink-0">
                  <span className="t-num block text-[0.875rem] font-semibold" style={{ color: "var(--ink)" }}>
                    {stunde.zeit}
                  </span>
                  <span className="t-num block text-[0.6875rem]" style={{ color: "var(--ink-faint)" }}>
                    {stunde.bis}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="flex h-8 w-10 shrink-0 items-center justify-center rounded-[9px] text-[0.625rem] font-bold"
                  style={{
                    background: `color-mix(in srgb, ${stunde.farbe} 17%, var(--surface))`,
                    color: stunde.farbe,
                    boxShadow: `inset 2.5px 0 0 0 ${stunde.farbe}`,
                  }}
                >
                  {stunde.kurz}
                </span>
                <span className="text-[0.875rem] font-semibold" style={{ color: "var(--ink)" }}>
                  {stunde.fach}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="t-caption mt-3">Beispieldaten, keine echte Klasse.</p>
    </div>
  );
}

/** Drei Nutzen, bewusst unterschiedlich gesetzt. */
function Nutzen() {
  return (
    <section className="mx-auto max-w-[1100px] px-6 py-16">
      <h2 className="t-section max-w-[18ch]">
        Drei Fragen, die jeder Schultag stellt.
      </h2>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {/* Der erste Nutzen bekommt mehr Gewicht als die beiden anderen. */}
        <div className="card p-7 lg:col-span-1 lg:row-span-1">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-[14px]"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <IconTasks size={22} />
          </span>
          <h3 className="t-title mt-5">Was kommt als Nächstes?</h3>
          <p className="t-body mt-2.5">
            Die laufende und die nächste Stunde, was heute fällig ist und was du
            mitnehmen musst. Ohne Auslegung: vor der Schule, in der Pause und am
            Wochenende steht dort, was stimmt.
          </p>
        </div>

        <div className="card p-7">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-[14px]"
            style={{ background: "var(--ok-soft)", color: "var(--ok)" }}
          >
            <IconCovered size={22} />
          </span>
          <h3 className="t-title mt-5">Was war letztes Mal?</h3>
          <p className="t-body mt-2.5">
            Jede Stunde führt ihren eigenen Verlauf: was behandelt wurde, welche
            Notiz du gemacht hast, welche Datei dazugehört. Durchsuchbar, Wochen
            später.
          </p>
        </div>

        <div className="card p-7">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-[14px]"
            style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
          >
            <IconCatchUp size={22} />
          </span>
          <h3 className="t-title mt-5">Was habe ich verpasst?</h3>
          <p className="t-body mt-2.5">
            Du wählst die Tage selbst – einen Grund fragt Dock nicht. Wo nichts
            festgehalten wurde, steht das auch so da.
          </p>
        </div>
      </div>
    </section>
  );
}

function VonDerStundeZurAufgabe() {
  return (
    <section className="mx-auto max-w-[1100px] px-6 py-16">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <h2 className="t-section max-w-[16ch]">
            Von der Ansage zur erledigten Aufgabe.
          </h2>
          <p className="t-body mt-5 max-w-[42ch]">
            Du tippst mit, was angesagt wird. Dock weiß, in welcher Stunde du
            bist, schlägt die nächste Stunde desselben Fachs als Termin vor und
            zeigt dir das Datum, bevor du speicherst.
          </p>
          <p className="t-body mt-4 max-w-[42ch]">
            Der Wortlaut bleibt, wie du ihn eingegeben hast. Fällt die Zielstunde
            aus, sucht Dock den nächsten Termin und sagt dir, dass sich etwas
            geändert hat. Eine unerledigte Aufgabe wandert nicht weiter – sie
            wird überfällig.
          </p>
        </div>

        <div className="card p-6">
          <div className="sunken px-4 py-3">
            <p className="t-label">In der Stunde erfasst</p>
            <p className="mt-1.5 text-[1.0625rem] font-bold" style={{ color: "var(--ink)" }}>
              S. 84 Nr. 4–8
            </p>
          </div>

          <div
            className="mt-3 rounded-[14px] px-4 py-3"
            style={{ background: "var(--accent-soft)" }}
          >
            <p className="t-label" style={{ color: "var(--accent-ink)" }}>
              Vorgeschlagener Termin
            </p>
            <p className="mt-1 text-[0.9375rem] font-semibold" style={{ color: "var(--ink)" }}>
              Nächste Mathematikstunde · Mittwoch, 08:55
            </p>
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-[14px] px-4 py-3" style={{ background: "var(--ok-soft)" }}>
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--ok)", color: "#fff" }}
            >
              <IconCheck size={14} />
            </span>
            <span className="text-[0.875rem] font-semibold" style={{ color: "var(--ok)" }}>
              Von dir erledigt – dein Stand bleibt privat
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Klassengedaechtnis() {
  return (
    <section className="mx-auto max-w-[1100px] px-6 py-16">
      <div className="card p-8 sm:p-12">
        <h2 className="t-section max-w-[18ch]">
          Ein Klassengedächtnis, kein soziales Netz.
        </h2>
        <p className="t-body mt-5 max-w-[52ch]">
          Wer etwas festhält, hilft allen, die gefehlt haben. Geteilte Einträge
          leben in Fassungen: Wird ein Text geändert, entsteht eine neue Fassung,
          und frühere Bestätigungen bleiben Historie statt stillschweigend
          weiterzugelten.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="sunken p-5">
            <span className="flex items-center gap-2" style={{ color: "var(--accent)" }}>
              <IconBring size={18} />
              <span className="t-label font-semibold" style={{ color: "var(--accent-ink)" }}>
                Klasse
              </span>
            </span>
            <p className="t-body mt-2.5">
              Was behandelt wurde, Hausübungen, angekündigte Prüfungen und
              geteilte Dateien.
            </p>
          </div>

          <div className="sunken p-5">
            <span className="flex items-center gap-2" style={{ color: "var(--ink-muted)" }}>
              <IconLock size={18} />
              <span className="t-label font-semibold">Privat</span>
            </span>
            <p className="t-body mt-2.5">
              Deine Notizen, deine Dateien, dein Erledigt-Stand und die Tage, die
              du nachholst. Niemand sonst sieht sie – auch keine Moderation.
            </p>
          </div>
        </div>

        <p className="t-caption mt-6 max-w-[58ch]">
          Ehrlich gesagt: Teilen zwischen echten Konten setzt ein eingerichtetes
          Backend voraus. Ohne eines bleibt auch ein Eintrag mit der Sichtbarkeit
          „Klasse“ auf deinem Gerät. Bestätigungen durch Mitschüler sind keine
          Freigabe durch die Schule.
        </p>
      </div>
    </section>
  );
}

function Start() {
  const schritte = [
    {
      titel: "Stundenplan steht",
      text: "Er ist beim ersten Start schon aktiv und wiederholt sich jede Woche – ohne Enddatum, ohne Bestätigungsschritt.",
    },
    {
      titel: "Gruppen auswählen",
      text: "Sprache, Wahlpflichtfächer und abgewählte Stunden sind berücksichtigt. Ändern kannst du alles jederzeit.",
    },
    {
      titel: "In der Stunde mittippen",
      text: "Hausübung, Behandeltes, Mitbringsel, Prüfung, Notiz oder Datei – Kurs und Termin sind vorbelegt.",
    },
  ];

  return (
    <section className="mx-auto max-w-[1100px] px-6 py-16">
      <h2 className="t-section max-w-[18ch]">So fängst du an.</h2>
      <p className="t-body mt-5 max-w-[48ch]">
        Keine Anmeldung bei der Schule, keine Zugangsdaten, keine Verbindung zu
        einem Schulsystem. Dock ist ein Werkzeug, das du selbst pflegst.
      </p>

      {/* Eine Abfolge – deshalb sind die Schritte hier nummeriert. */}
      <ol className="mt-10 grid gap-5 lg:grid-cols-3">
        {schritte.map((schritt, i) => (
          <li key={schritt.titel} className="card p-7">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-[0.875rem] font-bold"
              style={{ background: "var(--surface-contrast)", color: "var(--on-contrast)" }}
            >
              {i + 1}
            </span>
            <h3 className="t-title mt-5">{schritt.titel}</h3>
            <p className="t-body mt-2.5">{schritt.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Schluss() {
  return (
    <section className="mx-auto max-w-[1100px] px-6 pb-16">
      <div
        className="relative overflow-hidden rounded-[32px] px-8 py-16 text-center sm:px-12"
        style={{
          backgroundColor: "#1c2f8a",
          backgroundImage:
            "radial-gradient(90% 70% at 12% 4%, #2ec9bd 0%, transparent 58%), radial-gradient(85% 65% at 92% 10%, #7b52e8 0%, transparent 60%), linear-gradient(168deg, #1b8fd6 0%, #2f5fd0 44%, #5b3fc4 100%)",
        }}
      >
        <h2
          className="mx-auto max-w-[16ch] text-[2rem] font-bold leading-[1.05] text-white sm:text-[2.75rem]"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.035em" }}
        >
          Jede Stunde hat ihren Platz.
        </h2>
        <p
          className="mx-auto mt-5 max-w-[42ch] text-[1.0625rem] leading-[1.5]"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          Leg deinen Stundenplan an und halt ab der nächsten Stunde fest, was
          gesagt wird.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/willkommen"
            className="btn"
            style={{
              background: "#ffffff",
              color: "#16225c",
              minHeight: "3.25rem",
              borderRadius: "999px",
              paddingInline: "2rem",
              boxShadow: "0 2px 6px rgba(6,22,60,0.24), 0 14px 32px rgba(6,22,60,0.3)",
            }}
          >
            Dock öffnen
          </Link>
        </div>
      </div>
    </section>
  );
}

function Fusszeile() {
  return (
    <footer style={{ borderTop: "1px solid var(--line)" }}>
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Wordmark size="sm" />
          <p className="t-caption mt-2 max-w-[44ch]">
            Ein selbst gepflegter Schulorganizer. Keine Verbindung zu WebUntis
            oder einem anderen Schulsystem, keine Bewertung durch die Schule.
          </p>
        </div>
        <nav aria-label="Fußzeile" className="flex gap-2">
          <Link href="/app" className="btn btn-quiet">
            Demo
          </Link>
          <Link href="/willkommen" className="btn btn-quiet">
            Dock öffnen
          </Link>
        </nav>
      </div>
    </footer>
  );
}
