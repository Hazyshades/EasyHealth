"use client";

import { Sidebar, MobileBottomNav } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="eh-app">
      <div className="app-shell">
        <Sidebar />
        <div className="app-main">
          <TopBar />
          <main className="app-content">{children}</main>
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}
