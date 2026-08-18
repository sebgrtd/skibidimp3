"use client";

import React, { useState, useEffect } from "react";
import { KeyRound, Plus, Copy, Check, Trash2, ShieldCheck, UserCheck, Loader2, Sparkles } from "lucide-react";

export interface InviteCodeItem {
  id: string;
  code: string;
  createdById: string;
  isUsed: boolean;
  usedByUsername?: string;
  createdAt: string;
}

export default function AdminPanel() {
  const [invites, setInvites] = useState<InviteCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchInvites = async () => {
    try {
      const res = await fetch("/api/admin/invite-codes");
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const handleGenerateCode = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/invite-codes", { method: "POST" });
      if (res.ok) {
        await fetchInvites();
      }
    } catch {} finally {
      setGenerating(false);
    }
  };

  const handleDeleteCode = async (inviteId: string) => {
    if (!confirm("Supprimer ce code d'invitation ?")) return;
    try {
      const res = await fetch("/api/admin/invite-codes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      if (res.ok) {
        await fetchInvites();
      }
    } catch {}
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl border border-amber-500/40 bg-slate-900/90 p-6 shadow-2xl space-y-6 backdrop-blur-xl">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold shadow-lg shadow-amber-500/30">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Panneau d'Administration</span>
              <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] text-amber-400 font-extrabold uppercase">
                ADMIN ACCESS
              </span>
            </h2>
            <p className="text-xs text-slate-400">Générateur de Codes d'Invitation à Inscription Restreinte</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerateCode}
          disabled={generating}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          <span>Générer un Code d'Invitation</span>
        </button>
      </div>

      {/* Invite Codes Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
          <span>Codes Générés ({invites.length})</span>
          <span>Statut d'Utilisation</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            <span>Chargement des codes...</span>
          </div>
        ) : invites.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs space-y-2 border border-dashed border-slate-800 rounded-xl">
            <KeyRound className="h-8 w-8 mx-auto text-slate-600" />
            <p>Aucun code d'invitation généré pour le moment.</p>
            <p className="text-[11px] text-slate-400">Cliquez sur "Générer un Code" pour permettre à un nouvel utilisateur de s'inscrire.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 max-h-72 overflow-y-auto">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3 text-xs hover:bg-slate-800/40 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-amber-400 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-lg text-sm tracking-wider">
                    {inv.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(inv.code)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white border border-slate-700 bg-slate-800 px-2.5 py-1 rounded-md transition-colors"
                  >
                    {copiedCode === inv.code ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Copié !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copier</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  {inv.isUsed ? (
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[11px]">
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Utilisé par @{inv.usedByUsername}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-amber-300 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full text-[11px]">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      <span>Disponible (Usage unique)</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteCode(inv.id)}
                    className="text-slate-500 hover:text-red-400 p-1"
                    title="Supprimer ce code"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
