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
      className="hidden md:flex flex-col w-[220px] lg:w-56 shrink-0 sticky top-0 h-screen p-3 lg:p-4 rounded-none border-y-0 border-l-0 border-r border-base-content/10 dark:border-white/10 bg-base-100/65 dark:bg-base-100/40 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_-1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)]"
      aria-label="Menu lateral"
    >
      <div className="flex items-center gap-2 px-2 py-3 mb-2">
        <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center text-primary-content font-black italic text-lg shadow-lg shrink-0">
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
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-left font-semibold text-sm transition-colors focus-ring-sm min-h-[44px] ${
                isActive
                  ? 'bg-primary text-primary-content shadow-md shadow-primary/20'
                  : 'text-base-content/75 hover:bg-base-300/40'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </nav>
      <p className="text-[10px] text-center text-base-content/40 px-2 pt-2">v3.8.2</p>
    </aside>
  );
};

export default DesktopSidebar;
