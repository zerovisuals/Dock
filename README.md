# Dock

Ein Schulorganizer für einen echten, selbst gepflegten Stundenplan. Jede
Stunde ist der Ort für das, was besprochen wurde, und für das, was zu tun ist.

Dock beantwortet vier Fragen:

- **Jetzt** – in welcher Stunde bin ich?
- **Zuletzt** – was haben wir letztes Mal gemacht?
- **Als Nächstes** – welche Hausübungen, Materialien und Prüfungen stehen an?
- **Nach einer Abwesenheit** – was haben die anderen festgehalten, und was fehlt?

Die gesamte Oberfläche ist auf Deutsch (de-AT), Zeitzone Europe/Vienna,
Wochenbeginn Montag, 24-Stunden-Zeiten.

---

## Starten

Du brauchst **Node 20 oder neuer**. Sonst nichts – keine Datenbank, keine
Zugangsdaten, kein Konto.

```sh
npm install
npm run dev        # http://localhost:3000
```

Beim ersten Start landest du auf `/willkommen`. Der Ablauf ist überspringbar;
der Stundenplan ist ohnehin schon aktiv.

### Der eine Handgriff: Schriften

Die gelieferten Plain-Dateien sind **nicht im Repository**, solange die
Webfont-Lizenz nicht geklärt ist. Nach einem frischen Klon fehlen sie also.

```sh
mkdir -p assets/fonts-unlicensed
# die gelieferten .woff2-Dateien dort hineinkopieren
npm run schriften
```

`npm run dev` und `npm run build` rufen das von selbst mit auf. Fehlen die
Dateien, sagt das Skript welche – und Dock läuft mit der Systemschrift
weiter. Es bricht nie deswegen ab.

### Selbst ausprobieren

Heute ist vielleicht Wochenende oder Abend, dann ist der Plan zu Recht leer.
Für einen echten Schultag stell die Vorschau-Uhr:

```
http://localhost:3000/app?vorschau=2026-09-22T09:15   # Dienstag, 2. Stunde
http://localhost:3000/app?vorschau=aus                # wieder echte Zeit
```

Sie ist oben immer sichtbar gekennzeichnet und ändert nur die Anzeige.

Ein guter Rundgang:

1. **Heute** – laufende Stunde mit Fortschritt, danach der Tagesplan.
2. Auf eine Stunde tippen → **Erfassen** → *Hausübung*, Text eingeben.
   Unter „Fällig“ steht die vorgeschlagene nächste Stunde mit Datum.
3. Die Seite **neu laden** – alles ist noch da.
4. In der Zielstunde auf **Ändern** → *Stunde entfällt*. Zurück zu
   **Aufgaben**: die Fälligkeit ist auf die nächste Stunde gewandert und der
   Wechsel steht dabei.
5. **Erfassen → Datei** anhängen, danach in der Stunde öffnen, ansehen,
   herunterladen oder löschen.
6. **Einstellungen** – Zahlen zu deinen Daten, Export, Erscheinungsbild,
   Einladungen, alles löschen.

### Prüfen

```sh
npm run typecheck  # TypeScript, strikt
npm run test       # 71 fachliche Tests
npm run build      # Produktionsbau
npm run check      # alle drei nacheinander
```

Mit laufendem `npm run dev` zusätzlich:

```sh
npm run review     # Screenshots bei 360/430/768/1440, hell und dunkel
npm run ablauf     # der komplette Ablauf im echten Browser, 15 Schritte
```

Die Aufnahmen landen in `screenshots/`, die Befunde in
`screenshots/befunde.json`.

### Auf dem Handy testen

Im selben WLAN, mit der Adresse, die `npm run dev` unter „Network“ ausgibt:

```
http://192.168.x.x:3000
```

Zum Installieren auf dem Startbildschirm: in Safari auf „Teilen“ → „Zum
Home-Bildschirm“. **Einen Service Worker gibt es noch nicht**, Dock läuft
also noch nicht offline.

### Wege

| Weg | Inhalt |
|---|---|
| `/` | Öffentliche Seite |
| `/willkommen` | Einstieg: Schule, Klasse, Stundenplan, Auswahl, Erfassen |
| `/app` | Heute |
| `/app/stundenplan` | Wochenraster (Schreibtisch) und Tagesliste (Telefon) |
| `/app/aufgaben` | Hausübungen und Mitbringsel |
| `/app/faecher` | Kurse, Verlauf und Suche |
| `/app/nachholen` | Nachholen nach einer Abwesenheit |
| `/app/einstellungen` | Daten, Klasse, Darstellung, Stundenplan, Installation |

### Vorschau-Uhr

Für Gestaltung und Prüfung lässt sich die angezeigte Zeit stellen:

```
/app?vorschau=2026-09-21T09:15
/app?vorschau=aus
```

Sie ist immer sichtbar gekennzeichnet. Die echte Uhr des Geräts wird nie
verändert.

---

## Wo die Daten liegen

**Derzeit: auf dem Gerät.** Alles liegt in IndexedDB im Browser. Es übersteht
das Neuladen und das Schließen des Browsers. Es wird **nicht** synchronisiert
und **nicht** zwischen echten Benutzerkonten geteilt. Die Oberfläche sagt das
an jeder Stelle, an der es zählt.

Export und vollständiges Löschen stehen in den Einstellungen und erfassen auch
die Dateiinhalte, nicht nur die Datensätze.

### Geteilter Betrieb

Für echtes Teilen zwischen Konten braucht es ein Supabase-Projekt:

1. Projekt anlegen.
2. `supabase/migrations/0001_init.sql` einspielen.
3. `.env.local` nach dem Muster von `.env.example` füllen:
   ```
   NEXT_PUBLIC_SUPABASE_URL=…
   NEXT_PUBLIC_SUPABASE_ANON_KEY=…
   ```
4. Den Zugang in `src/data/supabase.ts` prüfen und einschalten.

> **Ehrlich gesagt:** Der Supabase-Zugang ist geschrieben, aber **nie gegen ein
> echtes Projekt ausgeführt worden** – es lagen keine Zugangsdaten vor. Er ist
> als geprüfter Entwurf zu behandeln, nicht als erprobte Funktion. Das Schema
> und die Zugriffsrichtlinien sind vollständig; ihre Wirkung in einer echten
> Datenbank ist ebenfalls nicht erprobt.

Der Dienstschlüssel (`SUPABASE_SERVICE_ROLE_KEY`) wird nur für Migrationen
gebraucht und gehört niemals in den Client.

---

## Der Stundenplan

Der bestätigte Plan der Klasse 7c ist beim ersten Start bereits angelegt und
aktiv. Es gibt **keinen** Bestätigungsschritt, **kein** Pflichtformular für
einen Zeitraum und **kein** Ablaufdatum.

- `endsOn = null`, Abstand eine Woche, keine Begrenzung der Anzahl.
- Der gespeicherte Zeitraum ist eine Beschleunigung, niemals ein Ende: Wird ein
  späteres Datum gebraucht, wird lückenlos nacherzeugt.
- Eine fehlende Zeile bedeutet „noch nicht erzeugt“, nie „keine Stunde mehr“.

Berücksichtigte Festlegungen:

| Festlegung | Umsetzung |
|---|---|
| Spanisch statt Latein | Dienstag 1., Donnerstag 1., Freitag 3. Stunde |
| Kein Religionsunterricht, keine Ethik | Montag 4., Donnerstag 6., Freitag 7. bleiben frei |
| Sport | Montag **08:00–10:00** (bestätigt, nicht 09:45) |
| KUG | Dienstag **13:40–15:20** (bestätigt) |
| Mathematik Wahlpflichtfach | Mittwoch 8.–9., eigener Kurs |
| Räume | kommen **nirgends** vor |
| Lehrpersonen | kommen **nirgends** vor |

Sport endet um 10:00, Physik beginnt um 10:00. Intervalle sind
startinklusiv und endexklusiv, deshalb entsteht kein Konflikt.

---

## Aufbau

```
src/domain/     Fachlicher Kern, ohne Oberfläche und ohne Speicher
  time.ts         Europe/Vienna, beide Umstellungstage, Kalenderrechnung
  periods.ts      Das Stundenraster
  recurrence.ts   Erzeugen der Stunden, wiederholbar und lückenlos
  dueRules.ts     Fälligkeiten mit festem Ankerpunkt
  seed.ts         Der bestätigte Plan der 7c
  demoSeed.ts     Erfundene Daten für die Vorschau

src/data/       Speicherung
  repository.ts   Die Grenze, plus Dateiprüfung
  indexeddb.ts    Auf dem Gerät, und eine Fassung im Arbeitsspeicher
  supabase.ts     Gehostet – geschrieben, nicht erprobt
  store.ts        Die Fachlogik über dem Speicher
  DockContext.tsx Zugang der Oberfläche

src/ui/         Bausteine
src/app/        Wege
supabase/       Schema und Zugriffsrichtlinien
tests/          71 fachliche Tests
```

### Grundsätze, die Bestand haben müssen

- Jede Einheit hat eine dauerhafte interne Kennung. Datum und Uhrzeit sind
  veränderliche Eigenschaften, niemals die Identität. Verschieben, Entfall und
  Zeitänderungen lassen Notizen, Dateien und Aufgabenbezüge unberührt.
- **Zielgruppe** („wer darf das sehen“) und **Herkunft** („wer behauptet das“)
  sind zwei getrennte Achsen. Eine Bestätigung durch Mitschüler ist keine
  Freigabe durch die Schule.
- „Nächste Stunde“ wird relativ zum **festen Ankerpunkt der Ankündigung**
  aufgelöst, nie relativ zum heutigen Tag. Sonst wanderte eine unerledigte
  Aufgabe mit jedem Seitenaufruf weiter und würde nie überfällig.
- Eine Bestätigung gilt für **genau eine Fassung**. Ändert sich der Text,
  bleibt sie Historie und gilt nicht weiter.
- Wiederholungen werden auf **Kalendertagen** gerechnet, nicht durch Addition
  von 168 UTC-Stunden. Eine Stunde bleibt über die Zeitumstellung hinweg zur
  selben örtlichen Uhrzeit.
- Leere bedeutet nie „es ist nichts passiert“. Wo nichts festgehalten wurde,
  steht: **„Für diese Stunde wurde noch nichts festgehalten.“**

---

## Schriften

Die Website und die App setzen **Plain** (Optimo). Die gelieferten Dateien
liegen in `assets/fonts-unlicensed/` und werden nach `public/fonts/` kopiert.
Beide Verzeichnisse sind von der Versionsverwaltung ausgenommen, solange die
Webfont-Lizenz nicht geklärt ist. Ohne die Dateien greift ein abgestimmter
Systemschrift-Stack; Layout und Abstände tragen die Identität auch dann.

Die gelieferten SF-Pro-Dateien werden **nicht** ausgeliefert. Dafür steht der
Apple-Systemstack.

Plain Medium wird mit **600** geführt, weil die gelieferte Datei das so
deklariert – nicht mit 500.

---

## Was bewusst fehlt

Keine Importe aus WebUntis oder anderen Systemen, kein iCal, kein OAuth, kein
Scraping, keine Hintergrundabfragen. Keine Sprachmodelle, keine Texterkennung,
keine semantische Suche. Keine Noten und keine Prüfungsverwaltung. Keine
Benachrichtigungsinfrastruktur, keine vollständige Offline-Synchronisierung,
keine sozialen Funktionen.

Dock behauptet an keiner Stelle, mit dem System der Schule verbunden zu sein.
