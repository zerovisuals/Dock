import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dock – Dein Schultag, an einem Ort",
  description:
    "Dock hält Stundenplan, Notizen, Hausübungen und das Klassengedächtnis an der Stunde fest, zu der sie gehören.",
  applicationName: "Dock",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Dock",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Der Benutzer darf zoomen. Ein Zoomverbot wäre eine Barriere.
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de-AT">
      <body>{children}</body>
    </html>
  );
}
