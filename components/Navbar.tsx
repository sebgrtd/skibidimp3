"use client";

import React from "react";
import Link from "next/link";
import { Music2, Youtube, Radio, LogOut, Lock, ShieldCheck, Video, Image as ImageIcon, Film } from "lucide-react";

interface NavbarProps {
  user: { id: string; username: string; isAdmin?: boolean } | null;
  onLogout: () => void;
  onOpenAuth: () => void;
}

export default function Navbar({ user, onLogout, onOpenAuth }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group transition-transform">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 shrink-0">
            <Music2 className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-100">
              Skibidi <span className="text-indigo-400">MP3</span>
            </span>
            <span className="hidden sm:inline-block rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
              Studio Multi-Plateformes
            </span>
          </div>
        </Link>

        {/* Platforms Badges (Desktop) */}
        <div className="hidden items-center gap-1.5 lg:flex">
          <div className="flex items-center gap-1 rounded-full border border-zinc-800/80 bg-zinc-900/50 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
            <Youtube className="h-3 w-3 text-red-500" />
            <span>YouTube</span>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-zinc-800/80 bg-zinc-900/50 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
            <Film className="h-3 w-3 text-pink-400" />
            <span>TikTok</span>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-zinc-800/80 bg-zinc-900/50 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
            <Film className="h-3 w-3 text-rose-400" />
            <span>Insta</span>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-zinc-800/80 bg-zinc-900/50 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
            <span className="text-[10px] font-bold text-zinc-300">𝕏</span>
            <span>Twitter</span>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-zinc-800/80 bg-zinc-900/50 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
            <ImageIcon className="h-3 w-3 text-red-400" />
            <span>Pinterest</span>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-zinc-800/80 bg-zinc-900/50 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
            <Video className="h-3 w-3 text-sky-400" />
            <span>Vimeo</span>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-zinc-800/80 bg-zinc-900/50 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
            <Music2 className="h-3 w-3 text-emerald-400" />
            <span>Spotify</span>
          </div>
        </div>

        {/* User / Admin & Auth Actions */}
        <div className="flex items-center gap-2.5">
          {user ? (
            <>
              {user.isAdmin && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition-all shadow-sm"
                  title="Accéder au panneau d'administration"
                >
                  <ShieldCheck className="h-4 w-4 text-indigo-400" />
                  <span className="hidden sm:inline">Administration</span>
                </Link>
              )}

              <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5">
                <div className="h-6 w-6 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-zinc-200 truncate max-w-[100px] sm:max-w-[150px]">
                  {user.username}
                </span>
                <button
                  type="button"
                  onClick={onLogout}
                  className="text-zinc-500 hover:text-rose-400 p-1 transition-colors ml-1"
                  title="Se déconnecter"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Connexion</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
