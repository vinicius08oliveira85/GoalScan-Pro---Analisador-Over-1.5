import { ExternalSignals } from '../types';
import { fetchLineupsFromTheSportsDb } from './theSportsDbService';
import { fetchWeatherForMatch } from './weatherService';

/**
 * Orquestrador de sinais externos:
 * - TheSportsDB (lineups/venue)
 * - Open-Meteo (clima)
 *
 * Mantém a IA com um contrato único e fácil de evoluir.
 */
export async function getExternalSignals(input: {
  enabled: boolean;
  homeTeam: string;
  awayTeam: string;
  matchDate?: string;
  matchTime?: string;
}): Promise<ExternalSignals> {
  if (!input.enabled) {
    return {
      enabled: false,
      lineups: {
        status: 'disabled',
        provider: 'thesportsdb',
        eventId: null,
        lastUpdatedAt: Date.now(),
        error: null,
      },
      weather: {
        status: 'disabled',
        provider: 'open-meteo',
        matchDate: input.matchDate ?? null,
        matchTime: input.matchTime ?? null,
        pitchCondition: 'unknown',
        suggestedProbabilityDeltaPp: null,
        lastUpdatedAt: Date.now(),
        error: null,
      },
    };
  }

  const lineups = await fetchLineupsFromTheSportsDb({
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    matchDate: input.matchDate,
    matchTime: input.matchTime,
  });

  // Para clima, usamos venue/cidade quando disponível; fallback: nome do mandante (pode ajudar em alguns casos).
  const venueQuery =
    (lineups.venue?.name ? String(lineups.venue.name) : '') ||
    (lineups.venue?.city ? String(lineups.venue.city) : '') ||
    input.homeTeam;

  const weather = await fetchWeatherForMatch({
    query: venueQuery,
    matchDate: input.matchDate,
    matchTime: input.matchTime,
  });

  return { enabled: true, lineups, weather };
}


