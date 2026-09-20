import { MemoryRepository } from "@/data/indexeddb";
import { DockStore } from "@/data/store";
import { LOCAL_USER_ID } from "@/domain/seed";

/** Ein frischer Speicher mit angelegtem Stundenplan. */
export async function freshStore(today: string) {
  const repo = new MemoryRepository();
  const store = new DockStore(repo, LOCAL_USER_ID);
  await store.ensureSeeded(today);
  return { repo, store };
}

export async function courseNamed(store: DockStore, name: string) {
  const snapshot = await store.load();
  const course = snapshot.courses.find((c) => c.displayName === name);
  if (!course) throw new Error(`Kurs nicht gefunden: ${name}`);
  return course;
}

/** Die Stunden eines Kurses, chronologisch. */
export async function lessonsOfCourse(store: DockStore, courseId: string) {
  const snapshot = await store.load();
  return snapshot.lessons
    .filter((l) => l.courseId === courseId)
    .sort((a, b) =>
      a.date === b.date
        ? a.startsAt.localeCompare(b.startsAt)
        : a.date.localeCompare(b.date)
    );
}
