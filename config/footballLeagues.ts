export interface FootballLeague {
  id: number;
  name: string;
  country: string;
  season: number;
  icon: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

function seasonForEuropean(): number {
  return CURRENT_MONTH >= 8 ? CURRENT_YEAR : CURRENT_YEAR - 1;
}

function seasonForBrazilian(): number {
  return CURRENT_YEAR;
}

export const FOOTBALL_LEAGUES: FootballLeague[] = [
  { id: 39, name: 'Premier League', country: 'England', season: seasonForEuropean(), icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 140, name: 'La Liga', country: 'Spain', season: seasonForEuropean(), icon: '🇪🇸' },
  { id: 78, name: 'Bundesliga', country: 'Germany', season: seasonForEuropean(), icon: '🇩🇪' },
  { id: 135, name: 'Serie A', country: 'Italy', season: seasonForEuropean(), icon: '🇮🇹' },
  { id: 61, name: 'Ligue 1', country: 'France', season: seasonForEuropean(), icon: '🇫🇷' },
  { id: 71, name: 'Série A', country: 'Brazil', season: seasonForBrazilian(), icon: '🇧🇷' },
];

export const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function getLeagueById(id: number): FootballLeague | undefined {
  return FOOTBALL_LEAGUES.find((l) => l.id === id);
}
