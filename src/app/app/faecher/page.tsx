"use client";

/**
 * Fächer.
 *
 * Kurse, nicht Fächer im Lehrplansinn: reguläre Mathematik und das
 * Wahlpflichtfach sind zwei Einträge, auch wenn die Namen sich ähneln.
 */

import Link from "next/link";
import { useMemo } from "react";
import { AppShell, ScreenHeader } from "@/ui/AppShell";
import { GroupedList, Badge } from "@/ui/LessonList";
import { CourseDot, EmptyState, LoadingLine } from "@/ui/primitives";
import { IconChevronRight } from "@/ui/icons";
import { useDock } from "@/data/DockContext";
import { latestResolution, taskStateOf } from "@/data/store";
import { compareDates } from "@/domain/time";

export default function FaecherPage() {
  const { snapshot, status, today, userId } = useDock();

  const kurse = useMemo(() => {
    return [...snapshot.courses]
      .map((course) => {
        const stunden = snapshot.lessons.filter(
          (l) => l.courseId === course.id,
        );
        const vergangen = stunden.filter(
          (l) => compareDates(l.date, today) < 0,
        ).length;

        const offen = snapshot.entries.filter((entry) => {
          if (entry.courseId !== course.id) return false;
          if (entry.kind !== "hausuebung" && entry.kind !== "mitbringen") {
            return false;
          }
          return !(taskStateOf(snapshot, entry.id, userId)?.done ?? false);
        }).length;

        const festgehalten = snapshot.entries.filter(
          (e) => e.courseId === course.id,
        ).length;

        return { course, vergangen, offen, festgehalten };
      })
      .sort((a, b) => a.course.displayName.localeCompare(b.course.displayName, "de-AT"));
  }, [snapshot, today, userId]);

  if (status === "laedt") {
    return (
      <AppShell>
        <LoadingLine />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScreenHeader
        title="Fächer"
        subtitle={`${kurse.length} Kurse in deinem Stundenplan`}
      />

      {kurse.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Noch keine Kurse"
            description="Sobald ein Stundenplan angelegt ist, stehen die Kurse hier."
          />
        </div>
      ) : (
        <GroupedList label="Deine Kurse">
          {kurse.map(({ course, vergangen, offen, festgehalten }) => (
            <Link
              key={course.id}
              href={`/app/faecher/${course.id}`}
              className="flex min-h-[64px] items-center gap-4 px-5 py-4"
            >
              <CourseDot color={course.accent} size={10} />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[0.9375rem] font-semibold"
                  style={{ color: "var(--ink)" }}
                >
                  {course.displayName}
                </p>
                <p className="t-caption mt-0.5">
                  {vergangen === 0
                    ? "Noch keine Stunde gehalten"
                    : `${vergangen} Stunden bisher`}
                  {festgehalten > 0 ? ` · ${festgehalten} Einträge` : ""}
                </p>
              </div>
              {course.elective && <Badge>Wahlpflicht</Badge>}
              {offen > 0 && <Badge tone="due">{offen} offen</Badge>}
              <IconChevronRight size={18} />
            </Link>
          ))}
        </GroupedList>
      )}

      <p className="t-caption mt-6">
        Kurse mit ähnlichem Namen bleiben getrennt. Mathematik und das
        Wahlpflichtfach Mathematik sind zwei eigene Kurse.
      </p>
    </AppShell>
  );
}
