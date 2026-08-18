"use client";

import React from "react";
import { Sparkles, Music, Youtube, Radio, Zap, User, LogOut, Lock } from "lucide-react";

interface NavbarProps {
  user: { id: string; username: string; email: string } | null;
  onLogout: () => void;
  onOpenAuth: () => void;
}

export default function Navbar({ user, onLogout, onOpenAuth }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 via-pink-500 to-yellow-400 text-white shadow-lg shadow-purple-500/30">
            <Zap className="h-6 w-6 fill-current animate-pulse" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight gradient-text">
              SUPER SKIBIDI <span className="text-pink-500">MP3</span> 🚽⚡
            </span>
            <span className="ml-2 hidden rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300 sm:inline-block">
              FULL UNLOCKED
            </span>
          </div>
        </div>

        {/* Source Badges */}
        <div className="hidden items-center gap-2 lg:flex">
          <div className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400">
            <Youtube className="h-3.5 w-3.5" />
            <span>YouTube 4K</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            <Music className="h-3.5 w-3.5" />
            <span>Spotify HD</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-400">
            <Radio className="h-3.5 w-3.5" />
            <span>SoundCloud</span>
          </div>
        </div>

        {/* Auth / Account User Badge */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3 rounded-full border border-purple-500/30 bg-slate-900/90 px-3 py-1.5">
              <div className="h-7 w-7 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-white hidden sm:inline-block">
                {user.username}
              </span>
              <button
                type="button"
                onClick={onLogout}
                className="text-slate-400 hover:text-red-400 p-1 transition-colors"
                title="Se déconnecter"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 shadow-md transition-all"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Connexion / Inscription</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
