import React from 'react';
import { motion } from 'framer-motion';
import { AnalysisResult, MatchData, BetInfo, BankSettings as BankSettingsType, SavedAnalysis, SelectedBet } from '../types';
import { BarChart2, CheckCircle, Save, XCircle } from 'lucide-react';

// Importar os componentes de UI que criamos
import ProbabilityGauge from './ProbabilityGauge';
import StatusBadge from './StatusBadge';

interface AnalysisDashboardProps {
  result: AnalysisResult;
  data: MatchData;
  onSave: (selectedBets?: SelectedBet[]) => void;
  betInfo?: BetInfo | null;
  bankSettings: BankSettingsType | null;
  onBetSave: (betInfo: BetInfo) => void;
  onError: (message: string) => void;
  isUpdatingBetStatus: boolean;
  onOddChange: (newOdd: number) => void;
  onAnalyzeResult: (match: SavedAnalysis) => void;
  savedMatch: SavedAnalysis | null;
  initialSelectedBets?: SelectedBet[];
}

// Um card para exibir estatísticas de forma consistente
const StatCard: React.FC<{ title: string; value: string | number; description: string; valueColorClass?: string }> = ({ title, value, description, valueColorClass = '' }) => (
  <div className="stat">
    <div className="stat-title">{title}</div>
    <div className={`stat-value ${valueColorClass}`}>{value}</div>
    <div className="stat-desc">{description}</div>
  </div>
);

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
  result,
  data,
  onSave,
  betInfo,
  bankSettings,
  onBetSave,
  onError,
  isUpdatingBetStatus,
  onOddChange,
  onAnalyzeResult,
  savedMatch,
}) => {
  const probabilityPercentage = result.over15Probability.confidence * 100;
  const ev = result.expectedValue.ev;
  const hasBet = betInfo && betInfo.betAmount > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Card Principal com o Gauge */}
      <div className="card bg-base-100 shadow-sm border border-base-300/50 p-6">
        <div className="flex flex-col md:flex-row items-center justify-around gap-6 text-center md:text-left">
          {/* Lado Esquerdo: Gauge de Probabilidade */}
          <div className="flex flex-col items-center gap-2">
            <ProbabilityGauge 
              percentage={probabilityPercentage}
              size={140}
              strokeWidth={12}
            />
            <span className="font-bold text-lg text-base-content/80 mt-2">{result.over15Probability.description}</span>
            <p className="text-xs text-base-content/60">Confiança do Algoritmo Poisson</p>
          </div>

          {/* Lado Direito: Estatísticas Chave */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <StatCard 
              title="Fair Odd (Justa)"
              value={result.over15Probability.fairOdd.toFixed(2)}
              description="Risco real da aposta"
              valueColorClass="text-secondary"
            />
            <StatCard 
              title="Valor Esperado (EV)"
              value={`${ev.toFixed(2)}%`}
              description={result.expectedValue.description}
              valueColorClass={ev > 0 ? 'text-success' : 'text-error'}
            />
            <StatCard 
              title="Odd da Análise"
              value={data.oddOver15.toFixed(2)}
              description="Odd usada no cálculo"
              valueColorClass="text-primary"
            />
            <StatCard 
              title="Gols Esperados"
              value={result.totalExpectedGoals.toFixed(2)}
              description="Soma de xG (H+A)"
              valueColorClass="text-info"
            />
          </div>
        </div>
      </div>

      {/* Alerta de Valor Esperado */}
      {ev > 0 ? (
        <div className="alert alert-success shadow-md">
          <CheckCircle className="w-6 h-6" />
          <div>
            <h3 className="font-bold">Aposta de Valor Positivo!</h3>
            <div className="text-xs">O Valor Esperado (EV) de {ev.toFixed(2)}% indica que, a longo prazo, esta aposta tende a ser lucrativa com a odd fornecida.</div>
          </div>
        </div>
      ) : (
        <div className="alert alert-warning shadow-md">
          <XCircle className="w-6 h-6" />
          <div>
            <h3 className="font-bold">Aposta de Valor Negativo ou Neutro</h3>
            <div className="text-xs">O EV de {ev.toFixed(2)}% sugere que a odd oferecida pode não compensar o risco. Considere com cautela.</div>
          </div>
        </div>
      )}

      {/* Seção de Aposta e Ações */}
      <div className="card bg-base-100 shadow-sm border border-base-300/50 p-6">
        <h3 className="text-lg font-bold mb-4">Gestão da Aposta</h3>
        {/* Aqui entraria o seu componente BetForm. Como não o tenho, vou simular. */}
        <div className="mock-bet-form bg-base-200 p-4 rounded-lg">
          <p className="text-center text-sm text-base-content/70">
            (Aqui ficaria o componente `BetForm` para inserir valor, odd, etc.)
          </p>
          {hasBet && (
            <div className="mt-4 text-center">
              <p className="text-base-content/80">Aposta registrada:</p>
              <div className="flex justify-center items-center gap-4 mt-2">
                <span className="font-bold text-xl">{bankSettings?.currency || '$'} {betInfo.betAmount.toFixed(2)}</span>
                <StatusBadge status={betInfo.status} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t border-base-300">
        {savedMatch && hasBet && betInfo.status !== 'pending' && (
          <button 
            onClick={() => onAnalyzeResult(savedMatch)}
            className="btn btn-ghost text-primary gap-2"
          >
            <BarChart2 className="w-4 h-4" />
            Analisar Resultado
          </button>
        )}
        <button 
          onClick={() => onSave()}
          className="btn btn-primary btn-outline flex-1 sm:flex-none"
        >
          <Save className="w-4 h-4" />
          {savedMatch ? 'Atualizar Análise' : 'Salvar Análise'}
        </button>
      </div>
    </motion.div>
  );
};

export default AnalysisDashboard;