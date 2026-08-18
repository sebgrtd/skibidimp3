import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Skibidi MP3 • Studio Audio 320kbps & Playlists",
  description: "Convertisseur audio professionnel YouTube, Spotify & SoundCloud en 320kbps HD Studio. Gestion de bibliothèque et téléchargements d'albums.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body className={`${inter.className} min-h-screen flex flex-col antialiased bg-zinc-950 text-zinc-100 selection:bg-indigo-500/30 selection:text-indigo-200`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
