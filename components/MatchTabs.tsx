import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, CheckCircle, XCircle, List, TrendingUp } from 'lucide-react';

export type TabCategory = 'todas' | 'hoje' | 'futuras' | 'finalizadas' | 'pendentes';

interface Tab {
  id: TabCategory;
  label: string;
  icon: React.ReactNode;
  count: number;
}

interface MatchTabsProps {
  activeTab: TabCategory;
  onTabChange: (tab: TabCategory) => void;
  counts: {
    todas: number;
    hoje: number;
    futuras: number;
    finalizadas: number;
    pendentes: number;
  };
}

const MatchTabs: React.FC<MatchTabsProps> = ({ activeTab, onTabChange, counts }) => {
  const tabs: Tab[] = [
    {
      id: 'todas',
      label: 'Todas',
      icon: <List className="w-4 h-4" />,
      count: counts.todas
    },
    {
      id: 'hoje',
      label: 'Hoje',
      icon: <Calendar className="w-4 h-4" />,
      count: counts.hoje
    },
    {
      id: 'futuras',
      label: 'Futuras',
      icon: <TrendingUp className="w-4 h-4" />,
      count: counts.futuras
    },
    {
      id: 'pendentes',
      label: 'Pendentes',
      icon: <Clock className="w-4 h-4" />,
      count: counts.pendentes
    },
    {
      id: 'finalizadas',
      label: 'Finalizadas',
      icon: <CheckCircle className="w-4 h-4" />,
      count: counts.finalizadas
    }
  ];

  return (
    <div className="mb-6">
      {/* Desktop Tabs */}
      <div className="hidden md:flex gap-2 p-2 bg-base-200/50 backdrop-blur-xl rounded-2xl border border-base-300/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-medium transition-all duration-300
              flex items-center gap-2
              ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-base-content/60 hover:text-base-content/80'
              }
            `}
            aria-label={`${tab.label} (${tab.count} partidas)`}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-xl"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <span className={activeTab === tab.id ? 'opacity-100' : 'opacity-60'}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`
                    px-2 py-0.5 rounded-full text-xs font-bold
                    ${
                      activeTab === tab.id
                        ? 'bg-white/20 text-white'
                        : 'bg-base-300 text-base-content/60'
                    }
                  `}
                >
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Mobile Tabs - Scroll Horizontal */}
      <div className="md:hidden overflow-x-auto custom-scrollbar pb-2 -mx-4 px-4">
        <div className="flex gap-2 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                relative px-4 py-2.5 rounded-xl font-medium transition-all duration-300 whitespace-nowrap
                flex items-center gap-2 flex-shrink-0
                ${
                  activeTab === tab.id
                    ? 'text-white'
                    : 'text-base-content/60 bg-base-200/50 border border-base-300/50'
                }
              `}
              aria-label={`${tab.label} (${tab.count} partidas)`}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabMobile"
                  className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-xl"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <span className={activeTab === tab.id ? 'opacity-100' : 'opacity-60'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`
                      px-2 py-0.5 rounded-full text-xs font-bold
                      ${
                        activeTab === tab.id
                          ? 'bg-white/20 text-white'
                          : 'bg-base-300 text-base-content/60'
                      }
                    `}
                  >
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MatchTabs;

