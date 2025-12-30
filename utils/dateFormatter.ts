/**
 * Utilitários para formatação de datas e horários no fuso horário de Brasília
 * Fuso: America/Sao_Paulo (UTC-3)
 */

const BRASILIA_TIMEZONE = 'America/Sao_Paulo';

/**
 * Converte uma string de data/hora para Date assumindo que está no fuso de Brasília
 * @param date - Data no formato YYYY-MM-DD
 * @param time - Hora no formato HH:mm (opcional)
 * @returns Date object (em UTC, representando o momento em Brasília)
 */
export function getMatchDateInBrasilia(date: string, time?: string): Date {
  const timeStr = time || '00:00';
  const [hours, minutes] = timeStr.split(':').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  
  // Criar Date assumindo que a data/hora está no fuso de Brasília
  // Brasília é UTC-3, então precisamos converter para UTC
  // Se temos 15:00 em Brasília, isso corresponde a 18:00 UTC
  // Mas precisamos considerar que Date.UTC cria em UTC, então:
  // Para representar 15:00 em Brasília (UTC-3), precisamos de 18:00 UTC
  const utcHours = hours + 3; // Adicionar 3 horas para converter Brasília -> UTC
  const utcDate = new Date(Date.UTC(year, month - 1, day, utcHours, minutes, 0));
  
  return utcDate;
}

/**
 * Formata uma Date para o fuso de Brasília
 * @param date - Date object
 * @param options - Opções de formatação do Intl.DateTimeFormat
 * @returns String formatada no fuso de Brasília
 */
export function formatDateInBrasilia(
  date: Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: BRASILIA_TIMEZONE,
    ...options
  };
  
  return new Intl.DateTimeFormat('pt-BR', defaultOptions).format(date);
}

/**
 * Formata apenas a data de uma partida no fuso de Brasília
 * @param date - Data no formato YYYY-MM-DD
 * @param time - Hora no formato HH:mm (opcional, usado para criar Date completo)
 * @param options - Opções de formatação (padrão: day: '2-digit', month: 'short')
 * @returns String formatada da data
 */
export function formatMatchDate(
  date: string,
  time?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const matchDate = getMatchDateInBrasilia(date, time);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    timeZone: BRASILIA_TIMEZONE,
    ...options
  };
  
  return formatDateInBrasilia(matchDate, defaultOptions);
}

/**
 * Formata apenas o horário de uma partida no fuso de Brasília
 * @param date - Data no formato YYYY-MM-DD
 * @param time - Hora no formato HH:mm
 * @returns String formatada do horário (HH:mm)
 */
export function formatMatchTime(date: string, time: string): string {
  const matchDate = getMatchDateInBrasilia(date, time);
  return formatDateInBrasilia(matchDate, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BRASILIA_TIMEZONE
  });
}

/**
 * Formata data e horário juntos de uma partida no fuso de Brasília
 * @param date - Data no formato YYYY-MM-DD
 * @param time - Hora no formato HH:mm (opcional)
 * @returns String formatada da data e horário
 */
export function formatMatchDateTime(date: string, time?: string): string {
  const matchDate = getMatchDateInBrasilia(date, time);
  return formatDateInBrasilia(matchDate, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BRASILIA_TIMEZONE
  });
}

/**
 * Formata um timestamp para o fuso de Brasília
 * @param timestamp - Timestamp em milissegundos
 * @param options - Opções de formatação
 * @returns String formatada no fuso de Brasília
 */
export function formatTimestampInBrasilia(
  timestamp: number,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = new Date(timestamp);
  return formatDateInBrasilia(date, options);
}

/**
 * Converte uma string de data/hora para Date considerando que está no fuso de Brasília
 * Alias para getMatchDateInBrasilia para manter compatibilidade
 */
export function parseBrasiliaDateTime(date: string, time?: string): Date {
  return getMatchDateInBrasilia(date, time);
}

