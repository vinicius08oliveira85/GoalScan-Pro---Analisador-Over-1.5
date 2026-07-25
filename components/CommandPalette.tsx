import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, X, ArrowRight } from 'lucide-react';
import ModalShell from './ui/ModalShell';

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
  const filteredActions = actions.filter(
    (action) =>
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
        setSelectedIndex((prev) => Math.min(prev + 1, filteredActions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
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

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      panelClassName="mt-[18vh] max-h-[min(80vh,calc(100dvh-6rem))] w-full max-w-2xl flex-col self-start"
      bodyClassName="p-0 max-h-none overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-base-300/50 bg-base-200/50 p-4 backdrop-blur-xl dark:border-base-300/50">
        <Search className="h-5 w-5 opacity-60" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar ações... (⌘K)"
          className="flex-1 border-none bg-transparent text-base-content outline-none placeholder:opacity-40"
        />
        <button onClick={onClose} className="btn btn-circle btn-ghost btn-xs ui-hover-rise" aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Actions List */}
      <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {filteredActions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="w-12 h-12 text-base-content/20 mb-4" />
            <p className="text-sm text-base-content/70 leading-relaxed">Nenhuma ação encontrada</p>
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
              className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl border p-3 transition-all duration-200 ${
                index === selectedIndex
                  ? 'border-primary/35 bg-primary/15 shadow-lg shadow-primary/15 backdrop-blur-sm'
                  : 'border-transparent hover:border-base-300/50 hover:bg-base-300/45'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            >
              <div
                className={`p-2 rounded-lg ${
                  index === selectedIndex ? 'bg-primary/20 text-primary' : 'bg-base-300/50 text-base-content/60'
                }`}
              >
                {action.icon}
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-black leading-relaxed md:text-base">{action.label}</div>
                {action.description && (
                  <div className="mt-1 text-xs leading-relaxed opacity-60 md:text-sm">
                    {action.description}
                  </div>
                )}
              </div>
              {action.shortcut && (
                <div className="flex items-center gap-1 text-xs opacity-40">
                  <kbd className="rounded border border-base-300/50 bg-base-300/80 px-2 py-1 font-mono text-[10px] shadow-inner dark:border-base-300/50">
                    {action.shortcut}
                  </kbd>
                </div>
              )}
              {index === selectedIndex && <ArrowRight className="w-4 h-4 text-primary" />}
            </motion.button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-base-300/50 bg-base-200/40 p-3 text-xs opacity-60 backdrop-blur-md dark:border-base-300/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-base-300/50 bg-base-300/80 px-1.5 py-0.5 dark:border-base-300/50">↑↓</kbd>
            <span>Navegar</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-base-300/50 bg-base-300/80 px-1.5 py-0.5 dark:border-base-300/50">↵</kbd>
            <span>Selecionar</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-base-300/50 bg-base-300/80 px-1.5 py-0.5 dark:border-base-300/50">Esc</kbd>
            <span>Fechar</span>
          </div>
        </div>
        <span>{filteredActions.length} ação(ões)</span>
      </div>
    </ModalShell>
  );
};

export default CommandPalette;
