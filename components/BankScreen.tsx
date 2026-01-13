import React from 'react';
import type { BankSettings, SavedAnalysis } from '../types';
import { clampLeverage, formatMoneyPtBr } from '../utils/bankNumbers';
import { useBankTabState } from '../hooks/useBankTabState';

import LeverageProgressionTable from './LeverageProgressionTable';
import BankCurrentCard from './bank/BankCurrentCard';
import BankEditCard from './bank/BankEditCard';
import BankReconcileCard from './bank/BankReconcileCard';
import BankStatsGrid from './bank/BankStatsGrid';
import BankBiggestCards from './bank/BankBiggestCards';
import BankEvolutionChart from './bank/BankEvolutionChart';
import BankEmptyState from './bank/BankEmptyState';

interface BankScreenProps {
  bankSettings?: BankSettings;
  savedMatches: SavedAnalysis[];
  onSave: (settings: BankSettings) => Promise<void>;
  onError?: (message: string) => void;
}

const BankScreen: React.FC<BankScreenProps> = ({ bankSettings, savedMatches, onSave, onError }) => {
  const state = useBankTabState({ bankSettings, savedMatches, onSave, onError });

  const isSaveDisabled = state.totalBank <= 0 || state.validationState === 'invalid';
  const isSaveBaseDisabled = !bankSettings || state.bankBase === null;
  const isReconcileDisabled = !bankSettings || state.bankBase === null;

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8">
      <BankCurrentCard
        totalBank={state.totalBank}
        pendingExposure={state.bankStats.pendingExposure}
        totalBets={state.bankStats.totalBets}
        updatedAt={bankSettings?.updatedAt}
        formatMoney={formatMoneyPtBr}
      />

      <BankEditCard
        inputRef={state.inputRef}
        inputValue={state.inputValue}
        totalBank={state.totalBank}
        validationState={state.validationState}
        validationMessage={state.validationMessage}
        onInputChange={state.handleInputChange}
        onInputBlur={state.handleInputBlur}
        leverageInput={state.leverageInput}
        leverage={clampLeverage(state.leverage)}
        onLeverageChange={state.handleLeverageChange}
        onLeverageBlur={state.handleLeverageBlur}
        saveStatus={state.saveStatus}
        onSave={state.handleSave}
        isSaveDisabled={isSaveDisabled}
      />

      <BankReconcileCard
        netCashDelta={state.netCashDelta}
        pendingExposure={state.bankStats.pendingExposure}
        suggestedBase={state.suggestedBase}
        bankBaseInput={state.bankBaseInput}
        onBaseChange={state.handleBaseChange}
        onBaseBlur={state.handleBaseBlur}
        onUseSuggestedBase={state.handleUseSuggestedBase}
        onSaveBase={state.handleSaveBase}
        baseStatus={state.baseStatus}
        isSaveBaseDisabled={isSaveBaseDisabled}
        onReconcile={state.handleReconcile}
        reconcileStatus={state.reconcileStatus}
        isReconcileDisabled={isReconcileDisabled}
      />

      <LeverageProgressionTable savedMatches={savedMatches} />

      <BankStatsGrid bankStats={state.bankStats} />

      <BankBiggestCards biggestWin={state.bankStats.biggestWin} biggestLoss={state.bankStats.biggestLoss} />

      <BankEvolutionChart data={state.bankEvolutionData} />

      <BankEmptyState show={!bankSettings} />
    </div>
  );
};

export default BankScreen;


