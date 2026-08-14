"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token, email, name, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Échec de l'inscription.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 360, margin: "10vh auto", padding: "1rem" }}>
      <h1>Rejoindre SuperDiscoGM</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          Nom
          <input required value={name} onChange={(e) => setName(e.target.value)} style={{ display: "block", width: "100%", padding: 8 }} />
        </label>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ display: "block", width: "100%", padding: 8 }} />
        </label>
        <label>
          Mot de passe (8 caractères minimum)
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={{ display: "block", width: "100%", padding: 8 }} />
        </label>
        {error && <p style={{ color: "#d64550" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: 10 }}>
          {loading ? "Création..." : "Créer mon compte"}
        </button>
      </form>
    </main>
  );
}
