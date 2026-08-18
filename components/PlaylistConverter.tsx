"use client";

import React, { useState } from "react";
import { 
  Download, 
  Layers, 
  CheckSquare, 
  Square, 
  Loader2, 
  FileArchive, 
  Music, 
  Youtube, 
  Radio, 
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { formatTime } from "@/lib/utils";

interface PlaylistTrack {
  index: number;
  id: string;
  title: string;
  artist: string;
  duration?: number;
  url: string;
  thumbnail?: string;
}

interface PlaylistInfo {
  platform: string;
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
  onAddToHistory?: (item: any) => void;
}

export default function PlaylistConverter({ playlist, onReset, onAddToHistory }: PlaylistConverterProps) {
  const tracks = playlist.entries || [];
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>(
    tracks.map((t) => t.id || String(t.index))
  );

  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipProgressPercent, setZipProgressPercent] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);

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

      if (onAddToHistory) {
        onAddToHistory({
          id: Date.now().toString(),
          title: track.title,
          artist: track.artist || playlist.artist || playlist.title,
          thumbnail: track.thumbnail || playlist.thumbnail,
          format,
          bitrate,
          date: new Date().toLocaleDateString(),
          url: track.url,
        });
      }
    } catch (err: any) {
      alert("Erreur lors du téléchargement de la piste : " + err.message);
    } finally {
      setDownloadingTrackId(null);
    }
  };

  // Download selected tracks as ZIP archive
  const handleDownloadZip = async () => {
    const selectedTracks = tracks.filter((t) => selectedTrackIds.includes(t.id || String(t.index)));
    if (selectedTracks.length === 0) return;

    setDownloadingZip(true);
    setZipProgressPercent(10);
    setProgressMsg(`Préparation de ${selectedTracks.length} pistes en HD (320kbps)...`);

    const zipInterval = setInterval(() => {
      setZipProgressPercent((prev) => {
        if (prev < 30) {
          setProgressMsg(`Connexion aux pistes de l'album (${selectedTracks.length} titres)...`);
          return prev + 5;
        } else if (prev < 80) {
          setProgressMsg(`Conversion audio & compression ZIP haute vitesse...`);
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
      setProgressMsg("Archive ZIP prête ! Téléchargement...");

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${playlist.title.replace(/[^a-zA-Z0-9_\- ]/g, "")}_320kbps.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      await new Promise((r) => setTimeout(r, 1000));
    } catch (err: any) {
      clearInterval(zipInterval);
      alert("Erreur lors de la génération du ZIP: " + err.message);
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
      <div className="rounded-2xl border border-purple-500/30 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-28 h-28 shrink-0 rounded-xl overflow-hidden border border-purple-500/40 bg-slate-950 shadow-md">
            {playlist.thumbnail ? (
              <img src={playlist.thumbnail} alt={playlist.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-purple-950 text-purple-400">
                <Layers className="h-10 w-10" />
              </div>
            )}
            <div className="absolute top-2 left-2 rounded-md bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
              Playlist
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <h2 className="text-2xl font-black text-white">{playlist.title}</h2>
            <p className="text-sm font-medium text-purple-400">
              {playlist.artist || "Collection"} • {tracks.length} pistes détectées
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                Batch Downloader Débloqué
              </span>
              <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-300">
                320 Kbps Gratuit
              </span>
            </div>
          </div>

          <button
            onClick={onReset}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            Changer d'URL
          </button>
        </div>

        {/* Global Batch Controls */}
        <div className="pt-4 border-t border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              {selectedTrackIds.length === tracks.length ? (
                <CheckSquare className="h-4 w-4 text-purple-400" />
              ) : (
                <Square className="h-4 w-4 text-slate-400" />
              )}
              <span>
                {selectedTrackIds.length === tracks.length
                  ? "Tout Désélectionner"
                  : `Tout Sélectionner (${tracks.length})`}
              </span>
            </button>

            <span className="text-xs text-slate-400 font-mono">
              {selectedTrackIds.length} / {tracks.length} cochées
            </span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
            >
              <option value="mp3">MP3 320k</option>
              <option value="flac">FLAC Lossless</option>
              <option value="wav">WAV</option>
            </select>

            <button
              onClick={handleDownloadZip}
              disabled={downloadingZip || selectedTrackIds.length === 0}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-600/30 hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {downloadingZip ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{progressMsg || "Génération ZIP..."}</span>
                </>
              ) : (
                <>
                  <FileArchive className="h-4 w-4" />
                  <span>Télécharger la Sélection (.ZIP)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Real-time ZIP Progress Bar */}
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

      {/* Playlist Track List Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
        <div className="divide-y divide-slate-800/60">
          {tracks.map((track, idx) => {
            const trackId = track.id || String(track.index);
            const isSelected = selectedTrackIds.includes(trackId);
            const isDownloadingThis = downloadingTrackId === trackId;

            return (
              <div
                key={trackId}
                className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                  isSelected ? "bg-purple-950/20" : "hover:bg-slate-800/40"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleTrack(trackId)}
                  className="text-slate-400 hover:text-purple-400 shrink-0"
                >
                  {isSelected ? (
                    <CheckSquare className="h-5 w-5 text-purple-400" />
                  ) : (
                    <Square className="h-5 w-5 text-slate-600" />
                  )}
                </button>

                <span className="w-6 text-center text-xs font-mono text-slate-500 shrink-0">
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white truncate">{track.title}</h4>
                  <p className="text-xs text-slate-400 truncate">{track.artist || playlist.title}</p>
                </div>

                {track.duration ? (
                  <span className="text-xs font-mono text-slate-400 shrink-0">
                    {formatTime(track.duration)}
                  </span>
                ) : null}

                <button
                  onClick={() => handleDownloadSingleTrack(track)}
                  disabled={isDownloadingThis}
                  className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:border-purple-500 hover:bg-purple-600 hover:text-white shrink-0 transition-colors"
                  title="Télécharger cette piste seule"
                >
                  {isDownloadingThis ? (
                    <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
