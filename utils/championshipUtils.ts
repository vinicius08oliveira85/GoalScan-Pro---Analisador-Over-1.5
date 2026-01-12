import { Championship } from '../types';
import { loadChampionships } from '../services/championshipService';

// Cache de campeonatos para evitar múltiplas requisições
let championshipsCache: Championship[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Carrega campeonatos com cache
 */
async function getChampionshipsCached(): Promise<Championship[]> {
  const now = Date.now();
  if (championshipsCache && now - cacheTimestamp < CACHE_DURATION) {
    return championshipsCache;
  }

  try {
    championshipsCache = await loadChampionships();
    cacheTimestamp = now;
    return championshipsCache;
  } catch (error) {
    // Se falhar, retornar cache antigo se existir
    if (championshipsCache) {
      return championshipsCache;
    }
    return [];
  }
}

/**
 * Busca o nome do campeonato a partir do ID
 */
export async function getChampionshipName(id: string | undefined): Promise<string | null> {
  if (!id) return null;

  try {
    const championships = await getChampionshipsCached();
    const championship = championships.find((c) => c.id === id);
    return championship?.nome || null;
  } catch (error) {
    return null;
  }
}

/**
 * Cria um mapa de ID -> Nome para acesso rápido
 */
export async function getChampionshipMap(): Promise<Map<string, string>> {
  try {
    const championships = await getChampionshipsCached();
    const map = new Map<string, string>();
    championships.forEach((c) => {
      map.set(c.id, c.nome);
    });
    return map;
  } catch (error) {
    return new Map();
  }
}

/**
 * Invalida o cache (útil quando um campeonato é adicionado/editado)
 */
export function invalidateChampionshipCache(): void {
  championshipsCache = null;
  cacheTimestamp = 0;
}

