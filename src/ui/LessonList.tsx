"use client";

/**
 * Stunden als Liste und der Zeitbogen.
 *
 * Der Bogen ist das Herzstück einer Stunde: Beginn, Dauer, Ende auf einen
 * Blick, die Ziffern groß und tabellarisch. Er ersetzt drei kleine Zeilen
 * durch eine Aussage.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import type { LessonBlock } from "@/domain/recurrence";
import type { Course } from "@/domain/types";
import { CourseDot } from "./primitives";
import { describeDuration, minutesOfDay } from "@/domain/time";

/**
 * Beginn – Dauer – Ende.
 *
 * Die Linie dazwischen zeigt den Fortschritt, wenn die Stunde läuft.
 */
export function TimeArc({
  startsAt,
  endsAt,
  progress,
  accent,
  size = "md",
}: {
  startsAt: string;
  endsAt: string;
  /** 0 bis 1, oder null wenn die Stunde nicht läuft. */
  progress?: number | null;
  accent?: string;
  size?: "md" | "lg";
}) {
  const dauer = minutesOfDay(endsAt) - minutesOfDay(startsAt);
  const farbe = accent ?? "var(--accent)";
  const gross = size === "lg";

  return (
    <div className="flex items-center gap-4">
      <div>
        <p className={gross ? "t-data-lg" : "t-data"}>{startsAt}</p>
      </div>

      <div className="relative flex-1 pb-1">
        <p
          className="t-caption mb-1.5 text-center"
          style={{ color: "var(--ink-muted)" }}
        >
          {describeDuration(dauer)}
        </p>
        <div
          className="relative h-[3px] w-full rounded-full"
          style={{ background: "var(--line-strong)" }}
        >
          {progress != null && (
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, progress * 100))}%`,
                background: farbe,
              }}
            />
          )}
          {progress != null && (
            <span
              aria-hidden
              className="absolute top-1/2 h-[10px] w-[10px] -translate-y-1/2 rounded-full"
              style={{
                left: `calc(${Math.min(100, Math.max(0, progress * 100))}% - 5px)`,
                background: farbe,
                boxShadow: "0 0 0 3px var(--surface)",
              }}
            />
          )}
        </div>
      </div>

      <div className="text-right">
        <p className={gross ? "t-data-lg" : "t-data"}>{endsAt}</p>
      </div>
    </div>
  );
}

export function LessonRow({
  block,
  course,
  badges,
  trailing,
  current,
}: {
  block: LessonBlock;
  course: Course | undefined;
  badges?: ReactNode;
  trailing?: ReactNode;
  current?: boolean;
}) {
  const cancelled = block.status === "entfallen";

  return (
    <Link
      href={`/app/stunde/${block.lessons[0]?.id ?? ""}`}
      className="flex min-h-[64px] items-center gap-4 px-5 py-3"
      style={{
        background: current ? "var(--accent-soft)" : "transparent",
      }}
    >
      {/* Die Zeit steht als Spalte, damit das Auge nicht springt. */}
      <span className="w-[3.25rem] shrink-0">
        <span
          className="t-num block text-[0.9375rem] font-semibold"
          style={{ color: cancelled ? "var(--ink-faint)" : "var(--ink)" }}
        >
          {block.startsAt}
        </span>
        <span className="t-num block text-[0.75rem]" style={{ color: "var(--ink-faint)" }}>
          {block.endsAt}
        </span>
      </span>

      <span
        aria-hidden
        className="h-9 w-[3px] shrink-0 rounded-full"
        style={{
          background: cancelled ? "var(--line-strong)" : (course?.accent ?? "#8A8A8A"),
        }}
      />

      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[0.9375rem] font-semibold"
          style={{
            color: cancelled ? "var(--ink-muted)" : "var(--ink)",
            textDecoration: cancelled ? "line-through" : undefined,
          }}
        >
          {course?.displayName ?? "Unbekannter Kurs"}
        </span>
        {badges && <span className="mt-1.5 flex flex-wrap gap-1.5">{badges}</span>}
      </span>

      {trailing && <span className="shrink-0">{trailing}</span>}
    </Link>
  );
}

export function GroupedList({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <section aria-label={label}>
      <div className="card overflow-hidden">
        <div className="dock-divided">{children}</div>
      </div>
    </section>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 pt-8 pb-3">
      <h2 className="t-title">{children}</h2>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "due" | "overdue" | "cancelled";
}) {
  const palette = {
    neutral: { bg: "var(--surface-sunken)", fg: "var(--ink-muted)" },
    due: { bg: "var(--accent-soft)", fg: "var(--accent-ink)" },
    overdue: { bg: "var(--danger-soft)", fg: "var(--danger)" },
    cancelled: { bg: "var(--surface-sunken)", fg: "var(--ink-faint)" },
  }[tone];

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold"
      style={{ background: palette.bg, color: palette.fg }}
    >
      {children}
    </span>
  );
}
