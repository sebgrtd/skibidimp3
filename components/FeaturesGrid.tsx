"use client";

import React from "react";
import { Zap, ShieldCheck, Video, Scissors, Volume2, Tag, FileArchive, ImageIcon } from "lucide-react";

export default function FeaturesGrid() {
  const features = [
    {
      icon: <Video className="h-5 w-5 text-indigo-400" />,
      title: "Vidéo MP4 HD (1080p / 720p)",
      description: "Téléchargez des vidéos YouTube, TikTok sans filigrane, Reels Instagram, Vimeo et vidéos Twitter / X en MP4 haute résolution.",
      badge: "Nouveau",
    },
    {
      icon: <Zap className="h-5 w-5 text-purple-400" />,
      title: "Audio 320 Kbps & FLAC Lossless",
      description: "Extraction audio de qualité studio 320kbps ou sans perte (FLAC, WAV, M4A) pour YouTube, Spotify, SoundCloud et TikTok.",
      badge: "Inclus",
    },
    {
      icon: <ImageIcon className="h-5 w-5 text-pink-400" />,
      title: "Images Pinterest & Twitter PNG",
      description: "Récupérez les images Pinterest (résolution originale maximale) et photos Twitter / X en format PNG haute fidélité.",
      badge: "Nouveau",
    },
    {
      icon: <FileArchive className="h-5 w-5 text-emerald-400" />,
      title: "Albums & Playlists en Archive .ZIP",
      description: "Convertissez des albums Spotify complets ou des playlists YouTube en un clic sous forme d'archive compressée .ZIP.",
      badge: "Inclus",
    },
    {
      icon: <Scissors className="h-5 w-5 text-blue-400" />,
      title: "Découpe Audio & Vidéo Précise",
      description: "Découpez vos extraits préférés avec une précision à la seconde (timestamps de début et fin personnalisés).",
      badge: "Inclus",
    },
    {
      icon: <ShieldCheck className="h-5 w-5 text-teal-400" />,
      title: "100% Privé, Sans Pub & Gratuit",
      description: "Aucun traqueur publicitaire, aucun pop-up intrusif. Téléchargements illimités et bibliothèque synchronisée.",
      badge: "Sécurisé",
    },
  ];

  return (
    <section className="w-full max-w-5xl mx-auto py-8 sm:py-12 px-4 space-y-6">
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-100">
          Studio Multi-Plateformes & Multi-Formats
        </h2>
        <p className="text-xs text-zinc-400">
          YouTube, TikTok, Instagram, Twitter/X, Pinterest, Vimeo, Spotify et SoundCloud en une seule application.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((item, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3 hover:border-zinc-700 hover:bg-zinc-900/60 transition-all duration-200 shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2.5">
                {item.icon}
              </div>
              <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-800/80 border border-zinc-700/60 px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-zinc-100">
                {item.title}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
