"use client";

import React, { useState } from "react";
import { 
  History, 
  Download, 
  FileArchive, 
  CheckSquare, 
  Square, 
  Loader2, 
  Music, 
  RefreshCw
} from "lucide-react";

export interface SyncedHistoryItem {
  id: string;
  title: string;
  artist: string;
  thumbnail?: string;
  format: string;
  bitrate: string;
  url: string;
  date: string;
  timestamp: number;
}

interface UserDashboardProps {
  user: { id: string; username: string };
  history: SyncedHistoryItem[];
  onRefreshHistory: () => void;
}

export default function UserDashboard({ user, history, onRefreshHistory }: UserDashboardProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [downloadingSingleId, setDownloadingSingleId] = useState<string | null>(null);

  const toggleSelectAll = () => {
    if (selectedIds.length === history.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(history.map((item) => item.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Download 1 track from history
  const handleDownloadSingle = async (item: SyncedHistoryItem) => {
    setDownloadingSingleId(item.id);
    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: item.url,
          format: item.format || "mp3",
          bitrate: item.bitrate || "320k",
          metadata: {
            title: item.title,
            artist: item.artist,
          },
        }),
      });

      if (!res.ok) throw new Error("Échec de la conversion.");

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const cleanArtist = item.artist.trim();
      const cleanTitle = item.title.trim();
      a.download = cleanArtist ? `${cleanArtist} - ${cleanTitle}.${item.format}` : `${cleanTitle}.${item.format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert("Erreur lors du téléchargement : " + err.message);
    } finally {
      setDownloadingSingleId(null);
    }
  };

  // Batch ZIP re-download
  const handleBatchRedownload = async (downloadAll: boolean = false) => {
    setDownloadingZip(true);
    const idsToDownload = downloadAll ? history.map(h => h.id) : selectedIds;
    setProgressMsg(`Préparation de ${idsToDownload.length} musiques en HD 320kbps...`);

    try {
      const res = await fetch("/api/user/batch-redownload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackIds: idsToDownload,
          downloadAll,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Échec de la création du fichier ZIP.");
      }

      setProgressMsg("Téléchargement du ZIP...");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `SuperSkibidi_Historique_${user.username}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert("Erreur ZIP : " + err.message);
    } finally {
      setDownloadingZip(false);
      setProgressMsg("");
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Account Info Header */}
      <div className="rounded-2xl border border-purple-500/40 bg-slate-900/90 p-4 sm:p-6 shadow-2xl space-y-6 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-purple-500/30">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                <span>Compte de {user.username}</span>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-400 font-bold">
                  Synchronisé
                </span>
              </h2>
              <p className="text-xs text-slate-400">{history.length} musique(s) sauvegardée(s)</p>
            </div>
          </div>

          <button
            onClick={onRefreshHistory}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Actualiser</span>
          </button>
        </div>

        {/* Global Controls for Batch Re-download */}
        {history.length > 0 && (
          <div className="pt-4 border-t border-slate-800/80 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center justify-between md:justify-start gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                {selectedIds.length === history.length ? (
                  <CheckSquare className="h-4 w-4 text-purple-400" />
                ) : (
                  <Square className="h-4 w-4 text-slate-400" />
                )}
                <span>
                  {selectedIds.length === history.length
                    ? "Désélectionner Tout"
                    : `Tout Sélectionner (${history.length})`}
                </span>
              </button>

              <span className="text-xs text-slate-400 font-mono">
                {selectedIds.length} sélectionnée(s)
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleBatchRedownload(false)}
                  disabled={downloadingZip}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-purple-500 disabled:opacity-50"
                >
                  {downloadingZip ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileArchive className="h-4 w-4" />
                  )}
                  <span>Re-télécharger Sélection (.ZIP)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleBatchRedownload(true)}
                disabled={downloadingZip}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-purple-600/30 hover:brightness-110 disabled:opacity-50"
              >
                {downloadingZip ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{progressMsg || "ZIP..."}</span>
                  </>
                ) : (
                  <>
                    <FileArchive className="h-4 w-4" />
                    <span>Re-télécharger TOUT (.ZIP)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History Items List */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
            <History className="h-4 w-4 text-purple-400" />
            <span>Mon Historique de Téléchargements</span>
          </h3>
          <span className="text-xs text-slate-400">{history.length} morceau(x)</span>
        </div>

        {history.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Music className="h-12 w-12 text-slate-600 mx-auto animate-bounce" />
            <h4 className="text-sm font-bold text-white">Aucun téléchargement enregistré</h4>
            <p className="text-xs text-slate-400">
              Collez un lien ci-dessus et téléchargez une musique. Elle sera automatiquement sauvegardée dans votre compte !
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto">
            {history.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const isDownloadingThis = downloadingSingleId === item.id;

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 sm:gap-4 p-3.5 sm:px-5 sm:py-3.5 transition-colors ${
                    isSelected ? "bg-purple-950/20" : "hover:bg-slate-800/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSelect(item.id)}
                    className="text-slate-400 hover:text-purple-400 shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="h-5 w-5 text-purple-400" />
                    ) : (
                      <Square className="h-5 w-5 text-slate-600" />
                    )}
                  </button>

                  <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-slate-950 border border-slate-800">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-slate-500">
                        <Music className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">{item.title}</h4>
                    <p className="text-[11px] sm:text-xs text-slate-400 truncate">{item.artist}</p>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-mono font-bold text-purple-300">
                      {item.format.toUpperCase()} {item.bitrate}
                    </span>

                    <button
                      onClick={() => handleDownloadSingle(item)}
                      disabled={isDownloadingThis}
                      className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:border-purple-500 hover:bg-purple-600 hover:text-white transition-colors"
                      title="Re-télécharger ce morceau"
                    >
                      {isDownloadingThis ? (
                        <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
