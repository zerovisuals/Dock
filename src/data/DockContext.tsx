"use client";

/**
 * Der Zugang der Oberfläche zu den Daten.
 *
 * Beim ersten Start wird der bestätigte Stundenplan angelegt und die
 * laufende Woche erzeugt – ohne Rückfrage, ohne Bestätigungsschritt.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createLocalRepository } from "./indexeddb";
import { DockStore, type DockSnapshot } from "./store";
import { LOCAL_USER_ID } from "@/domain/seed";
import {
  localTimeOf,
  toInstant,
  todayLocal,
  type LocalDate,
  type LocalTime,
} from "@/domain/time";
import type { Repository } from "./repository";

type Status = "laedt" | "bereit" | "fehler";

interface DockContextValue {
  store: DockStore;
  snapshot: DockSnapshot;
  status: Status;
  error: string | null;
  userId: string;
  /** Neu laden, nachdem etwas geschrieben wurde. */
  refresh: () => Promise<void>;
  /** Schreiben und anschliessend neu laden. Meldet Fehler sichtbar. */
  mutate: <T>(operation: (store: DockStore) => Promise<T>) => Promise<T | undefined>;
  /** Die aktuell geltende Zeit – echt oder aus der Vorschau-Uhr. */
  now: Date;
  today: LocalDate;
  nowTime: LocalTime;
  previewClock: boolean;
  setPreviewClock: (at: Date | null) => Promise<void>;
  lastError: string | null;
  clearError: () => void;
}

const DockContext = createContext<DockContextValue | null>(null);

const EMPTY: DockSnapshot = {
  courses: [],
  lessons: [],
  series: [],
  revisions: [],
  exceptions: [],
  entries: [],
  versions: [],
  resolutions: [],
  taskStates: [],
  assessments: [],
  documents: [],
  documentLinks: [],
  confirmations: [],
  corrections: [],
  invites: [],
  missedIntervals: [],
  materializedUntil: null,
  seeded: false,
};

export function DockProvider({
  children,
  repository,
  seed = true,
}: {
  children: ReactNode;
  repository?: Repository;
  seed?: boolean;
}) {
  const storeRef = useRef<DockStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = new DockStore(
      repository ?? createLocalRepository(),
      LOCAL_USER_ID,
    );
  }
  const store = storeRef.current;

  const [snapshot, setSnapshot] = useState<DockSnapshot>(EMPTY);
  const [status, setStatus] = useState<Status>("laedt");
  const [error, setError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [previewAt, setPreviewAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const next = await store.load();
    setSnapshot(next);
  }, [store]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (seed) await store.ensureSeeded(todayLocal());

        // Vorschau-Uhr über die Adresszeile, etwa ?vorschau=2026-10-12T09:15.
        // Sie ist ausdrücklich gekennzeichnet und dient der Gestaltung und
        // der Prüfung. Die echte Uhr des Benutzers wird nie verändert.
        if (typeof window !== "undefined") {
          const parameter = new URLSearchParams(window.location.search).get(
            "vorschau",
          );
          if (parameter !== null) {
            const wanted = parameter === "aus"
              ? null
              : new Date(
                  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(parameter)
                    ? toInstant(
                        parameter.slice(0, 10),
                        parameter.slice(11, 16),
                      ).toISOString()
                    : parameter,
                );
            if (wanted === null || !Number.isNaN(wanted.getTime())) {
              await store.setPreviewClock(wanted ? wanted.toISOString() : null);
            }
          }
        }

        const settings = await store.settings();
        const next = await store.load();
        if (cancelled) return;
        setSnapshot(next);
        setPreviewAt(
          settings.previewClock.enabled && settings.previewClock.at
            ? new Date(settings.previewClock.at)
            : null,
        );
        setStatus("bereit");
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Die Daten konnten nicht geladen werden.",
        );
        setStatus("fehler");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, seed]);

  // Die Anzeige von "jetzt" bleibt aktuell, ohne dass etwas neu geladen wird.
  useEffect(() => {
    if (previewAt) return;
    const timer = window.setInterval(() => setTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [previewAt]);

  const mutate = useCallback(
    async <T,>(operation: (store: DockStore) => Promise<T>) => {
      try {
        const result = await operation(store);
        await refresh();
        setLastError(null);
        return result;
      } catch (cause) {
        // Ein fehlgeschlagener Schreibvorgang wird sichtbar gemacht. Er wird
        // nie als erfolgreich ausgegeben.
        setLastError(
          cause instanceof Error
            ? cause.message
            : "Die Änderung konnte nicht gespeichert werden.",
        );
        return undefined;
      }
    },
    [store, refresh],
  );

  const setPreviewClock = useCallback(
    async (at: Date | null) => {
      await store.setPreviewClock(at ? at.toISOString() : null);
      setPreviewAt(at);
    },
    [store],
  );

  const now = useMemo(
    () => previewAt ?? new Date(tick),
    [previewAt, tick],
  );

  const value = useMemo<DockContextValue>(
    () => ({
      store,
      snapshot,
      status,
      error,
      userId: LOCAL_USER_ID,
      refresh,
      mutate,
      now,
      today: todayLocal(now),
      nowTime: localTimeOf(now),
      previewClock: previewAt !== null,
      setPreviewClock,
      lastError,
      clearError: () => setLastError(null),
    }),
    [store, snapshot, status, error, refresh, mutate, now, previewAt, setPreviewClock, lastError],
  );

  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

export function useDock(): DockContextValue {
  const value = useContext(DockContext);
  if (!value) {
    throw new Error("useDock muss innerhalb von DockProvider verwendet werden.");
  }
  return value;
}

/**
 * Sorgt dafuer, dass für ein Datum Stunden vorliegen.
 *
 * Wird beim Blaettern in spätere Wochen aufgerufen. Fehlt der Zeitraum, wird
 * er erweitert – es wird nie gemeldet, es gebe keine Stunden mehr.
 */
export function useEnsureMaterialized(date: LocalDate) {
  const { store, refresh, snapshot } = useDock();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const extended = await store.ensureMaterialized(date);
      if (extended && !cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [store, refresh, date, snapshot.materializedUntil]);
}
