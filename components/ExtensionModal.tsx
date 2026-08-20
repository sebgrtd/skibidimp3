"use client";

import React, { useState } from "react";
import { Zap, Download, Chrome, CheckCircle2, Copy, X, Video, RefreshCw, ShieldCheck } from "lucide-react";

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExtensionModal({ isOpen, onClose }: ExtensionModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyUrl = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900/95 p-6 sm:p-8 shadow-2xl shadow-indigo-500/10 text-zinc-100 overflow-hidden">
        
        {/* Subtle glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          title="Fermer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 shrink-0">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">Extension Chrome SkibidiMP3</h2>
              <span className="rounded-md bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
                v1.0.0
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Téléchargements directs et synchronisation automatique avec votre compte
            </p>
          </div>
        </div>

        {/* Features Cards */}
        <div className="grid grid-cols-3 gap-2.5 my-5">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-center flex flex-col items-center justify-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-400 mb-1.5">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <div className="text-[11px] font-semibold text-zinc-200">Bouton YouTube</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Intégré sous la vidéo</div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-center flex flex-col items-center justify-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-400 mb-1.5">
              <Video className="h-3.5 w-3.5" />
            </div>
            <div className="text-[11px] font-semibold text-zinc-200">MP4 Client Direct</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Sans charge VPS</div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-center flex flex-col items-center justify-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-400 mb-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
            </div>
            <div className="text-[11px] font-semibold text-zinc-200">Historique Lié</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Sync automatique</div>
          </div>
        </div>

        {/* 1-Click Download Button */}
        <div className="my-5">
          <a
            href="/api/extension/download"
            download="skibidimp3-extension.zip"
            className="flex items-center justify-center gap-2.5 w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 p-3 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <Download className="h-4 w-4" />
            <span>Télécharger le Package (.ZIP)</span>
          </a>
        </div>

        {/* Installation Steps */}
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <Chrome className="h-3.5 w-3.5 text-indigo-400" />
            Installation en 3 étapes (15 secondes)
          </h3>

          <div className="space-y-2.5 text-xs text-zinc-300">
            {/* Step 1 */}
            <div className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-bold text-indigo-400">
                1
              </span>
              <div className="pt-0.5">
                Téléchargez et dézippez le fichier <code className="text-indigo-300 bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-[11px]">skibidimp3-extension.zip</code>.
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-bold text-indigo-400">
                2
              </span>
              <div className="flex-1 pt-0.5">
                Ouvrez Google Chrome et accédez à :
                <div className="mt-1 flex items-center gap-2">
                  <code className="text-zinc-300 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-[11px] select-all">
                    chrome://extensions
                  </code>
                  <button
                    onClick={() => copyUrl("chrome://extensions")}
                    className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded transition-colors"
                  >
                    {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? "Copié !" : "Copier"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-bold text-indigo-400">
                3
              </span>
              <div className="pt-0.5">
                Activez le <strong>Mode développeur</strong> (en haut à droite), cliquez sur <strong>« Charger l'extension non empaquetée »</strong> et sélectionnez le dossier dézippé.
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-4 flex items-center justify-between text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Installation locale sécurisée
          </span>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 font-medium transition-colors"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
