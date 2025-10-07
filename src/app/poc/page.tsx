"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

type PocState = {
  network: 'testnet';
  admin: { address: string; secret: string };
  investors: { name: string; address: string; secret: string }[];
  currencies: Array<string | { code: string; link: string }>;
  distributed: boolean;
};

export default function PocPage() {
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<PocState | null>(null);
  const [initLoading, setInitLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Verifica se já existe estado salvo
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

  async function handleSetup() {
    setInitLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const res = await fetch('/api/setup');
      const data = (await res.json()) as PocState & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || 'Falha no setup');
      setState(data);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message || 'Erro no setup');
    } finally {
      setInitLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Inicialização do POC</h1>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Configuração do XRPL Proof of Concept</h2>
          
          <div className="space-y-4">
            <p className="text-gray-600">
              Esta funcionalidade irá criar e configurar automaticamente:
            </p>
            
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
              <li>Carteira administradora financiada</li>
              <li>3 carteiras de investidores financiadas</li>
              <li>Trust lines configuradas entre investidores e admin</li>
              <li>Distribuição inicial de tokens (BRL, TKA, TKB)</li>
            </ul>

            {state && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">POC já inicializado</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  Admin: {state.admin.address.slice(0, 6)}...{state.admin.address.slice(-4)}
                </p>
                <p className="text-sm text-green-700">
                  Investidores: {state.investors.length} configurados
                </p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">POC inicializado com sucesso!</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  Todas as carteiras foram criadas e configuradas.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Erro na inicialização</span>
                </div>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            )}

            <div className="pt-4">
              <Button 
                onClick={handleSetup} 
                disabled={initLoading || !!state}
                className="w-full"
                size="lg"
              >
                {initLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Inicializando POC...
                  </div>
                ) : state ? (
                  'POC já inicializado'
                ) : (
                  'Inicializar POC (admin + investidores)'
                )}
              </Button>
            </div>

            {state && (
              <div className="pt-4 space-y-2">
                <Link href="/admin">
                  <Button variant="outline" className="w-full">
                    Ir para Painel Admin
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="w-full">
                    Voltar para Seleção de Perfil
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
