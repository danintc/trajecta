import { useState, useEffect, useCallback } from 'react';
import { db, clearTestDatabase, seedPopulatedDatabase } from '@/adapters/out/storage/dexie-db';
import { Transaction } from '@/core/domain/transaction.entity';
import { Asset } from '@/core/domain/asset.entity';
import { CareerRecord } from '@/core/domain/career.entity';
import { HomeScreen } from './adapters/in/ui/screens/HomeScreen';
import { TimelineScreen } from './adapters/in/ui/screens/TimelineScreen';
import { InvestmentsScreen } from './adapters/in/ui/screens/InvestmentsScreen';
import { CareerScreen } from './adapters/in/ui/screens/CareerScreen';
import { AddTransactionModal } from './adapters/in/ui/components/AddTransactionModal';

export type ActiveTab = 'home' | 'timeline' | 'invest' | 'career';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [isPrivacyActive, setIsPrivacyActive] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [appMode, setAppMode] = useState<'empty' | 'populated'>('populated');

  // Estados sincronizados com IndexedDB
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [careerRecords, setCareerRecords] = useState<CareerRecord[]>([]);

  const loadDatabaseData = useCallback(async () => {
    await db.ensureDefaultCategories();
    const txs = await db.transactions.toArray();
    const asts = await db.assets.toArray();
    const crs = await db.careerRecords.toArray();

    setTransactions(txs);
    setAssets(asts);
    setCareerRecords(crs);
  }, []);

  // Inicialização
  useEffect(() => {
    const init = async () => {
      await seedPopulatedDatabase();
      await loadDatabaseData();
    };
    init();
  }, [loadDatabaseData]);

  // Alternar entre Clean Slate (Vazio) e Populado
  const handleToggleState = async (mode: 'empty' | 'populated') => {
    setAppMode(mode);
    if (mode === 'empty') {
      await clearTestDatabase();
    } else {
      await seedPopulatedDatabase();
    }
    await loadDatabaseData();
  };

  const handleDeleteTransaction = async (id: string) => {
    await db.transactions.delete(id);
    await loadDatabaseData();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-[#F4F4F5]">
      
      {/* TOP BAR */}
      <header className="border-b border-border-subtle bg-surface/90 backdrop-blur sticky top-0 z-40 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-yellow flex items-center justify-center font-extrabold text-black text-lg shadow-sm shadow-accent-yellow/20">
            T
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">Trajecta</span>
              <span className="text-[10px] font-semibold bg-[#27272A] text-finance-neutral px-2 py-0.5 rounded-full uppercase tracking-wider">
                Local-First
              </span>
            </div>
            <p className="text-xs text-[#71717A] hidden sm:block">
              Sua trajetória da carreira ao patrimônio
            </p>
          </div>
        </div>

        {/* CONTROLES GLOBAIS */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Seletor Estado Cru vs Populado */}
          <div className="bg-background p-1 rounded-lg border border-border-subtle flex items-center text-xs">
            <button
              onClick={() => handleToggleState('populated')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                appMode === 'populated'
                  ? 'bg-surface-hover text-white'
                  : 'text-finance-neutral hover:text-white'
              }`}
            >
              Populado
            </button>
            <button
              onClick={() => handleToggleState('empty')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                appMode === 'empty'
                  ? 'bg-surface-hover text-white'
                  : 'text-finance-neutral hover:text-white'
              }`}
            >
              Clean Slate (Vazio)
            </button>
          </div>

          {/* Toggle Modo Privacidade */}
          <button
            data-testid="privacy-toggle"
            onClick={() => setIsPrivacyActive(!isPrivacyActive)}
            className={`px-3 py-1.5 rounded-lg border border-border-subtle bg-background text-xs font-medium flex items-center gap-1.5 transition ${
              isPrivacyActive
                ? 'border-accent-yellow text-accent-yellow'
                : 'text-finance-neutral hover:text-white hover:border-[#3F3F46]'
            }`}
          >
            <span>{isPrivacyActive ? '🔒' : '👁️'}</span>
            <span className="hidden sm:inline">
              {isPrivacyActive ? 'Privacidade Ativa' : 'Modo Privacidade'}
            </span>
          </button>

          {/* Botão Global (+) */}
          <button
            data-testid="fab-add-transaction"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-accent-yellow hover:bg-accent-yellow-hover text-black font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-accent-yellow/20 transition transform active:scale-95"
          >
            <span className="text-sm font-black">+</span>
            <span>Lançar</span>
          </button>
        </div>
      </header>

      {/* NAVEGAÇÃO DE 4 ABAS */}
      <nav className="bg-[#121215] border-b border-border-subtle px-4 lg:px-8 flex items-center gap-1 overflow-x-auto">
        <button
          data-testid="nav-tab-home"
          onClick={() => setActiveTab('home')}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'home'
              ? 'border-accent-yellow text-accent-yellow'
              : 'border-transparent text-finance-neutral hover:text-white'
          }`}
        >
          <span>🏠</span> Dashboard
        </button>
        <button
          data-testid="nav-tab-timeline"
          onClick={() => setActiveTab('timeline')}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'timeline'
              ? 'border-accent-yellow text-accent-yellow'
              : 'border-transparent text-finance-neutral hover:text-white'
          }`}
        >
          <span>📜</span> Extrato / Timeline
        </button>
        <button
          data-testid="nav-tab-invest"
          onClick={() => setActiveTab('invest')}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'invest'
              ? 'border-accent-yellow text-accent-yellow'
              : 'border-transparent text-finance-neutral hover:text-white'
          }`}
        >
          <span>📈</span> Investimentos
        </button>
        <button
          data-testid="nav-tab-career"
          onClick={() => setActiveTab('career')}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'career'
              ? 'border-accent-yellow text-accent-yellow'
              : 'border-transparent text-finance-neutral hover:text-white'
          }`}
        >
          <span>💼</span> Carreira & Total Cash
        </button>
      </nav>

      {/* CONTEÚDO DA ABA ATIVA */}
      <main className="flex-1 p-4 lg:p-8 max-w-6xl mx-auto w-full">
        {activeTab === 'home' && (
          <HomeScreen
            transactions={transactions}
            assets={assets}
            isPrivacyActive={isPrivacyActive}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onNavigateToTimeline={() => setActiveTab('timeline')}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineScreen
            transactions={transactions}
            isPrivacyActive={isPrivacyActive}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}

        {activeTab === 'invest' && (
          <InvestmentsScreen
            assets={assets}
            isPrivacyActive={isPrivacyActive}
            onRefreshData={loadDatabaseData}
          />
        )}

        {activeTab === 'career' && (
          <CareerScreen
            careerRecords={careerRecords}
            isPrivacyActive={isPrivacyActive}
            onRefreshData={loadDatabaseData}
          />
        )}
      </main>

      {/* MODAL GLOBAL (+) DE TRANSAÇÕES */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={loadDatabaseData}
      />
    </div>
  );
}
