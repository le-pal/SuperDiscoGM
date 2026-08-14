"use client";

import { useRouter } from "next/navigation";

// Vit dans AppShell (topbar) — jusqu'ici seule la page d'accueil placeholder l'affichait,
// ce qui aurait laissé l'app sans moyen de se déconnecter une fois le vrai dashboard porté (étape 44).
export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      className="btn ghost small"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      Se déconnecter
    </button>
  );
}
