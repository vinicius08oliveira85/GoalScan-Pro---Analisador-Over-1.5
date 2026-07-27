export interface FootballLeague {
  id: number;
  name: string;
  country: string;
  season: number;
  icon: string;
}

export const FOOTBALL_LEAGUES: FootballLeague[] = [
  { id: 39, name: 'Premier League', country: 'England', season: 2025, icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 140, name: 'La Liga', country: 'Spain', season: 2025, icon: '🇪🇸' },
  { id: 78, name: 'Bundesliga', country: 'Germany', season: 2025, icon: '🇩🇪' },
  { id: 135, name: 'Serie A', country: 'Italy', season: 2025, icon: '🇮🇹' },
  { id: 61, name: 'Ligue 1', country: 'France', season: 2025, icon: '🇫🇷' },
  { id: 71, name: 'Série A', country: 'Brazil', season: 2026, icon: '🇧🇷' },
];

export const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function getLeagueById(id: number): FootballLeague | undefined {
  return FOOTBALL_LEAGUES.find((l) => l.id === id);
}
