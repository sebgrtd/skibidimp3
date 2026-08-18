import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Super Skibidi MP3 🚽⚡ - Convertisseur YouTube, Spotify & SoundCloud 320kbps",
  description: "Super Skibidi MP3 : Convertisseur ultra rapide YouTube, Spotify & SoundCloud 320kbps avec gestion de compte, verrouillage et re-téléchargement d'historique en ZIP. 100% Gratuit sans paywall.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body className={`${inter.className} min-h-screen flex flex-col antialiased bg-slate-950`}>
        {children}
      </body>
    </html>
  );
}
