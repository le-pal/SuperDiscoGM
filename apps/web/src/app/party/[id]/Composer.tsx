"use client";

import { useRef, useState } from "react";
import type { InventoryItem } from "@/lib/characterSheet";

// Composer (portage maquette/ecran-partie.html) — texte libre + actions structurées clés [Q27] :
// bouton dé (préremplit /roll, cf socket.ts ROLL_COMMAND_PATTERN, étape 37) et sélection rapide
// d'un objet de l'inventaire (insère une réplique dans le champ plutôt que de l'envoyer
// directement — laisse le joueur ajuster avant d'envoyer, plus sûr qu'un envoi automatique).
export function Composer({ inventory, onSend }: { inventory: InventoryItem[]; onSend: (content: string) => void }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function send() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
  }

  function insertRoll() {
    setValue("/roll 1d20");
    inputRef.current?.focus();
  }

  function insertItem(item: string) {
    if (!item) return;
    setValue((prev) => (prev.trim().length > 0 ? `${prev} ` : "") + `J'utilise ${item}. `);
    inputRef.current?.focus();
  }

  return (
    <div className="composer">
      <button type="button" className="btn small" onClick={insertRoll}>🎲 Lancer un dé</button>
      {inventory.length > 0 && (
        <select defaultValue="" onChange={(e) => { insertItem(e.target.value); e.target.value = ""; }} className="btn small ghost">
          <option value="" disabled>⚡ Action rapide</option>
          {inventory.map((item) => (
            <option key={item.name} value={item.name}>{item.name}</option>
          ))}
        </select>
      )}
      <input
        ref={inputRef}
        type="text"
        placeholder="Écrivez votre action ou votre réplique…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") send();
        }}
      />
      <button type="button" className="btn primary small" onClick={send}>Envoyer</button>
    </div>
  );
}
