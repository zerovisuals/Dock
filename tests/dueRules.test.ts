import { describe, expect, it } from "vitest";
import { freshStore, courseNamed, lessonsOfCourse } from "./helpers";
import { latestResolution, openTasks, taskStateOf } from "@/data/store";
import { isOverdue } from "@/domain/dueRules";
import { LOCAL_USER_ID } from "@/domain/seed";

/** Die erste Stunde eines Kurses ab einem Datum. */
async function ersteStundeAb(store: Awaited<ReturnType<typeof freshStore>>["store"], kursId: string, ab: string) {
  const stunden = await lessonsOfCourse(store, kursId);
  const treffer = stunden.find((l) => l.date >= ab);
  if (!treffer) throw new Error("Keine Stunde gefunden");
  return treffer;
}

describe("Faelligkeit zur naechsten Stunde", () => {
  it("loest auf die naechste Begegnung desselben Kurses auf", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const anker = await ersteStundeAb(store, mathe.id, "2026-10-13");

    const entry = await store.createEntry({
      kind: "hausuebung",
      courseId: mathe.id,
      lessonId: anker.id,
      blockKey: anker.blockKey,
      text: "S. 84 Nr. 4–8",
      audience: "privat",
      dueRule: { kind: "NEXT_SUBJECT_LESSON", anchorLessonId: anker.id },
    });

    const snapshot = await store.load();
    const aufloesung = latestResolution(snapshot, entry.id);

    expect(aufloesung?.state).toBe("aufgeloest");
    // Anker ist Dienstag, 13.10. Die naechste Mathematikstunde ist Mittwoch.
    expect(aufloesung?.targetDate).toBe("2026-10-14");
  });

  it("bewahrt den Wortlaut unveraendert", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const anker = await ersteStundeAb(store, mathe.id, "2026-10-13");

    const entry = await store.createEntry({
      kind: "hausuebung",
      courseId: mathe.id,
      lessonId: anker.id,
      text: "S. 84 Nr. 4–8",
      audience: "privat",
      dueRule: { kind: "NEXT_SUBJECT_LESSON", anchorLessonId: anker.id },
    });

    const snapshot = await store.load();
    const fassung = snapshot.versions.find(
      (v) => v.id === entry.currentVersionId,
    );
    expect(fassung?.text).toBe("S. 84 Nr. 4–8");
  });

  it("waehlt nicht die zweite Einheit einer Doppelstunde am selben Tag", async () => {
    const { store } = await freshStore("2026-10-14");
    const kug = await courseNamed(store, "KUG");
    const stunden = await lessonsOfCourse(store, kug.id);

    // Die erste Einheit des Dienstag-Doppels.
    const anker = stunden.find((l) => l.date === "2026-10-13");
    if (!anker) throw new Error("KUG-Stunde fehlt");

    const entry = await store.createEntry({
      kind: "hausuebung",
      courseId: kug.id,
      lessonId: anker.id,
      blockKey: anker.blockKey,
      text: "Mappe weiterfuehren",
      audience: "privat",
      dueRule: { kind: "NEXT_SUBJECT_LESSON", anchorLessonId: anker.id },
    });

    const snapshot = await store.load();
    const aufloesung = latestResolution(snapshot, entry.id);

    // Ziel ist die naechste Woche, nicht die zweite Einheit am selben Tag.
    expect(aufloesung?.targetDate).toBe("2026-10-20");
  });

  it("macht das Wahlpflichtfach nicht zum Ziel der regulaeren Mathematik", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const wpf = await courseNamed(store, "Mathematik (Wahlpflichtfach)");
    const anker = await ersteStundeAb(store, mathe.id, "2026-10-13");

    const entry = await store.createEntry({
      kind: "hausuebung",
      courseId: mathe.id,
      lessonId: anker.id,
      text: "Aufgaben",
      audience: "privat",
      dueRule: { kind: "NEXT_SUBJECT_LESSON", anchorLessonId: anker.id },
    });

    const snapshot = await store.load();
    const aufloesung = latestResolution(snapshot, entry.id);
    const ziel = snapshot.lessons.find(
      (l) => l.id === aufloesung?.targetLessonId,
    );

    expect(ziel?.courseId).toBe(mathe.id);
    expect(ziel?.courseId).not.toBe(wpf.id);
  });

  it("wandert nicht weiter, nur weil die Zeit vergeht", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const anker = await ersteStundeAb(store, mathe.id, "2026-10-13");

    const entry = await store.createEntry({
      kind: "hausuebung",
      courseId: mathe.id,
      lessonId: anker.id,
      text: "Aufgaben",
      audience: "privat",
      dueRule: { kind: "NEXT_SUBJECT_LESSON", anchorLessonId: anker.id },
    });

    const vorher = latestResolution(await store.load(), entry.id);

    // Erneutes Auswerten, als waere viel Zeit vergangen.
    await store.reresolveAll();
    await store.ensureMaterialized("2027-03-01");
    await store.reresolveAll();

    const nachher = latestResolution(await store.load(), entry.id);
    expect(nachher?.targetDate).toBe(vorher?.targetDate);
  });

  it("bleibt ueberfaellig, statt in die naechste Woche zu springen", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const anker = await ersteStundeAb(store, mathe.id, "2026-10-13");

    const entry = await store.createEntry({
      kind: "hausuebung",
      courseId: mathe.id,
      lessonId: anker.id,
      text: "Aufgaben",
      audience: "privat",
      dueRule: { kind: "NEXT_SUBJECT_LESSON", anchorLessonId: anker.id },
    });

    const snapshot = await store.load();
    const aufloesung = latestResolution(snapshot, entry.id);

    // Ein Monat spaeter ist die Aufgabe ueberfaellig – und bleibt es.
    expect(isOverdue(aufloesung, "2026-11-14", "10:00")).toBe(true);
    expect(aufloesung?.targetDate).toBe("2026-10-14");
  });
});

describe("Entfall einer Stunde", () => {
  it("waehlt fuer die naechste Stunde ein neues Ziel und haelt das fest", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const anker = await ersteStundeAb(store, mathe.id, "2026-10-13");

    const entry = await store.createEntry({
      kind: "hausuebung",
      courseId: mathe.id,
      lessonId: anker.id,
      text: "Aufgaben",
      audience: "privat",
      dueRule: { kind: "NEXT_SUBJECT_LESSON", anchorLessonId: anker.id },
    });

    const vorher = latestResolution(await store.load(), entry.id);
    expect(vorher?.targetDate).toBe("2026-10-14");

    // Das bisherige Ziel entfaellt.
    if (!vorher?.targetLessonId) throw new Error("Kein Ziel");
    await store.setLessonStatus(vorher.targetLessonId, "entfallen", "Ausfall");

    const nachher = latestResolution(await store.load(), entry.id);
    expect(nachher?.targetDate).toBe("2026-10-15"); // Donnerstag
    // Der Wechsel ist nachvollziehbar festgehalten.
    expect(nachher?.previousTargetDate).toBe("2026-10-14");
    expect(nachher?.reason).not.toBeNull();
  });

  it("stellt eine ausdruecklich gewaehlte Stunde zur Pruefung, statt still zu wechseln", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const stunden = await lessonsOfCourse(store, mathe.id);
    const ziel = stunden.find((l) => l.date === "2026-10-15");
    if (!ziel) throw new Error("Zielstunde fehlt");

    const entry = await store.createEntry({
      kind: "hausuebung",
      courseId: mathe.id,
      lessonId: stunden[0]?.id ?? null,
      text: "Aufgaben",
      audience: "privat",
      dueRule: { kind: "SPECIFIC_LESSON", lessonId: ziel.id },
    });

    await store.setLessonStatus(ziel.id, "entfallen", null);

    const aufloesung = latestResolution(await store.load(), entry.id);
    expect(aufloesung?.state).toBe("pruefen");
    // Das Ziel wurde nicht stillschweigend ersetzt.
    expect(aufloesung?.targetLessonId).toBe(ziel.id);
  });

  it("laesst feste Termine vom Entfall unberuehrt", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const stunden = await lessonsOfCourse(store, mathe.id);
    const anker = stunden[0];
    if (!anker) throw new Error("Stunde fehlt");

    const entry = await store.createEntry({
      kind: "hausuebung",
      courseId: mathe.id,
      lessonId: anker.id,
      text: "Bis Monatsende",
      audience: "privat",
      dueRule: { kind: "FIXED_DATE", date: "2026-10-31" },
    });

    const ziel = stunden.find((l) => l.date === "2026-10-15");
    if (ziel) await store.setLessonStatus(ziel.id, "entfallen", null);

    const aufloesung = latestResolution(await store.load(), entry.id);
    expect(aufloesung?.targetDate).toBe("2026-10-31");
    expect(aufloesung?.targetTime).toBeNull(); // keine erfundene Mitternacht
  });

  it("behaelt Inhalte an einer entfallenen Stunde", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const stunden = await lessonsOfCourse(store, mathe.id);
    const stunde = stunden[0];
    if (!stunde) throw new Error("Stunde fehlt");

    await store.createEntry({
      kind: "notiz",
      courseId: mathe.id,
      lessonId: stunde.id,
      text: "Wichtige Notiz",
      audience: "privat",
      dueRule: null,
    });

    await store.setLessonStatus(stunde.id, "entfallen", null);

    const snapshot = await store.load();
    const notiz = snapshot.entries.find(
      (e) => e.announcedInLessonId === stunde.id,
    );
    expect(notiz).toBeDefined();
    expect(snapshot.lessons.find((l) => l.id === stunde.id)?.status).toBe(
      "entfallen",
    );
  });
});

describe("Verschieben und Aendern", () => {
  it("behaelt Notizen und Aufgabenbezuege beim Verschieben", async () => {
    const { store } = await freshStore("2026-10-14");
    const physik = await courseNamed(store, "Physik");
    const stunden = await lessonsOfCourse(store, physik.id);
    const stunde = stunden.find((l) => l.date === "2026-10-12");
    if (!stunde) throw new Error("Stunde fehlt");

    const entry = await store.createEntry({
      kind: "notiz",
      courseId: physik.id,
      lessonId: stunde.id,
      text: "Formelsammlung mitnehmen",
      audience: "privat",
      dueRule: null,
    });

    await store.moveLesson(stunde.id, "2026-10-16", "14:00", "14:50");

    const snapshot = await store.load();
    const verschoben = snapshot.lessons.find((l) => l.id === stunde.id);

    // Dieselbe Kennung, neue Eigenschaften.
    expect(verschoben?.id).toBe(stunde.id);
    expect(verschoben?.date).toBe("2026-10-16");
    expect(verschoben?.startsAt).toBe("14:00");
    // Der Inhalt haengt weiterhin daran.
    expect(
      snapshot.entries.find((e) => e.id === entry.id)?.announcedInLessonId,
    ).toBe(stunde.id);
  });

  it("aendert eine Serie erst ab dem Stichtag und gleicht ab, statt zu doppeln", async () => {
    const { store } = await freshStore("2026-10-14");
    const physik = await courseNamed(store, "Physik");
    const snapshotVorher = await store.load();
    const serie = snapshotVorher.series.find(
      (s) => s.courseId === physik.id && s.weekday === 1,
    );
    if (!serie) throw new Error("Serie fehlt");

    const vorherStunde = snapshotVorher.lessons.find(
      (l) => l.seriesId === serie.id && l.date === "2026-10-19",
    );

    // Nur die Zeiten aendern, die Rasterstunde bleibt.
    await store.editSeriesFrom(serie.id, "2026-10-19", {
      startsAt: "10:15",
      endsAt: "11:05",
    });

    const snapshot = await store.load();
    const stunden = snapshot.lessons
      .filter((l) => l.courseId === physik.id && l.seriesId === serie.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    const vorher = stunden.find((l) => l.date === "2026-10-12");
    const nachher = stunden.find((l) => l.date === "2026-10-19");

    // Die fruehere Stunde behaelt ihre Zeit.
    expect(vorher?.startsAt).toBe("10:00");
    // Ab dem Stichtag gilt die neue Zeit.
    expect(nachher?.startsAt).toBe("10:15");
    expect(nachher?.endsAt).toBe("11:05");

    // Abgeglichen, nicht gedoppelt: dieselbe Kennung wie vorher.
    expect(nachher?.id).toBe(vorherStunde?.id);
    expect(
      stunden.filter((l) => l.date === "2026-10-19"),
    ).toHaveLength(1);
  });

  it("deaktiviert eine weggefallene Rasterstunde, statt sie zu loeschen", async () => {
    const { store } = await freshStore("2026-10-14");
    const physik = await courseNamed(store, "Physik");
    const snapshotVorher = await store.load();
    const serie = snapshotVorher.series.find(
      (s) => s.courseId === physik.id && s.weekday === 1,
    );
    if (!serie) throw new Error("Serie fehlt");

    const alteStunde = snapshotVorher.lessons.find(
      (l) => l.seriesId === serie.id && l.date === "2026-10-19",
    );
    if (!alteStunde) throw new Error("Stunde fehlt");

    // Eine Notiz haengt an der alten Stunde.
    await store.createEntry({
      kind: "notiz",
      courseId: physik.id,
      lessonId: alteStunde.id,
      text: "Bleibt erhalten",
      audience: "privat",
      dueRule: null,
    });

    // Die Serie zieht auf eine andere Rasterstunde um.
    await store.editSeriesFrom(serie.id, "2026-10-19", {
      periodIndexes: [4],
      startsAt: "11:00",
      endsAt: "11:50",
    });

    const snapshot = await store.load();

    // Die alte Stunde existiert weiter, nur deaktiviert.
    const alt = snapshot.lessons.find((l) => l.id === alteStunde.id);
    expect(alt).toBeDefined();
    expect(alt?.status).toBe("entfallen");

    // Die Notiz haengt weiterhin daran.
    expect(
      snapshot.entries.some((e) => e.announcedInLessonId === alteStunde.id),
    ).toBe(true);

    // Und es gibt genau eine aktive Stunde an diesem Tag.
    const aktiv = snapshot.lessons.filter(
      (l) =>
        l.seriesId === serie.id &&
        l.date === "2026-10-19" &&
        l.status !== "entfallen",
    );
    expect(aktiv).toHaveLength(1);
    expect(aktiv[0]?.startsAt).toBe("11:00");
  });
});

describe("Persoenlicher Stand", () => {
  it("bleibt erhalten, wenn sich der Text aendert, und wird gekennzeichnet", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const stunden = await lessonsOfCourse(store, mathe.id);
    const anker = stunden[0];
    if (!anker) throw new Error("Stunde fehlt");

    const entry = await store.createEntry({
      kind: "hausuebung",
      courseId: mathe.id,
      lessonId: anker.id,
      text: "S. 84 Nr. 4–8",
      audience: "kurs",
      dueRule: { kind: "NEXT_SUBJECT_LESSON", anchorLessonId: anker.id },
    });

    await store.setTaskDone(entry.id, true);
    const vorher = await store.load();
    const standVorher = taskStateOf(vorher, entry.id, LOCAL_USER_ID);
    expect(standVorher?.done).toBe(true);

    // Der Umfang waechst.
    await store.reviseEntry(entry.id, "S. 84 Nr. 4–10", null, "erweitert");

    const nachher = await store.load();
    const eintrag = nachher.entries.find((e) => e.id === entry.id);
    const stand = taskStateOf(nachher, entry.id, LOCAL_USER_ID);

    // Erledigt bleibt erledigt – aber fuer die alte Fassung.
    expect(stand?.done).toBe(true);
    expect(stand?.doneForVersionId).not.toBe(eintrag?.currentVersionId);
  });

  it("bleibt nach einer Aenderung des Stundenplans erledigt", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const stunden = await lessonsOfCourse(store, mathe.id);
    const anker = stunden[0];
    if (!anker) throw new Error("Stunde fehlt");

    const entry = await store.createEntry({
      kind: "hausuebung",
      courseId: mathe.id,
      lessonId: anker.id,
      text: "Aufgaben",
      audience: "privat",
      dueRule: { kind: "NEXT_SUBJECT_LESSON", anchorLessonId: anker.id },
    });

    await store.setTaskDone(entry.id, true);

    const aufloesung = latestResolution(await store.load(), entry.id);
    if (aufloesung?.targetLessonId) {
      await store.setLessonStatus(aufloesung.targetLessonId, "entfallen", null);
    }

    const stand = taskStateOf(await store.load(), entry.id, LOCAL_USER_ID);
    expect(stand?.done).toBe(true);
  });
});

describe("Ohne Faelligkeit", () => {
  it("ist ein gueltiger Zustand und bleibt sichtbar", async () => {
    const { store } = await freshStore("2026-10-14");
    const deutsch = await courseNamed(store, "Deutsch");
    const stunden = await lessonsOfCourse(store, deutsch.id);
    const anker = stunden[0];
    if (!anker) throw new Error("Stunde fehlt");

    await store.createEntry({
      kind: "hausuebung",
      courseId: deutsch.id,
      lessonId: anker.id,
      text: "Lektuere lesen",
      audience: "privat",
      dueRule: { kind: "NONE" },
    });

    const snapshot = await store.load();
    const aufgaben = openTasks(snapshot, LOCAL_USER_ID, "2026-10-14", "10:00");
    expect(aufgaben).toHaveLength(1);
    expect(aufgaben[0]?.resolution?.state).toBe("ohne");
    expect(aufgaben[0]?.overdue).toBe(false);
  });
});

describe("Ferien und unterrichtsfreie Zeit", () => {
  it("nimmt uebersprungene Tage nicht als Ziel", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const anker = await ersteStundeAb(store, mathe.id, "2026-10-13");

    // Der Mittwoch faellt in einen erfassten unterrichtsfreien Zeitraum.
    await store.addException("2026-10-14", "2026-10-14", "Schulfrei");

    const entry = await store.createEntry({
      kind: "hausuebung",
      courseId: mathe.id,
      lessonId: anker.id,
      text: "Aufgaben",
      audience: "privat",
      dueRule: { kind: "NEXT_SUBJECT_LESSON", anchorLessonId: anker.id },
    });

    const aufloesung = latestResolution(await store.load(), entry.id);
    expect(aufloesung?.targetDate).not.toBe("2026-10-14");
    expect(aufloesung?.targetDate).toBe("2026-10-15");
  });
});
