"use client";

import React, { useState, useRef } from "react";
import { 
  Download, 
  Sparkles, 
  Sliders, 
  Scissors, 
  Volume2, 
  Tag, 
  Music, 
  Youtube, 
  Radio, 
  AlertCircle,
  Loader2
} from "lucide-react";
import { formatTime } from "@/lib/utils";

interface MediaInfo {
  platform: "youtube" | "spotify" | "soundcloud" | "generic";
  isPlaylist: boolean;
  id?: string;
  title: string;
  artist: string;
  duration?: number;
  thumbnail?: string;
  url: string;
  originalUrl?: string;
  totalTracks?: number;
  entries?: any[];
}

interface ConverterFormProps {
  onPlaylistDetected?: (info: MediaInfo) => void;
  onAddToHistory?: (item: any) => void;
}

export default function ConverterForm({ onPlaylistDetected, onAddToHistory }: ConverterFormProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Settings
  const [format, setFormat] = useState("mp3");
  const [bitrate, setBitrate] = useState("320k");
  const [startTime, setStartTime] = useState("0");
  const [endTime, setEndTime] = useState("0");
  const [volumeBoost, setVolumeBoost] = useState("1.0");
  const [normalize, setNormalize] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Metadata editable
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editAlbum, setEditAlbum] = useState("");
  const [editYear, setEditYear] = useState(new Date().getFullYear().toString());
  const [editGenre, setEditGenre] = useState("Music");

  // Download state
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState("");

  const handleFetchInfo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setMediaInfo(null);

    try {
      const res = await fetch("/api/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la récupération des données.");
      }

      if (data.isPlaylist) {
        if (onPlaylistDetected) {
          onPlaylistDetected(data);
        } else {
          setMediaInfo(data);
        }
      } else {
        setMediaInfo(data);
        setEditTitle(data.title || "");
        setEditArtist(data.artist || "");
        setEditAlbum("Super Skibidi MP3");
        setEndTime(String(Math.floor(data.duration || 0)));
      }
    } catch (err: any) {
      setError(err.message || "Impossible de charger la vidéo. Vérifiez le lien.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!mediaInfo) return;

    setDownloading(true);
    setDownloadProgress("Initialisation du moteur audio (320kbps)...");

    try {
      const payload = {
        url: mediaInfo.originalUrl || mediaInfo.url || url,
        format,
        bitrate,
        startTime: Number(startTime) > 0 ? startTime : undefined,
        endTime: Number(endTime) > 0 && Number(endTime) < (mediaInfo.duration || 99999) ? endTime : undefined,
        volumeBoost,
        normalize,
        metadata: {
          title: editTitle || mediaInfo.title,
          artist: editArtist || mediaInfo.artist,
          album: editAlbum,
          year: editYear,
          genre: editGenre,
          coverUrl: mediaInfo.thumbnail,
        },
      };

      setDownloadProgress("Extraction de l'audio et traitement des filtres...");

      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Échec du téléchargement.");
      }

      setDownloadProgress("Téléchargement du fichier terminé !");

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;

      const cleanArtist = (editArtist || mediaInfo.artist).trim();
      const cleanTitle = (editTitle || mediaInfo.title).trim();
      const fileName = cleanArtist ? `${cleanArtist} - ${cleanTitle}.${format}` : `${cleanTitle}.${format}`;
      
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      // Save to user account history
      try {
        await fetch("/api/user/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle || mediaInfo.title,
            artist: editArtist || mediaInfo.artist,
            thumbnail: mediaInfo.thumbnail,
            format,
            bitrate,
            url: mediaInfo.url,
          }),
        });
      } catch {}

      if (onAddToHistory) {
        onAddToHistory({
          id: Date.now().toString(),
          title: editTitle || mediaInfo.title,
          artist: editArtist || mediaInfo.artist,
          thumbnail: mediaInfo.thumbnail,
          format,
          bitrate,
          date: new Date().toLocaleDateString(),
          url: mediaInfo.url,
        });
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue pendant le téléchargement.");
    } finally {
      setDownloading(false);
      setDownloadProgress("");
    }
  };

  const getPlatformIcon = (p?: string) => {
    switch (p) {
      case "youtube": return <Youtube className="h-5 w-5 text-red-500" />;
      case "spotify": return <Music className="h-5 w-5 text-emerald-500" />;
      case "soundcloud": return <Radio className="h-5 w-5 text-orange-500" />;
      default: return <Sparkles className="h-5 w-5 text-purple-400" />;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Input Card */}
      <div className="relative rounded-2xl border border-purple-500/30 bg-slate-900/90 p-4 sm:p-6 shadow-2xl backdrop-blur-xl transition-all hover:border-purple-500/50">
        <form onSubmit={handleFetchInfo} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Collez ici un lien YouTube, YouTube Shorts, Spotify ou SoundCloud..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3.5 pl-11 pr-24 text-sm text-slate-100 placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
              <div className="absolute left-3.5 top-3.5 text-slate-400">
                {getPlatformIcon(
                  url.includes("spotify") ? "spotify" : url.includes("soundcloud") ? "soundcloud" : url.includes("youtu") ? "youtube" : undefined
                )}
              </div>
              {url && (
                <button
                  type="button"
                  onClick={() => setUrl("")}
                  className="absolute right-3 top-3 rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:text-white"
                >
                  Effacer
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 px-6 py-3.5 font-bold text-white shadow-lg shadow-purple-600/30 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Analyse...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  <span>Extraire Audio</span>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-300">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Media Card Details */}
      {mediaInfo && !mediaInfo.isPlaylist && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-7 shadow-2xl space-y-6">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            {/* Thumbnail */}
            <div className="relative group shrink-0 w-48 h-48 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shadow-md">
              {mediaInfo.thumbnail ? (
                <img
                  src={mediaInfo.thumbnail}
                  alt={mediaInfo.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-purple-950/40 text-purple-400">
                  <Music className="h-12 w-12" />
                </div>
              )}

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-xs font-bold text-white bg-purple-600/90 px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-1">
                  {getPlatformIcon(mediaInfo.platform)}
                  {mediaInfo.platform.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Info Metadata */}
            <div className="flex-1 space-y-4 text-center md:text-left w-full">
              <div className="space-y-1">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-300">
                    320 Kbps HD Disponible
                  </span>
                  {mediaInfo.duration ? (
                    <span className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs font-mono text-slate-300">
                      {formatTime(mediaInfo.duration)}
                    </span>
                  ) : null}
                </div>
                <h2 className="text-xl font-bold text-white line-clamp-2">{editTitle || mediaInfo.title}</h2>
                <p className="text-sm font-medium text-purple-400">{editArtist || mediaInfo.artist}</p>
              </div>

              {/* Main Download Button */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3 items-center">
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 px-8 py-4 text-base font-extrabold text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.01] hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>{downloadProgress || "Traitement en cours..."}</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" />
                      <span>Télécharger ({format.toUpperCase()} - {bitrate})</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-4 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                >
                  <Sliders className="h-4 w-4 text-purple-400" />
                  <span>{showSettings ? "Masquer Réglages" : "Réglages Avancés & Tags"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible Advanced Settings Panel */}
          {showSettings && (
            <div className="pt-6 border-t border-slate-800 space-y-6 animate-accordion-down">
              <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                <Sliders className="h-4 w-4" />
                <span>Options Premium Unlocked</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Format & Bitrate */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase">Format & Qualité Audio</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Format</label>
                      <select
                        value={format}
                        onChange={(e) => setFormat(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-white focus:border-purple-500"
                      >
                        <option value="mp3">MP3 (Universel)</option>
                        <option value="flac">FLAC (Lossless)</option>
                        <option value="wav">WAV (Sans compression)</option>
                        <option value="m4a">M4A (AAC Apple)</option>
                        <option value="ogg">OGG Vorbis</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Débit (Bitrate)</label>
                      <select
                        value={bitrate}
                        onChange={(e) => setBitrate(e.target.value)}
                        disabled={format === "flac" || format === "wav"}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-white focus:border-purple-500 disabled:opacity-40"
                      >
                        <option value="320k">320 kbps (HD Studio)</option>
                        <option value="256k">256 kbps (Très Élevé)</option>
                        <option value="192k">192 kbps (Standard)</option>
                        <option value="128k">128 kbps (Économique)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Volume Boost & Filters */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                    <Volume2 className="h-4 w-4 text-pink-400" />
                    <span>Boost de Volume & Normalisation</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Amplification du Son</label>
                      <select
                        value={volumeBoost}
                        onChange={(e) => setVolumeBoost(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-white focus:border-purple-500"
                      >
                        <option value="1.0">Original (100%)</option>
                        <option value="1.25">Boost +25%</option>
                        <option value="1.5">Boost +50% (Puissant)</option>
                        <option value="2.0">Boost +100% (x2 Volume)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end">
                      <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-slate-800 bg-slate-900 p-2.5 hover:border-slate-700">
                        <input
                          type="checkbox"
                          checked={normalize}
                          onChange={(e) => setNormalize(e.target.checked)}
                          className="h-4 w-4 rounded accent-purple-500"
                        />
                        <span className="text-xs font-medium text-slate-200">Normaliser le son</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Audio Trimmer */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-4 md:col-span-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                    <Scissors className="h-4 w-4 text-purple-400" />
                    <span>Découpeur Audio (Start / End Timestamp)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Début (secondes)</label>
                      <input
                        type="number"
                        min="0"
                        max={mediaInfo.duration || 9999}
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-white"
                      />
                      <span className="text-[10px] text-slate-500">Temps: {formatTime(Number(startTime))}</span>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Fin (secondes)</label>
                      <input
                        type="number"
                        min="0"
                        max={mediaInfo.duration || 9999}
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-white"
                      />
                      <span className="text-[10px] text-slate-500">Temps: {formatTime(Number(endTime))}</span>
                    </div>
                  </div>
                </div>

                {/* ID3 Tag Editor */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-4 md:col-span-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                    <Tag className="h-4 w-4 text-emerald-400" />
                    <span>Éditeur de Métadonnées (Tags ID3 & Pochette)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Titre de la chanson</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Artiste</label>
                      <input
                        type="text"
                        value={editArtist}
                        onChange={(e) => setEditArtist(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Album</label>
                      <input
                        type="text"
                        value={editAlbum}
                        onChange={(e) => setEditAlbum(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
