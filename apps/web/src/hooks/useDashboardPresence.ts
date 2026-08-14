"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/components/SocketProvider";

// Indicateur de présence du tableau de bord [Q49] — "il y a déjà quelqu'un dessus" en un coup
// d'œil. Poll léger (10s) via ack socket plutôt qu'un flux poussé dédié : mécanique précise TBD
// [Q49b], ce hook expose juste userId[] par partyId, à l'appelant de décider l'affichage
// (liste nominative vs compteur, cf usePartyPresence.ts qui fait le même choix pour l'écran de partie).
export function useDashboardPresence(partyIds: string[]): Record<string, string[]> {
  const socket = useSocket();
  const [presence, setPresence] = useState<Record<string, string[]>>({});
  const key = partyIds.join(",");

  useEffect(() => {
    if (!socket || partyIds.length === 0) return;

    function refresh() {
      socket!.emit("dashboard:presence", partyIds, (result: Record<string, string[]>) => {
        setPresence(result);
      });
    }

    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, key]);

  return presence;
}
