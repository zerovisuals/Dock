import { describe, expect, it } from "vitest";
import { freshStore, courseNamed, lessonsOfCourse } from "./helpers";
import {
  confirmationsForCurrentVersion,
  inviteIsUsable,
  openCorrections,
  outdatedConfirmations,
} from "@/data/store";

/** Legt einen geteilten Eintrag an und gibt ihn zurück. */
async function geteilterEintrag(store: Awaited<ReturnType<typeof freshStore>>["store"]) {
  const mathe = await courseNamed(store, "Mathematik");
  const stunden = await lessonsOfCourse(store, mathe.id);
  const stunde = stunden[0];
  if (!stunde) throw new Error("Stunde fehlt");

  return store.createEntry({
    kind: "hausuebung",
    courseId: mathe.id,
    lessonId: stunde.id,
    text: "S. 84 Nr. 4–8",
    audience: "kurs",
    dueRule: null,
  });
}

describe("Bestätigungen", () => {
  it("gelten für genau die Fassung, die bestätigt wurde", async () => {
    const { store } = await freshStore("2026-10-14");
    const eintrag = await geteilterEintrag(store);

    await store.confirmVersion(eintrag.id, eintrag.currentVersionId);

    let snapshot = await store.load();
    let aktuell = snapshot.entries.find((e) => e.id === eintrag.id);
    if (!aktuell) throw new Error("Eintrag fehlt");

    expect(confirmationsForCurrentVersion(snapshot, aktuell)).toHaveLength(1);
    expect(outdatedConfirmations(snapshot, aktuell)).toHaveLength(0);

    // Der Text ändert sich – eine neue Fassung entsteht.
    await store.reviseEntry(eintrag.id, "S. 84 Nr. 4–10", null, "erweitert");

    snapshot = await store.load();
    aktuell = snapshot.entries.find((e) => e.id === eintrag.id);
    if (!aktuell) throw new Error("Eintrag fehlt");

    // Die Bestätigung gilt nicht mehr für den heutigen Text …
    expect(confirmationsForCurrentVersion(snapshot, aktuell)).toHaveLength(0);
    // … bleibt aber als Historie erhalten.
    expect(outdatedConfirmations(snapshot, aktuell)).toHaveLength(1);
  });

  it("zählt keine erfundenen Bestätigungen", async () => {
    const { store } = await freshStore("2026-10-14");
    const eintrag = await geteilterEintrag(store);

    const snapshot = await store.load();
    const aktuell = snapshot.entries.find((e) => e.id === eintrag.id);
    if (!aktuell) throw new Error("Eintrag fehlt");

    // Ohne Zutun gibt es null Bestätigungen, nicht eine erfundene.
    expect(confirmationsForCurrentVersion(snapshot, aktuell)).toHaveLength(0);
  });

  it("bestätigt nicht doppelt", async () => {
    const { store } = await freshStore("2026-10-14");
    const eintrag = await geteilterEintrag(store);

    await store.confirmVersion(eintrag.id, eintrag.currentVersionId);
    await store.confirmVersion(eintrag.id, eintrag.currentVersionId);

    expect((await store.load()).confirmations).toHaveLength(1);
  });

  it("lässt sich zurücknehmen", async () => {
    const { store } = await freshStore("2026-10-14");
    const eintrag = await geteilterEintrag(store);

    await store.confirmVersion(eintrag.id, eintrag.currentVersionId);
    await store.withdrawConfirmation(eintrag.currentVersionId);

    expect((await store.load()).confirmations).toHaveLength(0);
  });
});

describe("Korrekturvorschläge", () => {
  it("ändern nichts, bis sie übernommen werden", async () => {
    const { store } = await freshStore("2026-10-14");
    const eintrag = await geteilterEintrag(store);

    await store.proposeCorrection(
      eintrag.id,
      eintrag.currentVersionId,
      "S. 84 Nr. 4–12",
      "Ich habe 12 notiert",
    );

    const snapshot = await store.load();
    const aktuell = snapshot.entries.find((e) => e.id === eintrag.id);
    const fassung = snapshot.versions.find(
      (v) => v.id === aktuell?.currentVersionId,
    );

    // Der Widerspruch ist sichtbar, der Text unverändert.
    expect(openCorrections(snapshot, eintrag.id)).toHaveLength(1);
    expect(fassung?.text).toBe("S. 84 Nr. 4–8");
  });

  it("erzeugen beim Übernehmen eine neue Fassung", async () => {
    const { store } = await freshStore("2026-10-14");
    const eintrag = await geteilterEintrag(store);

    // Jemand bestätigt zuerst die ursprüngliche Fassung.
    await store.confirmVersion(eintrag.id, eintrag.currentVersionId);

    const vorschlag = await store.proposeCorrection(
      eintrag.id,
      eintrag.currentVersionId,
      "S. 84 Nr. 4–12",
      null,
    );
    await store.acceptCorrection(vorschlag.id);

    const snapshot = await store.load();
    const aktuell = snapshot.entries.find((e) => e.id === eintrag.id);
    if (!aktuell) throw new Error("Eintrag fehlt");
    const fassung = snapshot.versions.find(
      (v) => v.id === aktuell.currentVersionId,
    );

    expect(fassung?.text).toBe("S. 84 Nr. 4–12");
    expect(fassung?.revision).toBe(2);
    expect(openCorrections(snapshot, eintrag.id)).toHaveLength(0);

    // Die frühere Bestätigung gilt nicht für die neue Fassung.
    expect(confirmationsForCurrentVersion(snapshot, aktuell)).toHaveLength(0);
    expect(outdatedConfirmations(snapshot, aktuell)).toHaveLength(1);
  });

  it("lassen sich ablehnen, ohne den Text zu ändern", async () => {
    const { store } = await freshStore("2026-10-14");
    const eintrag = await geteilterEintrag(store);

    const vorschlag = await store.proposeCorrection(
      eintrag.id,
      eintrag.currentVersionId,
      "Etwas anderes",
      null,
    );
    await store.rejectCorrection(vorschlag.id);

    const snapshot = await store.load();
    const aktuell = snapshot.entries.find((e) => e.id === eintrag.id);
    const fassung = snapshot.versions.find(
      (v) => v.id === aktuell?.currentVersionId,
    );

    expect(fassung?.text).toBe("S. 84 Nr. 4–8");
    expect(
      snapshot.corrections.find((c) => c.id === vorschlag.id)?.state,
    ).toBe("abgelehnt");
  });
});

describe("Einladungen", () => {
  it("laufen ab und lassen sich zurücknehmen", async () => {
    const { store } = await freshStore("2026-10-14");

    const einladung = await store.createInvite({ gueltigTage: 7, maxUses: 3 });
    expect(inviteIsUsable(einladung)).toBe(true);
    expect(einladung.requiresApproval).toBe(true);

    // Nach Ablauf nicht mehr einlösbar.
    const spaeter = new Date(Date.now() + 8 * 86_400_000);
    expect(inviteIsUsable(einladung, spaeter)).toBe(false);

    // Zurückgenommen ebenfalls nicht.
    await store.revokeInvite(einladung.id);
    const snapshot = await store.load();
    const zurueckgenommen = snapshot.invites.find((i) => i.id === einladung.id);
    if (!zurueckgenommen) throw new Error("Einladung fehlt");
    expect(inviteIsUsable(zurueckgenommen)).toBe(false);
  });

  it("sind nicht durch Raten zu treffen", async () => {
    const { store } = await freshStore("2026-10-14");
    const einladung = await store.createInvite();

    // Der Code ist keine Ableitung des Klassennamens.
    expect(einladung.code).not.toContain("7c");
    expect(einladung.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    // Verwechselbare Zeichen kommen nicht vor.
    expect(einladung.code).not.toMatch(/[01OIL]/);
  });

  it("begrenzen die Zahl der Einlösungen", async () => {
    const { store } = await freshStore("2026-10-14");
    const einladung = await store.createInvite({ maxUses: 2 });

    expect(inviteIsUsable({ ...einladung, uses: 1 })).toBe(true);
    expect(inviteIsUsable({ ...einladung, uses: 2 })).toBe(false);
  });
});
