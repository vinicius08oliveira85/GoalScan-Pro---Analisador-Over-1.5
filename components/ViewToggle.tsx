import React from 'react';
import { motion } from 'framer-motion';
import { Grid3x3, List, LayoutGrid } from 'lucide-react';

export type ViewMode = 'grid' | 'list' | 'compact';

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ viewMode, onViewChange }) => {
  const views: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
    {
      mode: 'grid',
      label: 'Grid',
      icon: <Grid3x3 className="w-4 h-4" />
    },
    {
      mode: 'list',
      label: 'Lista',
      icon: <List className="w-4 h-4" />
    },
    {
      mode: 'compact',
      label: 'Compacta',
      icon: <LayoutGrid className="w-4 h-4" />
    }
  ];

  return (
    <div className="flex items-center gap-2 bg-base-200/50 backdrop-blur-xl rounded-xl p-1 border border-base-300/50 w-full sm:w-auto justify-center sm:justify-start">
      {views.map((view) => (
        <button
          key={view.mode}
          onClick={() => onViewChange(view.mode)}
          className={`
            relative px-3 py-2 rounded-lg font-medium transition-all duration-300
            flex items-center gap-2
            ${
              viewMode === view.mode
                ? 'text-white'
                : 'text-base-content/60 hover:text-base-content/80'
            }
          `}
          aria-label={`Visualização ${view.label}`}
          aria-pressed={viewMode === view.mode}
          role="button"
        >
          {viewMode === view.mode && (
            <motion.div
              layoutId="activeView"
              className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-lg"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <span className={viewMode === view.mode ? 'opacity-100' : 'opacity-60'}>
              {view.icon}
            </span>
            <span className="hidden sm:inline">{view.label}</span>
          </span>
        </button>
      ))}
    </div>
  );
};

export default ViewToggle;

