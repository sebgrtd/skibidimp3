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
  RefreshCw,
  Trash2,
  AlertTriangle
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
  const [zipProgressPercent, setZipProgressPercent] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [downloadingSingleId, setDownloadingSingleId] = useState<string | null>(null);
  const [singleProgress, setSingleProgress] = useState<{ [id: string]: { percent: number; status: string } }>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

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

  // Delete 1 single track from history
  const handleDeleteSingle = async (id: string) => {
    if (!confirm("Voulez-vous supprimer ce morceau de votre historique ?")) return;
    setDeletingId(id);
    try {
      const res = await fetch("/api/user/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setSelectedIds(prev => prev.filter(i => i !== id));
        onRefreshHistory();
      } else {
        const err = await res.json().catch(() => ({}));
        alert("Erreur lors de la suppression : " + (err.error || "Échec"));
      }
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Delete selected tracks from history
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Supprimer définitivement les ${selectedIds.length} morceau(x) sélectionné(s) de votre historique ?`)) return;

    setIsDeletingBatch(true);
    try {
      const res = await fetch("/api/user/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        setSelectedIds([]);
        onRefreshHistory();
      } else {
        const err = await res.json().catch(() => ({}));
        alert("Erreur lors de la suppression : " + (err.error || "Échec"));
      }
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setIsDeletingBatch(false);
    }
  };

  // Clear entire user history
  const handleClearAll = async () => {
    if (history.length === 0) return;
    if (!confirm("Êtes-vous sûr de vouloir vider TOUT votre historique de téléchargements ? Cette action est irréversible.")) return;

    setIsDeletingBatch(true);
    try {
      const res = await fetch("/api/user/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAll: true }),
      });
      if (res.ok) {
        setSelectedIds([]);
        onRefreshHistory();
      } else {
        const err = await res.json().catch(() => ({}));
        alert("Erreur : " + (err.error || "Échec"));
      }
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setIsDeletingBatch(false);
    }
  };

  // Download 1 track from history
  const handleDownloadSingle = async (item: SyncedHistoryItem) => {
    setDownloadingSingleId(item.id);
    setSingleProgress((prev) => ({
      ...prev,
      [item.id]: { percent: 10, status: "Connexion..." },
    }));

    const singleInterval = setInterval(() => {
      setSingleProgress((prev) => {
        const current = prev[item.id] || { percent: 10, status: "Connexion..." };
        if (current.percent < 40) {
          return { ...prev, [item.id]: { percent: current.percent + 6, status: "Connexion..." } };
        } else if (current.percent < 80) {
          return { ...prev, [item.id]: { percent: current.percent + 4, status: "Conversion 320k..." } };
        } else if (current.percent < 95) {
          return { ...prev, [item.id]: { percent: current.percent + 1.5, status: "Finalisation..." } };
        }
        return prev;
      });
    }, 400);

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
            coverUrl: item.thumbnail,
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Échec de la conversion.");
      }

      clearInterval(singleInterval);
      setSingleProgress((prev) => ({
        ...prev,
        [item.id]: { percent: 100, status: "Prêt !" },
      }));

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

      await new Promise((r) => setTimeout(r, 800));
    } catch (err: any) {
      clearInterval(singleInterval);
      alert("Erreur lors du téléchargement : " + err.message);
    } finally {
      clearInterval(singleInterval);
      setDownloadingSingleId(null);
      setSingleProgress((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
    }
  };

  // Batch ZIP re-download
  const handleBatchRedownload = async (downloadAll: boolean = false) => {
    setDownloadingZip(true);
    setZipProgressPercent(10);
    const idsToDownload = downloadAll ? history.map(h => h.id) : selectedIds;
    setProgressMsg(`Préparation de ${idsToDownload.length} musiques en HD 320kbps...`);

    const zipInterval = setInterval(() => {
      setZipProgressPercent((prev) => {
        if (prev < 30) {
          setProgressMsg(`Connexion aux flux audio (${idsToDownload.length} titres)...`);
          return prev + 6;
        } else if (prev < 80) {
          setProgressMsg(`Compression & conversion ZIP haute vitesse...`);
          return prev + 3;
        } else if (prev < 95) {
          setProgressMsg(`Finalisation du fichier ZIP...`);
          return prev + 1;
        }
        return prev;
      });
    }, 500);

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
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Échec de la création du fichier ZIP.");
      }

      clearInterval(zipInterval);
      setZipProgressPercent(100);
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

      await new Promise((r) => setTimeout(r, 1000));
    } catch (err: any) {
      clearInterval(zipInterval);
      alert("Erreur ZIP : " + err.message);
    } finally {
      clearInterval(zipInterval);
      setDownloadingZip(false);
      setProgressMsg("");
      setZipProgressPercent(0);
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

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={isDeletingBatch}
                className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                title="Supprimer tout l'historique"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tout effacer</span>
              </button>
            )}

            <button
              onClick={onRefreshHistory}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Actualiser</span>
            </button>
          </div>
        </div>

        {/* Global Controls for Batch Re-download & Batch Delete */}
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

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto justify-end">
              {selectedIds.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={isDeletingBatch}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Supprimer ({selectedIds.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBatchRedownload(false)}
                    disabled={downloadingZip}
                    className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-purple-500 disabled:opacity-50"
                  >
                    {downloadingZip ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileArchive className="h-4 w-4" />
                    )}
                    <span>ZIP Sélection ({selectedIds.length})</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => handleBatchRedownload(true)}
                disabled={downloadingZip}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-purple-600/30 hover:brightness-110 disabled:opacity-50"
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

        {/* Real-time ZIP Progress Bar in Dashboard */}
        {downloadingZip && (
          <div className="pt-4 border-t border-slate-800 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="text-purple-300 font-medium truncate flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                {progressMsg}
              </span>
              <span className="font-mono font-bold text-emerald-400 shrink-0">
                {Math.round(zipProgressPercent)}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-emerald-400 transition-all duration-300 relative overflow-hidden"
                style={{ width: `${Math.min(100, Math.max(5, zipProgressPercent))}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
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
              const isDeletingThis = deletingId === item.id;
              const progress = singleProgress[item.id];

              return (
                <div
                  key={item.id}
                  className={`flex flex-col p-3.5 sm:px-5 sm:py-3.5 transition-colors ${
                    isDownloadingThis ? "bg-purple-950/40 border-l-2 border-purple-500" : isSelected ? "bg-purple-950/20" : "hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
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
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate">{item.title}</h4>
                        {isDownloadingThis && progress && (
                          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 shrink-0 animate-pulse">
                            {Math.round(progress.percent)}% - {progress.status}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-400 truncate">{item.artist}</p>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <span className="hidden sm:inline-block rounded-md border border-purple-500/30 bg-purple-500/10 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-mono font-bold text-purple-300">
                        {item.format.toUpperCase()} {item.bitrate}
                      </span>

                      <button
                        onClick={() => handleDownloadSingle(item)}
                        disabled={isDownloadingThis || isDeletingThis}
                        className={`rounded-lg border p-2 shrink-0 transition-colors disabled:opacity-50 ${
                          isDownloadingThis
                            ? "border-purple-500/50 bg-purple-600/30 text-purple-300 font-mono text-xs font-bold px-3"
                            : "border-slate-700 bg-slate-800 text-slate-300 hover:border-purple-500 hover:bg-purple-600 hover:text-white"
                        }`}
                        title="Re-télécharger ce morceau"
                      >
                        {isDownloadingThis ? (
                          <div className="flex items-center gap-1.5">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                            <span>{progress ? `${Math.round(progress.percent)}%` : "..."}</span>
                          </div>
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </button>

                      <button
                        onClick={() => handleDeleteSingle(item.id)}
                        disabled={isDeletingThis || isDownloadingThis}
                        className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:border-rose-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors disabled:opacity-50"
                        title="Supprimer de l'historique"
                      >
                        {isDeletingThis ? (
                          <Loader2 className="h-4 w-4 animate-spin text-rose-400" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Inline progress bar */}
                  {isDownloadingThis && progress && (
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden mt-2.5 border border-purple-500/30">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-emerald-400 transition-all duration-300 relative overflow-hidden"
                        style={{ width: `${Math.min(100, Math.max(5, progress.percent))}%` }}
                      >
                        <div className="absolute inset-0 bg-white/30 animate-pulse" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

