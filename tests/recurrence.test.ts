import { describe, expect, it } from "vitest";
import { freshStore, courseNamed, lessonsOfCourse } from "./helpers";
import { blocksOn, lessonsOn } from "@/data/store";
import { addDays, startOfWeek, weekdayOf } from "@/domain/time";

const MONTAG_DER_QUELLWOCHE = "2026-10-12";

describe("Stundenplan beim ersten Start", () => {
  it("zeigt den Plan sofort in der aktuellen Woche, ohne Einrichtungsschritt", async () => {
    const { store } = await freshStore("2026-10-14");
    const snapshot = await store.load();

    // Es gibt keinen Bestätigungsschritt: nach dem Anlegen ist der Plan da.
    expect(snapshot.seeded).toBe(true);
    expect(lessonsOn(snapshot, MONTAG_DER_QUELLWOCHE).length).toBeGreaterThan(0);
  });

  it("bildet die bestätigte Woche genau ab", async () => {
    const { store } = await freshStore("2026-10-14");
    const snapshot = await store.load();
    const namen = (datum: string) =>
      blocksOn(snapshot, datum).map((b) => {
        const kurs = snapshot.courses.find((c) => c.id === b.courseId);
        return `${b.startsAt}-${b.endsAt} ${kurs?.displayName}`;
      });

    expect(namen("2026-10-12")).toEqual([
      "08:00-10:00 Bewegung und Sport",
      "10:00-10:50 Physik",
      "11:55-13:40 Labor",
    ]);
    expect(namen("2026-10-13")).toEqual([
      "08:00-08:50 Spanisch",
      "08:55-09:45 Geschichte",
      "10:00-10:50 Englisch",
      "11:00-11:50 Deutsch",
      "11:55-12:45 Mathematik",
      "13:40-15:20 KUG",
    ]);
    expect(namen("2026-10-15")).toEqual([
      "08:00-08:50 Spanisch",
      "08:55-09:45 Mathematik",
      "10:00-10:50 Chemie",
      "11:00-11:50 Englisch",
      "11:55-12:45 Biologie",
    ]);
  });

  it("hält die bestätigten Zeiten für Sport und KUG", async () => {
    const { store } = await freshStore("2026-10-14");
    const snapshot = await store.load();

    const sport = blocksOn(snapshot, "2026-10-12")[0];
    expect(sport?.startsAt).toBe("08:00");
    expect(sport?.endsAt).toBe("10:00"); // nicht 09:45
    expect(sport?.periodIndexes).toEqual([1, 2]);

    const kug = blocksOn(snapshot, "2026-10-13").at(-1);
    expect(kug?.startsAt).toBe("13:40");
    expect(kug?.endsAt).toBe("15:20");
  });

  it("lässt Sport und Physik nicht kollidieren", async () => {
    const { store } = await freshStore("2026-10-14");
    const snapshot = await store.load();
    const [sport, physik] = blocksOn(snapshot, "2026-10-12");
    // Endexklusiv: 10:00 gehört bereits zu Physik.
    expect(sport?.endsAt).toBe("10:00");
    expect(physik?.startsAt).toBe("10:00");
  });

  it("nimmt weder Latein noch Religion noch Ethik auf", async () => {
    const { store } = await freshStore("2026-10-14");
    const snapshot = await store.load();
    const namen = snapshot.courses.map((c) => c.displayName.toLowerCase());

    expect(namen.some((n) => n.includes("latein"))).toBe(false);
    expect(namen.some((n) => n.includes("religion"))).toBe(false);
    expect(namen.some((n) => n.includes("ethik"))).toBe(false);
    expect(namen).toContain("spanisch");
  });

  it("legt keine parallelen Alternativen gleichzeitig an", async () => {
    const { store } = await freshStore("2026-10-14");
    const snapshot = await store.load();

    // Dienstag 1. Stunde: nur Spanisch, nicht zusätzlich Latein.
    const ersteStunde = lessonsOn(snapshot, "2026-10-13").filter(
      (l) => l.periodIndex === 1,
    );
    expect(ersteStunde).toHaveLength(1);
  });

  it("führt kein Feld für Räume", async () => {
    const { store } = await freshStore("2026-10-14");
    const snapshot = await store.load();
    const alleFelder = new Set<string>();
    for (const lesson of snapshot.lessons) {
      for (const key of Object.keys(lesson)) alleFelder.add(key);
    }
    for (const course of snapshot.courses) {
      for (const key of Object.keys(course)) alleFelder.add(key);
    }
    expect([...alleFelder].some((k) => /raum|room/i.test(k))).toBe(false);
  });
});

describe("Wiederholung ohne Ende", () => {
  it("wiederholt den Plan in späteren Monaten und Jahren", async () => {
    const { store } = await freshStore("2026-10-14");

    // Weit in der Zukunft: der Zeitraum muss mitwachsen.
    for (const ziel of ["2027-03-15", "2028-05-08", "2030-11-11"]) {
      await store.ensureMaterialized(ziel);
      const snapshot = await store.load();
      const montag = startOfWeek(ziel);
      expect(weekdayOf(montag)).toBe(1);
      expect(blocksOn(snapshot, montag).length).toBe(3); // Sport, Physik, Labor
    }
  });

  it("setzt kein Enddatum und keine Begrenzung der Anzahl", async () => {
    const { store } = await freshStore("2026-10-14");
    const snapshot = await store.load();
    for (const serie of snapshot.series) {
      expect(serie.endsOn).toBeNull();
      expect(serie.intervalWeeks).toBe(1);
      expect(serie.active).toBe(true);
    }
  });

  it("hält dieselbe örtliche Uhrzeit über die Zeitumstellung", async () => {
    const { store } = await freshStore("2026-10-14");
    await store.ensureMaterialized("2027-04-30");
    const snapshot = await store.load();

    // Montage vor und nach der Umstellung im Frühjahr 2027 (28. März).
    const vorher = blocksOn(snapshot, "2027-03-22")[0];
    const nachher = blocksOn(snapshot, "2027-04-05")[0];
    expect(vorher?.startsAt).toBe("08:00");
    expect(nachher?.startsAt).toBe("08:00");
  });

  it("läuft über den Jahreswechsel weiter", async () => {
    const { store } = await freshStore("2026-12-14");
    await store.ensureMaterialized("2027-01-20");
    const snapshot = await store.load();
    expect(blocksOn(snapshot, "2027-01-11").length).toBe(3);
  });
});

describe("Erneutes Erzeugen", () => {
  it("legt bei wiederholtem Aufruf nichts doppelt an", async () => {
    const { store } = await freshStore("2026-10-14");
    const vorher = (await store.load()).lessons.length;

    await store.ensureMaterialized("2026-10-14");
    await store.ensureMaterialized("2026-10-20");
    await store.ensureSeeded("2026-10-14");

    expect((await store.load()).lessons.length).toBe(vorher);
  });

  it("erweitert den Zeitraum, statt zu behaupten, es gebe keine Stunde mehr", async () => {
    const { store } = await freshStore("2026-10-14");
    const vorher = (await store.load()).lessons.length;

    await store.ensureMaterialized("2027-06-01");
    const nachher = (await store.load()).lessons.length;

    expect(nachher).toBeGreaterThan(vorher);
  });

  it("behält Kennungen bestehender Stunden beim Erweitern", async () => {
    const { store } = await freshStore("2026-10-14");
    const vorher = (await store.load()).lessons.find(
      (l) => l.date === "2026-10-12",
    );

    await store.ensureMaterialized("2027-06-01");
    const nachher = (await store.load()).lessons.find(
      (l) => l.occurrenceKey === vorher?.occurrenceKey,
    );

    expect(nachher?.id).toBe(vorher?.id);
  });
});

describe("Doppelstunden", () => {
  it("fasst zusammen dar, behält aber die einzelnen Stunden", async () => {
    const { store } = await freshStore("2026-10-14");
    const snapshot = await store.load();

    const kug = blocksOn(snapshot, "2026-10-13").at(-1);
    expect(kug?.lessons).toHaveLength(2);
    expect(kug?.periodIndexes).toEqual([7, 8]);
    // Beide Stunden haben eigene, verschiedene Kennungen.
    expect(kug?.lessons[0]?.id).not.toBe(kug?.lessons[1]?.id);
  });
});

describe("Wahlpflichtfach", () => {
  it("führt Mathematik Wahlpflicht als eigenen Kurs", async () => {
    const { store } = await freshStore("2026-10-14");
    const mathe = await courseNamed(store, "Mathematik");
    const wpf = await courseNamed(store, "Mathematik (Wahlpflichtfach)");

    expect(wpf.id).not.toBe(mathe.id);
    expect(wpf.elective).toBe(true);

    const wpfStunden = await lessonsOfCourse(store, wpf.id);
    // Mittwoch, 8. und 9. Stunde.
    const mittwoch = wpfStunden.filter((l) => l.date === "2026-10-14");
    expect(mittwoch.map((l) => l.periodIndex)).toEqual([8, 9]);
  });
});
