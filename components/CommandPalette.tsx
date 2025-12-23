import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Settings, Home, Wallet, X, ArrowRight } from 'lucide-react';
import { modalVariants, overlayVariants } from '../utils/animations';

interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandAction[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, actions }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filtrar ações baseado na busca
  const filteredActions = actions.filter(action =>
    action.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    action.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    action.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Resetar seleção quando a busca mudar
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Focar no input quando abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearchQuery('');
    }
  }, [isOpen]);

  // Navegação com teclado
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredActions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredActions[selectedIndex]) {
        e.preventDefault();
        filteredActions[selectedIndex].action();
        onClose();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredActions, selectedIndex, onClose]);

  // Scroll para item selecionado
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-[20vh] px-4">
        {/* Overlay */}
        <motion.div
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          variants={modalVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="relative w-full max-w-2xl bg-base-200/95 backdrop-blur-xl border border-base-300/50 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-base-300/50">
            <Search className="w-5 h-5 text-base-content/60" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar ações... (⌘K)"
              className="flex-1 bg-transparent border-none outline-none text-base-content placeholder-base-content/40"
            />
            <button
              onClick={onClose}
              className="btn btn-xs btn-circle btn-ghost"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Actions List */}
          <div
            ref={listRef}
            className="max-h-96 overflow-y-auto custom-scrollbar p-2"
          >
            {filteredActions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-12 h-12 text-base-content/20 mb-4" />
                <p className="text-sm text-base-content/60">Nenhuma ação encontrada</p>
              </div>
            ) : (
              filteredActions.map((action, index) => (
                <motion.button
                  key={action.id}
                  onClick={() => {
                    action.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    index === selectedIndex
                      ? 'bg-primary/20 border border-primary/30 shadow-lg'
                      : 'hover:bg-base-300/50 border border-transparent'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className={`p-2 rounded-lg ${
                    index === selectedIndex ? 'bg-primary/20 text-primary' : 'bg-base-300/50 text-base-content/60'
                  }`}>
                    {action.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-sm">{action.label}</div>
                    {action.description && (
                      <div className="text-xs text-base-content/60 mt-0.5">{action.description}</div>
                    )}
                  </div>
                  {action.shortcut && (
                    <div className="flex items-center gap-1 text-xs text-base-content/40">
                      <kbd className="px-2 py-1 bg-base-300 rounded border border-base-content/20">
                        {action.shortcut}
                      </kbd>
                    </div>
                  )}
                  {index === selectedIndex && (
                    <ArrowRight className="w-4 h-4 text-primary" />
                  )}
                </motion.button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-3 border-t border-base-300/50 text-xs text-base-content/60">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-base-300 rounded border border-base-content/20">↑↓</kbd>
                <span>Navegar</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-base-300 rounded border border-base-content/20">↵</kbd>
                <span>Selecionar</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-base-300 rounded border border-base-content/20">Esc</kbd>
                <span>Fechar</span>
              </div>
            </div>
            <span>{filteredActions.length} ação(ões)</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CommandPalette;

