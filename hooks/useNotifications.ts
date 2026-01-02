import { useState, useEffect, useCallback } from 'react';
import { SavedAnalysis } from '../types';
import {
  scheduleNotificationsForMatches,
  cancelNotification,
  restoreScheduledNotifications,
  getMatchesWithinNotificationWindow,
  requestNotificationPermission,
} from '../services/notificationService';

export const useNotifications = (savedMatches: SavedAnalysis[]) => {
  const [activeNotifications, setActiveNotifications] = useState<SavedAnalysis[]>([]);

  // Verificar notificações periodicamente
  useEffect(() => {
    const checkNotifications = () => {
      const matchesToNotify = getMatchesWithinNotificationWindow(savedMatches);

      setActiveNotifications((prev) => {
        // Filtrar apenas partidas que ainda não estão sendo exibidas
        const newNotifications = matchesToNotify.filter(
          (match) => !prev.some((n) => n.id === match.id)
        );

        // Combinar notificações existentes com novas
        const allNotifications = [...prev, ...newNotifications];

        // Remover notificações de partidas que já passaram
        return allNotifications.filter((match) => {
          const matchTimestamp =
            match.data.matchDate && match.data.matchTime
              ? new Date(`${match.data.matchDate}T${match.data.matchTime}:00`).getTime()
              : null;
          if (!matchTimestamp) return false;
          return matchTimestamp > Date.now();
        });
      });
    };

    // Verificar imediatamente
    checkNotifications();

    // Verificar a cada minuto
    const interval = setInterval(checkNotifications, 60000);

    return () => clearInterval(interval);
  }, [savedMatches]);

  // Agendar notificações quando partidas mudarem
  useEffect(() => {
    if (savedMatches.length > 0) {
      scheduleNotificationsForMatches(savedMatches);
    }
  }, [savedMatches]);

  // Solicitar permissão na primeira vez
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Restaurar notificações agendadas
  useEffect(() => {
    if (savedMatches.length > 0) {
      restoreScheduledNotifications(savedMatches);
    }
  }, [savedMatches]);

  const removeNotification = useCallback((matchId: string) => {
    setActiveNotifications((prev) => prev.filter((n) => n.id !== matchId));
  }, []);

  const cancelMatchNotification = useCallback((matchId: string) => {
    cancelNotification(matchId);
    setActiveNotifications((prev) => prev.filter((n) => n.id !== matchId));
  }, []);

  return {
    activeNotifications,
    removeNotification,
    cancelMatchNotification,
  };
};
