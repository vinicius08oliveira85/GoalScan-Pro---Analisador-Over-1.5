import React, { useState } from 'react';
import { Clipboard, CheckCircle, AlertTriangle } from 'lucide-react';
import { TableRowGeral } from '../types';
import { parseChampionshipGeneralTable } from '../utils/championshipParser';

interface ChampionshipTablePasteAreaProps {
  onImport: (data: TableRowGeral[]) => void;
}

export const ChampionshipTablePasteArea: React.FC<ChampionshipTablePasteAreaProps> = ({ onImport }) => {
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleProcess = () => {
    setError(null);
    try {
      const data = parseChampionshipGeneralTable(pasteText);
      
      if (data.length > 0) {
        // Verifica se calculou os totais corretamente
        const sample = data[0];
        if (!sample.MP && (sample['Home MP'] || sample['Away MP'])) {
             setError('Aviso: Dados detectados, mas colunas de totais (MP, W, D, L) não puderam ser calculadas automaticamente. Verifique o formato.');
             onImport(data);
        } else {
             onImport(data);
             setShowPaste(false);
             setPasteText('');
        }
      } else {
        setError('Nenhum dado válido encontrado. Verifique se copiou a tabela corretamente (com cabeçalhos como Rk, Squad, Home MP, etc).');
      }
    } catch (err) {
      setError('Erro ao processar dados. Verifique o formato.');
      console.error(err);
    }
  };

  return (
    <div className="bg-base-200/50 p-4 rounded-xl border border-base-300 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">Importar Tabela Geral</span>
          <div className="tooltip" data-tip="Copie a tabela do Excel ou site (incluindo cabeçalhos) e cole aqui. O sistema calculará os totais (MP, W, D, L, etc.) somando Casa + Fora automaticamente.">
             <span className="text-xs opacity-60 cursor-help">(Copie e cole do Excel ou Web)</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowPaste(!showPaste)}
          className="btn btn-xs btn-ghost gap-1 text-primary"
        >
          <Clipboard className="w-3 h-3" />
          {showPaste ? 'Fechar' : 'Colar Dados'}
        </button>
      </div>

      {showPaste && (
        <div className="mt-2">
          <p className="text-xs opacity-60 mb-2">
            Cole a tabela completa abaixo (incluindo cabeçalhos como <strong>Rk, Squad, Home MP, Home W</strong>, etc.):
          </p>
          <textarea
            className="textarea textarea-bordered w-full text-xs font-mono min-h-[150px] mb-2"
            placeholder={`Exemplo:\nRk\tSquad\tHome MP\tHome W\tHome D...\n1\tArsenal\t11\t9\t2...`}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          
          {error && (
            <div className="alert alert-warning text-xs py-2 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button 
              type="button" 
              className="btn btn-sm btn-ghost" 
              onClick={() => {
                setShowPaste(false);
                setError(null);
              }}
            >
              Cancelar
            </button>
            <button 
              type="button" 
              className="btn btn-sm btn-primary" 
              onClick={handleProcess}
              disabled={!pasteText.trim()}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Processar Tabela
            </button>
          </div>
        </div>
      )}
    </div>
  );
};