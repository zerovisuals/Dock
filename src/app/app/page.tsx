"use client";

/**
 * Heute.
 *
 * Zeigt den gewählten Tag: die laufende und die nächste Stunde, den Rest des
 * Tages, faellige und ueberfaellige Arbeit, Mitbringsel und angekündigte
 * Prüfungen.
 *
 * Vor Schulbeginn, in Pausen, nach Schulschluss und am Wochenende wird der
 * wahre Zustand gezeigt. Es wird keine laufende Stunde erfunden, damit die
 * Gestaltung voller aussieht.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell, ScreenHeader } from "@/ui/AppShell";
import {
  GroupedList,
  LessonRow,
  Badge,
  SectionTitle,
  TimeArc,
} from "@/ui/LessonList";
import { EmptyState, LoadingLine, Notice, CourseDot } from "@/ui/primitives";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
} from "@/ui/icons";
import { useBlockBadges } from "@/ui/useTaskBadges";
import { useDock, useEnsureMaterialized } from "@/data/DockContext";
import {
  blocksOn,
  courseOf,
  currentAndNext,
  currentVersion,
  latestResolution,
  openTasks,
  taskStateOf,
} from "@/data/store";
import type { LessonBlock } from "@/domain/recurrence";
import {
  addDays,
  compareDates,
  describeDateRelative,
  describeDuration,
  formatDateWithWeekday,
  formatTimeRange,
  localTimeOf,
  minutesBetweenInstants,
  minutesOfDay,
  toInstant,
  weekdayName,
} from "@/domain/time";
import { QuickCapture } from "@/ui/QuickCapture";
import { AufgabenZeile } from "@/ui/AufgabenZeile";

export default function HeutePage() {
  const { snapshot, status, today, now, nowTime, userId } = useDock();
  const [selected, setSelected] = useState<string | null>(null);
  const [capture, setCapture] = useState(false);

  const date = selected ?? today;
  useEnsureMaterialized(date);

  const blocks = useMemo(() => blocksOn(snapshot, date), [snapshot, date]);
  const { current, next } = useMemo(
    () => currentAndNext(snapshot, now),
    [snapshot, now],
  );

  const tasks = useMemo(
    () => openTasks(snapshot, userId, today, nowTime),
    [snapshot, userId, today, nowTime],
  );

  const offen = tasks.filter((t) => !t.state?.done);
  const ueberfaellig = offen.filter((t) => t.overdue);
  const heuteFaellig = offen.filter(
    (t) => !t.overdue && t.resolution?.targetDate === today,
  );
  const mitbringen = offen.filter(
    (t) =>
      t.entry.kind === "mitbringen" &&
      t.resolution?.targetDate != null &&
      compareDates(t.resolution.targetDate, today) >= 0 &&
      compareDates(t.resolution.targetDate, addDays(today, 7)) <= 0,
  );

  const pruefungen = useMemo(
    () =>
      snapshot.assessments
        .filter((a) => a.date != null && compareDates(a.date, today) >= 0)
        .sort((a, b) => compareDates(a.date ?? "", b.date ?? ""))
        .slice(0, 4),
    [snapshot.assessments, today],
  );

  if (status === "laedt") {
    return (
      <AppShell>
        <LoadingLine />
      </AppShell>
    );
  }

  const istHeute = date === today;
  const minutes = minutesOfDay(nowTime);
  const rest = istHeute
    ? blocks.filter((b) => minutesOfDay(b.endsAt) > minutes)
    : blocks;

  return (
    <AppShell>
      <ScreenHeader
        title={describeDateRelative(date, today)}
        subtitle={
          <span className="t-num">
            {weekdayName(date)}, {formatDateWithWeekday(date).split(", ")[1]}
          </span>
        }
        actions={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelected(addDays(date, -1))}
              aria-label="Vorheriger Tag"
              className="btn btn-quiet min-h-[44px] px-2"
            >
              <IconChevronLeft />
            </button>
            {!istHeute && (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="btn btn-secondary"
              >
                Heute
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelected(addDays(date, 1))}
              aria-label="Nächster Tag"
              className="btn btn-quiet min-h-[44px] px-2"
            >
              <IconChevronRight />
            </button>
          </div>
        }
      />

      {/* Jetzt und als Nächstes – nur am heutigen Tag, und nur was stimmt. */}
      {istHeute && <JetztUndNaechstes current={current} next={next} />}

      {/* Der Rest des Tages */}
      <SectionTitle>
        {istHeute && rest.length < blocks.length ? "Noch heute" : "Dein Tag"}
      </SectionTitle>

      {rest.length === 0 ? (
        <div className="card px-6 py-6">
          <p className="t-title">
            {blocks.length === 0
              ? "Kein Unterricht an diesem Tag"
              : "Der Unterricht ist für heute vorbei"}
          </p>
          <p className="t-small mt-2">
            {blocks.length === 0
              ? `In deinem Stundenplan ist für ${weekdayName(date)} nichts eingetragen.`
              : "Alle Stunden dieses Tages sind vorbei."}
          </p>
        </div>
      ) : (
        <GroupedList label="Stunden des Tages">
          {rest.map((block) => (
            <StundeZeile
              key={block.blockKey}
              block={block}
              current={current?.blockKey === block.blockKey}
            />
          ))}
        </GroupedList>
      )}

      {/* Offene Arbeit – immer als Fläche, nie als loser grauer Satz. */}
      <SectionTitle
        action={
          offen.length > 0 ? (
            <Link href="/app/aufgaben" className="t-small font-semibold" style={{ color: "var(--accent)" }}>
              Alle ansehen
            </Link>
          ) : undefined
        }
      >
        Offene Arbeit
      </SectionTitle>

      {offen.length === 0 ? (
        <div className="card flex items-center gap-4 px-6 py-5">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--ok-soft)", color: "var(--ok)" }}
          >
            <IconCheck size={20} />
          </span>
          <span className="min-w-0">
            <span className="t-heading block">Nichts offen</span>
            <span className="t-small block">
              Keine fälligen Hausübungen und nichts mitzubringen.
            </span>
          </span>
        </div>
      ) : (
        <GroupedList label="Offene Arbeit">
          {[...ueberfaellig, ...heuteFaellig, ...mitbringen]
            .filter(
              (task, index, liste) =>
                liste.findIndex((t) => t.entry.id === task.entry.id) === index,
            )
            .slice(0, 6)
            .map((task) => (
              <AufgabenZeile
                key={task.entry.id}
                entry={task.entry}
                overdue={task.overdue}
              />
            ))}
        </GroupedList>
      )}

      {/* Angekündigte Prüfungen */}
      {pruefungen.length > 0 && (
        <>
          <SectionTitle>Angekündigte Prüfungen</SectionTitle>
          <GroupedList label="Angekündigte Prüfungen">
            {pruefungen.map((assessment) => {
              const course = courseOf(snapshot, assessment.courseId);
              return (
                <div key={assessment.id} className="flex items-center gap-4 px-5 py-4">
                  <CourseDot color={course?.accent ?? "#8A8A8A"} size={8} />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[0.9375rem] font-semibold"
                      style={{ color: "var(--ink)" }}
                    >
                      {assessment.title}
                    </p>
                    <p className="t-caption mt-0.5">
                      {course?.displayName}
                      {assessment.date
                        ? ` · ${describeDateRelative(assessment.date, today)}`
                        : ""}
                    </p>
                  </div>
                  <Badge>Von dir</Badge>
                </div>
              );
            })}
          </GroupedList>
        </>
      )}

      {/* Die Hauptaktion sitzt am Ende, über die volle Breite. */}
      <div className="mt-8">
        <button
          type="button"
          onClick={() => setCapture(true)}
          className="btn btn-primary btn-block"
        >
          <IconPlus size={20} />
          Eintrag erfassen
        </button>
        <p className="t-caption mt-4 text-center">
          Von dir gepflegt · nicht mit dem System der Schule verbunden
        </p>
      </div>

      <QuickCapture
        open={capture}
        onClose={() => setCapture(false)}
        defaultLessonId={current?.lessons[0]?.id ?? next?.lessons[0]?.id ?? null}
        candidateBlocks={blocks}
      />
    </AppShell>
  );
}

/**
 * Die laufende und die nächste Stunde.
 *
 * Eine Aussage, nicht zwei. Der Zeitbogen trägt die Stunde: Beginn, Dauer,
 * Ende in großen Ziffern, dazwischen der Fortschritt.
 *
 * Es wird nie eine Stunde erfunden, um die Fläche zu füllen.
 */
function JetztUndNaechstes({
  current,
  next,
}: {
  current: LessonBlock | null;
  next: LessonBlock | null;
}) {
  const { snapshot, today, now } = useDock();

  if (!current && !next) {
    return (
      <div className="card mt-2 px-6 py-6">
        <p className="t-title">In den nächsten zwei Wochen kein Unterricht</p>
        <p className="t-small mt-2">
          Trag im Stundenplan etwas ein, wenn sich das ändert.
        </p>
      </div>
    );
  }

  const haupt = current ?? next;
  if (!haupt) return null;

  const hauptKurs = courseOf(snapshot, haupt.courseId);
  const laeuft = current !== null;

  const fortschritt = laeuft
    ? Math.min(
        1,
        Math.max(
          0,
          (minutesOfDay(localTimeOf(now)) - minutesOfDay(haupt.startsAt)) /
            Math.max(
              1,
              minutesOfDay(haupt.endsAt) - minutesOfDay(haupt.startsAt),
            ),
        ),
      )
    : null;

  const restMinuten = laeuft
    ? minutesOfDay(haupt.endsAt) - minutesOfDay(localTimeOf(now))
    : 0;

  const bisBeginn = !laeuft
    ? minutesBetweenInstants(now, toInstant(haupt.date, haupt.startsAt))
    : 0;

  // Die übernächste Stunde steht nur als ruhige Zeile darunter.
  const danach = laeuft ? next : null;
  const danachKurs = danach ? courseOf(snapshot, danach.courseId) : undefined;

  return (
    <div className="card mt-2 overflow-hidden">
      <Link href={`/app/stunde/${haupt.lessons[0]?.id}`} className="block px-6 pt-6 pb-6">
        <div className="flex items-baseline justify-between gap-4">
          <p
            className="t-label font-semibold"
            style={{ color: laeuft ? "var(--accent)" : "var(--ink-muted)" }}
          >
            {laeuft
              ? "Jetzt"
              : `Als Nächstes${
                  haupt.date !== today
                    ? ` · ${describeDateRelative(haupt.date, today)}`
                    : ""
                }`}
          </p>
          <p className="t-label t-num">
            {laeuft
              ? `noch ${describeDuration(restMinuten)}`
              : `in ${describeDuration(bisBeginn)}`}
          </p>
        </div>

        <p className="t-title mt-2 flex items-center gap-2.5">
          <CourseDot color={hauptKurs?.accent ?? "#8A8A8A"} size={10} />
          {hauptKurs?.displayName}
        </p>

        <div className="mt-5">
          <TimeArc
            startsAt={haupt.startsAt}
            endsAt={haupt.endsAt}
            progress={fortschritt}
            accent={hauptKurs?.accent}
            size="lg"
          />
        </div>
      </Link>

      {danach && (
        <Link
          href={`/app/stunde/${danach.lessons[0]?.id}`}
          className="flex items-center gap-4 px-6 py-4"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <span className="t-label">Danach</span>
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
            <CourseDot color={danachKurs?.accent ?? "#8A8A8A"} size={8} />
            <span
              className="truncate text-[0.9375rem] font-semibold"
              style={{ color: "var(--ink)" }}
            >
              {danachKurs?.displayName}
            </span>
          </span>
          <span className="t-num t-small shrink-0">{danach.startsAt}</span>
        </Link>
      )}
    </div>
  );
}

function StundeZeile({ block, current }: { block: LessonBlock; current: boolean }) {
  const { snapshot, userId } = useDock();
  const course = courseOf(snapshot, block.courseId);
  const badges = useBlockBadges(snapshot, block, userId);

  return (
    <LessonRow
      block={block}
      course={course}
      current={current}
      badges={
        <>
          {block.status === "entfallen" && <Badge tone="cancelled">Entfällt</Badge>}
          {block.status === "zusatztermin" && <Badge>Zusatztermin</Badge>}
          {badges.dueCount > 0 && (
            <Badge tone="due">
              {badges.dueCount === 1 ? "Hausübung fällig" : `${badges.dueCount} Hausübungen fällig`}
            </Badge>
          )}
          {badges.bringCount > 0 && <Badge tone="due">Mitbringen</Badge>}
          {badges.assessment && <Badge tone="due">Prüfung</Badge>}
          {badges.covered && <Badge>Behandelt erfasst</Badge>}
        </>
      }
    />
  );
}
