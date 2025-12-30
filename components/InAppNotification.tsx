import React, { useEffect, useState } from 'react';
import { SavedAnalysis } from '../types';
import { Bell, X, Clock, ArrowRight } from 'lucide-react';
import { getMatchDateInBrasilia, formatMatchTime } from '../utils/dateFormatter';

interface InAppNotificationProps {
  match: SavedAnalysis;
  onClose: () => void;
  onClick?: () => void;
}

const InAppNotification: React.FC<InAppNotificationProps> = ({ 
  match, 
  onClose, 
  onClick 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animação de entrada
    setTimeout(() => setIsVisible(true), 100);

    // Auto-fechar após 10 segundos
    const autoCloseTimer = setTimeout(() => {
      handleClose();
    }, 10000);

    return () => {
      clearTimeout(autoCloseTimer);
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300); // Aguardar animação de saída
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
      handleClose();
    }
  };

  // Calcular tempo restante
  const getTimeUntilMatch = (): string => {
    if (!match.data.matchDate || !match.data.matchTime) return '';

    try {
      const matchDateTime = getMatchDateInBrasilia(match.data.matchDate, match.data.matchTime);
      const now = new Date();
      const diffMs = matchDateTime.getTime() - now.getTime();
      
      if (diffMs <= 0) return 'A partida já começou';

      const minutes = Math.floor(diffMs / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      if (minutes > 0) {
        return `Em ${minutes} min${minutes > 1 ? 's' : ''} e ${seconds}s`;
      }
      return `Em ${seconds}s`;
    } catch {
      return '';
    }
  };

  return (
    <div
      className={`w-full transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div
        className="custom-card p-4 bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/10 border border-primary/30 shadow-2xl cursor-pointer hover:scale-[1.02] transition-transform"
        onClick={handleClick}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-primary/20 border border-primary/30 flex-shrink-0">
            <Bell className="w-5 h-5 text-primary animate-pulse" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-black text-sm uppercase text-primary">
                Partida começando em breve!
              </h4>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                className="btn btn-xs btn-circle btn-ghost p-0 min-h-0 h-6 w-6 flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            
            <p className="text-sm font-bold mb-2 break-words">
              {match.data.homeTeam} <span className="text-primary opacity-60">vs</span> {match.data.awayTeam}
            </p>
            
            <div className="flex items-center gap-2 text-xs opacity-80">
              <Clock className="w-3 h-3" />
              <span>{getTimeUntilMatch()}</span>
              {match.data.matchTime && match.data.matchDate && (
                <span className="opacity-60">
                  • Início: {formatMatchTime(match.data.matchDate, match.data.matchTime)}
                </span>
              )}
            </div>

            {onClick && (
              <div className="mt-2 flex items-center gap-1 text-xs text-primary font-bold">
                <span>Ver partida</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InAppNotification;

