"use client";

import React from "react";
import { Zap, ShieldCheck, Download, Scissors, Volume2, Tag, FileArchive } from "lucide-react";

export default function FeaturesGrid() {
  const features = [
    {
      icon: <Zap className="h-6 w-6 text-purple-400" />,
      title: "Audio 320 Kbps HD Gratuit",
      description: "Aucune limite de débit ou de compression. Profitez du son MP3 320 kbps, FLAC sans perte ou WAV Studio.",
      paywallComparison: "Payant sur les autres convertisseurs (limités à 128k)",
    },
    {
      icon: <FileArchive className="h-6 w-6 text-pink-400" />,
      title: "Téléchargement de Playlists en ZIP",
      description: "Convertissez des playlists complètes YouTube ou albums Spotify en 1 seul clic sous forme d'archive .ZIP.",
      paywallComparison: "Bloqué par paywall ailleurs (limité à 3 titres)",
    },
    {
      icon: <Scissors className="h-6 w-6 text-emerald-400" />,
      title: "Découpeur Audio Intégré",
      description: "Découpez les intros, outro ou interludes avec précision de timestamp avant le téléchargement.",
      paywallComparison: "Option Premium ou payante sur le web",
    },
    {
      icon: <Tag className="h-6 w-6 text-blue-400" />,
      title: "Éditeur de Tags ID3 & Pochettes HD",
      description: "Modifiez le titre, l'artiste, l'album et intégrez la pochette d'album haute définition directement dans le fichier audio.",
      paywallComparison: "Inexistant sur les convertisseurs gratuits",
    },
    {
      icon: <Volume2 className="h-6 w-6 text-orange-400" />,
      title: "Boost de Volume +100% & Normalisation",
      description: "Amplifiez le volume jusqu'à x2 et égalisez le niveau sonore entre différentes chansons.",
      paywallComparison: "Réservé aux logiciels payants",
    },
    {
      icon: <ShieldCheck className="h-6 w-6 text-teal-400" />,
      title: "100% Sans Pub & Vitesse Maximale",
      description: "Pas de fenêtres pop-up, pas de redirection trompeuse, pas de captcha. Conversion instantanée.",
      paywallComparison: "Les sites web gratuits regorgent de pubs virales",
    },
  ];

  return (
    <section className="w-full max-w-6xl mx-auto py-12 px-4 space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-300">
          <Zap className="h-4 w-4" />
          <span>SUPER SKIBIDI FEATURES 🚽⚡</span>
        </div>
        <h2 className="text-3xl font-black text-white sm:text-4xl">
          Pourquoi utiliser <span className="gradient-text">SUPER SKIBIDI MP3</span> ?
        </h2>
        <p className="text-sm text-slate-400 max-w-2xl mx-auto">
          Nous avons débloqué toutes les fonctionnalités restreintes par les convertisseurs en ligne payants pour vous offrir le meilleur outil d'extraction audio.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((item, idx) => (
          <div
            key={idx}
            className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 hover:border-purple-500/50 hover:bg-slate-900/90 transition-all duration-300 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 group-hover:scale-110 transition-transform">
                {item.icon}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                GRATUIT
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                {item.title}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
            </div>

            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-pink-400/90 font-medium italic">
              ❌ {item.paywallComparison}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
