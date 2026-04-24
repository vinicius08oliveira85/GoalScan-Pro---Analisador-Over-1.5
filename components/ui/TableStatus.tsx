import React from 'react';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../utils/cn';

interface TableStatusProps {
  updatedAt: number | string | null | undefined;
  className?: string;
}

const TableStatus: React.FC<TableStatusProps> = ({ updatedAt, className }) => {
  if (!updatedAt) return null;

  const lastUpdateDate = typeof updatedAt === 'number' ? updatedAt : new Date(updatedAt).getTime();
  const diffInMs = Date.now() - lastUpdateDate;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  let statusText = '';
  let colorClass = '';
  let Icon = Clock;

  if (diffInDays === 0) {
    statusText = 'Atualizado hoje';
    colorClass = 'text-success border-success/30 bg-success/10';
    Icon = CheckCircle2;
  } else if (diffInDays === 1) {
    statusText = 'Atualizado ontem';
    colorClass = 'text-warning border-warning/30 bg-warning/10';
  } else if (diffInDays < 7) {
    statusText = `Há ${diffInDays} dias`;
    colorClass = 'text-warning border-warning/30 bg-warning/10';
  } else {
    statusText = `Desatualizado (${diffInDays}d)`;
    colorClass = 'text-error border-error/30 bg-error/10';
    Icon = AlertCircle;
  }

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-tighter backdrop-blur-md transition-all duration-300",
      colorClass,
      className
    )}>
      <Icon className="w-3.5 h-3.5" />
      <span>{statusText}</span>
      
      {/* Efeito de Pulsação para dados antigos (> 3 dias) */}
      {diffInDays > 3 && (
        <span className="relative flex h-2 w-2 ml-1">
          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", diffInDays > 7 ? "bg-error" : "bg-warning")}></span>
          <span className={cn("relative inline-flex rounded-full h-2 w-2", diffInDays > 7 ? "bg-error" : "bg-warning")}></span>
        </span>
      )}
    </div>
  );
};

export default TableStatus;