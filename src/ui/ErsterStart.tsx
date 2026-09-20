"use client";

/**
 * Beim allerersten Start einmal zum Willkommensablauf.
 *
 * Der Stundenplan ist zu diesem Zeitpunkt bereits angelegt und aktiv – der
 * Ablauf schaltet nichts frei, er zeigt nur. Wer ihn überspringt oder schon
 * einmal gesehen hat, landet nie wieder dort.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ABGESCHLOSSEN = "dock:willkommen";

export function ErsterStart() {
  const router = useRouter();

  useEffect(() => {
    let gesehen = true;
    try {
      gesehen = window.localStorage.getItem(ABGESCHLOSSEN) === "1";
    } catch {
      // Ohne lokalen Speicher wird der Ablauf nicht erzwungen: lieber gar
      // nicht zeigen als bei jedem Start.
      gesehen = true;
    }
    if (!gesehen) router.replace("/willkommen");
  }, [router]);

  return null;
}
