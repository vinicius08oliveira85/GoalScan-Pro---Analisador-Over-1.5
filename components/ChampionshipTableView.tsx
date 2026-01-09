import React, { useState, useMemo } from 'react';
import { ChampionshipTable, TableRowGeral } from '../types';
import { Search, ArrowUpDown } from 'lucide-react';

interface ChampionshipTableViewProps {
  table: ChampionshipTable;
  onSquadSelect?: (squad: string) => void;
}

// Mapeamento de campos para PT-BR
const fieldTranslations: Record<string, string> = {
  Rk: 'Classificação',
  Squad: 'Equipe',
  MP: 'Partidas Jogadas',
  W: 'Vitórias',
  D: 'Empates',
  L: 'Derrotas',
  GF: 'Gols a Favor',
  GA: 'Gols Contra',
  GD: 'Saldo de Gols',
  Pts: 'Pontos',
  'Pts/MP': 'Pontos por Partida',
  xG: 'Gols Esperados',
  xGA: 'Gols Esperados Permitidos',
  xGD: 'Diferença de Gols Esperados',
  'xGD/90': 'Diferença de xG por 90 Minutos',
  'Last 5': 'Últimos 5 Jogos',
  Attendance: 'Público por Jogo',
  'Top Team Scorer': 'Artilheiro da Equipe',
  Goalkeeper: 'Goleiro',
  Notes: 'Observações',
};

// Campos que devem ser ocultos (links internos)
const hiddenFields = ['Top Team Scorer_link', 'Goalkeeper_link'];

const ChampionshipTableView: React.FC<ChampionshipTableViewProps> = ({
  table,
  onSquadSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Converter dados da tabela para array de linhas
  const rows = useMemo(() => {
    if (!table.table_data || !Array.isArray(table.table_data)) {
      return [];
    }
    return table.table_data as TableRowGeral[];
  }, [table.table_data]);

  // Obter colunas disponíveis (campos do primeiro registro)
  // Garantir que Squad seja sempre a primeira coluna (chave primária lógica)
  const columns = useMemo(() => {
    if (rows.length === 0) return [];
    const firstRow = rows[0];
    const allColumns = Object.keys(firstRow).filter((key) => !hiddenFields.includes(key));
    
    // Separar Squad das outras colunas
    const squadIndex = allColumns.indexOf('Squad');
    const otherColumns = allColumns.filter((col) => col !== 'Squad');
    
    // Retornar Squad primeiro, depois as outras colunas
    return squadIndex >= 0 ? ['Squad', ...otherColumns] : allColumns;
  }, [rows]);

  // Filtrar e ordenar linhas
  const filteredAndSortedRows = useMemo(() => {
    let filtered = rows;

    // Aplicar filtro de busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((row) => {
        return Object.values(row).some((value) =>
          String(value).toLowerCase().includes(term)
        );
      });
    }

    // Aplicar ordenação
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = (a as Record<string, unknown>)[sortField];
        const bValue = (b as Record<string, unknown>)[sortField];

        // Tentar converter para número se possível
        const aNum = parseFloat(String(aValue));
        const bNum = parseFloat(String(bValue));

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // Comparação de strings
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();

        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    return filtered;
  }, [rows, searchTerm, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSquadClick = (squad: string) => {
    if (onSquadSelect) {
      onSquadSelect(squad);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="custom-card p-6 text-center">
        <p className="text-base-content/60">Nenhum dado disponível nesta tabela.</p>
      </div>
    );
  }

  return (
    <div className="custom-card p-4 md:p-6">
      <div className="mb-4">
        <h3 className="text-xl font-bold mb-2">{table.table_name}</h3>
        <div className="form-control">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input
              type="text"
              placeholder="Buscar por equipe ou qualquer campo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-bordered w-full pl-10"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="cursor-pointer hover:bg-base-300 transition-colors"
                  onClick={() => handleSort(column)}
                >
                  <div className="flex items-center gap-2">
                    <span>{fieldTranslations[column] || column}</span>
                    {sortField === column && (
                      <ArrowUpDown
                        className={`w-4 h-4 ${sortDirection === 'asc' ? '' : 'rotate-180'}`}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedRows.map((row) => {
              // Usar Squad como chave primária (identificador único da linha)
              const squadKey = (row as Record<string, unknown>).Squad || `row-${Math.random()}`;
              return (
                <tr key={squadKey} className="hover:bg-base-200">
                  {columns.map((column) => {
                    const value = (row as Record<string, unknown>)[column];
                    const displayValue = value !== null && value !== undefined ? String(value) : '-';

                    // Se for a coluna Squad e houver callback, tornar clicável
                    if (column === 'Squad' && onSquadSelect) {
                      return (
                        <td key={column}>
                          <button
                            onClick={() => handleSquadClick(displayValue)}
                            className="btn btn-link btn-sm p-0 h-auto min-h-0 text-primary hover:text-primary-focus"
                          >
                            {displayValue}
                          </button>
                        </td>
                      );
                    }

                    return <td key={column}>{displayValue}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredAndSortedRows.length === 0 && searchTerm && (
        <div className="text-center py-8 text-base-content/60">
          Nenhum resultado encontrado para "{searchTerm}"
        </div>
      )}
    </div>
  );
};

export default ChampionshipTableView;

