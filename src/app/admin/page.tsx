"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, LogOut, Plus, UserPlus } from "lucide-react";
import Link from "next/link";
import { 
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AdminData = {
  issuer: string;
  summary: {
    totalTrustLines: number;
    uniqueAccounts: number;
    currencies: number;
    currenciesList: string[];
  };
  byCurrency: Record<string, Array<{ account: string; balance: string; limit: string }>>;
  allTrustLines: Array<{ account: string; currency: string; balance: string; limit: string }>;
  investors: Array<{ name: string; address: string; secret: string }>;
};

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [openWallet, setOpenWallet] = useState<string | null>(null);
  const [showNewWalletDialog, setShowNewWalletDialog] = useState(false);
  const [newWalletName, setNewWalletName] = useState("");
  const [selectedTrustlines, setSelectedTrustlines] = useState<string[]>([]);
  const [creatingWallet, setCreatingWallet] = useState(false);

  useEffect(() => {
    async function fetchAdminData() {
      try {
        const res = await fetch('/api/admin');
        const adminData = await res.json();
        if (!res.ok) throw new Error(adminData.error || 'Failed to fetch admin data');
        setData(adminData);
      } catch (e: any) {
        setError(e.message || 'Error fetching admin data');
      } finally {
        setLoading(false);
      }
    }
    fetchAdminData();
  }, []);

  // Agrupar dados por wallet
  const groupedByWallet = data ? data.allTrustLines.reduce((acc, line) => {
    if (!acc[line.account]) {
      acc[line.account] = [];
    }
    acc[line.account].push(line.currency);
    return acc;
  }, {} as Record<string, string[]>) : {};

  // Tokens that a wallet does NOT have trustline to, based on state currencies
  const currenciesList = data?.summary.currenciesList ?? [];
  const issuer = data?.issuer ?? "";
  const getMissingForWallet = (wallet: string) => {
    const has = new Set(groupedByWallet[wallet] ?? []);
    return currenciesList.filter(c => c !== 'XRP' && !has.has(c));
  };

  // Get investor name from wallet address
  const getInvestorName = (wallet: string) => {
    if (wallet === issuer) return "Admin";
    // Find investor in the data from API
    const investor = data?.investors?.find(i => i.address === wallet);
    return investor?.name || "Investor";
  };

  async function addTrustline(wallet: string, currency: string) {
    try {
      setAdding(`${wallet}:${currency}`);
      const res = await fetch('/api/trustline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: wallet, currency, issuer })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao criar trustline');
      toast.success(`Trustline ${currency} adicionada para ${wallet.slice(0,6)}...`)
      // refresh admin data
      const r = await fetch('/api/admin');
      const adminData = await r.json();
      if (!r.ok) throw new Error(adminData.error || 'Falha ao atualizar dados');
      setData(adminData);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar trustline');
    } finally {
      setAdding(null);
    }
  }

  async function createNewWallet() {
    if (!newWalletName.trim()) {
      toast.error("Nome da carteira é obrigatório");
      return;
    }
    
    setCreatingWallet(true);
    try {
      const res = await fetch('/api/admin/new-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newWalletName.trim(), 
          trustlines: selectedTrustlines 
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao criar carteira');
      
      toast.success(`Carteira ${newWalletName} criada com sucesso!`);
      setShowNewWalletDialog(false);
      setNewWalletName("");
      setSelectedTrustlines([]);
      
      // refresh admin data
      const r = await fetch('/api/admin');
      const adminData = await r.json();
      if (!r.ok) throw new Error(adminData.error || 'Falha ao atualizar dados');
      setData(adminData);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar carteira');
    } finally {
      setCreatingWallet(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando dados admin...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/">
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Painel do Administrador</h1>
          <div className="text-sm text-gray-600 gap-2 flex gap-4">
            <p>Perfil: Admin</p>
            <p>Endereço da Carteira: {data?.issuer}</p>
          </div>
          
          <div className="space-x-2">
            <Link href="/">
              <Button variant="outline" className="flex items-center gap-2">Trocar perfil <LogOut className="w-4 h-4" /></Button>
            </Link>
          </div>
        </div>

        {data && (
          <>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h2 className="text-lg font-semibold mb-3">Resumo</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{data.summary.totalTrustLines}</p>
                  <p className="text-sm text-gray-600">Total Trust Lines</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{data.summary.uniqueAccounts}</p>
                  <p className="text-sm text-gray-600">Carteiras com trustline</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{data.summary.currencies}</p>
                  <p className="text-sm text-gray-600">Tokens</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Carteiras Registradas</h2>
              <Button 
                onClick={() => setShowNewWalletDialog(true)}
                className="flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Registrar nova wallet
              </Button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border">
              <Table className="w-full">
                <TableHeader className="bg-gray-100">
                  <TableRow>
                    <TableHead className="text-center font-bold text-gray-600 w-1/4">Investidor</TableHead>
                    <TableHead className="text-center font-bold text-gray-600 w-1/4">Carteiras</TableHead>
                    <TableHead className="text-center font-bold text-gray-600 w-1/4">Tokens com trustline</TableHead>
                    <TableHead className="text-center font-bold text-gray-600 w-1/4">Ações</TableHead>
                    <TableHead className="text-center font-bold text-gray-600 w-1/4">Criar trustlines</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedByWallet).map(([wallet, currencies]) => (
                    <TableRow key={wallet} className="hover:bg-gray-50">
                      <TableCell className="text-center py-3 font-semibold text-sm">
                        {getInvestorName(wallet)}
                      </TableCell>
                      <TableCell className="text-center py-3 font-mono text-sm">
                        {wallet}
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {currencies.map((currency, idx) => (
                            <span 
                              key={idx}
                              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                            >
                              {currency}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <div className="flex items-center justify-center gap-2">
                          <Link 
                            href={`https://testnet.xrpl.org/accounts/${wallet}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors"
                          >
                            Ver conta
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-3">
                      <AlertDialog open={openWallet === wallet} onOpenChange={(open) => setOpenWallet(open ? wallet : null)}>
                            <AlertDialogTrigger asChild>
                              <Button variant="default" className="inline-flex items-center gap-2">
                                Adicionar Trustline <Plus className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Adicionar Trustline</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Selecione uma moeda que esta carteira ainda não possui trustline.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="space-y-2">
                                {getMissingForWallet(wallet).length === 0 ? (
                                  <p className="text-sm text-gray-600">Nenhuma moeda pendente.</p>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {getMissingForWallet(wallet).map((c) => (
                                      <Button key={c} variant="outline" disabled={adding === `${wallet}:${c}`} onClick={() => addTrustline(wallet, c)}>
                                        {adding === `${wallet}:${c}` ? 'Adicionando...' : `Adicionar ${c}`}
                                      </Button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Fechar</AlertDialogCancel>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* Dialog para criar nova carteira */}
        <AlertDialog open={showNewWalletDialog} onOpenChange={setShowNewWalletDialog}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Registrar Nova Carteira</AlertDialogTitle>
              <AlertDialogDescription>
                Crie uma nova carteira e configure suas trustlines iniciais.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome da Carteira</label>
                <Input
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                  placeholder="Ex: Investor 4"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Trustlines Iniciais</label>
                <div className="space-y-2">
                  {data?.summary.currenciesList?.map((currency) => (
                    <label key={currency} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedTrustlines.includes(currency)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTrustlines([...selectedTrustlines, currency]);
                          } else {
                            setSelectedTrustlines(selectedTrustlines.filter(c => c !== currency));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{currency}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button 
                onClick={createNewWallet} 
                disabled={creatingWallet || !newWalletName.trim()}
                className="flex items-center gap-2"
              >
                {creatingWallet ? 'Criando...' : 'Criar Carteira'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
