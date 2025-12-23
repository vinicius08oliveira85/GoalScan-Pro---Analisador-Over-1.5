
import React, { useState, useEffect } from 'react';
import { BankSettings } from '../types';
import { Wallet, Save, DollarSign } from 'lucide-react';

interface BankSettingsProps {
  bankSettings?: BankSettings;
  onSave: (settings: BankSettings) => void;
}

const BankSettings: React.FC<BankSettingsProps> = ({ bankSettings, onSave }) => {
  const [totalBank, setTotalBank] = useState<number>(bankSettings?.totalBank || 0);
  const [currency, setCurrency] = useState<string>(bankSettings?.currency || 'R$');

  useEffect(() => {
    if (bankSettings) {
      setTotalBank(bankSettings.totalBank);
      setCurrency(bankSettings.currency);
    }
  }, [bankSettings]);

  const handleSave = () => {
    if (totalBank <= 0) {
      alert('Por favor, insira um valor de banca válido.');
      return;
    }

    const newSettings: BankSettings = {
      totalBank,
      currency,
      updatedAt: Date.now()
    };

    onSave(newSettings);
  };

  return (
    <div className="custom-card p-6 bg-gradient-to-br from-secondary/10 to-accent/10 border border-secondary/20">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-5 h-5 text-secondary" />
        <h3 className="text-lg font-black uppercase">Configurações de Banca</h3>
      </div>

      <div className="space-y-4">
        {/* Valor da Banca */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-bold flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Banca Total
            </span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={totalBank || ''}
            onChange={(e) => setTotalBank(Number(e.target.value))}
            className="input input-bordered w-full"
            placeholder="Ex: 1000.00"
          />
          <label className="label">
            <span className="label-text-alt opacity-60">
              Capital total disponível para apostas
            </span>
          </label>
        </div>

        {/* Moeda */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-bold">Moeda</span>
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="select select-bordered w-full"
          >
            <option value="R$">R$ (Real Brasileiro)</option>
            <option value="$">$ (Dólar Americano)</option>
            <option value="€">€ (Euro)</option>
            <option value="£">£ (Libra Esterlina)</option>
          </select>
        </div>

        {/* Informações */}
        {bankSettings && bankSettings.totalBank > 0 && (
          <div className="bg-base-100/50 p-4 rounded-xl border border-white/5">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="opacity-60">Banca Atual:</span>
                <span className="font-bold text-lg">
                  {currency} {totalBank.toFixed(2)}
                </span>
              </div>
              {bankSettings.updatedAt && (
                <div className="flex justify-between text-xs opacity-50">
                  <span>Última atualização:</span>
                  <span>{new Date(bankSettings.updatedAt).toLocaleString('pt-BR')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botão Salvar */}
        <button
          onClick={handleSave}
          className="btn btn-secondary w-full flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Salvar Configurações
        </button>
      </div>
    </div>
  );
};

export default BankSettings;

