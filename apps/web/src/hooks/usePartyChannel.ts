"use client";

import { useEffect, useState, useCallback } from "react";
import { useSocket } from "@/components/SocketProvider";
import type { ChatMessagePayload } from "@/server/socket";

interface StreamChunkEvent {
  partyId: string;
  chunk: string;
}

interface ChatErrorEvent {
  message: string;
}

interface MjErrorEvent {
  partyId: string;
  message: string;
}

// Rejoint la room party:<id> au montage, quitte au démontage. `initialMessages` vient du chargement
// serveur (page.tsx, page la plus récente) ; les événements temps réel (chat:message) s'y
// ajoutent, dédupliqués par id — la persistance réelle + le tour MJ streamé sont maintenant
// couverts côté serveur par turnEngine.ts (étape 35), ce hook n'est que le relais + la fusion.
export function usePartyChannel(partyId: string, initialMessages: ChatMessagePayload[] = []) {
  const socket = useSocket();
  const [messages, setMessages] = useState<ChatMessagePayload[]>(initialMessages);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Distinct de `error` (validation de saisie, ex: /roll invalide) — remonte l'échec du MOTEUR
  // DE TOUR lui-même (pas de modèle configuré, clé API invalide...) : jusqu'ici un silence total
  // côté joueur, cf turnEngine.ts classifyTurnError(). Assez important pour un affichage distinct.
  const [mjError, setMjError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    socket.emit("party:join", partyId);

    const onMessage = (payload: ChatMessagePayload) => {
      if (payload.partyId !== partyId) return;
      setMessages((prev) => (payload.id && prev.some((m) => m.id === payload.id) ? prev : [...prev, payload]));
      if (payload.authorType === "MJ") setStreamingText(null);
    };
    const onStream = (event: StreamChunkEvent) => {
      if (event.partyId !== partyId) return;
      setStreamingText((prev) => (prev ?? "") + event.chunk);
    };
    const onError = (event: ChatErrorEvent) => setError(event.message);
    const onMjError = (event: MjErrorEvent) => {
      if (event.partyId !== partyId) return;
      setMjError(event.message);
      setStreamingText(null); // le tour a échoué, ne pas laisser une bulle "…" figée
    };

    socket.on("chat:message", onMessage);
    socket.on("chat:stream", onStream);
    socket.on("chat:error", onError);
    socket.on("mj:error", onMjError);

    return () => {
      socket.emit("party:leave", partyId);
      socket.off("chat:message", onMessage);
      socket.off("chat:stream", onStream);
      socket.off("chat:error", onError);
      socket.off("mj:error", onMjError);
    };
  }, [socket, partyId]);

  const sendMessage = useCallback(
    (content: string, visibleToUserIds?: string[]) => {
      setError(null);
      setMjError(null);
      socket?.emit("chat:message", { partyId, content, visibleToUserIds });
    },
    [socket, partyId]
  );

  // Utilisé pour préfixer des messages plus anciens chargés à la demande (scroll infini, étape
  // 38/41) — dédupliqué par id comme les messages temps réel, au cas où les deux se recouvrent.
  const prependMessages = useCallback((older: ChatMessagePayload[]) => {
    setMessages((prev) => {
      const knownIds = new Set(prev.map((m) => m.id).filter(Boolean));
      return [...older.filter((m) => !m.id || !knownIds.has(m.id)), ...prev];
    });
  }, []);

  const dismissMjError = useCallback(() => setMjError(null), []);

  return { messages, streamingText, error, mjError, sendMessage, prependMessages, dismissMjError };
}
