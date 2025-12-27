import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Plus, Wallet, Menu, X } from 'lucide-react';
import { animations } from '../utils/animations';

interface MobileNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}

interface MobileNavProps {
  items: MobileNavItem[];
  menuItems?: MobileNavItem[];
  onBankClick?: () => void;
  bankLabel?: string;
  className?: string;
}

const MobileNav: React.FC<MobileNavProps> = ({ 
  items, 
  menuItems,
  onBankClick, 
  bankLabel,
  className = '' 
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerItems = menuItems ?? items;

  return (
    <>
      {/* Bottom Navigation - Mobile Only */}
      <motion.nav
        className={`btm-nav btm-nav-lg lg:hidden bg-base-200/95 backdrop-blur-xl border-t border-base-300/50 fixed bottom-0 left-0 right-0 z-40 ${className}`}
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {items.map((item) => (
          <motion.button
            key={item.id}
            onClick={item.onClick}
            className={`${item.active ? 'active text-primary' : 'text-base-content/60'} transition-colors`}
            whileTap={{ scale: 0.95 }}
            aria-label={item.label}
          >
            <div className="flex flex-col items-center gap-1">
              {item.icon}
              <span className="btm-nav-label text-xs font-bold">{item.label}</span>
            </div>
          </motion.button>
        ))}
        
        {onBankClick && (
          <motion.button
            onClick={onBankClick}
            className="text-base-content/60 hover:text-primary transition-colors"
            whileTap={{ scale: 0.95 }}
            aria-label="Banca"
          >
            <div className="flex flex-col items-center gap-1">
              <Wallet className="w-5 h-5" />
              <span className="btm-nav-label text-xs font-bold">{bankLabel || 'Banca'}</span>
            </div>
          </motion.button>
        )}

        {/* Menu Button */}
        <motion.button
          onClick={() => setIsDrawerOpen(true)}
          className="text-base-content/60 hover:text-primary transition-colors"
          whileTap={{ scale: 0.95 }}
          aria-label="Menu"
        >
          <div className="flex flex-col items-center gap-1">
            <Menu className="w-5 h-5" />
            <span className="btm-nav-label text-xs font-bold">Menu</span>
          </div>
        </motion.button>
      </motion.nav>

      {/* Drawer/Sidebar */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:hidden"
              onClick={() => setIsDrawerOpen(false)}
            />

            {/* Drawer */}
            <motion.aside
              variants={animations.slideInLeft}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed left-0 top-0 bottom-0 w-80 bg-base-200/95 backdrop-blur-xl border-r border-base-300/50 z-50 lg:hidden shadow-2xl"
            >
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-base-300/50">
                  <h2 className="text-lg font-black">Menu</h2>
                  <motion.button
                    onClick={() => setIsDrawerOpen(false)}
                    className="btn btn-xs btn-circle btn-ghost"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    aria-label="Fechar menu"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                  {drawerItems.map((item) => (
                    <motion.button
                      key={item.id}
                      onClick={() => {
                        item.onClick();
                        setIsDrawerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                        item.active
                          ? 'bg-primary/20 border border-primary/30 text-primary'
                          : 'hover:bg-base-300/50 border border-transparent text-base-content'
                      }`}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className={`p-2 rounded-lg ${
                        item.active ? 'bg-primary/20' : 'bg-base-300/50'
                      }`}>
                        {item.icon}
                      </div>
                      <span className="font-semibold">{item.label}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-base-300/50">
                  <div className="text-xs text-base-content/60 text-center">
                    GoalScan Pro v3.8
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileNav;

