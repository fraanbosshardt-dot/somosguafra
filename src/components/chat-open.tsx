"use client";
import type { ReactNode } from "react";
import { requestChatOpen } from "@/lib/open-chat";

export function ChatOpen({ children = "Hablar con Guafra", code }: { children?: ReactNode; code?: string }) {
  return <button className="btn pri" type="button" onClick={() => requestChatOpen(code)}>{children}</button>;
}
