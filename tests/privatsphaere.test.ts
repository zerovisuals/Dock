import { describe, expect, it } from "vitest";
import { MemoryRepository } from "@/data/indexeddb";
import { DockStore, taskStateOf, latestResolution } from "@/data/store";
import { freshStore, courseNamed, lessonsOfCourse } from "./helpers";
import { LOCAL_USER_ID } from "@/domain/seed";
import { validateUpload } from "@/data/repository";

const ZWEITE_PERSON = "99999999-0000-4000-8000-00000000000b";

/**
 * Sichtbarkeit und Herkunft.
 *
 * Hinweis zur Reichweite: Diese Tests pruefen das Modell und die Logik ueber
 * dem Speicher. Die Durchsetzung fuer echte, getrennte Benutzerkonten liegt
 * in den Richtlinien der Datenbank (supabase/migrations/0001_init.sql). Sie
 * laesst sich ohne ein eingerichtetes Backend nicht ausfuehren und ist daher
 * hier nicht geprueft – das wird ausdruecklich so festgehalten.
 */

describe("Privat und Klasse", () => {
  it("fuehrt Zielgruppe und Herkunft getrennt", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const stunden = await lessonsOfCourse(store, mathe.id);
    const stunde = stunden[0];
    if (!stunde) throw new Error("Stunde fehlt");

    const privat = await store.createEntry({
      kind: "notiz",
      courseId: mathe.id,
      lessonId: stunde.id,
      text: "Nur fuer mich",
      audience: "privat",
      dueRule: null,
    });

    const geteilt = await store.createEntry({
      kind: "behandelt",
      courseId: mathe.id,
      lessonId: stunde.id,
      text: "Produktregel",
      audience: "kurs",
      dueRule: null,
    });

    const snapshot = await store.load();
    const a = snapshot.entries.find((e) => e.id === privat.id);
    const b = snapshot.entries.find((e) => e.id === geteilt.id);

    expect(a?.audience).toBe("privat");
    expect(b?.audience).toBe("kurs");
    // Beide stammen von der Person selbst – die Herkunft sagt nichts ueber
    // die Sichtbarkeit aus.
    expect(a?.origin).toBe("selbst");
    expect(b?.origin).toBe("selbst");
  });

  it("haelt den Erledigt-Stand zwischen Personen getrennt", async () => {
    const repo = new MemoryRepository();
    const ich = new DockStore(repo, LOCAL_USER_ID);
    const andere = new DockStore(repo, ZWEITE_PERSON);

    await ich.ensureSeeded("2026-10-14");
    const snapshot = await ich.load();
    const mathe = snapshot.courses.find((c) => c.displayName === "Mathematik");
    if (!mathe) throw new Error("Kurs fehlt");
    const stunde = snapshot.lessons.find((l) => l.courseId === mathe.id);
    if (!stunde) throw new Error("Stunde fehlt");

    // Eine geteilte Aufgabe.
    const aufgabe = await ich.createEntry({
      kind: "hausuebung",
      courseId: mathe.id,
      lessonId: stunde.id,
      text: "S. 84 Nr. 4–8",
      audience: "kurs",
      dueRule: { kind: "NEXT_SUBJECT_LESSON", anchorLessonId: stunde.id },
    });

    await ich.setTaskDone(aufgabe.id, true);

    const danach = await ich.load();
    // Mein Stand: erledigt. Der Stand der anderen Person: unberuehrt.
    expect(taskStateOf(danach, aufgabe.id, LOCAL_USER_ID)?.done).toBe(true);
    expect(taskStateOf(danach, aufgabe.id, ZWEITE_PERSON)).toBeUndefined();

    // Die andere Person hakt fuer sich ab.
    await andere.setTaskDone(aufgabe.id, true);
    const zuletzt = await ich.load();
    expect(taskStateOf(zuletzt, aufgabe.id, ZWEITE_PERSON)?.done).toBe(true);
    // Und das aendert meinen Stand nicht.
    expect(taskStateOf(zuletzt, aufgabe.id, LOCAL_USER_ID)?.done).toBe(true);
  });

  it("erfasst zu Abwesenheiten keinen Grund", async () => {
    const { store } = await freshStore("2026-10-14");
    const zeitraum = await store.addMissedInterval("2026-10-12", "2026-10-13");

    const felder = Object.keys(zeitraum);
    expect(felder).not.toContain("reason");
    expect(felder).not.toContain("grund");
    expect(felder.some((f) => /grund|reason|krank/i.test(f))).toBe(false);
  });
});

describe("Fassungen und Bestaetigungen", () => {
  it("legt bei einer Aenderung eine neue Fassung an", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const stunden = await lessonsOfCourse(store, mathe.id);
    const stunde = stunden[0];
    if (!stunde) throw new Error("Stunde fehlt");

    const eintrag = await store.createEntry({
      kind: "hausuebung",
      courseId: mathe.id,
      lessonId: stunde.id,
      text: "S. 84 Nr. 4–8",
      audience: "kurs",
      dueRule: null,
    });

    const ersteFassung = eintrag.currentVersionId;
    await store.reviseEntry(eintrag.id, "S. 84 Nr. 4–10", null, "erweitert");

    const snapshot = await store.load();
    const fassungen = snapshot.versions.filter((v) => v.entryId === eintrag.id);
    const aktuell = snapshot.entries.find((e) => e.id === eintrag.id);

    expect(fassungen).toHaveLength(2);
    expect(aktuell?.currentVersionId).not.toBe(ersteFassung);
    // Die alte Fassung bleibt als Historie erhalten.
    expect(fassungen.some((v) => v.id === ersteFassung)).toBe(true);
    expect(fassungen.find((v) => v.revision === 1)?.text).toBe("S. 84 Nr. 4–8");
    expect(fassungen.find((v) => v.revision === 2)?.text).toBe("S. 84 Nr. 4–10");
  });

  it("markiert eine Erledigung als veraltet, wenn der Umfang waechst", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const stunden = await lessonsOfCourse(store, mathe.id);
    const stunde = stunden[0];
    if (!stunde) throw new Error("Stunde fehlt");

    const eintrag = await store.createEntry({
      kind: "hausuebung",
      courseId: mathe.id,
      lessonId: stunde.id,
      text: "S. 84 Nr. 4–8",
      audience: "kurs",
      dueRule: null,
    });

    await store.setTaskDone(eintrag.id, true);
    const vorher = await store.load();
    const standVorher = taskStateOf(vorher, eintrag.id, LOCAL_USER_ID);

    await store.reviseEntry(eintrag.id, "S. 84 Nr. 4–10", null, null);

    const nachher = await store.load();
    const aktuell = nachher.entries.find((e) => e.id === eintrag.id);
    const stand = taskStateOf(nachher, eintrag.id, LOCAL_USER_ID);

    // Der Stand bleibt, zeigt aber auf die alte Fassung: die zusaetzliche
    // Arbeit gilt nicht stillschweigend als erledigt.
    expect(stand?.done).toBe(true);
    expect(stand?.doneForVersionId).toBe(standVorher?.doneForVersionId);
    expect(stand?.doneForVersionId).not.toBe(aktuell?.currentVersionId);
  });
});

describe("Dateien", () => {
  it("nimmt die erlaubten Arten an", () => {
    for (const [name, typ] of [
      ["skript.pdf", "application/pdf"],
      ["mitschrift.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ["tafel.jpg", "image/jpeg"],
      ["tafel.png", "image/png"],
      ["tafel.webp", "image/webp"],
    ] as const) {
      expect(validateUpload({ name, type: typ, size: 1024 }).ok).toBe(true);
    }
  });

  it("lehnt ausfuehrbare und makrofaehige Inhalte ab", () => {
    for (const [name, typ] of [
      ["virus.exe", "application/pdf"],
      ["makro.docm", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ["skript.js", "application/pdf"],
      ["seite.html", "application/pdf"],
      ["bild.svg", "image/png"],
    ] as const) {
      expect(validateUpload({ name, type: typ, size: 1024 }).ok).toBe(false);
    }
  });

  it("haelt die Groessenbeschraenkung ein und nennt sie", () => {
    const ergebnis = validateUpload(
      { name: "gross.pdf", type: "application/pdf", size: 11 * 1024 * 1024 },
      10 * 1024 * 1024,
    );
    expect(ergebnis.ok).toBe(false);
    if (!ergebnis.ok) expect(ergebnis.reason).toContain("10 MB");
  });

  it("lehnt leere Dateien ab", () => {
    expect(
      validateUpload({ name: "leer.pdf", type: "application/pdf", size: 0 }).ok,
    ).toBe(false);
  });
});

describe("Nachholen", () => {
  it("findet auch nachtraeglich erfasste Eintraege", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const stunden = await lessonsOfCourse(store, mathe.id);
    // Eine Stunde in der Vergangenheit.
    const vergangen = stunden.find((l) => l.date === "2026-10-13");
    if (!vergangen) throw new Error("Stunde fehlt");

    await store.addMissedInterval("2026-10-13", "2026-10-13");

    // Der Eintrag entsteht erst jetzt, gehoert aber zu jener Stunde.
    await store.createEntry({
      kind: "behandelt",
      courseId: mathe.id,
      lessonId: vergangen.id,
      text: "Nachgetragen: Produktregel",
      audience: "kurs",
      dueRule: null,
    });

    const snapshot = await store.load();
    const zeitraum = snapshot.missedIntervals[0];
    expect(zeitraum?.from).toBe("2026-10-13");

    const treffer = snapshot.entries.filter(
      (e) => e.announcedInLessonId === vergangen.id,
    );
    expect(treffer).toHaveLength(1);
    expect(
      snapshot.versions.find((v) => v.id === treffer[0]?.currentVersionId)?.text,
    ).toContain("Nachgetragen");
  });

  it("meldet fehlende Aufzeichnungen, statt Leere als Nichtstun auszugeben", async () => {
    const { store } = await freshStore("2026-10-14");
    await store.addMissedInterval("2026-10-12", "2026-10-12");

    const snapshot = await store.load();
    const montagsStunden = snapshot.lessons.filter(
      (l) => l.date === "2026-10-12",
    );
    const mitInhalt = montagsStunden.filter((l) =>
      snapshot.entries.some((e) => e.announcedInLessonId === l.id),
    );

    // Es gibt Stunden, aber keine Aufzeichnungen. Genau das muss die
    // Oberflaeche sagen koennen.
    expect(montagsStunden.length).toBeGreaterThan(0);
    expect(mitInhalt).toHaveLength(0);
  });
});
