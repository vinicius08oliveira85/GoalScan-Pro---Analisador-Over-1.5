import React from 'react';
import { Home, LayoutList, Trophy, Wallet, Settings } from 'lucide-react';
import type { TabType } from '../navTypes';

const ITEMS: Array<{ id: TabType; label: string; Icon: typeof Home }> = [
  { id: 'dashboard', label: 'Início', Icon: Home },
  { id: 'matches', label: 'Jogos', Icon: LayoutList },
  { id: 'championships', label: 'Campeonatos', Icon: Trophy },
  { id: 'bank', label: 'Banca', Icon: Wallet },
  { id: 'settings', label: 'Configurações', Icon: Settings },
];

interface DesktopSidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ activeTab, onTabChange }) => {
  return (
    <aside
      className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col rounded-none border-y-0 border-l-0 border-r border-base-300/50 bg-base-100/55 p-3 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl backdrop-saturate-150 dark:border-base-300/50 dark:bg-base-100/40 dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)] md:flex lg:w-56 lg:p-4"
      aria-label="Menu lateral"
    >
      <div className="flex items-center gap-2 px-2 py-3 mb-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary to-secondary/80 text-lg font-black italic text-primary-content shadow-lg shadow-primary/25">
          G
        </div>
        <div className="min-w-0">
          <p className="font-black text-sm leading-tight tracking-tight truncate">GOALSCAN</p>
          <p className="text-[10px] font-bold text-primary/80 uppercase tracking-wider">Pro</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1 flex-1" aria-label="Seções">
        {ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-all duration-200 focus-ring-sm ${
                isActive
                  ? 'bg-primary text-primary-content shadow-lg shadow-primary/25'
                  : 'text-base-content/75 hover:scale-[1.02] hover:bg-base-300/45'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </nav>
      <p className="px-2 pt-2 text-center text-[10px] font-bold opacity-40">v3.8.2</p>
    </aside>
  );
};

export default DesktopSidebar;
