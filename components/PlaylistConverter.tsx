"use client";

import React, { useState } from "react";
import { 
  Download, 
  Layers, 
  CheckSquare, 
  Square, 
  Loader2, 
  ArrowLeft, 
  Sliders, 
  Volume2
} from "lucide-react";
import { formatTime } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";

export interface PlaylistTrack {
  index: number;
  id?: string;
  title: string;
  artist?: string;
  duration?: number;
  url?: string;
  originalUrl?: string;
  thumbnail?: string;
}

export interface PlaylistInfo {
  platform: "youtube" | "spotify" | "soundcloud" | "instagram" | "twitter" | "tiktok" | "pinterest" | "vimeo" | "generic";
  isPlaylist: boolean;
  title: string;
  artist?: string;
  thumbnail?: string;
  totalTracks?: number;
  entries?: PlaylistTrack[];
  url: string;
}

interface PlaylistConverterProps {
  playlist: PlaylistInfo;
  onReset: () => void;
  onAddToHistory?: (item?: any) => void;
}

export default function PlaylistConverter({ playlist, onReset, onAddToHistory }: PlaylistConverterProps) {
  const { toast } = useToast();
  const tracks = playlist.entries || [];
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>(
    tracks.map((t) => t.id || String(t.index))
  );

  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipProgressPercent, setZipProgressPercent] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);
  const [trackProgress, setTrackProgress] = useState<{ [id: string]: { percent: number; status: string } }>({});

  // Settings
  const [format, setFormat] = useState("mp3");
  const [bitrate, setBitrate] = useState("320k");
  const [volumeBoost, setVolumeBoost] = useState("1.0");

  const toggleSelectAll = () => {
    if (selectedTrackIds.length === tracks.length) {
      setSelectedTrackIds([]);
    } else {
      setSelectedTrackIds(tracks.map((t) => t.id || String(t.index)));
    }
  };

  const toggleTrack = (id: string) => {
    if (selectedTrackIds.includes(id)) {
      setSelectedTrackIds(selectedTrackIds.filter((item) => item !== id));
    } else {
      setSelectedTrackIds([...selectedTrackIds, id]);
    }
  };

  // Download Single Track from Playlist
  const handleDownloadSingleTrack = async (track: PlaylistTrack) => {
    const trackId = track.id || String(track.index);
    setDownloadingTrackId(trackId);
    setTrackProgress((prev) => ({
      ...prev,
      [trackId]: { percent: 10, status: "Connexion..." },
    }));

    const trackInterval = setInterval(() => {
      setTrackProgress((prev) => {
        const current = prev[trackId] || { percent: 10, status: "Connexion..." };
        if (current.percent < 40) {
          return { ...prev, [trackId]: { percent: current.percent + 6, status: "Connexion..." } };
        } else if (current.percent < 80) {
          return { ...prev, [trackId]: { percent: current.percent + 4, status: "Conversion 320k..." } };
        } else if (current.percent < 95) {
          return { ...prev, [trackId]: { percent: current.percent + 1.5, status: "Finalisation..." } };
        }
        return prev;
      });
    }, 400);

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: track.url || `https://open.spotify.com/track/${track.id}`,
          format,
          bitrate,
          volumeBoost,
          metadata: {
            title: track.title,
            artist: track.artist || playlist.artist || playlist.title,
            album: playlist.title,
            coverUrl: track.thumbnail || playlist.thumbnail,
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Échec du téléchargement.");
      }

      clearInterval(trackInterval);
      setTrackProgress((prev) => ({
        ...prev,
        [trackId]: { percent: 100, status: "Prêt !" },
      }));

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const cleanArtist = (track.artist || playlist.artist || playlist.title).trim();
      const cleanTitle = track.title.trim();
      a.download = `${cleanArtist} - ${cleanTitle}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      toast.success(`« ${cleanTitle} » téléchargé !`);

      // Save to user account history
      try {
        await fetch("/api/user/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: track.title,
            artist: track.artist || playlist.artist || playlist.title,
            thumbnail: track.thumbnail || playlist.thumbnail,
            format,
            bitrate,
            url: track.url || `https://open.spotify.com/track/${track.id}`,
          }),
        });
      } catch {}

      if (onAddToHistory) {
        onAddToHistory();
      }

      await new Promise((r) => setTimeout(r, 800));
    } catch (err: any) {
      clearInterval(trackInterval);
      toast.error("Erreur lors du téléchargement : " + err.message);
    } finally {
      clearInterval(trackInterval);
      setDownloadingTrackId(null);
      setTrackProgress((prev) => {
        const copy = { ...prev };
        delete copy[trackId];
        return copy;
      });
    }
  };

  // Download selected tracks as ZIP archive
  const handleDownloadZip = async () => {
    const selectedTracks = tracks.filter((t) => selectedTrackIds.includes(t.id || String(t.index)));
    if (selectedTracks.length === 0) {
      toast.info("Veuillez sélectionner au moins une piste à télécharger.");
      return;
    }

    setDownloadingZip(true);
    setZipProgressPercent(10);
    setProgressMsg(`Préparation de ${selectedTracks.length} pistes en HD (320kbps)...`);

    const zipInterval = setInterval(() => {
      setZipProgressPercent((prev) => {
        if (prev < 30) {
          setProgressMsg(`Connexion aux pistes (${selectedTracks.length} titres)...`);
          return prev + 5;
        } else if (prev < 80) {
          setProgressMsg(`Conversion audio & compression ZIP...`);
          return prev + 3;
        } else if (prev < 95) {
          setProgressMsg(`Finalisation de l'archive ZIP...`);
          return prev + 1;
        }
        return prev;
      });
    }, 600);

    try {
      const res = await fetch("/api/batch-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracks: selectedTracks.map((t) => ({
            url: t.url || `https://open.spotify.com/track/${t.id}`,
            title: t.title,
            artist: t.artist || playlist.artist || playlist.title,
          })),
          format,
          bitrate,
          volumeBoost,
          playlistName: playlist.title,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la création du ZIP.");
      }

      clearInterval(zipInterval);
      setZipProgressPercent(100);
      setProgressMsg("Archive ZIP prête !");

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${playlist.title.replace(/[^a-zA-Z0-9_\- ]/g, "")}_320kbps.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      toast.success(`Archive ZIP téléchargée (${selectedTracks.length} titres) !`);

      // Save all tracks to user history
      try {
        await Promise.all(
          selectedTracks.map((t) =>
            fetch("/api/user/history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: t.title,
                artist: t.artist || playlist.artist || playlist.title,
                thumbnail: t.thumbnail || playlist.thumbnail,
                format,
                bitrate,
                url: t.url || `https://open.spotify.com/track/${t.id}`,
              }),
            })
          )
        );
      } catch {}

      if (onAddToHistory) {
        onAddToHistory();
      }

      await new Promise((r) => setTimeout(r, 1000));
    } catch (err: any) {
      clearInterval(zipInterval);
      toast.error("Erreur lors de la génération du ZIP : " + err.message);
    } finally {
      clearInterval(zipInterval);
      setDownloadingZip(false);
      setProgressMsg("");
      setZipProgressPercent(0);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header Info Banner */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6 shadow-xl backdrop-blur-xl space-y-5">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative w-28 h-28 shrink-0 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-md">
            {playlist.thumbnail ? (
              <img src={playlist.thumbnail} alt={playlist.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-indigo-400">
                <Layers className="h-10 w-10" />
              </div>
            )}
            <div className="absolute top-2 left-2 rounded-md bg-indigo-600 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
              {playlist.platform.toUpperCase()}
            </div>
          </div>

          <div className="flex-1 space-y-2 text-center sm:text-left min-w-0">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                {(playlist.platform === "instagram" || playlist.platform === "twitter" || (playlist as any).platform === "pinterest")
                  ? `Carrousel Multi-Médias (${tracks.length} éléments)`
                  : `Album / Playlist (${tracks.length} pistes)`}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 line-clamp-2">{playlist.title}</h2>
            {playlist.artist && <p className="text-xs font-medium text-zinc-400">{playlist.artist}</p>}

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <button
                type="button"
                onClick={onReset}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Changer d'URL</span>
              </button>
            </div>
          </div>
        </div>

        {/* Global Batch Controls */}
        <div className="pt-4 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              {selectedTrackIds.length === tracks.length ? (
                <>
                  <CheckSquare className="h-4 w-4 text-indigo-400" />
                  <span>Tout Désélectionner</span>
                </>
              ) : (
                <>
                  <Square className="h-4 w-4 text-zinc-400" />
                  <span>Tout Sélectionner ({selectedTrackIds.length}/{tracks.length})</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <select
              value={`${format}_${bitrate}`}
              onChange={(e) => {
                const [f, b] = e.target.value.split("_");
                setFormat(f);
                setBitrate(b || "320k");
              }}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-100 focus:border-indigo-500 focus:outline-none"
            >
              {(playlist.platform === "instagram" || playlist.platform === "twitter" || (playlist as any).platform === "pinterest") ? (
                <>
                  <option value="png_original">Images PNG (Original HD)</option>
                  <option value="jpg_original">Images JPG</option>
                  <option value="mp4_video">Vidéos MP4 (HD)</option>
                  <option value="mp3_320k">Audio MP3 (320k)</option>
                  <option value="gif_anim">GIFs Animés</option>
                </>
              ) : (
                <>
                  <option value="mp3_320k">MP3 320k (HD)</option>
                  <option value="mp3_256k">MP3 256k</option>
                  <option value="flac_320k">FLAC (Lossless)</option>
                  <option value="wav_320k">WAV</option>
                </>
              )}
            </select>

            <button
              onClick={handleDownloadZip}
              disabled={downloadingZip || selectedTrackIds.length === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all"
            >
              {downloadingZip ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Génération ZIP...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Télécharger la Sélection (.ZIP)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Real-time ZIP Progress Bar */}
        {downloadingZip && (
          <div className="pt-4 border-t border-zinc-800 space-y-2 animate-in fade-in duration-150">
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

      {/* Playlist Track List Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
        <div className="divide-y divide-zinc-800/60">
          {tracks.map((track, idx) => {
            const trackId = track.id || String(track.index);
            const isSelected = selectedTrackIds.includes(trackId);
            const isDownloadingThis = downloadingTrackId === trackId;
            const progress = trackProgress[trackId];

            return (
              <div
                key={trackId}
                className={`flex flex-col px-5 py-3.5 transition-colors ${
                  isDownloadingThis ? "bg-zinc-850/80 border-l-2 border-indigo-500" : isSelected ? "bg-indigo-950/15" : "hover:bg-zinc-800/30"
                }`}
              >
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => toggleTrack(trackId)}
                    className="text-zinc-500 hover:text-indigo-400 shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-indigo-400" />
                    ) : (
                      <Square className="h-4 w-4 text-zinc-600" />
                    )}
                  </button>

                  <span className="w-5 text-center text-xs font-mono text-zinc-500 shrink-0">
                    {idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">{track.title}</h4>
                      {isDownloadingThis && progress && (
                        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 shrink-0 animate-pulse">
                          {Math.round(progress.percent)}% - {progress.status}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate">{track.artist || playlist.title}</p>
                  </div>

                  {track.duration && !isDownloadingThis ? (
                    <span className="text-xs font-mono text-zinc-400 shrink-0">
                      {formatTime(track.duration)}
                    </span>
                  ) : null}

                  <button
                    onClick={() => handleDownloadSingleTrack(track)}
                    disabled={isDownloadingThis}
                    className={`rounded-lg border p-1.5 shrink-0 transition-colors ${
                      isDownloadingThis
                        ? "border-indigo-500/40 bg-indigo-600/20 text-indigo-300 font-mono text-xs font-semibold px-2.5"
                        : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                    }`}
                    title="Télécharger cette piste seule"
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
                </div>

                {/* Inline track progress bar */}
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
      </div>
    </div>
  );
}
