"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/components/SocketProvider";

interface PresenceEvent {
  partyId: string;
  onlineUserIds: string[];
}

// Écoute party:presence (déjà émis par server/socket.ts à chaque join/leave/disconnect).
// Mécanique d'affichage précise (liste nominative vs compteur) : TBD [Q49b], ce hook expose
// la liste brute des userId connectés, à l'appelant de décider comment l'afficher.
export function usePartyPresence(partyId: string): string[] {
  const socket = useSocket();
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!socket) return;

    const onPresence = (event: PresenceEvent) => {
      if (event.partyId === partyId) setOnlineUserIds(event.onlineUserIds);
    };
    socket.on("party:presence", onPresence);

    return () => {
      socket.off("party:presence", onPresence);
    };
  }, [socket, partyId]);

  return onlineUserIds;
}
