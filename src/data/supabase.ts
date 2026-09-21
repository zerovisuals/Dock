/**
 * Zugang zu einer gehosteten Datenbank.
 *
 * WICHTIGER HINWEIS ZUR REICHWEITE
 * --------------------------------
 * Dieser Zugang ist geschrieben, aber **nicht erprobt**. Zum Zeitpunkt der
 * Erstellung lagen keine Zugangsdaten vor. Er wurde nie gegen ein echtes
 * Projekt ausgeführt. Wer ihn einschaltet, muss ihn zuerst prüfen.
 *
 * Was dagegen erprobt ist: die Speicherung auf dem Gerät und die gesamte
 * Fachlogik darüber.
 *
 * Absicht
 * -------
 * Die Grenze `Repository` ist bewusst schmal gehalten, damit ein Wechsel der
 * Ablage die Fachlogik nicht berührt. Dieser Entwurf zeigt, wie der Wechsel
 * aussieht – einschließlich der Stellen, an denen es zusätzliche Arbeit
 * braucht:
 *
 *  - Die Spaltennamen der Datenbank sind in Schlangenschrift, die Felder im
 *    Code in Höckerschrift. Die Übersetzung gehört hierher, nicht in die
 *    Fachlogik.
 *  - Dateien liegen nicht in der Tabelle, sondern im privaten Ablagefach.
 *  - Jede Abfrage läuft zusätzlich durch die Zeilenrichtlinien der Datenbank.
 *    Die Begrenzung liegt dort, nicht in diesem Code.
 *
 * Die Richtlinien stehen in `supabase/migrations/0001_init.sql`.
 */

import type {
  CollectionName,
  Collections,
  Repository,
  StorageMode,
} from "./repository";

export interface SupabaseZugang {
  url: string;
  anonKey: string;
}

/** Liest die Zugangsdaten aus der Umgebung. */
export function readSupabaseAccess(): SupabaseZugang | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** Ist ein geteilter Betrieb überhaupt eingerichtet? */
export function sharedModeConfigured(): boolean {
  return readSupabaseAccess() !== null;
}

/** Die Tabellennamen in der Datenbank. */
const TABELLEN: Record<CollectionName, string> = {
  schools: "schools",
  academicYears: "academic_years",
  classes: "classes",
  courses: "courses",
  memberships: "memberships",
  series: "schedule_series",
  revisions: "schedule_revisions",
  lessons: "lesson_instances",
  exceptions: "schedule_exceptions",
  entries: "entries",
  entryVersions: "entry_versions",
  resolutions: "due_resolutions",
  taskStates: "user_task_states",
  assessments: "assessments",
  documents: "documents",
  documentLinks: "document_links",
  confirmations: "confirmations",
  corrections: "correction_proposals",
  invites: "invites",
  missedIntervals: "missed_intervals",
  // Profil, Entwürfe und Einstellungen bleiben auf dem Gerät: sie gehören
  // niemandem sonst und haben in der geteilten Datenbank nichts verloren.
  profiles: "",
  drafts: "",
  settings: "",
};

const NUR_LOKAL: ReadonlySet<CollectionName> = new Set([
  "profiles",
  "drafts",
  "settings",
]);

/** Höckerschrift zu Schlangenschrift und zurück. */
function zuSchlange(name: string): string {
  return name.replace(/[A-Z]/g, (zeichen) => `_${zeichen.toLowerCase()}`);
}

function zuHoecker(name: string): string {
  return name.replace(/_([a-z])/g, (_, zeichen: string) =>
    zeichen.toUpperCase(),
  );
}

function hinaus(wert: Record<string, unknown>): Record<string, unknown> {
  const ergebnis: Record<string, unknown> = {};
  for (const [schluessel, inhalt] of Object.entries(wert)) {
    ergebnis[zuSchlange(schluessel)] = inhalt;
  }
  return ergebnis;
}

function herein(wert: Record<string, unknown>): Record<string, unknown> {
  const ergebnis: Record<string, unknown> = {};
  for (const [schluessel, inhalt] of Object.entries(wert)) {
    ergebnis[zuHoecker(schluessel)] = inhalt;
  }
  return ergebnis;
}

/**
 * Der gehostete Zugang.
 *
 * Er erfüllt dieselbe Grenze wie die Speicherung auf dem Gerät. Der private
 * Anteil – Profil, Entwürfe, Einstellungen – bleibt dabei ausdrücklich lokal
 * und wird an einen übergebenen lokalen Zugang weitergereicht.
 */
export class SupabaseRepository implements Repository {
  readonly mode: StorageMode = "geteilt";

  constructor(
    private readonly zugang: SupabaseZugang,
    /** Für alles, was nicht in die geteilte Datenbank gehört. */
    private readonly lokal: Repository,
    /** Das Zugriffstoken des angemeldeten Benutzers. */
    private readonly accessToken: string,
  ) {}

  private async anfrage(
    pfad: string,
    optionen: RequestInit = {},
  ): Promise<Response> {
    const antwort = await fetch(`${this.zugang.url}/rest/v1/${pfad}`, {
      ...optionen,
      headers: {
        apikey: this.zugang.anonKey,
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...optionen.headers,
      },
    });

    if (!antwort.ok) {
      const text = await antwort.text();
      // Ein Fehler wird weitergereicht, nicht verschluckt. Ein
      // fehlgeschlagener Schreibvorgang darf nie als erfolgreich gelten.
      throw new Error(
        `Die Datenbank hat die Anfrage abgelehnt (${antwort.status}): ${text}`,
      );
    }
    return antwort;
  }

  async list<K extends CollectionName>(name: K): Promise<Collections[K][]> {
    if (NUR_LOKAL.has(name)) return this.lokal.list(name);
    const antwort = await this.anfrage(`${TABELLEN[name]}?select=*`);
    const zeilen = (await antwort.json()) as Record<string, unknown>[];
    return zeilen.map(herein) as unknown as Collections[K][];
  }

  async get<K extends CollectionName>(
    name: K,
    id: string,
  ): Promise<Collections[K] | undefined> {
    if (NUR_LOKAL.has(name)) return this.lokal.get(name, id);
    const antwort = await this.anfrage(
      `${TABELLEN[name]}?id=eq.${encodeURIComponent(id)}&select=*`,
    );
    const zeilen = (await antwort.json()) as Record<string, unknown>[];
    const erste = zeilen[0];
    return erste
      ? (herein(erste) as unknown as Collections[K])
      : undefined;
  }

  async put<K extends CollectionName>(
    name: K,
    value: Collections[K],
  ): Promise<void> {
    if (NUR_LOKAL.has(name)) return this.lokal.put(name, value);
    // Über die Kennung: ein erneut gesendeter Schreibvorgang ersetzt, er
    // legt nichts zusätzlich an.
    await this.anfrage(TABELLEN[name], {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(
        hinaus(value as unknown as Record<string, unknown>),
      ),
    });
  }

  async putMany<K extends CollectionName>(
    name: K,
    values: readonly Collections[K][],
  ): Promise<void> {
    if (values.length === 0) return;
    if (NUR_LOKAL.has(name)) return this.lokal.putMany(name, values);
    await this.anfrage(TABELLEN[name], {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(
        values.map((wert) =>
          hinaus(wert as unknown as Record<string, unknown>),
        ),
      ),
    });
  }

  async remove(name: CollectionName, id: string): Promise<void> {
    if (NUR_LOKAL.has(name)) return this.lokal.remove(name, id);
    await this.anfrage(`${TABELLEN[name]}?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
  }

  /* Dateien liegen im privaten Ablagefach, nicht in einer Tabelle. */

  private ablage(id: string): string {
    return `${this.zugang.url}/storage/v1/object/dock-dateien/${id}`;
  }

  async putBlob(id: string, blob: Blob): Promise<void> {
    const antwort = await fetch(this.ablage(id), {
      method: "POST",
      headers: {
        apikey: this.zugang.anonKey,
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": blob.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: blob,
    });
    if (!antwort.ok) {
      throw new Error(
        `Die Datei konnte nicht abgelegt werden (${antwort.status}).`,
      );
    }
  }

  async getBlob(id: string): Promise<Blob | undefined> {
    const antwort = await fetch(this.ablage(id), {
      headers: {
        apikey: this.zugang.anonKey,
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
    if (antwort.status === 404) return undefined;
    if (!antwort.ok) {
      throw new Error(
        `Die Datei konnte nicht geladen werden (${antwort.status}).`,
      );
    }
    return antwort.blob();
  }

  async removeBlob(id: string): Promise<void> {
    const antwort = await fetch(this.ablage(id), {
      method: "DELETE",
      headers: {
        apikey: this.zugang.anonKey,
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
    if (!antwort.ok && antwort.status !== 404) {
      throw new Error(
        `Die Datei konnte nicht gelöscht werden (${antwort.status}).`,
      );
    }
  }

  /**
   * Im geteilten Betrieb wird nicht alles gelöscht.
   *
   * Ein einzelner Benutzer darf nicht die Inhalte seiner Klasse entfernen.
   * Das Löschen der eigenen Daten gehört in einen eigenen, serverseitigen
   * Ablauf – er ist hier ausdrücklich nicht vorhanden.
   */
  async clear(): Promise<void> {
    throw new Error(
      "Im geteilten Betrieb ist das vollständige Löschen hier nicht vorgesehen. " +
        "Lösche deine Daten über den dafür vorgesehenen Ablauf.",
    );
  }
}
