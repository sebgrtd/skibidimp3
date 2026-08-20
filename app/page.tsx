"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import LockScreen from "@/components/LockScreen";
import ConverterForm from "@/components/ConverterForm";
import PlaylistConverter from "@/components/PlaylistConverter";
import UserDashboard, { SyncedHistoryItem } from "@/components/UserDashboard";
import FeaturesGrid from "@/components/FeaturesGrid";
import ExtensionModal from "@/components/ExtensionModal";
import { Loader2 } from "lucide-react";

interface UserProfile {
  id: string;
  username: string;
  isAdmin?: boolean;
}

export default function Home() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);

  const [playlistInfo, setPlaylistInfo] = useState<any | null>(null);
  const [userHistory, setUserHistory] = useState<SyncedHistoryItem[]>([]);

  // Verify auth session on load
  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
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
      // 1. Synchroniser l'historique local si présent
      try {
        const localItems = JSON.parse(localStorage.getItem("skibidi_local_history") || "[]");
        if (Array.isArray(localItems) && localItems.length > 0) {
          await fetch("/api/user/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: localItems }),
          });
          localStorage.removeItem("skibidi_local_history");
        }
      } catch {}

      // 2. Récupérer l'historique complet synchronisé
      const res = await fetch("/api/user/history", { cache: "no-store" });
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-100">
        <div className="flex items-center gap-3 font-medium text-xs text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          <span>Chargement du studio média...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col antialiased bg-zinc-950 text-zinc-100">
      <Navbar
        user={user}
        onLogout={handleLogout}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenExtensionModal={() => setShowExtensionModal(true)}
      />

      {/* Extension Chrome Installation Modal */}
      <ExtensionModal
        isOpen={showExtensionModal}
        onClose={() => setShowExtensionModal(false)}
      />

      {/* App Lock: Require auth */}
      {(!user || showAuthModal) && (
        <LockScreen
          onLoginSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            setShowAuthModal(false);
            fetchUserHistory();
          }}
        />
      )}

      <main className="flex-1 container mx-auto px-4 py-8 sm:py-12 space-y-12 max-w-5xl">
        {/* Hero Section */}
        <section className="text-center space-y-3.5 max-w-2xl mx-auto pt-2 sm:pt-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3.5 py-1 text-xs font-medium text-zinc-300 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Vidéo MP4 • Audio 320kbps • GIF • Images PNG</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-100 leading-tight">
            Convertir & Télécharger tous vos médias
          </h1>

          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-lg mx-auto">
            Téléchargez depuis YouTube, TikTok, Instagram, Twitter/X, Pinterest, Vimeo, Spotify et SoundCloud en MP4, MP3 320k ou PNG HD.
          </p>
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

        {/* User Account Dashboard & History */}
        {user && (
          <UserDashboard
            user={user}
            history={userHistory}
            onRefreshHistory={fetchUserHistory}
          />
        )}

        {/* Features Grid */}
        <FeaturesGrid />
      </main>

      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-6 text-center text-xs text-zinc-500">
        <div className="container mx-auto px-4 space-y-1">
          <p className="font-medium text-zinc-400">
            Skibidi MP3 • Studio Média Multi-Plateformes (MP4 / MP3 / PNG / GIF)
          </p>
        </div>
      </footer>
    </div>
  );
}
