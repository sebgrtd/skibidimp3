"use client";

import React, { useState } from "react";
import { Lock, User, Key, LogIn, UserPlus, Loader2, KeyRound, Music2 } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

interface LockScreenProps {
  onLoginSuccess: (user: { id: string; username: string; isAdmin?: boolean }) => void;
}

export default function LockScreen({ onLoginSuccess }: LockScreenProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");

  // Form fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { username, password }
          : { username, password, inviteCode };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Échec de l'authentification.");
      }

      toast.success(`Bienvenue, @${data.user.username} !`);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
      toast.error(err.message || "Erreur d'authentification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-2xl">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 shadow-md shadow-indigo-500/10 mx-auto">
            <Music2 className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">
              Skibidi <span className="text-indigo-400">MP3 Studio</span>
            </h2>
            <p className="text-xs text-zinc-400">
              {mode === "login"
                ? "Connectez-vous pour accéder au convertisseur haute fidélité"
                : "Inscription sécurisée sur invitation"}
            </p>
          </div>
        </div>

        {/* Tabs Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === "login"
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Connexion</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(null); }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === "register"
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Créer un Compte</span>
          </button>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">Nom d'utilisateur</label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex: sebastien, alexandre..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 pl-10 text-xs text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <User className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
            </div>
          </div>

          {mode === "register" && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">
                Code d'Invitation (Obligatoire)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="ex: SKIBIDI-A8F92C"
                  className="w-full rounded-xl border border-amber-500/40 bg-zinc-950 px-4 py-2.5 pl-10 font-mono text-xs font-semibold text-amber-300 placeholder-zinc-600 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all"
                />
                <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-amber-400" />
              </div>
              <span className="text-[11px] text-zinc-500">Demandez un code d'invitation à l'administrateur.</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">Mot de passe</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 pl-10 text-xs text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <Key className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all mt-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "login" ? (
              <LogIn className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            <span>{mode === "login" ? "Se Connecter" : "Créer mon Compte"}</span>
          </button>
        </form>

        <div className="pt-2 border-t border-zinc-800/80 text-center">
          <p className="text-[11px] text-zinc-500 flex items-center justify-center gap-1.5">
            <Lock className="h-3 w-3" />
            <span>Accès privé et sécurisé par chiffrement de clé Scrypt</span>
          </p>
        </div>
      </div>
    </div>
  );
}
