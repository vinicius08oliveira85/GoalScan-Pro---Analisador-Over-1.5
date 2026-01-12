import { useState, useEffect } from 'react';
import { getChampionshipName } from '../utils/championshipUtils';

/**
 * Hook para buscar o nome do campeonato a partir do ID
 */
export function useChampionshipName(championshipId: string | undefined): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!championshipId) {
      setName(null);
      return;
    }

    getChampionshipName(championshipId).then(setName);
  }, [championshipId]);

  return name;
}

