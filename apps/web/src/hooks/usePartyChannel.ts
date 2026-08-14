"use client";

import { useEffect, useState, useCallback } from "react";
import { useSocket } from "@/components/SocketProvider";
import type { ChatMessagePayload } from "@/server/socket";

// Rejoint la room party:<id> au montage, quitte au démontage, accumule les messages reçus.
// La persistance réelle en DB + l'appel LLM du MJ-IA arrivent avec le moteur de tour (étape 35
// du PLAN.md) — ce hook ne fait que le relais temps réel, pas la logique de jeu.
export function usePartyChannel(partyId: string) {
  const socket = useSocket();
  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.emit("party:join", partyId);
    const onMessage = (payload: ChatMessagePayload) => {
      if (payload.partyId === partyId) setMessages((prev) => [...prev, payload]);
    };
    socket.on("chat:message", onMessage);

    return () => {
      socket.emit("party:leave", partyId);
      socket.off("chat:message", onMessage);
    };
  }, [socket, partyId]);

  const sendMessage = useCallback(
    (payload: Omit<ChatMessagePayload, "partyId">) => {
      socket?.emit("chat:message", { ...payload, partyId });
    },
    [socket, partyId]
  );

  return { messages, sendMessage };
}
