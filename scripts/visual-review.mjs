/**
 * Visuelle Pruefung.
 *
 * Nimmt die angegebenen Routen in mehreren Breiten auf und meldet
 * mechanische Befunde: waagrechtes Ueberlaufen, zu kleine Bedienflaechen,
 * Einblend-Animationen und englische Textreste.
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.DOCK_BASE ?? "http://localhost:3000";
const OUT = "screenshots";

const SIZES = [
  { name: "phone-360", width: 360, height: 780, mobile: true },
  { name: "phone-430", width: 430, height: 932, mobile: true },
  { name: "tablet-768", width: 768, height: 1024, mobile: false },
  { name: "desktop-1440", width: 1440, height: 900, mobile: false },
];

const ROUTES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["/", "/app", "/app/stundenplan", "/app/aufgaben", "/app/faecher", "/app/nachholen", "/app/einstellungen"];

mkdirSync(OUT, { recursive: true });

// Die Umgebung bringt Chromium mit. Playwright erwartet eine andere
// Build-Nummer, deshalb wird der Pfad ausdruecklich gesetzt statt ein
// zweiter Browser heruntergeladen.
const EXECUTABLE = process.env.DOCK_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({
  executablePath: existsSync(EXECUTABLE) ? EXECUTABLE : undefined,
});
const findings = [];

for (const size of SIZES) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 2,
    isMobile: size.mobile,
    hasTouch: size.mobile,
    locale: "de-AT",
    timezoneId: "Europe/Vienna",
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  for (const route of ROUTES) {
    const slug = route === "/" ? "home" : route.replace(/^\/+/, "").replace(/\//g, "-");
    try {
      await page.goto(BASE + route + (route.includes("?") ? "&" : "?") + "vorschau=2026-09-21T09:15", { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(700);

      await page.screenshot({
        path: `${OUT}/${slug}__${size.name}.png`,
        fullPage: false,
      });

      // Waagrechtes Ueberlaufen der Seite.
      const overflow = await page.evaluate(() => {
        const d = document.documentElement;
        return { scrollW: d.scrollWidth, clientW: d.clientWidth };
      });
      if (overflow.scrollW > overflow.clientW + 1) {
        findings.push({
          size: size.name, route,
          kind: "overflow",
          detail: `scrollWidth ${overflow.scrollW} > clientWidth ${overflow.clientW}`,
        });
      }

      // Zu kleine Bedienflaechen auf Touch-Breiten.
      if (size.mobile) {
        const small = await page.evaluate(() => {
          const out = [];
          for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="checkbox"], [role="tab"]')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const style = getComputedStyle(el);
            if (style.visibility === "hidden" || style.display === "none") continue;
            if (r.height < 44 && !el.closest("nav[aria-label='Hauptnavigation']")) {
              out.push({
                tag: el.tagName.toLowerCase(),
                text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40),
                h: Math.round(r.height),
              });
            }
          }
          return out.slice(0, 12);
        });
        for (const s of small) {
          findings.push({ size: size.name, route, kind: "touch-target", detail: `${s.tag} "${s.text}" ${s.h}px` });
        }
      }

      // Einblendungen und Eintrittsfolgen sind ausdruecklich untersagt.
      const fades = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll("*")) {
          const s = getComputedStyle(el);
          if (s.transitionProperty.split(",").map((p) => p.trim()).includes("opacity")) {
            out.push(`transition opacity: ${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 30)}`);
          }
          if (s.animationName && s.animationName !== "none") {
            out.push(`animation ${s.animationName}: ${el.tagName.toLowerCase()}`);
          }
        }
        return [...new Set(out)].slice(0, 10);
      });
      for (const f of fades) {
        findings.push({ size: size.name, route, kind: "motion", detail: f });
      }

      // Englische Textreste in der Oberflaeche.
      if (size.name === "desktop-1440") {
        const english = await page.evaluate(() => {
          const words = /\b(Settings|Today|Homework|Loading|Error|Save|Cancel|Submit|Search|Next|Back|Close|Delete|Edit|Week|Schedule|Subject|Tasks|Sign in|Sign up|Get started|Learn more)\b/;
          const hits = [];
          const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = walk.nextNode())) {
            const t = (n.textContent || "").trim();
            if (t && words.test(t)) hits.push(t.slice(0, 60));
          }
          return [...new Set(hits)].slice(0, 10);
        });
        for (const e of english) {
          findings.push({ size: size.name, route, kind: "sprache", detail: e });
        }
      }
    } catch (cause) {
      findings.push({ size: size.name, route, kind: "fehler", detail: String(cause).slice(0, 200) });
    }
  }

  for (const e of [...new Set(consoleErrors)].slice(0, 8)) {
    findings.push({ size: size.name, route: "(konsole)", kind: "konsole", detail: e.slice(0, 200) });
  }

  await context.close();
}

await browser.close();

writeFileSync(`${OUT}/befunde.json`, JSON.stringify(findings, null, 2));

if (findings.length === 0) {
  console.log("Keine mechanischen Befunde.");
} else {
  console.log(`${findings.length} Befunde:\n`);
  for (const f of findings) {
    console.log(`  [${f.kind}] ${f.route} @ ${f.size}: ${f.detail}`);
  }
}
