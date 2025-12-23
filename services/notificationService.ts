import { SavedAnalysis } from '../types';

// Armazenar timeouts agendados
const scheduledNotifications: Map<string, NodeJS.Timeout> = new Map();
const NOTIFICATION_MINUTES_BEFORE = 5;

/**
 * Solicita permissão para notificações do navegador
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Este navegador não suporta notificações');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Calcula o timestamp da partida combinando matchDate e matchTime
 */
function getMatchTimestamp(matchDate?: string, matchTime?: string): number | null {
  if (!matchDate) return null;

  try {
    // Combinar data e hora
    const dateTimeString = matchTime 
      ? `${matchDate}T${matchTime}:00`
      : `${matchDate}T00:00:00`;
    
    const matchDateTime = new Date(dateTimeString);
    
    // Verificar se a data é válida
    if (isNaN(matchDateTime.getTime())) {
      return null;
    }

    return matchDateTime.getTime();
  } catch (error) {
    console.error('Erro ao calcular timestamp da partida:', error);
    return null;
  }
}

/**
 * Verifica se uma partida está dentro do intervalo de notificação (5 minutos antes)
 */
export function isMatchWithinNotificationWindow(match: SavedAnalysis): boolean {
  const matchTimestamp = getMatchTimestamp(match.data.matchDate, match.data.matchTime);
  if (!matchTimestamp) return false;

  const now = Date.now();
  const notificationTime = matchTimestamp - (NOTIFICATION_MINUTES_BEFORE * 60 * 1000);
  const matchStartTime = matchTimestamp;

  // Verificar se está entre o tempo de notificação e o início da partida
  return now >= notificationTime && now < matchStartTime;
}

/**
 * Verifica se uma partida é futura e precisa de notificação
 */
function shouldScheduleNotification(match: SavedAnalysis): boolean {
  const matchTimestamp = getMatchTimestamp(match.data.matchDate, match.data.matchTime);
  if (!matchTimestamp) return false;

  const now = Date.now();
  const notificationTime = matchTimestamp - (NOTIFICATION_MINUTES_BEFORE * 60 * 1000);

  // Só agendar se a notificação ainda não passou e a partida é futura
  return notificationTime > now;
}

/**
 * Agenda uma notificação do navegador para uma partida
 */
async function scheduleBrowserNotification(match: SavedAnalysis): Promise<void> {
  const matchTimestamp = getMatchTimestamp(match.data.matchDate, match.data.matchTime);
  if (!matchTimestamp) return;

  const now = Date.now();
  const notificationTime = matchTimestamp - (NOTIFICATION_MINUTES_BEFORE * 60 * 1000);
  const delay = notificationTime - now;

  if (delay <= 0) {
    // Já passou o tempo de notificação
    return;
  }

  // Cancelar notificação anterior se existir
  cancelNotification(match.id);

  const timeoutId = setTimeout(async () => {
    const hasPermission = await requestNotificationPermission();
    
    if (hasPermission) {
      const matchDateTime = new Date(matchTimestamp);
      const timeStr = matchDateTime.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      new Notification('Partida começando em breve! ⚽', {
        body: `${match.data.homeTeam} vs ${match.data.awayTeam}\nInício: ${timeStr}`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: `match-${match.id}`,
        requireInteraction: false,
        silent: false
      });

      // Remover do mapa após disparar
      scheduledNotifications.delete(match.id);
    }
  }, delay);

  scheduledNotifications.set(match.id, timeoutId);

  // Salvar no localStorage para persistência
  saveScheduledNotification(match.id, notificationTime);
}

/**
 * Salva informação da notificação agendada no localStorage
 */
function saveScheduledNotification(matchId: string, notificationTime: number): void {
  try {
    const scheduled = getScheduledNotifications();
    scheduled[matchId] = notificationTime;
    localStorage.setItem('goalscan_scheduled_notifications', JSON.stringify(scheduled));
  } catch (error) {
    console.error('Erro ao salvar notificação agendada:', error);
  }
}

/**
 * Obtém notificações agendadas do localStorage
 */
function getScheduledNotifications(): Record<string, number> {
  try {
    const stored = localStorage.getItem('goalscan_scheduled_notifications');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Erro ao ler notificações agendadas:', error);
    return {};
  }
}

/**
 * Remove notificação agendada do localStorage
 */
function removeScheduledNotification(matchId: string): void {
  try {
    const scheduled = getScheduledNotifications();
    delete scheduled[matchId];
    localStorage.setItem('goalscan_scheduled_notifications', JSON.stringify(scheduled));
  } catch (error) {
    console.error('Erro ao remover notificação agendada:', error);
  }
}

/**
 * Agenda notificações para todas as partidas que precisam
 */
export async function scheduleNotificationsForMatches(matches: SavedAnalysis[]): Promise<void> {
  // Limpar notificações antigas primeiro
  cleanupOldNotifications(matches);

  // Agendar novas notificações
  for (const match of matches) {
    if (shouldScheduleNotification(match)) {
      await scheduleBrowserNotification(match);
    }
  }
}

/**
 * Cancela uma notificação agendada
 */
export function cancelNotification(matchId: string): void {
  const timeoutId = scheduledNotifications.get(matchId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    scheduledNotifications.delete(matchId);
  }
  removeScheduledNotification(matchId);
}

/**
 * Cancela todas as notificações
 */
export function cancelAllNotifications(): void {
  scheduledNotifications.forEach((timeoutId) => {
    clearTimeout(timeoutId);
  });
  scheduledNotifications.clear();
  try {
    localStorage.removeItem('goalscan_scheduled_notifications');
  } catch (error) {
    console.error('Erro ao limpar notificações:', error);
  }
}

/**
 * Limpa notificações de partidas que já passaram ou não existem mais
 */
function cleanupOldNotifications(currentMatches: SavedAnalysis[]): void {
  const currentMatchIds = new Set(currentMatches.map(m => m.id));
  const scheduled = getScheduledNotifications();
  const now = Date.now();

  // Cancelar notificações de partidas que não existem mais
  Object.keys(scheduled).forEach(matchId => {
    if (!currentMatchIds.has(matchId)) {
      cancelNotification(matchId);
    }
  });

  // Cancelar notificações de partidas que já passaram
  currentMatches.forEach(match => {
    const matchTimestamp = getMatchTimestamp(match.data.matchDate, match.data.matchTime);
    if (matchTimestamp && matchTimestamp < now) {
      cancelNotification(match.id);
    }
  });
}

/**
 * Restaura notificações agendadas do localStorage (útil após reload)
 */
export async function restoreScheduledNotifications(matches: SavedAnalysis[]): Promise<void> {
  // Limpar todas as notificações atuais
  cancelAllNotifications();

  // Reagendar baseado nas partidas atuais
  await scheduleNotificationsForMatches(matches);
}

/**
 * Obtém partidas que estão dentro da janela de notificação (para notificação in-app)
 */
export function getMatchesWithinNotificationWindow(matches: SavedAnalysis[]): SavedAnalysis[] {
  return matches.filter(match => isMatchWithinNotificationWindow(match));
}

