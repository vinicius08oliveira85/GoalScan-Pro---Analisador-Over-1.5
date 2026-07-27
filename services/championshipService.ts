export type {
  ChampionshipRow,
  ChampionshipTableRow,
  ChampionshipTeamRow,
} from './championshipCore';

export {
  loadChampionships,
  loadChampionship,
  saveChampionship,
  deleteChampionship,
  updateChampionshipUploadedAt,
} from './championshipCore';

export type {
  ChampionshipTablesDiagnostic,
} from './championshipDiagnostics';

export {
  checkChampionshipTablesAvailability,
} from './championshipDiagnostics';

export {
  loadChampionshipTables,
  saveChampionshipTable,
  deleteChampionshipTable,
  getSquadsFromTable,
  getTeamDataFromTable,
  calculateCompetitionAverageGoals,
  syncTeamStatsFromTable,
  detectChampionshipTableFormat,
  updateChampionshipTableFormat,
  saveChampionshipTeamsNormalized,
  loadChampionshipTeams,
} from './championshipTables';

export type {
  ChampionshipComplementRow,
} from './championshipComplement';

export {
  saveChampionshipComplement,
  loadChampionshipComplement,
  getComplementBySquad,
  calculateCompetitionComplementAverages,
} from './championshipComplement';
