"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";


type PocState = {
  network: 'testnet';
  admin: { address: string; secret: string };
  investors: { name: string; address: string; secret: string }[];
  currencies: Array<string | { code: string; link: string }>;
  distributed: boolean;
};

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<string | null>(null);
  const [state, setState] = useState<PocState | null>(null);
  useEffect(() => {
    const p = localStorage.getItem("xrpl_poc_profile");
    if (p) setProfile(p);
    // tenta carregar estado salvo (admin/investidores) se já existir
    (async () => {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = await res.json();
          setState(data);
        }
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    if (profile) localStorage.setItem("xrpl_poc_profile", profile);
  }, [profile]);

  const investorOptions = useMemo(() => (state?.investors ?? []).map(inv => ({ label: inv.name, value: inv.address })), [state]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg border p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Crowdfund Dashboard</h1>
            <p className="text-gray-600">Selecione seu perfil para começar</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 w-full">
              <Link href="/admin" className="w-full">
                <Button variant="outline" disabled={!state} className="w-full">
                  Entrar como Admin
                </Button>
              </Link>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">ou</span>
              </div>
            </div>

            <div className="w-full">
              <Select
                value={profile && investorOptions.find(o => o.value === profile) ? profile : ''}
                onValueChange={(v: string) => setProfile(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um investidor" />
                </SelectTrigger>
                <SelectContent>
                  {investorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {state && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Perfil atual:</span> {profile === 'admin' ? 'Admin' : (state.investors.find(i => i.address === profile)?.name || 'Nenhum')}
                </div>
                {profile && profile !== 'admin' && (
                  <Link href="/offers" className="block">
                    <Button variant="outline" className="w-full">
                      Ir para ofertas
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-200">
            <Link href="/poc" className="block">
              <Button variant="ghost" size="sm" className="w-full text-gray-500 hover:text-gray-700">
                Inicializar POC
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
