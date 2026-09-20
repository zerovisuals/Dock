"use client";

/**
 * Eine Aufgabenzeile.
 *
 * Wird in den Aufgaben und auf Heute verwendet. Der Erledigt-Stand gehört der
 * Person, nicht der Aufgabe.
 */

import {
  AudienceBadge,
  CourseDot,
  Notice,
} from "@/ui/primitives";
import { Badge } from "@/ui/LessonList";
import { useDock } from "@/data/DockContext";
import {
  courseOf,
  currentVersion,
  latestResolution,
  taskStateOf,
  completionIsStale,
} from "@/data/store";
import type { Entry } from "@/domain/types";
import { describeDateRelative } from "@/domain/time";

export function AufgabenZeile({
  entry,
  overdue,
}: {
  entry: Entry;
  overdue?: boolean;
}) {
  const { snapshot, userId, mutate, today } = useDock();
  const version = currentVersion(snapshot, entry);
  const course = courseOf(snapshot, entry.courseId);
  const resolution = latestResolution(snapshot, entry.id);
  const state = taskStateOf(snapshot, entry.id, userId);
  const veraltet = completionIsStale(entry, state);
  const erledigt = state?.done ?? false;

  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <button
        type="button"
        role="checkbox"
        aria-checked={erledigt}
        aria-label={`${version?.text ?? "Aufgabe"} als erledigt markieren`}
        onClick={() => mutate((s) => s.setTaskDone(entry.id, !erledigt))}
        className="mt-0.5 flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[8px]"
        style={{
          border: erledigt ? "0" : "1.5px solid var(--line-strong)",
          background: erledigt ? "var(--accent)" : "var(--surface-sunken)",
        }}
      >
        {erledigt && (
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

      <div className="min-w-0 flex-1">
        <p
          className="text-[0.9375rem] leading-[1.45]"
          style={{
            color: erledigt ? "var(--ink-muted)" : "var(--ink)",
            textDecoration: erledigt ? "line-through" : undefined,
          }}
        >
          {version?.text}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <CourseDot color={course?.accent ?? "#8A8A8A"} size={7} />
            <span className="t-caption">{course?.displayName}</span>
          </span>
          {resolution?.state === "aufgeloest" && resolution.targetDate && (
            <span className="t-caption">
              · fällig {describeDateRelative(resolution.targetDate, today)}
            </span>
          )}
          {resolution?.state === "offen" && (
            <span className="t-caption">· Nächste Stunde noch nicht geplant</span>
          )}
          {entry.kind === "mitbringen" && <Badge>Mitbringen</Badge>}
          <AudienceBadge audience={entry.audience} />
        </div>

        {resolution?.state === "pruefen" && (
          <div className="mt-2">
            <Notice tone="warn">Ziel prüfen: {resolution.reason}</Notice>
          </div>
        )}

        {veraltet && (
          <div className="mt-2">
            <Notice tone="warn">
              Der Text wurde geändert, seit du abgehakt hast. Prüf, ob etwas
              dazugekommen ist.
            </Notice>
          </div>
        )}
      </div>

      {overdue && <Badge tone="overdue">Überfällig</Badge>}
    </div>
  );
}
