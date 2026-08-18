"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import LockScreen from "@/components/LockScreen";
import ConverterForm from "@/components/ConverterForm";
import PlaylistConverter from "@/components/PlaylistConverter";
import UserDashboard, { SyncedHistoryItem } from "@/components/UserDashboard";
import FeaturesGrid from "@/components/FeaturesGrid";
import { Sparkles, Youtube, Music, Radio, Loader2 } from "lucide-react";

interface UserProfile {
  id: string;
  username: string;
  email: string;
}

export default function Home() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [playlistInfo, setPlaylistInfo] = useState<any | null>(null);
  const [userHistory, setUserHistory] = useState<SyncedHistoryItem[]>([]);

  // Verify auth session on load
  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (res.ok && data.authenticated && data.user) {
        setUser(data.user);
        fetchUserHistory();
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setAuthChecked(true);
    }
  };

  const fetchUserHistory = async () => {
    try {
      const res = await fetch("/api/user/history");
      if (res.ok) {
        const data = await res.json();
        setUserHistory(data.history || []);
      }
    } catch {}
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/me", { method: "POST" });
    setUser(null);
    setUserHistory([]);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex items-center gap-3 font-bold text-sm text-purple-400">
          <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
          <span>Vérification de la session Super Skibidi MP3...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col antialiased bg-slate-950">
      <Navbar
        user={user}
        onLogout={handleLogout}
        onOpenAuth={() => setShowAuthModal(true)}
      />

      {/* App Lock: Force login if not authenticated */}
      {(!user || showAuthModal) && (
        <LockScreen
          onLoginSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            setShowAuthModal(false);
            fetchUserHistory();
          }}
        />
      )}

      <main className="flex-1 container mx-auto px-4 py-8 sm:py-12 space-y-12">
        {/* Hero Section */}
        <section className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-4 py-1.5 text-xs font-bold text-pink-400">
            <Sparkles className="h-4 w-4 animate-spin" />
            <span>SUPER SKIBIDI EDITION • COMPTES & SYNCHRO 🚽⚡</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
            <span className="gradient-text">SUPER SKIBIDI MP3</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 font-medium">
            Convertissez vos musiques en vraie qualité 320 kbps HD Studio. Vos téléchargements sont automatiquement sauvegardés dans votre compte pour les re-télécharger en 1 seul clic !
          </p>

          {/* Source Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-red-400">
              <Youtube className="h-4 w-4 text-red-500" />
              <span>YouTube & Shorts</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-emerald-400">
              <Music className="h-4 w-4 text-emerald-500" />
              <span>Spotify Track & Album</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-orange-400">
              <Radio className="h-4 w-4 text-orange-500" />
              <span>SoundCloud HQ</span>
            </div>
          </div>
        </section>

        {/* Converter Form / Playlist Converter */}
        <section>
          {playlistInfo ? (
            <PlaylistConverter
              playlist={playlistInfo}
              onReset={() => setPlaylistInfo(null)}
              onAddToHistory={fetchUserHistory}
            />
          ) : (
            <ConverterForm
              onPlaylistDetected={(info) => setPlaylistInfo(info)}
              onAddToHistory={fetchUserHistory}
            />
          )}
        </section>

        {/* User Account Dashboard & History Re-downloader */}
        {user && (
          <UserDashboard
            user={user}
            history={userHistory}
            onRefreshHistory={fetchUserHistory}
          />
        )}

        {/* Unlocked Features Comparison Grid */}
        <FeaturesGrid />
      </main>

      <footer className="border-t border-slate-800 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="container mx-auto px-4 space-y-2">
          <p className="font-bold text-slate-400">
            SUPER SKIBIDI MP3 🚽⚡ • Moteur d'Extraction Audio & Synchro Compte (320kbps Studio)
          </p>
        </div>
      </footer>
    </div>
  );
}
