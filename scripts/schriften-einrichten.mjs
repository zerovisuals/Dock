/**
 * Richtet die Schriften für die lokale Entwicklung ein.
 *
 * Die gelieferten Dateien liegen bewusst ausserhalb der Versionsverwaltung,
 * solange die Webfont-Lizenz nicht geklärt ist. Nach einem frischen Klon sind
 * sie deshalb nicht da. Dieses Skript kopiert sie an den Ort, von dem die
 * Anwendung sie lädt – oder sagt klar, was fehlt.
 *
 * Ohne die Dateien läuft Dock trotzdem: dann greift der Systemschrift-Stack.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const QUELLE = "assets/fonts-unlicensed";
const ZIEL = "public/fonts";

/** Die drei Schnitte, die ausgeliefert werden. SF Pro nie. */
const SCHNITTE = [
  ["24c714fdc32827a6-s.p.woff2", "plain-400.woff2", "Plain Regular 400"],
  ["d194712e1a895a3f-s.p.woff2", "plain-600.woff2", "Plain Medium 600"],
  ["0ef3d83b6332bc53-s.p.woff2", "plain-700.woff2", "Plain Bold 700"],
];

if (!existsSync(QUELLE)) {
  console.log(`Kein Verzeichnis ${QUELLE}.`);
  console.log("Dock läuft mit der Systemschrift weiter.\n");
  console.log("Wenn du Plain verwenden willst:");
  console.log(`  1. Lege ${QUELLE}/ an.`);
  console.log("  2. Kopiere die gelieferten WOFF2-Dateien hinein.");
  console.log("  3. Führe npm run schriften erneut aus.");
  process.exit(0);
}

mkdirSync(ZIEL, { recursive: true });

const vorhanden = new Set(readdirSync(QUELLE));
let kopiert = 0;
const fehlend = [];

for (const [quelle, ziel, bezeichnung] of SCHNITTE) {
  if (vorhanden.has(quelle)) {
    copyFileSync(join(QUELLE, quelle), join(ZIEL, ziel));
    console.log(`  ✓ ${bezeichnung}`);
    kopiert += 1;
  } else {
    fehlend.push(`${bezeichnung} (${quelle})`);
  }
}

console.log("");
if (kopiert === SCHNITTE.length) {
  console.log("Alle drei Schnitte eingerichtet. Starte mit npm run dev.");
} else if (kopiert > 0) {
  console.log(`${kopiert} von ${SCHNITTE.length} Schnitten eingerichtet.`);
  console.log("Es fehlen:");
  for (const eintrag of fehlend) console.log(`  – ${eintrag}`);
  console.log("\nFür die fehlenden Gewichte greift die Systemschrift.");
} else {
  console.log("Keine Plain-Datei gefunden. Dock läuft mit der Systemschrift.");
}
