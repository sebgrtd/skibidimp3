"use client";

import React from "react";
import { History, Trash2, Music, ExternalLink } from "lucide-react";

export interface HistoryItem {
  id: string;
  title: string;
  artist: string;
  thumbnail?: string;
  format: string;
  bitrate: string;
  date: string;
  url: string;
}

interface HistoryListProps {
  history: HistoryItem[];
  onClear: () => void;
}

export default function HistoryList({ history, onClear }: HistoryListProps) {
  if (history.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200">
          <History className="h-5 w-5 text-purple-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Historique des Téléchargements Récents</h3>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Vider l'historique</span>
        </button>
      </div>

      <div className="divide-y divide-slate-800/60 max-h-60 overflow-y-auto pr-1">
        {history.map((item) => (
          <div key={item.id} className="flex items-center gap-3 py-2.5 hover:bg-slate-800/30 px-2 rounded-lg">
            <div className="h-10 w-10 shrink-0 rounded-md overflow-hidden bg-slate-950 border border-slate-800">
              {item.thumbnail ? (
                <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-500">
                  <Music className="h-5 w-5" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
              <p className="text-[11px] text-slate-400 truncate">{item.artist}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-300">
                {item.format.toUpperCase()} {item.bitrate}
              </span>
              <span className="text-[10px] text-slate-500">{item.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
