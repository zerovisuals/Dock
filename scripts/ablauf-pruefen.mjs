/**
 * Durchgängige Prüfung im echten Browser.
 *
 * Der Ablauf aus der Aufgabenstellung: Stunde wählen, Hausübung zur nächsten
 * Stunde erfassen, neu laden, Zielstunde entfallen lassen, die neue
 * Auflösung sehen, persönlich abhaken.
 */
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const BASE = process.env.DOCK_BASE ?? "http://localhost:3000";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch({
  executablePath: existsSync(EXE) ? EXE : undefined,
});
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  isMobile: true,
  hasTouch: true,
  locale: "de-AT",
  timezoneId: "Europe/Vienna",
});
// Der Willkommensablauf wird beim allerersten Start angeboten. Für diese
// Prüfung wird er als gesehen markiert, damit direkt die App erscheint.
await context.addInitScript(() => {
  try {
    window.localStorage.setItem("dock:willkommen", "1");
  } catch {
    // Ohne lokalen Speicher landet die Prüfung im Willkommensablauf; das
    // würde auffallen.
  }
});

const page = await context.newPage();

const fehler = [];
page.on("pageerror", (e) => fehler.push(String(e)));

const schritte = [];
function melde(name, ok, notiz = "") {
  schritte.push({ name, ok, notiz });
  console.log(`${ok ? "  OK  " : " FEHL "} ${name}${notiz ? ` – ${notiz}` : ""}`);
}

try {
  // --- 1. Montag der Quellwoche ansteuern --------------------------------
  await page.goto(`${BASE}/app?vorschau=2026-09-21T09:15`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1500);

  const heuteText = await page.locator("h1").first().innerText();
  melde("Heute wird geladen", heuteText.includes("Heute"), heuteText);

  // --- 2. In eine Stunde gehen -------------------------------------------
  await page.getByRole("link", { name: /Physik/ }).first().click();
  await page.waitForURL(/\/app\/stunde\//, { timeout: 15000 });
  await page.waitForTimeout(900);

  const kurs = await page.locator("h1").first().innerText();
  melde("Stundendetail geöffnet", kurs.includes("Physik"), kurs);

  const stundenUrl = page.url();

  // --- 3. Hausübung zur nächsten Stunde erfassen -------------------------
  await page.getByRole("button", { name: /Eintrag zu dieser Stunde/ }).click();
  await page.waitForTimeout(700);

  await page.getByRole("button", { name: "Hausübung", exact: true }).click();
  await page.locator("textarea").first().fill("S. 84 Nr. 4–8");

  const terminHinweis = await page.locator("text=/Nächste Physikstunde/").count();
  melde(
    "Vorgeschlagener Termin ist sichtbar",
    terminHinweis > 0,
    terminHinweis > 0 ? "Nächste Physikstunde wird angezeigt" : "nicht gefunden",
  );

  await page.getByRole("button", { name: "Speichern" }).click();
  await page.waitForTimeout(1200);

  const gespeichert = await page.locator("text=S. 84 Nr. 4–8").count();
  melde("Hausübung gespeichert", gespeichert > 0);

  // --- 4. Neu laden: überlebt die Angabe? --------------------------------
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const nachReload = await page.locator("text=S. 84 Nr. 4–8").count();
  melde("Übersteht das Neuladen", nachReload > 0);

  const wortlaut = await page
    .locator("text=S. 84 Nr. 4–8")
    .first()
    .innerText();
  melde(
    "Wortlaut unverändert",
    wortlaut.trim() === "S. 84 Nr. 4–8",
    `„${wortlaut.trim()}“`,
  );

  // --- 5. Fälligkeit merken ----------------------------------------------
  // Gezielt die Fälligkeitszeile lesen, nicht irgendeinen Text, der
  // zufällig "fällig" enthält – etwa einen Filterknopf.
  const faelligVorher = await page
    .locator("p.t-caption", { hasText: /^fällig / })
    .first()
    .innerText()
    .catch(() => "");
  melde("Fälligkeit aufgelöst", faelligVorher.length > 0, faelligVorher.trim());

  // --- 6. Zielstunde entfallen lassen ------------------------------------
  // Zur nächsten Physikstunde blättern.
  const weiter = page
    .getByRole("link", { name: /morgen|Mittwoch|Mi,/i })
    .last();
  if (await weiter.count()) {
    await weiter.click();
    await page.waitForTimeout(1200);
  }

  await page.getByRole("button", { name: /Ändern/ }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /Stunde entfällt/ }).click();
  await page.waitForTimeout(1500);

  const entfaellt = await page.locator("text=Entfällt").count();
  melde("Stunde als entfallen eingetragen", entfaellt > 0);

  // --- 7. Zurück zur Aufgabe: neues Ziel, festgehalten -------------------
  await page.goto(`${BASE}/app/aufgaben?vorschau=2026-09-21T09:15`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1400);

  const aufgabeDa = await page.locator("text=S. 84 Nr. 4–8").count();
  melde("Aufgabe weiterhin sichtbar", aufgabeDa > 0);

  // Die Fälligkeitszeile der Aufgabe selbst, nicht die Filterknöpfe.
  const faelligNachher = await page
    .locator("span.t-caption", { hasText: /fällig / })
    .first()
    .innerText()
    .catch(() => "");
  melde(
    "Neue Auflösung nach dem Entfall",
    faelligNachher.length > 0 && faelligNachher !== faelligVorher,
    `vorher „${faelligVorher.trim()}“, nachher „${faelligNachher.trim()}“`,
  );

  // Das neue Ziel liegt in der Zukunft – die Aufgabe ist nicht überfällig.
  const nichtUeberfaellig =
    (await page.locator("text=Überfällig").count()) === 1; // nur der Filter
  melde(
    "Nicht fälschlich überfällig",
    nichtUeberfaellig,
    "nur der Filterknopf trägt dieses Wort",
  );

  // --- 8. Persönlich abhaken ---------------------------------------------
  // Das Abhaken nimmt die Aufgabe aus dem Filter "Offen" – genau so soll es
  // sein. Geprüft wird deshalb über den Filter "Erledigt".
  await page.getByRole("checkbox").first().click();
  await page.waitForTimeout(1200);

  const verschwundenAusOffen =
    (await page.locator("text=S. 84 Nr. 4–8").count()) === 0;
  melde(
    "Abgehakte Aufgabe verlässt den Filter „Offen“",
    verschwundenAusOffen,
  );

  await page.getByRole("button", { name: "Erledigt", exact: true }).click();
  await page.waitForTimeout(1000);

  const unterErledigt = await page.locator("text=S. 84 Nr. 4–8").count();
  melde("Erscheint unter „Erledigt“", unterErledigt > 0);

  const zustand = await page
    .getByRole("checkbox")
    .first()
    .getAttribute("aria-checked");
  melde("Als erledigt gekennzeichnet", zustand === "true");

  // --- 9. Und das übersteht das Neuladen ---------------------------------
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Erledigt", exact: true }).click();
  await page.waitForTimeout(1000);

  const nochErledigt = await page.locator("text=S. 84 Nr. 4–8").count();
  melde("Erledigt-Stand übersteht das Neuladen", nochErledigt > 0);
} catch (ursache) {
  melde("Ablauf abgebrochen", false, String(ursache).slice(0, 220));
}

if (fehler.length > 0) {
  console.log("\nSeitenfehler:");
  for (const f of [...new Set(fehler)].slice(0, 5)) console.log("  " + f);
}

await browser.close();

const offen = schritte.filter((s) => !s.ok);
console.log(
  `\n${schritte.length - offen.length} von ${schritte.length} Schritten erfolgreich.`,
);
process.exit(offen.length === 0 ? 0 : 1);
