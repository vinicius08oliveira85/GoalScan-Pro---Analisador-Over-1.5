import React from 'react';
import { Home, LayoutList, Trophy, Wallet } from 'lucide-react';
import type { TabType } from '../navTypes';

const ITEMS: Array<{ id: TabType; label: string; Icon: typeof Home }> = [
  { id: 'dashboard', label: 'Início', Icon: Home },
  { id: 'matches', label: 'Jogos', Icon: LayoutList },
  { id: 'championships', label: 'Campeonatos', Icon: Trophy },
  { id: 'bank', label: 'Banca', Icon: Wallet },
];

interface MobileBottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-[90] border-t border-base-300/50 bg-base-200/90 backdrop-blur-md pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 px-1 shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.12)]"
      aria-label="Navegação principal"
    >
      <div className="flex items-stretch justify-around max-w-lg mx-auto">
        {ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[48px] min-w-0 rounded-xl py-1.5 transition-colors focus-ring-sm ${
                isActive ? 'text-primary bg-primary/15' : 'text-base-content/60 active:bg-base-300/50'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" aria-hidden />
              <span className="text-[10px] font-bold leading-tight truncate max-w-full px-0.5">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
