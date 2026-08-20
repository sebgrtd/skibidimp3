"use client";

import React, { useState } from "react";
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
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Video,
  Image as ImageIcon,
  Film
} from "lucide-react";
import { formatTime } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";

export interface MediaInfo {
  platform: "youtube" | "spotify" | "soundcloud" | "vimeo" | "instagram" | "tiktok" | "pinterest" | "twitter" | "generic";
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
  mediaType?: "video" | "audio" | "image" | "mixed" | "gif";
  hasVideo?: boolean;
  hasAudio?: boolean;
  hasImage?: boolean;
  availableFormats?: string[];
}

interface ConverterFormProps {
  onPlaylistDetected?: (info: MediaInfo) => void;
  onAddToHistory?: (item?: any) => void;
}

export default function ConverterForm({ onPlaylistDetected, onAddToHistory }: ConverterFormProps) {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mode Selection: "video" | "audio" | "image" | "gif"
  const [selectedMode, setSelectedMode] = useState<"video" | "audio" | "image" | "gif">("audio");

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
  const [downloadPercent, setDownloadPercent] = useState(0);

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

      const data: MediaInfo = await res.json();

      if (!res.ok) {
        throw new Error((data as any).error || "Erreur lors de la récupération des données.");
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
        setEditAlbum("Skibidi Studio");
        setEndTime(String(Math.floor(data.duration || 0)));

        // Automatically select the best default mode
        if (data.mediaType === "image" || data.hasImage && !data.hasVideo) {
          setSelectedMode("image");
          setFormat("png");
        } else if (data.hasVideo && (data.platform === "tiktok" || data.platform === "instagram" || data.platform === "vimeo")) {
          setSelectedMode("video");
          setFormat("mp4");
        } else {
          setSelectedMode("audio");
          setFormat("mp3");
        }

        toast.info("Média analysé avec succès.");
      }
    } catch (err: any) {
      const errMsg = err.message || "Impossible de charger ce lien. Vérifiez l'URL.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (mode: "video" | "audio" | "image" | "gif") => {
    setSelectedMode(mode);
    if (mode === "video") setFormat("mp4");
    else if (mode === "image") setFormat("png");
    else if (mode === "gif") setFormat("gif");
    else if (mode === "audio") setFormat("mp3");
  };

  const handleDownload = async () => {
    if (!mediaInfo) return;

    setDownloading(true);
    setDownloadPercent(5);

    const isVideo = format === "mp4";
    const isImage = format === "png" || format === "jpg";
    const isGif = format === "gif";

    setDownloadProgress(
      isImage 
        ? "Récupération de l'image haute définition..." 
        : isVideo 
          ? "Extraction du flux vidéo HD (1080p)..." 
          : isGif 
            ? "Génération du GIF animé..." 
            : "Connexion au flux audio HD..."
    );

    const progressInterval = setInterval(() => {
      setDownloadPercent((prev) => {
        if (prev < 30) {
          setDownloadProgress(isImage ? "Traitement image..." : isVideo ? "Téléchargement flux vidéo..." : "Connexion flux source...");
          return prev + (isImage ? 25 : 5);
        } else if (prev < 75) {
          setDownloadProgress(isImage ? "Finalisation PNG..." : isVideo ? "Encodage vidéo MP4..." : "Conversion 320kbps...");
          return prev + (isImage ? 20 : 3);
        } else if (prev < 95) {
          setDownloadProgress("Finalisation du fichier...");
          return prev + 1.5;
        }
        return prev;
      });
    }, 350);

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

      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Échec du téléchargement.");
      }

      clearInterval(progressInterval);
      setDownloadPercent(100);
      setDownloadProgress("Fichier prêt ! Téléchargement en cours...");

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

      toast.success(`Téléchargement de « ${cleanTitle} » réussi !`);

      const newHistoryItem = {
        id: Date.now().toString(),
        title: editTitle || mediaInfo.title,
        artist: editArtist || mediaInfo.artist,
        thumbnail: mediaInfo.thumbnail,
        format,
        bitrate: isVideo ? "1080p" : isImage ? "HD" : bitrate,
        date: new Date().toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        url: mediaInfo.originalUrl || mediaInfo.url,
      };

      // Always save locally in localStorage
      try {
        const stored = JSON.parse(localStorage.getItem("skibidi_local_history") || "[]");
        const updated = [newHistoryItem, ...stored.filter((h: any) => h.id !== newHistoryItem.id)].slice(0, 100);
        localStorage.setItem("skibidi_local_history", JSON.stringify(updated));
      } catch {}

      // Save to user account history if logged in
      try {
        await fetch("/api/user/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newHistoryItem),
        });
      } catch {}

      if (onAddToHistory) {
        onAddToHistory(newHistoryItem);
      }

      await new Promise((r) => setTimeout(r, 1000));
    } catch (err: any) {
      clearInterval(progressInterval);
      const errMsg = err.message || "Une erreur est survenue pendant le téléchargement.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      clearInterval(progressInterval);
      setDownloading(false);
      setDownloadProgress("");
      setDownloadPercent(0);
    }
  };

  const getPlatformIcon = (p?: string) => {
    switch (p) {
      case "youtube": return <Youtube className="h-4 w-4 text-red-500" />;
      case "spotify": return <Music className="h-4 w-4 text-emerald-400" />;
      case "soundcloud": return <Radio className="h-4 w-4 text-orange-400" />;
      case "vimeo": return <Video className="h-4 w-4 text-sky-400" />;
      case "tiktok": return <Film className="h-4 w-4 text-pink-400" />;
      case "instagram": return <Film className="h-4 w-4 text-rose-400" />;
      case "twitter": return <span className="font-bold text-zinc-200">𝕏</span>;
      case "pinterest": return <ImageIcon className="h-4 w-4 text-red-400" />;
      default: return <Sparkles className="h-4 w-4 text-indigo-400" />;
    }
  };

  const detectPlatformFromUrl = (raw: string) => {
    const l = raw.toLowerCase();
    if (l.includes("spotify")) return "spotify";
    if (l.includes("soundcloud")) return "soundcloud";
    if (l.includes("vimeo")) return "vimeo";
    if (l.includes("tiktok")) return "tiktok";
    if (l.includes("instagram")) return "instagram";
    if (l.includes("twitter") || l.includes("x.com")) return "twitter";
    if (l.includes("pinterest") || l.includes("pin.it")) return "pinterest";
    if (l.includes("youtu")) return "youtube";
    return undefined;
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Search & URL Input Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5 shadow-xl backdrop-blur-xl transition-all hover:border-zinc-700">
        <form onSubmit={handleFetchInfo} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Collez une URL YouTube, TikTok, Instagram, Twitter/X, Pinterest, Vimeo, Spotify..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 pl-10 pr-20 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <div className="absolute left-3.5 top-3.5 text-zinc-500 flex items-center justify-center">
                {getPlatformIcon(detectPlatformFromUrl(url))}
              </div>
              {url && (
                <button
                  type="button"
                  onClick={() => setUrl("")}
                  className="absolute right-3 top-2.5 rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Effacer
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-3 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyse...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Analyser le Média</span>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Media Details Card */}
      {mediaInfo && !mediaInfo.isPlaylist && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            {/* Thumbnail / Media Preview */}
            <div className="relative group shrink-0 w-36 h-36 sm:w-40 sm:h-40 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-md">
              {mediaInfo.thumbnail ? (
                <img
                  src={mediaInfo.thumbnail}
                  alt={mediaInfo.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-600">
                  <Music className="h-10 w-10" />
                </div>
              )}

              <div className="absolute top-2 left-2">
                <span className="text-[10px] font-semibold text-zinc-300 bg-zinc-950/80 border border-zinc-700/60 px-2 py-0.5 rounded-md backdrop-blur-sm flex items-center gap-1">
                  {getPlatformIcon(mediaInfo.platform)}
                  {mediaInfo.platform.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Info Metadata */}
            <div className="flex-1 space-y-3.5 text-center sm:text-left w-full min-w-0">
              <div className="space-y-1">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                    {mediaInfo.hasVideo ? "Vidéo HD Disponible" : mediaInfo.hasImage ? "Image HD Disponible" : "Audio 320 kbps Studio"}
                  </span>
                  {mediaInfo.duration ? (
                    <span className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] font-mono text-zinc-400">
                      {formatTime(mediaInfo.duration)}
                    </span>
                  ) : null}
                </div>
                <h2 className="text-base sm:text-lg font-bold text-zinc-100 line-clamp-2">{editTitle || mediaInfo.title}</h2>
                <p className="text-xs font-medium text-zinc-400 truncate">{editArtist || mediaInfo.artist}</p>
              </div>

              {/* Format Selection Switcher Tabs */}
              <div className="flex items-center justify-center sm:justify-start gap-1.5 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                {/* Audio Tab */}
                {(mediaInfo.hasAudio || mediaInfo.platform === "spotify" || mediaInfo.platform === "soundcloud") && (
                  <button
                    type="button"
                    onClick={() => handleModeChange("audio")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedMode === "audio"
                        ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Music className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Audio (MP3 / FLAC)</span>
                  </button>
                )}

                {/* Video Tab */}
                {mediaInfo.hasVideo && (
                  <button
                    type="button"
                    onClick={() => handleModeChange("video")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedMode === "video"
                        ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Video className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Vidéo (MP4)</span>
                  </button>
                )}

                {/* GIF Tab */}
                {(mediaInfo.platform === "twitter" || (mediaInfo.hasVideo && (mediaInfo.duration || 0) <= 60)) && (
                  <button
                    type="button"
                    onClick={() => handleModeChange("gif")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedMode === "gif"
                        ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Film className="h-3.5 w-3.5 text-amber-400" />
                    <span>GIF</span>
                  </button>
                )}

                {/* Image Tab */}
                {(mediaInfo.hasImage || mediaInfo.platform === "pinterest" || mediaInfo.platform === "twitter") && (
                  <button
                    type="button"
                    onClick={() => handleModeChange("image")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedMode === "image"
                        ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-pink-400" />
                    <span>Image (PNG)</span>
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-1 flex flex-col sm:flex-row gap-2.5 items-center">
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-6 py-3 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{downloadProgress || "Traitement..."}</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>
                        Télécharger en {format.toUpperCase()}
                        {selectedMode === "audio" ? ` (${bitrate})` : selectedMode === "video" ? " (HD)" : ""}
                      </span>
                    </>
                  )}
                </button>

                {selectedMode === "audio" && (
                  <button
                    type="button"
                    onClick={() => setShowSettings(!showSettings)}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    <Sliders className="h-3.5 w-3.5 text-zinc-400" />
                    <span>{showSettings ? "Masquer" : "Réglages & Tags"}</span>
                    {showSettings ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>

              {/* Download Progress Bar */}
              {downloading && (
                <div className="mt-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/80 shadow-lg space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-zinc-300 font-medium truncate">
                      {downloadPercent >= 100 ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 text-indigo-400 animate-spin shrink-0" />
                      )}
                      <span className="truncate">{downloadProgress}</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400 shrink-0 pl-2">
                      {Math.round(downloadPercent)}%
                    </span>
                  </div>

                  <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-zinc-800">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300 relative overflow-hidden"
                      style={{ width: `${Math.min(100, Math.max(5, downloadPercent))}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Advanced Settings & Metadata Panel (Audio mode) */}
          {showSettings && selectedMode === "audio" && (
            <div className="pt-5 border-t border-zinc-800 space-y-5 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Format & Quality */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Format & Débit</h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Format</label>
                      <select
                        value={format}
                        onChange={(e) => setFormat(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="mp3">MP3</option>
                        <option value="flac">FLAC (Lossless)</option>
                        <option value="wav">WAV</option>
                        <option value="m4a">M4A (AAC)</option>
                        <option value="ogg">OGG</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Débit (Bitrate)</label>
                      <select
                        value={bitrate}
                        onChange={(e) => setBitrate(e.target.value)}
                        disabled={format === "flac" || format === "wav"}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none disabled:opacity-40"
                      >
                        <option value="320k">320 kbps (HD)</option>
                        <option value="256k">256 kbps</option>
                        <option value="192k">192 kbps</option>
                        <option value="128k">128 kbps</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Volume Boost */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Volume2 className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Volume & Égalisation</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Gain Audio</label>
                      <select
                        value={volumeBoost}
                        onChange={(e) => setVolumeBoost(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="1.0">Normal (100%)</option>
                        <option value="1.25">+25%</option>
                        <option value="1.5">+50%</option>
                        <option value="2.0">+100% (x2)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end">
                      <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-xs text-zinc-300">
                        <input
                          type="checkbox"
                          checked={normalize}
                          onChange={(e) => setNormalize(e.target.checked)}
                          className="h-3.5 w-3.5 rounded accent-indigo-600"
                        />
                        <span>Normaliser</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Trimmer */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3 sm:col-span-2">
                  <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Scissors className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Découpe Précise (Start / End)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Début (secondes)</label>
                      <input
                        type="number"
                        min="0"
                        max={mediaInfo.duration || 9999}
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-mono text-zinc-100 focus:border-indigo-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-zinc-500">Temps: {formatTime(Number(startTime))}</span>
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Fin (secondes)</label>
                      <input
                        type="number"
                        min="0"
                        max={mediaInfo.duration || 9999}
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-mono text-zinc-100 focus:border-indigo-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-zinc-500">Temps: {formatTime(Number(endTime))}</span>
                    </div>
                  </div>
                </div>

                {/* ID3 Tags */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3 sm:col-span-2">
                  <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Métadonnées ID3 & Tags</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Titre</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Artiste</label>
                      <input
                        type="text"
                        value={editArtist}
                        onChange={(e) => setEditArtist(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Album</label>
                      <input
                        type="text"
                        value={editAlbum}
                        onChange={(e) => setEditAlbum(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
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
