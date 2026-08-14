"use client";

import { useState } from "react";
import type { ChatMessagePayload } from "@/server/socket";
import type { CharacterSheetView } from "@/lib/characterSheet";
import type { Ambiance } from "@/lib/ambiance";
import { Avatar } from "@/components/Avatar";
import { usePartyChannel } from "@/hooks/usePartyChannel";
import { usePartyPresence } from "@/hooks/usePartyPresence";
import { Composer } from "./Composer";
import { PartySidebar } from "./PartySidebar";

interface Participant {
  name: string;
  avatarColor: string;
  role: "JOUEUR" | "SPECTATEUR";
}

// Portage complet de maquette/ecran-partie.html (étape 41). SANS le sélecteur "point de vue" ni
// le sélecteur d'ambiance manuel de la maquette (outils de démo explicitement écartés du vrai
// produit, cf CLAUDE.md) — chaque utilisateur ne voit que SA vue (filtrage serveur déjà en place
// depuis turnEngine.ts/socket.ts), l'ambiance suit automatiquement le lieu de la phase active.
export function PartyScreen({
  partyId,
  currentUser,
  participantsById,
  campaignId,
  campaignName,
  scenarioTitle,
  currentPhase,
  ambiance,
  initialMessages,
  initialNextCursor,
  ownSheet,
  initialNotes,
}: {
  partyId: string;
  currentUser: { id: string; name: string; avatarColor: string };
  participantsById: Record<string, Participant>;
  campaignId: string;
  campaignName: string;
  scenarioTitle: string;
  currentPhase: { title: string; order: number } | null;
  ambiance: Ambiance;
  initialMessages: ChatMessagePayload[];
  initialNextCursor: string | null;
  ownSheet: CharacterSheetView | null;
  initialNotes: string;
}) {
  const { messages, streamingText, error, sendMessage, prependMessages } = usePartyChannel(partyId, initialMessages);
  const onlineUserIds = usePartyPresence(partyId);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const res = await fetch(`/api/parties/${partyId}/messages?cursor=${nextCursor}`);
    setLoadingMore(false);
    if (!res.ok) return;
    const data = await res.json();
    prependMessages(data.messages);
    setNextCursor(data.nextCursor);
  }

  const participantAvatars = Object.entries(participantsById).filter(([, p]) => p.role === "JOUEUR");
  const spectatorCount = Object.values(participantsById).filter((p) => p.role === "SPECTATEUR").length;

  return (
    <div className="app-shell" style={{ height: "100vh" }}>
      <div className="topbar">
        <a className="brand" href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="dot" /> SuperDiscoGM
        </a>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: ".9rem" }}>{campaignName} — {scenarioTitle}</div>
          {currentPhase && (
            <div className="faint" style={{ fontSize: ".72rem" }}>Scène active : #{currentPhase.order + 1} {currentPhase.title}</div>
          )}
        </div>
        <div className="flex center gap-8">
          <span
            title="Temps réel"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: onlineUserIds.length > 0 ? "var(--success)" : "var(--text-faint)",
              boxShadow: onlineUserIds.length > 0 ? "0 0 6px var(--success)" : undefined,
            }}
          />
          {participantAvatars.map(([userId, p]) => (
            <Avatar key={userId} name={p.name} color={p.avatarColor} size="sm" />
          ))}
          {spectatorCount > 0 && (
            <div className="avatar sm" style={{ background: "var(--role-spectateur)" }} title={`${spectatorCount} spectateur(s)`}>
              +{spectatorCount}
            </div>
          )}
        </div>
      </div>

      <div className="partie-shell" data-ambiance={ambiance}>
        <div className="partie-main">
          <div className="chat-scroll" style={{ flex: 1, paddingLeft: 24, paddingRight: 24 }}>
            {nextCursor && (
              <button type="button" className="btn ghost small" onClick={loadMore} disabled={loadingMore} style={{ alignSelf: "center" }}>
                {loadingMore ? "Chargement…" : "Charger les messages précédents"}
              </button>
            )}

            {messages.map((msg) => (
              <MessageBubble key={msg.id ?? `${msg.authorUserId}-${msg.content}`} msg={msg} participantsById={participantsById} />
            ))}

            {streamingText !== null && (
              <div className="msg narration">
                <Avatar name="MJ" color="" isMj size="sm" />
                <div>
                  <div className="bubble">
                    <div className="who">Maître du Jeu</div>
                    <div className="text">{streamingText || "…"}</div>
                  </div>
                </div>
              </div>
            )}

            {error && <p className="faint" style={{ color: "#d64550", textAlign: "center" }}>{error}</p>}
          </div>

          <Composer inventory={ownSheet?.inventory ?? []} onSend={(content) => sendMessage(content)} />
        </div>

        <PartySidebar campaignId={campaignId} sheet={ownSheet} initialNotes={initialNotes} />
      </div>
    </div>
  );
}

function MessageBubble({ msg, participantsById }: { msg: ChatMessagePayload; participantsById: Record<string, Participant> }) {
  if (msg.authorType === "SYSTEM") {
    return (
      <div className="msg system">
        <div className="divider">{msg.content}</div>
      </div>
    );
  }

  const isMj = msg.authorType === "MJ";
  const author = msg.authorUserId ? participantsById[msg.authorUserId] : undefined;
  const isPrivate = (msg.visibleToUserIds?.length ?? 0) > 0;
  const isDiceRoll = msg.content.startsWith("🎲 ");
  const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";

  const classes = ["msg", isMj ? "narration" : "", isPrivate ? "private" : ""].filter(Boolean).join(" ");
  const nameColor = !isMj && author ? author.avatarColor : undefined;

  return (
    <div className={classes}>
      <Avatar name={isMj ? "MJ" : author?.name ?? "?"} color={author?.avatarColor ?? "#888"} size="sm" isMj={isMj} />
      <div>
        {isPrivate && <div className="private-flag">🔒 aparté — visible seulement des participants et du MJ</div>}
        <div className="bubble" style={nameColor ? { borderColor: nameColor } : undefined}>
          <div className="who" style={nameColor ? { color: nameColor } : undefined}>
            {isMj ? "Maître du Jeu" : author?.name ?? "Inconnu"}
            {time && <span className="time">{time}</span>}
          </div>
          {isDiceRoll ? <div className="dice-card">{msg.content}</div> : <div className="text">{msg.content}</div>}
        </div>
      </div>
    </div>
  );
}
