import type { ReactNode } from "react";
import { DockProvider } from "@/data/DockContext";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <DockProvider>{children}</DockProvider>;
}
