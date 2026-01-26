import React from 'react';
import { CheckCircle, XCircle, Clock, Ban, AlertCircle } from 'lucide-react';

export type BetStatus = 'pending' | 'won' | 'lost' | 'cancelled' | 'void';

interface StatusBadgeProps {
  status: BetStatus | string;
  showIcon?: boolean;
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showIcon = true, className = '' }) => {
  const getStatusConfig = (s: string) => {
    switch (s?.toLowerCase()) {
      case 'won':
      case 'ganha':
        return {
          color: 'bg-success/15 text-success border-success/20',
          icon: <CheckCircle className="w-3.5 h-3.5" />,
          label: 'Ganha'
        };
      case 'lost':
      case 'perdida':
        return {
          color: 'bg-error/15 text-error border-error/20',
          icon: <XCircle className="w-3.5 h-3.5" />,
          label: 'Perdida'
        };
      case 'pending':
      case 'pendente':
        return {
          color: 'bg-warning/15 text-warning border-warning/20',
          icon: <Clock className="w-3.5 h-3.5" />,
          label: 'Pendente'
        };
      case 'cancelled':
      case 'cancelada':
      case 'void':
        return {
          color: 'bg-base-300 text-base-content/70 border-base-content/20',
          icon: <Ban className="w-3.5 h-3.5" />,
          label: 'Anulada'
        };
      default:
        return {
          color: 'bg-base-200 text-base-content/70 border-base-300',
          icon: <AlertCircle className="w-3.5 h-3.5" />,
          label: status || 'Desconhecido'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span 
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border
        ${config.color} ${className}
      `}
      role="status"
      aria-label={`Status da aposta: ${config.label}`}
    >
      {showIcon && config.icon}
      {config.label}
    </span>
  );
};

export default StatusBadge;