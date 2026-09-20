import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Der Entwicklungs-Indikator von Next.js überlagert sonst die untere
  // Navigation in den Aufnahmen der visuellen Prüfung.
  devIndicators: false,
  // Die gelieferten Schriftbinärdateien liegen bewusst ausserhalb von public/
  // und werden nicht ausgeliefert. Siehe assets/fonts-unlicensed/README.md.
};

export default nextConfig;
