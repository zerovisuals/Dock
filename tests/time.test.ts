import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatDateLong,
  isoWeekNumber,
  localDateOf,
  localTimeOf,
  overlaps,
  startOfWeek,
  toInstant,
  weekdayOf,
} from "@/domain/time";

describe("Kalenderrechnung", () => {
  it("bestimmt den Wochentag nach ISO 8601", () => {
    expect(weekdayOf("2026-10-12")).toBe(1); // Montag
    expect(weekdayOf("2026-10-18")).toBe(7); // Sonntag
  });

  it("findet den Montag der Woche", () => {
    expect(startOfWeek("2026-10-15")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-12")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12");
  });

  it("rechnet über Monats- und Jahresgrenzen", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29"); // Schaltjahr
    expect(daysBetween("2026-10-12", "2027-10-12")).toBe(365);
  });

  it("nennt Monate auf oesterreichisch", () => {
    expect(formatDateLong("2026-01-07")).toBe("7. Jänner 2026");
    expect(formatDateLong("2026-03-02")).toBe("2. März 2026");
  });

  it("zählt Kalenderwochen", () => {
    expect(isoWeekNumber("2026-10-12")).toBe(42);
  });
});

describe("Zeitzone Europe/Vienna", () => {
  it("hält die örtliche Uhrzeit über die Zeitumstellung hinweg", () => {
    // Umstellung im Frühjahr 2026: Sonntag, 29. März.
    const before = toInstant("2026-03-23", "08:00");
    const after = toInstant("2026-03-30", "08:00");

    expect(localTimeOf(before)).toBe("08:00");
    expect(localTimeOf(after)).toBe("08:00");

    // Der Abstand beträgt 167 Stunden, nicht 168: genau das unterscheidet
    // die Rechnung in Ortszeit von einer Addition in UTC.
    const hours = (after.getTime() - before.getTime()) / 3_600_000;
    expect(hours).toBe(167);
  });

  it("hält die örtliche Uhrzeit über die Umstellung im Herbst", () => {
    const before = toInstant("2026-10-19", "13:40");
    const after = toInstant("2026-10-26", "13:40");
    expect(localTimeOf(before)).toBe("13:40");
    expect(localTimeOf(after)).toBe("13:40");
    expect((after.getTime() - before.getTime()) / 3_600_000).toBe(169);
  });

  it("rechnet Ortszeit und Zeitpunkt verlustfrei ineinander um", () => {
    for (const date of ["2026-01-15", "2026-07-15", "2026-10-12"]) {
      const instant = toInstant(date, "11:55");
      expect(localDateOf(instant)).toBe(date);
      expect(localTimeOf(instant)).toBe("11:55");
    }
  });

  it("schiebt eine übersprungene Ortszeit nach vorne", () => {
    // 02:30 gibt es am Umstellungstag nicht.
    const instant = toInstant("2026-03-29", "02:30");
    expect(localTimeOf(instant)).toBe("03:30");
  });

  it("waehlt bei doppelter Ortszeit das erste Auftreten", () => {
    const instant = toInstant("2026-10-25", "02:30");
    expect(localTimeOf(instant)).toBe("02:30");
    // Das erste Auftreten liegt noch in der Sommerzeit: 00:30 UTC.
    expect(instant.toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });
});

describe("Intervalle", () => {
  it("behandelt aneinandergrenzende Stunden als konfliktfrei", () => {
    // Sport endet um 10:00, Physik beginnt um 10:00.
    expect(overlaps("08:00", "10:00", "10:00", "10:50")).toBe(false);
  });

  it("erkennt echte Überschneidungen", () => {
    expect(overlaps("08:00", "10:00", "09:45", "10:50")).toBe(true);
  });
});
