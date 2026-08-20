"use client";

import React, { useState, useMemo } from "react";
import { 
  Download, 
  History, 
  Trash2, 
  CheckSquare, 
  Square, 
  RotateCw, 
  Loader2, 
  Music,
  FolderArchive,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  X
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
  
  // Search, Filter & Sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date_desc");

  // Platform detection helper
  const detectPlatform = (rawUrl: string = "", rawPlatform?: string) => {
    if (rawPlatform && rawPlatform !== "generic") return rawPlatform.toLowerCase();
    const l = (rawUrl || "").toLowerCase();
    if (l.includes("spotify.com") || l.includes("open.spotify") || l.startsWith("spotify:")) return "spotify";
    if (l.includes("youtube.com") || l.includes("youtu.be") || l.includes("music.youtube")) return "youtube";
    if (l.includes("soundcloud.com") || l.includes("snd.sc")) return "soundcloud";
    if (l.includes("twitter.com") || l.includes("x.com") || l.includes("t.co")) return "twitter";
    if (l.includes("tiktok.com")) return "tiktok";
    if (l.includes("instagram.com")) return "instagram";
    if (l.includes("pinterest.com") || l.includes("pin.it")) return "pinterest";
    if (l.includes("vimeo.com") || l.includes("player.vimeo")) return "vimeo";
    return "other";
  };

  const getPlatformBadge = (p: string) => {
    switch (p) {
      case "youtube": return <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">YouTube</span>;
      case "spotify": return <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">Spotify</span>;
      case "soundcloud": return <span className="inline-flex items-center gap-1 rounded-md border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-400">SoundCloud</span>;
      case "twitter": return <span className="inline-flex items-center gap-1 rounded-md border border-zinc-500/30 bg-zinc-500/10 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">𝕏 Twitter</span>;
      case "tiktok": return <span className="inline-flex items-center gap-1 rounded-md border border-pink-500/30 bg-pink-500/10 px-1.5 py-0.5 text-[10px] font-medium text-pink-400">TikTok</span>;
      case "instagram": return <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-400">Instagram</span>;
      case "pinterest": return <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-300">Pinterest</span>;
      case "vimeo": return <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-400">Vimeo</span>;
      default: return <span className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">Web</span>;
    }
  };

  // Modals state
  const [deleteSingleItem, setDeleteSingleItem] = useState<SyncedHistoryItem | null>(null);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtered & Sorted History
  const filteredAndSortedHistory = useMemo(() => {
    let result = history.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.artist && item.artist.toLowerCase().includes(q)) ||
        (item.url && item.url.toLowerCase().includes(q));

      const matchFormat =
        formatFilter === "all" ||
        (item.format && item.format.toLowerCase() === formatFilter.toLowerCase());

      const itemPlatform = detectPlatform(item.url, (item as any).platform);
      const matchPlatform =
        platformFilter === "all" ||
        (platformFilter === "other" ? itemPlatform === "other" : itemPlatform === platformFilter);

      return matchSearch && matchFormat && matchPlatform;
    });

    result.sort((a, b) => {
      if (sortBy === "title_asc") return (a.title || "").localeCompare(b.title || "");
      if (sortBy === "title_desc") return (b.title || "").localeCompare(a.title || "");
      if (sortBy === "artist_asc") return (a.artist || "").localeCompare(b.artist || "");
      if (sortBy === "date_asc") return (a.id || "").localeCompare(b.id || "");
      return (b.id || "").localeCompare(a.id || ""); // default date_desc
    });

    return result;
  }, [history, searchQuery, formatFilter, platformFilter, sortBy]);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    const visibleIds = filteredAndSortedHistory.map((h) => h.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    if (allVisibleSelected) {
      setSelectedIds(selectedIds.filter((id) => !visibleIds.includes(id)));
    } else {
      const newSelected = Array.from(new Set([...selectedIds, ...visibleIds]));
      setSelectedIds(newSelected);
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
        <div className="p-4 border-b border-zinc-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <History className="h-4 w-4 text-indigo-400" />
              <span>Historique des Téléchargements</span>
            </h3>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span>{filteredAndSortedHistory.length} / {history.length} morceau(x)</span>
            </div>
          </div>

          {/* Search, Filter & Sort Toolbar */}
          {history.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
              {/* Search Bar */}
              <div className="sm:col-span-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par titre, artiste..."
                  className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Platform Filter */}
              <div className="sm:col-span-3">
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                >
                  <option value="all">🌐 Tous les sites</option>
                  <option value="youtube">🔴 YouTube</option>
                  <option value="spotify">🟢 Spotify</option>
                  <option value="soundcloud">🟠 SoundCloud</option>
                  <option value="twitter">𝕏 Twitter / X</option>
                  <option value="tiktok">🎵 TikTok</option>
                  <option value="instagram">📸 Instagram</option>
                  <option value="pinterest">📌 Pinterest</option>
                  <option value="vimeo">🔵 Vimeo</option>
                  <option value="other">📎 Autre / Direct</option>
                </select>
              </div>

              {/* Format Filter */}
              <div className="sm:col-span-2">
                <select
                  value={formatFilter}
                  onChange={(e) => setFormatFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                >
                  <option value="all">Tous formats</option>
                  <option value="mp3">MP3</option>
                  <option value="mp4">MP4 (Vidéo)</option>
                  <option value="flac">FLAC</option>
                  <option value="wav">WAV</option>
                  <option value="m4a">M4A</option>
                  <option value="gif">GIF</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="sm:col-span-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                >
                  <option value="date_desc">Plus récents d'abord</option>
                  <option value="date_asc">Plus anciens d'abord</option>
                  <option value="title_asc">Titre (A → Z)</option>
                  <option value="title_desc">Titre (Z → A)</option>
                  <option value="artist_asc">Artiste (A → Z)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {history.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Music className="h-10 w-10 text-zinc-600 mx-auto" />
            <h4 className="text-sm font-semibold text-zinc-300">Aucun téléchargement enregistré</h4>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Collez un lien ci-dessus pour convertir votre première musique. Elle sera sauvegardée dans votre compte !
            </p>
          </div>
        ) : filteredAndSortedHistory.length === 0 ? (
          <div className="p-10 text-center space-y-2.5">
            <Search className="h-8 w-8 text-zinc-600 mx-auto" />
            <h4 className="text-xs font-semibold text-zinc-300">Aucun résultat correspondant</h4>
            <p className="text-[11px] text-zinc-500">Essayez de modifier votre recherche ou vos filtres.</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setPlatformFilter("all");
                setFormatFilter("all");
              }}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60 max-h-96 overflow-y-auto">
            {filteredAndSortedHistory.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const isDownloadingThis = downloadingSingleId === item.id;
              const progress = singleProgress[item.id];
              const platform = detectPlatform(item.url);

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
                      <div className="flex items-center gap-2 flex-wrap">
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
                      {getPlatformBadge(platform)}

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
