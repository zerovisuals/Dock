import type { ReactNode } from "react";
import { DockProvider } from "@/data/DockContext";
import { ErsterStart } from "@/ui/ErsterStart";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <DockProvider>
      <ErsterStart />
      {children}
    </DockProvider>
  );
}
