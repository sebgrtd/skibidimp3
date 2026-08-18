"use client";

import React, { useState } from "react";
import { Lock, Sparkles, User, Mail, Key, LogIn, UserPlus, Loader2, Zap, ShieldCheck } from "lucide-react";

interface LockScreenProps {
  onLoginSuccess: (user: { id: string; username: string; email: string }) => void;
}

export default function LockScreen({ onLoginSuccess }: LockScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");

  // Form fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
          ? { usernameOrEmail: username || email, password }
          : { username, email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Échec de l'authentification.");
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-purple-500/40 bg-slate-900/95 p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-purple-600/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-pink-600/30 blur-3xl pointer-events-none" />

        {/* Header Badge */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/40 mx-auto">
            <Lock className="h-7 w-7" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tight text-white">
              SUPER SKIBIDI <span className="gradient-text">MP3</span> 🚽⚡
            </h2>
            <p className="text-xs font-semibold text-purple-300">
              {mode === "login"
                ? "Connexion requise pour débloquer le convertisseur"
                : "Créer un compte pour sauvegarder vos téléchargements"}
            </p>
          </div>
        </div>

        {/* Tabs Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-950/80 border border-slate-800">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); }}
            className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === "login" ? "bg-purple-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Connexion</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(null); }}
            className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === "register" ? "bg-purple-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Créer un Compte</span>
          </button>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" ? (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nom d'utilisateur</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ex: SkibidiKing"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 pl-10 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  />
                  <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Adresse E-mail</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex: skibidi@exemple.fr"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 pl-10 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  />
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Nom d'utilisateur ou E-mail</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex: SkibidiKing"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 pl-10 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                />
                <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Mot de passe</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 pl-10 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
              <Key className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 px-5 py-3.5 font-bold text-white shadow-lg shadow-purple-600/30 hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Chargement...</span>
              </>
            ) : mode === "login" ? (
              <>
                <LogIn className="h-4 w-4" />
                <span>Se Connecter & Débloquer</span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Créer Mon Compte</span>
              </>
            )}
          </button>
        </form>

        {/* Lock Notice */}
        <div className="pt-3 border-t border-slate-800/80 text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Accès sécurisé • Sauvegarde automatique de votre musique</span>
          </div>
        </div>
      </div>
    </div>
  );
}
