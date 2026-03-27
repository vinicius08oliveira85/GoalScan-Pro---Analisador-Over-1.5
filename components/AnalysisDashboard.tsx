import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AnalysisResult, MatchData, BetInfo, BankSettings, SelectedBet, SavedAnalysis } from '../types';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Calculator,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  Zap,
  Shield,
  Target,
  Sparkles,
  Search,
} from 'lucide-react';
import BetManager from './BetManager';
import ProbabilityGauge from './ProbabilityGauge';
import MetricCard from './MetricCard';
import { getCurrencySymbol } from '../utils/currency';
import { animations } from '../utils/animations';
import { getPrimaryProbability } from '../utils/probability';
import { getEdgePp } from '../utils/betMetrics';
import { calculateSelectedBetsProbability } from '../utils/betRange';
import { getRiskLevelFromProbability } from '../utils/risk';
import {
  getEdgeTooltip,
  calculateDataQuality,
  getMarketOverTooltip,
  getMarketUnderTooltip,
  getBothGoalsTooltip,
} from '../utils/probabilityTooltips';

interface AnalysisDashboardProps {
  result: AnalysisResult;
  data: MatchData;
  onSave?: (selectedBets?: SelectedBet[]) => void;
  betInfo?: BetInfo;
  bankSettings?: BankSettings;
  savedMatches?: SavedAnalysis[];
  onBetSave?: (betInfo: BetInfo) => void;
  onError?: (message: string) => void;
  isUpdatingBetStatus?: boolean;
  onOddChange?: (odd: number) => void;
  initialSelectedBets?: SelectedBet[];
  onAnalyzeResult: (match: SavedAnalysis) => void;
  savedMatch: SavedAnalysis | null;
}

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
  result,
  data,
  onSave,
  betInfo,
  bankSettings,
  savedMatches,
  onBetSave,
  onError,
  isUpdatingBetStatus = false,
  onOddChange,
  initialSelectedBets,
  onAnalyzeResult,
  savedMatch,
}) => {
  const [showBetManager, setShowBetManager] = useState(false);
  const [selectedBets, setSelectedBets] = useState<SelectedBet[]>(initialSelectedBets || []);
  const [overUnderTab, setOverUnderTab] = useState<'combined' | 'stats' | 'table'>('combined');

  useEffect(() => {
    if (initialSelectedBets) {
      setSelectedBets(initialSelectedBets);
    }
  }, [initialSelectedBets]);

  const primaryProb = getPrimaryProbability(result);
  const hasCombinedOU = !!result.overUnderProbabilities && Object.keys(result.overUnderProbabilities).length > 0;
  const hasStatsOU = !!result.statsOverUnderProbabilities && Object.keys(result.statsOverUnderProbabilities).length > 0;
  const hasTableOU = !!result.tableOverUnderProbabilities && Object.keys(result.tableOverUnderProbabilities).length > 0;

  useEffect(() => {
    if (!hasCombinedOU && !hasStatsOU && !hasTableOU) return;
    if (overUnderTab === 'combined' && !hasCombinedOU) setOverUnderTab(hasStatsOU ? 'stats' : 'table');
    else if (overUnderTab === 'stats' && !hasStatsOU) setOverUnderTab(hasCombinedOU ? 'combined' : 'table');
    else if (overUnderTab === 'table' && !hasTableOU) setOverUnderTab(hasCombinedOU ? 'combined' : 'stats');
  }, [overUnderTab, hasCombinedOU, hasStatsOU, hasTableOU]);

  const displayProbability = useMemo(() => calculateSelectedBetsProbability(selectedBets, result.overUnderProbabilities) ?? primaryProb, [selectedBets, result.overUnderProbabilities, primaryProb]);
  const displayLabel = useMemo(() => {
    if (selectedBets.length === 1) return `${selectedBets[0].type === 'over' ? 'Over' : 'Under'} ${selectedBets[0].line}`;
    if (selectedBets.length === 2) return `${selectedBets[0].type === 'over' ? 'Over' : 'Under'} ${selectedBets[0].line} + ${selectedBets[1].type === 'over' ? 'Over' : 'Under'} ${selectedBets[1].line}`;
    return 'Over 1.5';
  }, [selectedBets]);

  const displayEv = useMemo(() => data.oddOver15 > 1 ? ((displayProbability / 100) * data.oddOver15 - 1) * 100 : result.ev, [displayProbability, data.oddOver15, result.ev]);
  const edgePp = useMemo(() => data.oddOver15 > 1 ? getEdgePp(displayProbability, data.oddOver15, 0.06) : null, [displayProbability, data.oddOver15]);
  const displayRiskLevel = useMemo(() => getRiskLevelFromProbability(displayProbability), [displayProbability]);

  const handleBetClick = (line: string, type: 'over' | 'under', probability: number) => {
    const newBet: SelectedBet = { line, type, probability };
    const isSelected = selectedBets.some(b => b.line === line && b.type === type);
    if (isSelected) {
      setSelectedBets(selectedBets.filter(b => !(b.line === line && b.type === type)));
    } else {
      if (selectedBets.length >= 2) return;
      if (selectedBets.some(b => b.type === type)) {
        setSelectedBets(selectedBets.map(b => b.type === type ? newBet : b));
      } else {
        setSelectedBets([...selectedBets, newBet]);
      }
    }
  };

  const isBetSelected = (line: string, type: 'over' | 'under') => selectedBets.some(b => b.line === line && b.type === type);

  return (
    <motion.div className="flex flex-col gap-6 md:gap-8" variants={animations.fadeInUp} initial="initial" animate="animate">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <motion.div className="lg:col-span-1" variants={animations.scaleIn} initial="initial" animate="animate">
          <ProbabilityGauge probability={primaryProb} selectedProbability={displayProbability} selectedLabel={displayLabel} odd={data.oddOver15} ev={displayEv} onOddChange={onOddChange} />
        </motion.div>
        <motion.div className="lg:col-span-2 card bg-base-100 shadow-sm border border-base-300/50 p-4 md:p-6" variants={animations.slideInRight} initial="initial" animate="animate">
          <div className="flex flex-col gap-4 md:gap-6">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight text-base-content">{data.homeTeam} <span className="text-primary/70 mx-1">vs</span> {data.awayTeam}</h3>
                  <p className="text-xs sm:text-sm font-semibold text-base-content/70 uppercase tracking-wide">Análise de Gols (Over/Under)</p>
                </div>
                <div className="flex flex-row sm:flex-col items-start sm:items-end gap-3 w-full sm:w-auto">
                    <div className={`badge badge-lg font-bold border-2 ${displayRiskLevel === 'Baixo' ? 'badge-success' : displayRiskLevel === 'Moderado' ? 'badge-warning' : 'badge-error'}`} title={`Risco: ${displayRiskLevel}`}>
                        <AlertCircle className="w-4 h-4 mr-2" /> {displayRiskLevel}
                    </div>
                    {onSave && <button onClick={() => onSave(selectedBets.length > 0 ? selectedBets : undefined)} className="btn btn-primary btn-md shadow-lg">Salvar Análise</button>}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard title={`Over ${selectedBets.find(b => b.type === 'over')?.line ?? '1.5'}`} value={`${result.overUnderProbabilities?.[selectedBets.find(b => b.type === 'over')?.line ?? '1.5']?.over.toFixed(1) ?? '-'}%`} icon={TrendingUp} color="success" />
                  <MetricCard title={`Under ${selectedBets.find(b => b.type === 'under')?.line ?? '1.5'}`} value={`${result.overUnderProbabilities?.[selectedBets.find(b => b.type === 'under')?.line ?? '1.5']?.under.toFixed(1) ?? '-'}%`} icon={TrendingDown} color="error" />
                  <MetricCard title="Ambas Marcam" value={result.bttsProbability != null ? `${result.bttsProbability.toFixed(1)}%` : '—'} icon={Sparkles} color="accent" />
                  <MetricCard title="Edge (pp)" value={edgePp == null ? '—' : `${edgePp >= 0 ? '+' : ''}${edgePp.toFixed(1)}pp`} icon={TrendingUp} color={edgePp == null ? 'warning' : edgePp >= 0 ? 'success' : 'error'} />
              </div>
              
              <div className="mt-4 p-4 card bg-base-200 border-l-4 border-primary/60">
                  <p className="text-sm italic text-base-content/90">"{result.recommendation}"</p>
              </div>
          </div>
        </motion.div>
      </div>

      {(hasCombinedOU || hasStatsOU || hasTableOU) && (
          <motion.div className="card bg-base-100 shadow-sm border border-base-300/50 p-4 md:p-6" variants={animations.fadeInUp} initial="initial" animate="animate">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-black text-base-content">Probabilidades Over/Under</h3>
                  <div className="tabs tabs-boxed tabs-sm">
                      {hasCombinedOU && <button onClick={() => setOverUnderTab('combined')} className={`tab ${overUnderTab === 'combined' ? 'tab-active' : ''}`}>Combinada</button>}
                      {hasStatsOU && <button onClick={() => setOverUnderTab('stats')} className={`tab ${overUnderTab === 'stats' ? 'tab-active' : ''}`}>Estatísticas</button>}
                      {hasTableOU && <button onClick={() => setOverUnderTab('table')} className={`tab ${overUnderTab === 'table' ? 'tab-active' : ''}`}>Tabela</button>}
                  </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {['0.5', '1.5', '2.5', '3.5', '4.5', '5.5'].map(line => {
                      const prob = overUnderTab === 'combined' ? result.overUnderProbabilities?.[line] : overUnderTab === 'stats' ? result.statsOverUnderProbabilities?.[line] : result.tableOverUnderProbabilities?.[line];
                      if (!prob) return null;
                      const isInteractive = overUnderTab === 'combined';
                      return (
                          <div key={line} className="card bg-base-200 p-3">
                              <div className="text-xs font-bold text-base-content/70 mb-2">Linha {line}</div>
                              <div onClick={isInteractive ? () => handleBetClick(line, 'over', prob.over) : undefined} className={`flex justify-between p-2 rounded-lg cursor-pointer ${isBetSelected(line, 'over') ? 'bg-success/20' : 'hover:bg-base-300/50'}`}>
                                  <span className="text-xs font-semibold text-success">Over</span>
                                  <span className="text-sm font-black text-base-content">{prob.over.toFixed(1)}%</span>
                              </div>
                              <div onClick={isInteractive ? () => handleBetClick(line, 'under', prob.under) : undefined} className={`flex justify-between p-2 rounded-lg cursor-pointer ${isBetSelected(line, 'under') ? 'bg-error/20' : 'hover:bg-base-300/50'}`}>
                                  <span className="text-xs font-semibold text-error">Under</span>
                                  <span className="text-sm font-black text-base-content">{prob.under.toFixed(1)}%</span>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </motion.div>
      )}

      {onBetSave && (
          <div className="card bg-base-100 shadow-sm border border-base-300/50 p-4 md:p-6">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-black text-base-content">Gerenciar Aposta</h3>
                  {!showBetManager && <button onClick={() => setShowBetManager(true)} className="btn btn-primary btn-sm">{betInfo?.betAmount > 0 ? 'Editar' : 'Apostar'}</button>}
              </div>
              {showBetManager ? (
                  <BetManager odd={data.oddOver15 || 0} probability={displayProbability} betInfo={betInfo} bankSettings={bankSettings} onSave={newBetInfo => { onBetSave(newBetInfo); setShowBetManager(false); }} onError={onError} onCancel={() => setShowBetManager(false)} />
              ) : betInfo?.betAmount > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div><div className="text-xs font-bold text-base-content/70">Status</div><div className={`badge ${betInfo.status === 'won' ? 'badge-success' : betInfo.status === 'lost' ? 'badge-error' : 'badge-warning'}`}>{betInfo.status}</div></div>
                      <div><div className="text-xs font-bold text-base-content/70">Apostado</div><div className="font-bold text-base-content">{getCurrencySymbol(bankSettings?.currency)}{betInfo.betAmount.toFixed(2)}</div></div>
                      <div><div className="text-xs font-bold text-base-content/70">Retorno</div><div className={`font-bold ${betInfo.status === 'won' ? 'text-success' : betInfo.status === 'lost' ? 'text-error' : 'text-primary'}`}>{betInfo.status === 'won' ? `+${betInfo.potentialProfit.toFixed(2)}` : betInfo.status === 'lost' ? `-${betInfo.betAmount.toFixed(2)}` : betInfo.potentialReturn.toFixed(2)}</div></div>
                  </div>
              ) : <p className="text-sm text-base-content/70">Nenhuma aposta registrada.</p>}
          </div>
      )}
    </motion.div>
  );
};

export default AnalysisDashboard;
