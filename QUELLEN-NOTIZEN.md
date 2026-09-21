# Quellennotizen

Interne Notizen zur Herkunft der Stundenplandaten. Nicht für die
Veröffentlichung bestimmt.

## Stand der Aufnahme

- Quelldokument: **„Stundenplan – Klasse: 7c, 12. Oktober – 16. Oktober 2026“**
- Zwei Seiten, dieselbe Woche; Seite 2 zeigt die Stunden 8 bis 11.
- Die Daten des Dokuments sind **reine Herkunftsangabe**. Sie sind weder
  Beginn noch Ende des Stundenplans. Der Plan läuft ab der ersten lokalen
  Woche und wiederholt sich ohne Ende.

## Bestätigte Festlegungen

| Punkt | Festlegung |
|---|---|
| Sprache | Spanisch, nicht Latein |
| Religion und Ethik | keines von beidem |
| Sport | Montag 08:00–10:00 (überschreibt das Rasterende 09:45) |
| KUG | Dienstag 13:40–15:20 |
| Mathematik Wahlpflicht | Mittwoch 8.–9. Stunde, eigener Kurs |
| Räume | kommen nirgends vor (Festlegung des Auftraggebers) |
| Lehrpersonen | ausserhalb des Umfangs |

## Offene Punkte

| Kurs | Was fehlt |
|---|---|
| **KUG** | Die vollständige Kursbezeichnung. Im Quelldokument nur als `K…` zu sehen, die weiteren Einträge derselben Spalte sind verdeckt („+2“). Die Zeit ist bestätigt. |
| **Labor** (Mo 5.–6.) | Bezeichnung im Original `Labor 7. Klass…`, abgeschnitten. Das Dokument nennt zwei Räume (103.BIU, 124.CH), was auf eine Teilung in Biologie- und Chemiegruppe hindeutet. Da Räume nicht geführt werden, steht der Kurs als **„Labor“** ohne Gruppenzuordnung. |
| **Sport** (Mo 1.–2.) | Bezeichnung im Original `Be…`, abgeschnitten. Zwei parallele Einträge (T1, T3), einer davon für 7b. Die Gruppenzuordnung ist nicht bestätigt. |

Die Originalbezeichnungen sind in `src/domain/seed.ts` als `sourceLabel`
erhalten und werden in den Einstellungen angezeigt. Der Anzeigename ist davon
getrennt und änderbar.

## Nicht gewählte Angebote

In `UNSELECTED_OFFERINGS` (`src/domain/seed.ts`) festgehalten, damit die
Auswahl nachvollziehbar bleibt. Sie erscheinen **nicht** im Tagesplan, sondern
nur in den Einstellungen unter „Nicht gewählte Angebote der Klasse“.

## Rasterstunden

Die Zeiten der Stunden **1 bis 6** sind im Quelldokument beschriftet. Die
Beginnzeiten ab der **7. Stunde** folgen den zusammenhängenden Zeilengrenzen
und sind **nicht eigenständig bestätigt**. Das ist in den Einstellungen unter
„Stundenraster“ so gekennzeichnet.

Die beiden bestätigten Sonderzeiten (Sport, KUG) haben Vorrang vor dem Raster.
