# Gelieferte Schriftdateien – nicht ausliefern

Diese Verzeichnis enthaelt die vom Auftraggeber gelieferten WOFF2-Dateien.
Sie liegen bewusst **ausserhalb von `public/`**, sind in `.gitignore`
ausgeschlossen und werden **nicht** in den Build aufgenommen.

Grund: Die Metadaten der Plain-Dateien verweisen auf die Lizenzierung von
Optimo; die SF-Pro-Dateien enthalten Einbettungsbeschraenkungen von Apple.
Der Besitz kopierter Website-Assets belegt keine Webfont-Lizenz.

Entscheidung des Auftraggebers: "Lokal ja, im Repo/Build nein." Die Dateien
duerfen lokal verwendet werden, um gerenderte Screens mit `referencedesign.pdf`
zu vergleichen. Ausgeliefert wird der Systemschrift-Fallback.

| Datei | Familie / Stil | Gewicht laut Metadaten |
|---|---|---:|
| `24c714fdc32827a6-s.p.woff2` | Plain Regular | 400 |
| `d194712e1a895a3f-s.p.woff2` | Plain Medium Regular | 600 |
| `0ef3d83b6332bc53-s.p.woff2` | Plain Bold | 700 |
| `2d54f7a30e94df3e-s.p.woff2` | SF Pro Text Regular (kleiner Zeichensatz) | 400 |
| `36738fc3bf659882-s.p.woff2` | SF Pro Text Regular (grosser Zeichensatz) | 400 |
| `79f07f1c8c9c61b7-s.p.woff2` | SF Pro Text Medium | 500 |
| `f8b779e682b9358e-s.p.woff2` | SF Pro Text Bold | 700 |

Plain Medium wird mit **600** gefuehrt, weil die gelieferte Datei das so
deklariert – nicht mit 500.

## Aktivierung (nur mit gueltiger Lizenz)

1. Lizenz fuer die Plain-Webfonts bei Optimo erwerben.
2. Die Plain-Dateien nach `public/fonts/` kopieren.
3. In `src/app/globals.css` `--font-display` auf `"Plain"` umstellen; die
   `@font-face`-Regeln stehen dort bereits auskommentiert bereit.

SF Pro wird in keinem Fall ausgeliefert. Die App verwendet dafuer den
Apple-Systemschrift-Stack.
