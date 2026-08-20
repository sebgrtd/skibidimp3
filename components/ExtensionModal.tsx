"use client";

import React, { useState } from "react";
import { Zap, Download, Chrome, CheckCircle2, Copy, ExternalLink, X, FolderArchive, ArrowRight, ShieldCheck } from "lucide-react";

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
      <div className="relative w-full max-w-xl rounded-2xl border border-zinc-700/80 bg-zinc-900/95 p-6 sm:p-8 shadow-2xl shadow-indigo-500/10 text-zinc-100 overflow-hidden">
        
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          title="Fermer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white shadow-lg shadow-indigo-500/30 shrink-0">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-white">Extension Chrome SkibidiMP3</h2>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                v1.0.0
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Téléchargements instantanés directs & synchronisation complète avec votre compte
            </p>
          </div>
        </div>

        {/* Features Pills */}
        <div className="grid grid-cols-3 gap-2 my-5">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5 text-center">
            <div className="text-base mb-1">⚡</div>
            <div className="text-[11px] font-semibold text-zinc-200">Bouton YouTube</div>
            <div className="text-[10px] text-zinc-500">Intégré sous le lecteur</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5 text-center">
            <div className="text-base mb-1">📹</div>
            <div className="text-[11px] font-semibold text-zinc-200">MP4 Client Direct</div>
            <div className="text-[10px] text-zinc-500">Zéro bande passante VPS</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5 text-center">
            <div className="text-base mb-1">🔄</div>
            <div className="text-[11px] font-semibold text-zinc-200">Historique Lié</div>
            <div className="text-[10px] text-zinc-500">Sync automatique</div>
          </div>
        </div>

        {/* 1-Click Download Button */}
        <div className="my-6">
          <a
            href="/api/extension/download"
            download="skibidimp3-extension.zip"
            className="flex items-center justify-center gap-3 w-full rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 p-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <Download className="h-5 w-5" />
            <span>Télécharger le Package (.ZIP)</span>
          </a>
        </div>

        {/* Installation Steps */}
        <div className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <Chrome className="h-3.5 w-3.5 text-indigo-400" />
            Installation en 3 étapes (15 secondes)
          </h3>

          <div className="space-y-3 text-xs text-zinc-300">
            {/* Step 1 */}
            <div className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-[11px] font-bold text-indigo-400">
                1
              </span>
              <div>
                <strong>Téléchargez et dézippez</strong> le fichier <code className="text-indigo-300 bg-zinc-900 px-1 py-0.5 rounded">skibidimp3-extension.zip</code> dans un dossier de votre choix.
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-[11px] font-bold text-indigo-400">
                2
              </span>
              <div className="flex-1">
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
                    {copied ? "Copié !" : "Copier"}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-[11px] font-bold text-indigo-400">
                3
              </span>
              <div>
                Activez le <strong>« Mode développeur »</strong> (interrupteur en haut à droite), cliquez sur <strong>« Charger l'extension non empaquetée »</strong> et sélectionnez le dossier dézippé.
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-5 flex items-center justify-between text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Sans passer par le Chrome Web Store
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
