"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socketClient";

const SocketContext = createContext<Socket | null>(null);

// Ouvre la connexion une fois (singleton, cf socketClient.ts) — à placer autour des pages
// authentifiées (AppShell), jamais autour de /login où il n'y a pas encore de session.
export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = getSocket();
    setSocket(s);
    // Pas de disconnect() au démontage : le socket est un singleton partagé entre navigations
    // au sein de l'app (App Router garde le client monté), pas par instance de composant.
  }, []);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}
