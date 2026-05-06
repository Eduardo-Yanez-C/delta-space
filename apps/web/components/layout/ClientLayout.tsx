"use client";

import { AppLayout } from "./AppLayout";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
