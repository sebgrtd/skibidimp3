"use client";

import React, { useState } from "react";
import { 
  Download, 
  History, 
  Trash2, 
  CheckSquare, 
  Square, 
  RotateCw, 
  Loader2, 
  Music,
  FolderArchive
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";

export interface SyncedHistoryItem {
  id: string;
  title: string;
  artist: string;
  thumbnail?: string;
  format: string;
  bitrate: string;
  date: string;
  url: string;
}

interface UserDashboardProps {
  user: { id: string; username: string };
  history: SyncedHistoryItem[];
  onRefreshHistory: () => void;
}

export default function UserDashboard({ user, history, onRefreshHistory }: UserDashboardProps) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipProgressPercent, setZipProgressPercent] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [downloadingSingleId, setDownloadingSingleId] = useState<string | null>(null);
  const [singleProgress, setSingleProgress] = useState<{ [id: string]: { percent: number; status: string } }>({});
  
  // Modals state
  const [deleteSingleItem, setDeleteSingleItem] = useState<SyncedHistoryItem | null>(null);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === history.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(history.map((h) => h.id));
    }
  };

  // Delete single history item
  const handleExecuteDeleteSingle = async () => {
    if (!deleteSingleItem) return;
    const itemId = deleteSingleItem.id;
    setDeleteSingleItem(null);
    setIsDeleting(true);

    try {
      const res = await fetch("/api/user/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId }),
      });

      if (res.ok) {
        toast.success("Morceau supprimé de l'historique.");
        setSelectedIds(prev => prev.filter(id => id !== itemId));
        onRefreshHistory();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Impossible de supprimer le morceau.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur de connexion.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete selected history items
  const handleExecuteDeleteSelected = async () => {
    setConfirmDeleteSelected(false);
    if (selectedIds.length === 0) return;
    setIsDeleting(true);

    try {
      const res = await fetch("/api/user/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (res.ok) {
        toast.success(`${selectedIds.length} morceau(x) supprimé(s).`);
        setSelectedIds([]);
        onRefreshHistory();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Impossible de supprimer la sélection.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur de connexion.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Clear all history
  const handleExecuteClearAll = async () => {
    setConfirmClearAll(false);
    setIsDeleting(true);

    try {
      const res = await fetch("/api/user/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAll: true }),
      });

      if (res.ok) {
        toast.success("Historique entièrement vidé.");
        setSelectedIds([]);
        onRefreshHistory();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Impossible de vider l'historique.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur de connexion.");
    } finally {
      setIsDeleting(false);
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

      toast.success(`« ${cleanTitle} » téléchargé !`);
      await new Promise((r) => setTimeout(r, 800));
    } catch (err: any) {
      clearInterval(singleInterval);
      toast.error(err.message || "Erreur lors du téléchargement.");
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
    const idsToDownload = downloadAll ? history.map(h => h.id) : selectedIds;
    if (idsToDownload.length === 0) {
      toast.info("Veuillez sélectionner au moins un morceau.");
      return;
    }

    setDownloadingZip(true);
    setZipProgressPercent(10);
    setProgressMsg(`Préparation de ${idsToDownload.length} titres en HD 320kbps...`);

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
        body: JSON.stringify({ itemIds: idsToDownload }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la génération du ZIP.");
      }

      clearInterval(zipInterval);
      setZipProgressPercent(100);
      setProgressMsg("Archive prête !");

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Skibidi_Library_${idsToDownload.length}_tracks.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      toast.success(`Archive ZIP téléchargée (${idsToDownload.length} morceaux) !`);
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err: any) {
      clearInterval(zipInterval);
      toast.error(err.message || "Erreur lors de la création de l'archive ZIP.");
    } finally {
      clearInterval(zipInterval);
      setDownloadingZip(false);
      setProgressMsg("");
      setZipProgressPercent(0);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Account Info & Batch Controls Banner */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6 shadow-xl backdrop-blur-xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-bold text-indigo-400">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-semibold text-zinc-100">
                  Bibliothèque de @{user.username}
                </h3>
                <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  Synchronisé
                </span>
              </div>
              <p className="text-xs text-zinc-400">{history.length} musique(s) sauvegardée(s)</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
                title="Tout effacer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tout effacer</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRefreshHistory}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition-colors"
              title="Actualiser la liste"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Actualiser</span>
            </button>
          </div>
        </div>

        {/* Global Selection Controls */}
        {history.length > 0 && (
          <div className="pt-4 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                {selectedIds.length === history.length ? (
                  <>
                    <CheckSquare className="h-4 w-4 text-indigo-400" />
                    <span>Désélectionner tout</span>
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 text-zinc-500" />
                    <span>Tout Sélectionner ({history.length})</span>
                  </>
                )}
              </button>

              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteSelected(true)}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Supprimer ({selectedIds.length})</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => handleBatchRedownload(selectedIds.length === 0)}
                disabled={downloadingZip || history.length === 0}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all"
              >
                {downloadingZip ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Préparation de l'archive...</span>
                  </>
                ) : (
                  <>
                    <FolderArchive className="h-4 w-4" />
                    <span>
                      {selectedIds.length > 0
                        ? `Télécharger Sélection (${selectedIds.length} .ZIP)`
                        : `Tout Télécharger (${history.length} .ZIP)`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Real-time ZIP Progress Bar */}
        {downloadingZip && (
          <div className="pt-3 border-t border-zinc-800 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium truncate flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                {progressMsg}
              </span>
              <span className="font-mono font-bold text-emerald-400 shrink-0">
                {Math.round(zipProgressPercent)}%
              </span>
            </div>
            <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-800">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300 relative overflow-hidden"
                style={{ width: `${Math.min(100, Math.max(5, zipProgressPercent))}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History Items List */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <History className="h-4 w-4 text-indigo-400" />
            <span>Historique des Téléchargements</span>
          </h3>
          <span className="text-xs text-zinc-500">{history.length} morceau(x)</span>
        </div>

        {history.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Music className="h-10 w-10 text-zinc-600 mx-auto" />
            <h4 className="text-sm font-semibold text-zinc-300">Aucun téléchargement enregistré</h4>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Collez un lien ci-dessus pour convertir votre première musique. Elle sera sauvegardée dans votre compte !
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60 max-h-96 overflow-y-auto">
            {history.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const isDownloadingThis = downloadingSingleId === item.id;
              const progress = singleProgress[item.id];

              return (
                <div
                  key={item.id}
                  className={`flex flex-col p-3.5 sm:px-5 sm:py-3.5 transition-colors ${
                    isDownloadingThis ? "bg-zinc-850/80 border-l-2 border-indigo-500" : isSelected ? "bg-indigo-950/15" : "hover:bg-zinc-800/30"
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={() => toggleSelect(item.id)}
                      className="text-zinc-500 hover:text-indigo-400 shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-indigo-400" />
                      ) : (
                        <Square className="h-4 w-4 text-zinc-600" />
                      )}
                    </button>

                    <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-zinc-600">
                          <Music className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">{item.title}</h4>
                        {isDownloadingThis && progress && (
                          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 shrink-0 animate-pulse">
                            {Math.round(progress.percent)}% - {progress.status}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate">{item.artist}</p>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <span className="hidden sm:inline-block rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                        {item.format.toUpperCase()} {item.bitrate}
                      </span>

                      <button
                        onClick={() => handleDownloadSingle(item)}
                        disabled={isDownloadingThis}
                        className={`rounded-lg border p-1.5 shrink-0 transition-colors disabled:opacity-50 ${
                          isDownloadingThis
                            ? "border-indigo-500/40 bg-indigo-600/20 text-indigo-300 font-mono text-xs font-semibold px-2.5"
                            : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                        }`}
                        title="Re-télécharger ce morceau"
                      >
                        {isDownloadingThis ? (
                          <div className="flex items-center gap-1.5">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                            <span>{progress ? `${Math.round(progress.percent)}%` : "..."}</span>
                          </div>
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => setDeleteSingleItem(item)}
                        className="rounded-lg border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
                        title="Supprimer de l'historique"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline progress bar */}
                  {isDownloadingThis && progress && (
                    <div className="w-full h-1 bg-zinc-950 rounded-full overflow-hidden mt-2.5 border border-zinc-800">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300 relative overflow-hidden"
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

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={deleteSingleItem !== null}
        title="Supprimer ce morceau"
        message={`Êtes-vous sûr de vouloir supprimer « ${deleteSingleItem?.title || ""} » de votre historique ?`}
        confirmLabel="Supprimer"
        onConfirm={handleExecuteDeleteSingle}
        onCancel={() => setDeleteSingleItem(null)}
      />

      <ConfirmModal
        isOpen={confirmDeleteSelected}
        title="Supprimer la sélection"
        message={`Êtes-vous sûr de vouloir supprimer définitivement les ${selectedIds.length} morceau(x) sélectionné(s) ?`}
        confirmLabel={`Supprimer ${selectedIds.length} morceau(x)`}
        onConfirm={handleExecuteDeleteSelected}
        onCancel={() => setConfirmDeleteSelected(false)}
      />

      <ConfirmModal
        isOpen={confirmClearAll}
        title="Vider tout l'historique"
        message="Êtes-vous certain de vouloir supprimer l'intégralité de votre historique de téléchargement ? Cette action est irréversible."
        confirmLabel="Tout effacer définitivement"
        onConfirm={handleExecuteClearAll}
        onCancel={() => setConfirmClearAll(false)}
      />
    </div>
  );
}
