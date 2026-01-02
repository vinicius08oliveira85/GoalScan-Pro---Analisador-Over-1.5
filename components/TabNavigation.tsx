import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Target, Wallet, Settings } from 'lucide-react';

export type TabType = 'dashboard' | 'matches' | 'bank' | 'settings';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4 md:w-5 md:h-5" />,
    },
    { id: 'matches', label: 'Partidas', icon: <Target className="w-4 h-4 md:w-5 md:h-5" /> },
    { id: 'bank', label: 'Banca', icon: <Wallet className="w-4 h-4 md:w-5 md:h-5" /> },
    {
      id: 'settings',
      label: 'Configurações',
      icon: <Settings className="w-4 h-4 md:w-5 md:h-5" />,
    },
  ];

  return (
    <div className="w-full border-b border-base-300 bg-base-200/80 backdrop-blur-md sticky top-0 z-40">
      <div className="container mx-auto px-3 md:px-4">
        {/* Desktop: Tabs horizontais */}
        <div className="hidden md:flex tabs tabs-boxed bg-base-300/50 p-1 gap-1">
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`tab flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-content shadow-lg'
                  : 'text-base-content/70 hover:text-base-content hover:bg-base-200'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Mobile: Tabs em scroll horizontal */}
        <div className="md:hidden overflow-x-auto scrollbar-hide pb-2">
          <div className="flex gap-2 min-w-max px-1">
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-content shadow-lg'
                    : 'bg-base-300/50 text-base-content/70 active:bg-base-300'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabNavigation;
