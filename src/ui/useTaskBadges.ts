"use client";

/**
 * Welche Kennzeichnungen an einer Stunde stehen.
 *
 * Nur Bedeutsames: faellige Arbeit, Mitbringsel, angekündigte Prüfungen und
 * der Entfall. Keine Zähler, die nichts aussagen.
 */

import { useMemo } from "react";
import type { LessonBlock } from "@/domain/recurrence";
import type { DockSnapshot } from "@/data/store";
import { latestResolution, taskStateOf } from "@/data/store";

export interface BlockBadges {
  dueCount: number;
  bringCount: number;
  assessment: boolean;
  covered: boolean;
  notes: number;
}

export function useBlockBadges(
  snapshot: DockSnapshot,
  block: LessonBlock,
  userId: string,
): BlockBadges {
  return useMemo(() => {
    const lessonIds = new Set(block.lessons.map((l) => l.id));

    let dueCount = 0;
    let bringCount = 0;
    let notes = 0;
    let covered = false;

    for (const entry of snapshot.entries) {
      if (entry.kind === "behandelt") {
        if (entry.announcedInLessonId && lessonIds.has(entry.announcedInLessonId)) {
          covered = true;
        }
        continue;
      }

      if (entry.kind === "notiz" || entry.kind === "datei") {
        if (entry.announcedInLessonId && lessonIds.has(entry.announcedInLessonId)) {
          notes += 1;
        }
        continue;
      }

      if (entry.kind !== "hausuebung" && entry.kind !== "mitbringen") continue;

      const resolution = latestResolution(snapshot, entry.id);
      const targetsThis = resolution?.targetLessonId != null &&
        lessonIds.has(resolution.targetLessonId);
      if (!targetsThis) continue;

      const state = taskStateOf(snapshot, entry.id, userId);
      if (state?.done) continue;

      if (entry.kind === "hausuebung") dueCount += 1;
      else bringCount += 1;
    }

    const assessment = snapshot.assessments.some(
      (a) =>
        (a.lessonId != null && lessonIds.has(a.lessonId)) ||
        (a.date != null && a.date === block.date && a.courseId === block.courseId),
    );

    return { dueCount, bringCount, assessment, covered, notes };
  }, [snapshot, block, userId]);
}
