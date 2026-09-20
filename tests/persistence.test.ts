import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbRepository } from "@/data/indexeddb";
import { DockStore } from "@/data/store";
import { LOCAL_USER_ID } from "@/domain/seed";
import { latestResolution, taskStateOf } from "@/data/store";

/**
 * Echte Speicherung über IndexedDB.
 *
 * Geprüft wird das, was der Benutzer erlebt: schließen, wieder öffnen, und
 * alles ist noch da. Dafür wird ein zweiter Speicher auf dieselbe Datenbank
 * gesetzt – das entspricht einem Neuladen der Seite.
 */

let lauf = 0;
let datenbank = "dock-test-0";

// Jeder Test bekommt eine eigene Datenbank. Das ist zuverlaessiger als das
// Loeschen einer gemeinsamen, deren Verbindungen noch offen sein koennen.
beforeEach(() => {
  lauf += 1;
  datenbank = `dock-test-${lauf}`;
});

describe("Speicherung auf dem Gerät", () => {
  it("überlebt das Neuladen", async () => {
    const ersteSitzung = new DockStore(new IndexedDbRepository(datenbank), LOCAL_USER_ID);
    await ersteSitzung.ensureSeeded("2026-10-14");

    const snapshot = await ersteSitzung.load();
    const mathe = snapshot.courses.find((c) => c.displayName === "Mathematik");
    if (!mathe) throw new Error("Kurs fehlt");
    const stunde = snapshot.lessons.find((l) => l.courseId === mathe.id);
    if (!stunde) throw new Error("Stunde fehlt");

    const eintrag = await ersteSitzung.createEntry({
      kind: "hausuebung",
      courseId: mathe.id,
      lessonId: stunde.id,
      text: "S. 84 Nr. 4–8",
      audience: "privat",
      dueRule: { kind: "NEXT_SUBJECT_LESSON", anchorLessonId: stunde.id },
    });
    await ersteSitzung.setTaskDone(eintrag.id, true);

    // Neue Sitzung auf derselben Datenbank – wie nach einem Neuladen.
    const zweiteSitzung = new DockStore(new IndexedDbRepository(datenbank), LOCAL_USER_ID);
    const danach = await zweiteSitzung.load();

    expect(danach.seeded).toBe(true);
    expect(danach.courses).toHaveLength(14);
    expect(danach.lessons.length).toBeGreaterThan(0);

    const geladen = danach.entries.find((e) => e.id === eintrag.id);
    expect(geladen).toBeDefined();
    expect(
      danach.versions.find((v) => v.id === geladen?.currentVersionId)?.text,
    ).toBe("S. 84 Nr. 4–8");

    // Der persönliche Stand ebenfalls.
    expect(taskStateOf(danach, eintrag.id, LOCAL_USER_ID)?.done).toBe(true);
    // Und die festgehaltene Fälligkeit.
    expect(latestResolution(danach, eintrag.id)?.state).toBe("aufgeloest");
  });

  it("legt beim erneuten Start nichts doppelt an", async () => {
    const erste = new DockStore(new IndexedDbRepository(datenbank), LOCAL_USER_ID);
    await erste.ensureSeeded("2026-10-14");
    const anzahl = (await erste.load()).lessons.length;

    const zweite = new DockStore(new IndexedDbRepository(datenbank), LOCAL_USER_ID);
    await zweite.ensureSeeded("2026-10-14");

    expect((await zweite.load()).lessons.length).toBe(anzahl);
    expect((await zweite.load()).courses).toHaveLength(14);
  });

  it("gibt beim Export alles heraus, auch die Dateien", async () => {
    const store = new DockStore(new IndexedDbRepository(datenbank), LOCAL_USER_ID);
    await store.ensureSeeded("2026-10-14");

    const snapshot = await store.load();
    const kurs = snapshot.courses[0];
    const stunde = snapshot.lessons[0];
    if (!kurs || !stunde) throw new Error("Grunddaten fehlen");

    const datei = new File(["Hallo"], "notiz.pdf", { type: "application/pdf" });
    await store.attachFile({
      file: datei,
      courseId: kurs.id,
      lessonId: stunde.id,
      entryId: null,
      assessmentId: null,
      audience: "privat",
    });

    const { json, files } = await store.exportAll();
    const inhalt = JSON.parse(json);

    expect(inhalt.courses).toHaveLength(14);
    expect(inhalt.lessons.length).toBeGreaterThan(0);
    expect(files).toHaveLength(1);
    expect(files[0]?.name).toContain("notiz.pdf");
  });

  it("löscht auf Wunsch wirklich alles, einschließlich der Dateiinhalte", async () => {
    const repo = new IndexedDbRepository(datenbank);
    const store = new DockStore(repo, LOCAL_USER_ID);
    await store.ensureSeeded("2026-10-14");

    const snapshot = await store.load();
    const kurs = snapshot.courses[0];
    const stunde = snapshot.lessons[0];
    if (!kurs || !stunde) throw new Error("Grunddaten fehlen");

    const dokument = await store.attachFile({
      file: new File(["x"], "a.png", { type: "image/png" }),
      courseId: kurs.id,
      lessonId: stunde.id,
      entryId: null,
      assessmentId: null,
      audience: "privat",
    });

    await store.deleteEverything();

    const danach = await store.load();
    expect(danach.courses).toHaveLength(0);
    expect(danach.lessons).toHaveLength(0);
    expect(danach.documents).toHaveLength(0);
    // Der Dateiinhalt ist ebenfalls weg, nicht nur der Datensatz.
    expect(await repo.getBlob(dokument.id)).toBeUndefined();
  });

  it("sichert nicht abgeschickte Entwürfe und gibt sie wieder her", async () => {
    const erste = new DockStore(new IndexedDbRepository(datenbank), LOCAL_USER_ID);
    await erste.ensureSeeded("2026-10-14");
    await erste.saveDraft("erfassen:hausuebung:abc", "S. 84 Nr. 4");

    const zweite = new DockStore(new IndexedDbRepository(datenbank), LOCAL_USER_ID);
    expect(await zweite.getDraft("erfassen:hausuebung:abc")).toBe(
      "S. 84 Nr. 4",
    );

    await zweite.clearDraft("erfassen:hausuebung:abc");
    expect(await zweite.getDraft("erfassen:hausuebung:abc")).toBeNull();
  });
});
