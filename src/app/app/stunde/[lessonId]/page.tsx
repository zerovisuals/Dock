"use client";

/**
 * Eine Stunde im Detail.
 *
 * Oben der Zeitbogen als Kopf, darunter getrennt, was die Klasse festgehalten
 * hat und was privat ist. Die Trennung trägt immer Text, nie nur Farbe.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppShell } from "@/ui/AppShell";
import {
  AudienceBadge,
  CourseDot,
  EmptyState,
  LoadingLine,
  Notice,
  Segmented,
} from "@/ui/primitives";
import { Badge, GroupedList, TimeArc } from "@/ui/LessonList";
import {
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconPlus,
  IconTrash,
} from "@/ui/icons";
import { useDock } from "@/data/DockContext";
import {
  courseOf,
  currentVersion,
  latestResolution,
  taskStateOf,
  completionIsStale,
} from "@/data/store";
import { QuickCapture } from "@/ui/QuickCapture";
import { StundeBearbeiten } from "@/ui/StundeBearbeiten";
import { formatFileSize } from "@/data/repository";
import { KlassenEintragFuss } from "@/ui/KlassenEintrag";
import type { Entry } from "@/domain/types";
import {
  compareDates,
  describeDateRelative,
  formatDateLong,
  minutesOfDay,
} from "@/domain/time";

type Ansicht = "klasse" | "privat";

const ART_LABEL: Record<Entry["kind"], string> = {
  hausuebung: "Hausübung",
  behandelt: "Behandelt",
  mitbringen: "Mitbringen",
  pruefung: "Prüfung",
  notiz: "Notiz",
  datei: "Datei",
};

export default function StundePage() {
  const parameter = useParams<{ lessonId: string }>();
  const router = useRouter();
  const { snapshot, status, today } = useDock();
  const [ansicht, setAnsichtRoh] = useState<Ansicht | null>(null);
  const [erfassen, setErfassen] = useState(false);
  const [bearbeiten, setBearbeiten] = useState(false);

  const lesson = snapshot.lessons.find((l) => l.id === parameter.lessonId);

  const blockStunden = useMemo(() => {
    if (!lesson) return [];
    return snapshot.lessons
      .filter((l) => l.blockKey === lesson.blockKey)
      .sort((a, b) => a.periodIndex - b.periodIndex);
  }, [lesson, snapshot.lessons]);

  const geschwister = useMemo(() => {
    if (!lesson) return { vorige: null, naechste: null };
    // Nach Blöcken, nicht nach Einzelstunden – sonst wäre die zweite
    // Einheit einer Doppelstunde die "nächste Stunde".
    const bloecke = new Map<string, (typeof snapshot.lessons)[number]>();
    for (const l of snapshot.lessons) {
      if (l.courseId !== lesson.courseId) continue;
      const vorhanden = bloecke.get(l.blockKey);
      if (!vorhanden || l.periodIndex < vorhanden.periodIndex) {
        bloecke.set(l.blockKey, l);
      }
    }
    const alle = [...bloecke.values()].sort((a, b) =>
      a.date === b.date
        ? minutesOfDay(a.startsAt) - minutesOfDay(b.startsAt)
        : compareDates(a.date, b.date),
    );
    const index = alle.findIndex((l) => l.blockKey === lesson.blockKey);
    return {
      vorige: index > 0 ? (alle[index - 1] ?? null) : null,
      naechste:
        index >= 0 && index < alle.length - 1 ? (alle[index + 1] ?? null) : null,
    };
  }, [lesson, snapshot.lessons]);

  const eintraege = useMemo(() => {
    if (!lesson) return [];
    const blockIds = new Set(blockStunden.map((l) => l.id));
    return snapshot.entries.filter(
      (e) =>
        (e.announcedInLessonId !== null && blockIds.has(e.announcedInLessonId)) ||
        e.announcedInBlockKey === lesson.blockKey,
    );
  }, [lesson, blockStunden, snapshot.entries]);

  const dateien = useMemo(() => {
    if (!lesson) return [];
    const blockIds = new Set(blockStunden.map((l) => l.id));
    const verknuepfungen = snapshot.documentLinks.filter(
      (l) => l.lessonId !== null && blockIds.has(l.lessonId),
    );
    const ids = new Set(verknuepfungen.map((l) => l.documentId));
    return snapshot.documents.filter((d) => ids.has(d.id));
  }, [lesson, blockStunden, snapshot.documentLinks, snapshot.documents]);

  if (status === "laedt") {
    return (
      <AppShell>
        <LoadingLine />
      </AppShell>
    );
  }

  if (!lesson) {
    return (
      <AppShell>
        <div className="card mt-8">
          <EmptyState
            title="Diese Stunde gibt es nicht"
            description="Sie wurde vielleicht gelöscht, oder der Link ist veraltet."
            action={
              <Link href="/app/stundenplan" className="btn btn-primary">
                Zum Stundenplan
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

  const course = courseOf(snapshot, lesson.courseId);
  const entfaellt = lesson.status === "entfallen";
  const beginn = blockStunden[0]?.startsAt ?? lesson.startsAt;
  const ende = blockStunden[blockStunden.length - 1]?.endsAt ?? lesson.endsAt;

  const klasseEintraege = eintraege.filter((e) => e.audience === "kurs");
  const privatEintraege = eintraege.filter((e) => e.audience === "privat");

  // Ohne eigene Wahl wird der Reiter gezeigt, der etwas enthält. Sonst
  // wirkte ein gerade gespeicherter privater Eintrag wie verschwunden.
  const gewaehlt: Ansicht =
    ansicht ??
    (klasseEintraege.length === 0 && privatEintraege.length > 0
      ? "privat"
      : "klasse");
  const sichtbare = gewaehlt === "klasse" ? klasseEintraege : privatEintraege;

  return (
    <AppShell
      action={
        <button
          type="button"
          onClick={() => setErfassen(true)}
          className="btn btn-primary h-[60px] w-[60px] px-0"
          style={{ borderRadius: "999px" }}
          aria-label="Eintrag zu dieser Stunde hinzufügen"
        >
          <IconPlus size={24} />
        </button>
      }
    >
      <div className="flex items-center justify-between gap-3 pt-6 lg:pt-10">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Zurück"
          className="btn btn-round"
        >
          <IconChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={() => setBearbeiten(true)}
          className="btn btn-secondary"
        >
          <IconEdit size={17} />
          Ändern
        </button>
      </div>

      {/* Kopf: Kurs und Zeitbogen */}
      <div className="card mt-5 px-6 py-6">
        <p className="t-label">{describeDateRelative(lesson.date, today)}</p>
        <h1 className="t-section mt-1.5 flex items-center gap-2.5">
          <CourseDot color={course?.accent ?? "#8A8A8A"} size={11} />
          <span style={{ textDecoration: entfaellt ? "line-through" : undefined }}>
            {course?.displayName}
          </span>
        </h1>
        <p className="t-small mt-1">{formatDateLong(lesson.date)}</p>

        <div className="mt-6">
          <TimeArc startsAt={beginn} endsAt={ende} accent={course?.accent} />
        </div>

        {(entfaellt ||
          lesson.status === "zusatztermin" ||
          blockStunden.length > 1) && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {entfaellt && <Badge tone="cancelled">Entfällt</Badge>}
            {lesson.status === "zusatztermin" && <Badge>Zusatztermin</Badge>}
            {blockStunden.length > 1 && (
              <Badge>
                Doppelstunde · Einheit{" "}
                {blockStunden.map((l) => l.periodIndex).join(" und ")}
              </Badge>
            )}
          </div>
        )}
      </div>

      {entfaellt && (
        <div className="mt-4">
          <Notice tone="warn">
            {lesson.statusNote
              ? `Von dir als entfallen eingetragen: ${lesson.statusNote}`
              : "Von dir als entfallen eingetragen. Das ist keine Mitteilung der Schule."}{" "}
            Notizen, Dateien und Aufgaben bleiben erhalten.
          </Notice>
        </div>
      )}

      {/* Klasse oder Privat */}
      <div className="mt-8">
        <Segmented
          label="Inhalte filtern"
          value={gewaehlt}
          onChange={setAnsichtRoh}
          options={[
            { value: "klasse", label: `Klasse (${klasseEintraege.length})` },
            { value: "privat", label: `Privat (${privatEintraege.length})` },
          ]}
        />
      </div>

      <div className="mt-4">
        {sichtbare.length === 0 ? (
          <div className="card px-6 py-6">
            {gewaehlt === "klasse" ? (
              <>
                <p className="t-title">
                  Für diese Stunde wurde noch nichts festgehalten
                </p>
                <p className="t-small mt-2">
                  Das heißt nicht, dass nichts stattgefunden hat – es hat nur
                  noch niemand etwas eingetragen.
                </p>
              </>
            ) : (
              <>
                <p className="t-title">Keine privaten Notizen</p>
                <p className="t-small mt-2">
                  Was du hier festhältst, sieht nur du.
                </p>
              </>
            )}
          </div>
        ) : (
          <GroupedList
            label={
              gewaehlt === "klasse" ? "Inhalte der Klasse" : "Private Inhalte"
            }
          >
            {sichtbare.map((entry) => (
              <EintragZeile key={entry.id} entry={entry} />
            ))}
          </GroupedList>
        )}
      </div>

      {dateien.length > 0 && (
        <div className="mt-8">
          <h2 className="t-title mb-3">Dateien</h2>
          <GroupedList label="Dateien dieser Stunde">
            {dateien.map((dokument) => (
              <div key={dokument.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[0.9375rem] font-semibold"
                    style={{ color: "var(--ink)" }}
                  >
                    {dokument.name}
                  </p>
                  <p className="t-caption mt-0.5">
                    {formatFileSize(dokument.sizeBytes)}
                  </p>
                </div>
                <AudienceBadge audience={dokument.audience} />
              </div>
            ))}
          </GroupedList>
        </div>
      )}

      {/* Vorige und nächste Begegnung desselben Kurses */}
      <nav
        aria-label="Andere Stunden dieses Kurses"
        className="mt-8 flex items-center justify-between gap-3"
      >
        {geschwister.vorige ? (
          <Link
            href={`/app/stunde/${geschwister.vorige.id}`}
            className="btn btn-secondary"
          >
            <IconChevronLeft size={17} />
            {describeDateRelative(geschwister.vorige.date, today)}
          </Link>
        ) : (
          <span />
        )}
        {geschwister.naechste ? (
          <Link
            href={`/app/stunde/${geschwister.naechste.id}`}
            className="btn btn-secondary"
          >
            {describeDateRelative(geschwister.naechste.date, today)}
            <IconChevronRight size={17} />
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <QuickCapture
        open={erfassen}
        onClose={() => setErfassen(false)}
        onSaved={(audience) =>
          setAnsichtRoh(audience === "privat" ? "privat" : "klasse")
        }
        defaultLessonId={lesson.id}
        candidateBlocks={[
          {
            blockKey: lesson.blockKey,
            courseId: lesson.courseId,
            date: lesson.date,
            startsAt: beginn,
            endsAt: ende,
            periodIndexes: blockStunden.map((l) => l.periodIndex),
            lessons: blockStunden,
            status: lesson.status,
          },
        ]}
      />

      <StundeBearbeiten
        open={bearbeiten}
        onClose={() => setBearbeiten(false)}
        lesson={lesson}
      />
    </AppShell>
  );
}

function EintragZeile({ entry }: { entry: Entry }) {
  const { snapshot, userId, mutate, today } = useDock();
  const version = currentVersion(snapshot, entry);
  const resolution = latestResolution(snapshot, entry.id);
  const state = taskStateOf(snapshot, entry.id, userId);
  const veraltet = completionIsStale(entry, state);
  const abhakbar = entry.kind === "hausuebung" || entry.kind === "mitbringen";

  return (
    <div className="flex items-start gap-4 px-5 py-4">
      {abhakbar && (
        <button
          type="button"
          role="checkbox"
          aria-checked={state?.done ?? false}
          aria-label={`${version?.text ?? "Eintrag"} als erledigt markieren`}
          onClick={() =>
            mutate((s) => s.setTaskDone(entry.id, !(state?.done ?? false)))
          }
          className="mt-0.5 flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[8px]"
          style={{
            border: state?.done ? "0" : "1.5px solid var(--line-strong)",
            background: state?.done ? "var(--accent)" : "var(--surface-sunken)",
          }}
        >
          {state?.done && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="none"
              stroke="#fff"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M4.5 10.5l3.5 3.5 8-8.5" />
            </svg>
          )}
        </button>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{ART_LABEL[entry.kind]}</Badge>
          <AudienceBadge audience={entry.audience} />
        </div>
        <p
          className="mt-2 text-[0.9375rem] leading-[1.5]"
          style={{ color: "var(--ink)" }}
        >
          {version?.text}
        </p>
        {version?.detail && <p className="t-small mt-1">{version.detail}</p>}

        {resolution?.state === "aufgeloest" && resolution.targetDate && (
          <p className="t-caption mt-1.5">
            fällig {describeDateRelative(resolution.targetDate, today)}
          </p>
        )}
        {resolution?.state === "offen" && (
          <p className="t-caption mt-1.5">Nächste Stunde noch nicht geplant</p>
        )}
        {resolution?.state === "pruefen" && (
          <p className="t-caption mt-1.5" style={{ color: "var(--warn)" }}>
            Ziel prüfen: {resolution.reason}
          </p>
        )}

        {veraltet && (
          <div className="mt-2.5">
            <Notice tone="warn">
              Der Text wurde geändert, seit du abgehakt hast. Prüf, ob etwas
              dazugekommen ist.
            </Notice>
          </div>
        )}

        {(version?.revision ?? 1) > 1 && (
          <p className="t-caption mt-1.5">Fassung {version?.revision}</p>
        )}

        <KlassenEintragFuss entry={entry} />
      </div>

      <button
        type="button"
        onClick={() => mutate((s) => s.deleteEntry(entry.id))}
        aria-label={`${version?.text ?? "Eintrag"} löschen`}
        className="btn btn-quiet shrink-0 px-2"
      >
        <IconTrash size={17} />
      </button>
    </div>
  );
}
