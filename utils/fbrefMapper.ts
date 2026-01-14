import { TableRowGcaFor, TableRowGeral, TableRowPassingFor, TableRowStandardFor } from '../types';

/**
 * Normaliza nome de cabeçalho do fbref.com para formato esperado
 */
export function normalizeHeader(header: string): string {
  const headerLower = header.toLowerCase().trim();

  const mapping: Record<string, string> = {
    'rk': 'Rk',
    'rank': 'Rk',
    'squad': 'Squad',
    'team': 'Squad',
    'mp': 'MP',
    'matches played': 'MP',
    'w': 'W',
    'wins': 'W',
    'd': 'D',
    'draws': 'D',
    'l': 'L',
    'losses': 'L',
    'gf': 'GF',
    'goals for': 'GF',
    'ga': 'GA',
    'goals against': 'GA',
    'gd': 'GD',
    'goal difference': 'GD',
    'pts': 'Pts',
    'points': 'Pts',
    'pts/mp': 'Pts/MP',
    'pts / mp': 'Pts/MP',
    'points per match': 'Pts/MP',
    'xg': 'xG',
    'expected goals': 'xG',
    'xga': 'xGA',
    'expected goals against': 'xGA',
    'xgd': 'xGD',
    'expected goal difference': 'xGD',
    'xgd/90': 'xGD/90',
    'xgd /90': 'xGD/90',
    'xgd / 90': 'xGD/90',
    'last 5': 'Last 5',
    'last5': 'Last 5',
    'last five': 'Last 5',
    'attendance': 'Attendance',
    'top team scorer': 'Top Team Scorer',
    'top scorer': 'Top Team Scorer',
    'goalkeeper': 'Goalkeeper',
    'gk': 'Goalkeeper',
    'poss': 'Poss',
    'possession': 'Poss',
    'playing time mp': 'Playing Time MP',
    'progression prgp': 'Progression PrgP',
    'progression prgc': 'Progression PrgC',
    'per 90 minutes npxg+xag': 'Per 90 Minutes npxG+xAG',
    'per 90 minutes xg+xag': 'Per 90 Minutes xG+xAG',
  };

  if (mapping[headerLower]) {
    return mapping[headerLower];
  }

  // Capitalizar primeira letra de cada palavra
  return header
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Converte dados brutos extraídos do fbref.com para formato TableRowGeral
 */
export function mapToTableRowGeral(rawRow: Record<string, unknown>): TableRowGeral | null {
  // Garantir que há campo Squad
  if (!rawRow.Squad && !rawRow.squad) {
    return null;
  }

  const row: TableRowGeral = {
    Rk: String(rawRow.Rk || rawRow.rk || rawRow.Rank || rawRow.rank || ''),
    Squad: String(rawRow.Squad || rawRow.squad || ''),
    MP: String(rawRow.MP || rawRow.mp || ''),
    W: String(rawRow.W || rawRow.w || ''),
    D: String(rawRow.D || rawRow.d || ''),
    L: String(rawRow.L || rawRow.l || ''),
    GF: String(rawRow.GF || rawRow.gf || ''),
    GA: String(rawRow.GA || rawRow.ga || ''),
    GD: String(rawRow.GD || rawRow.gd || ''),
    Pts: String(rawRow.Pts || rawRow.pts || ''),
    'Pts/MP': String(rawRow['Pts/MP'] || rawRow['pts/mp'] || ''),
    xG: String(rawRow.xG || rawRow.xg || ''),
    xGA: String(rawRow.xGA || rawRow.xga || ''),
    xGD: String(rawRow.xGD || rawRow.xgd || ''),
    'xGD/90': String(rawRow['xGD/90'] || rawRow['xgd/90'] || ''),
    'Last 5': String(rawRow['Last 5'] || rawRow['last 5'] || rawRow['Last5'] || ''),
    Attendance: String(rawRow.Attendance || rawRow.attendance || ''),
    'Top Team Scorer': String(rawRow['Top Team Scorer'] || rawRow['top team scorer'] || ''),
    Goalkeeper: String(rawRow.Goalkeeper || rawRow.goalkeeper || ''),
    Notes: String(rawRow.Notes || rawRow.notes || ''),
  };

  // Adicionar campos opcionais se existirem
  if (rawRow['Top Team Scorer_link'] || rawRow['top team scorer_link']) {
    row['Top Team Scorer_link'] = String(rawRow['Top Team Scorer_link'] || rawRow['top team scorer_link']);
  }
  if (rawRow['Goalkeeper_link'] || rawRow['goalkeeper_link']) {
    row['Goalkeeper_link'] = String(rawRow['Goalkeeper_link'] || rawRow['goalkeeper_link']);
  }
  // Goalkeeper e Notes já são preenchidos com fallback acima (mantemos aqui apenas por compatibilidade)

  return row;
}

/**
 * Converte dados brutos extraídos do fbref.com para formato TableRowStandardFor
 */
export function mapToTableRowStandardFor(rawRow: Record<string, unknown>): TableRowStandardFor | null {
  // Garantir que há campo Squad
  if (!rawRow.Squad && !rawRow.squad) {
    return null;
  }

  const row: TableRowStandardFor = {
    Squad: String(rawRow.Squad || rawRow.squad || ''),
  };

  // Mapear campos opcionais
  if (rawRow.Poss || rawRow.poss) {
    row.Poss = String(rawRow.Poss || rawRow.poss);
  }
  if (rawRow['Playing Time MP'] || rawRow['playing time mp']) {
    row['Playing Time MP'] = String(rawRow['Playing Time MP'] || rawRow['playing time mp']);
  }
  if (rawRow['Progression PrgP'] || rawRow['progression prgp']) {
    row['Progression PrgP'] = String(rawRow['Progression PrgP'] || rawRow['progression prgp']);
  }
  if (rawRow['Progression PrgC'] || rawRow['progression prgc']) {
    row['Progression PrgC'] = String(rawRow['Progression PrgC'] || rawRow['progression prgc']);
  }
  if (rawRow['Per 90 Minutes npxG+xAG'] || rawRow['per 90 minutes npxg+xag']) {
    row['Per 90 Minutes npxG+xAG'] = String(
      rawRow['Per 90 Minutes npxG+xAG'] || rawRow['per 90 minutes npxg+xag']
    );
  } else if (rawRow['Per 90 Minutes xG+xAG'] || rawRow['per 90 minutes xg+xag']) {
    row['Per 90 Minutes xG+xAG'] = String(
      rawRow['Per 90 Minutes xG+xAG'] || rawRow['per 90 minutes xg+xag']
    );
  }

  // Adicionar outros campos dinamicamente
  Object.keys(rawRow).forEach((key) => {
    if (!row[key as keyof TableRowStandardFor]) {
      row[key] = rawRow[key];
    }
  });

  return row;
}

/**
 * Converte dados brutos extraídos do fbref.com para formato TableRowPassingFor
 * (apenas garante Squad e preserva colunas dinâmicas)
 */
export function mapToTableRowPassingFor(rawRow: Record<string, unknown>): TableRowPassingFor | null {
  const squad = String(rawRow.Squad || rawRow.squad || rawRow.Team || rawRow.team || '').trim();
  if (!squad) return null;

  const row: TableRowPassingFor = { Squad: squad };
  Object.keys(rawRow).forEach((key) => {
    if (key === 'squad' && !('Squad' in rawRow)) return;
    row[key] = rawRow[key];
  });
  return row;
}

/**
 * Converte dados brutos extraídos do fbref.com para formato TableRowGcaFor
 * (apenas garante Squad e preserva colunas dinâmicas)
 */
export function mapToTableRowGcaFor(rawRow: Record<string, unknown>): TableRowGcaFor | null {
  const squad = String(rawRow.Squad || rawRow.squad || rawRow.Team || rawRow.team || '').trim();
  if (!squad) return null;

  const row: TableRowGcaFor = { Squad: squad };
  Object.keys(rawRow).forEach((key) => {
    if (key === 'squad' && !('Squad' in rawRow)) return;
    row[key] = rawRow[key];
  });
  return row;
}

/**
 * Converte array de dados brutos para formato TableRowGeral[]
 */
export function mapToTableRowsGeral(rawData: unknown[]): TableRowGeral[] {
  return rawData
    .map((row) => {
      if (typeof row !== 'object' || row === null) {
        return null;
      }
      return mapToTableRowGeral(row as Record<string, unknown>);
    })
    .filter((row): row is TableRowGeral => row !== null);
}

/**
 * Converte array de dados brutos para formato TableRowStandardFor[]
 */
export function mapToTableRowsStandardFor(rawData: unknown[]): TableRowStandardFor[] {
  return rawData
    .map((row) => {
      if (typeof row !== 'object' || row === null) {
        return null;
      }
      return mapToTableRowStandardFor(row as Record<string, unknown>);
    })
    .filter((row): row is TableRowStandardFor => row !== null);
}

export function mapToTableRowsPassingFor(rawData: unknown[]): TableRowPassingFor[] {
  return rawData
    .map((row) => {
      if (typeof row !== 'object' || row === null) return null;
      return mapToTableRowPassingFor(row as Record<string, unknown>);
    })
    .filter((row): row is TableRowPassingFor => row !== null);
}

export function mapToTableRowsGcaFor(rawData: unknown[]): TableRowGcaFor[] {
  return rawData
    .map((row) => {
      if (typeof row !== 'object' || row === null) return null;
      return mapToTableRowGcaFor(row as Record<string, unknown>);
    })
    .filter((row): row is TableRowGcaFor => row !== null);
}

