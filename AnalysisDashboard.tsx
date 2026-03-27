import React from 'react';
import { AnalysisResult, MatchData } from '../types';
import { getRecommendation } from '../services/analysisEngine';
import ProbabilityGauge from './ProbabilityGauge';

interface Props {
  result: AnalysisResult;
  data: MatchData;
  currentOdd: number;
}

const AnalysisDashboard: React.FC<Props> = ({ result, data, currentOdd }) => {
  const recommendation = getRecommendation(result.expectedValue || 0);

  return (
    <div className="p-6 bg-base-100 rounded-xl shadow-xl">
      <h2 className="text-2xl font-bold mb-4">{data.homeTeam} vs {data.awayTeam}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="stat bg-base-200 rounded-box">
          <div className="stat-title">Valor Esperado (EV)</div>
          <div className={`stat-value ${recommendation.color}`}>
            {(result.expectedValue! * 100).toFixed(1)}%
          </div>
          <div className="stat-desc font-bold">{recommendation.label}</div>
        </div>

        <div className="stat bg-base-200 rounded-box">
          <div className="stat-title">Confiança IA</div>
          <div className="stat-value text-primary">{result.confidenceScore}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <ProbabilityGauge label="Over 0.5 HT" value={result.probabilities.over05HT} />
        <ProbabilityGauge label="Over 1.5 FT" value={result.probabilities.over15} />
        <ProbabilityGauge label="Over 2.5 FT" value={result.probabilities.over25} />
        <ProbabilityGauge label="Under 3.5 FT" value={result.probabilities.under35} />
        <ProbabilityGauge label="BTTS" value={result.probabilities.btts} />
      </div>

      <div className="mt-6 p-4 bg-primary/10 rounded-lg">
        <h3 className="font-bold text-lg mb-2">Justificativa Técnica:</h3>
        <p className="italic text-base-content/80">{result.justification}</p>
      </div>
    </div>
  );
};

export default AnalysisDashboard;