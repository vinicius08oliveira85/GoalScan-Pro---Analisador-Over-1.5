/**
 * Utilitários para manipulação de moedas
 */

// Mapeamento de códigos ISO 4217 para símbolos
const CURRENCY_SYMBOLS: Record<string, string> = {
  BRL: 'R$',
  USD: '$',
  EUR: '€',
  GBP: '£'
};

// Mapeamento reverso: símbolos para códigos ISO
const SYMBOL_TO_CODE: Record<string, string> = {
  'R$': 'BRL',
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP'
};

/**
 * Converte código ISO 4217 para símbolo de moeda
 * @param code Código ISO (ex: BRL, USD)
 * @returns Símbolo da moeda (ex: R$, $)
 */
export function getCurrencySymbol(code: string): string {
  // Se já for um símbolo, retorna como está (compatibilidade)
  if (SYMBOL_TO_CODE[code]) {
    return code;
  }
  
  // Converte código ISO para símbolo
  return CURRENCY_SYMBOLS[code.toUpperCase()] || code;
}

/**
 * Converte símbolo de moeda para código ISO 4217
 * @param symbol Símbolo da moeda (ex: R$, $)
 * @returns Código ISO (ex: BRL, USD)
 */
export function getCurrencyCode(symbol: string): string {
  // Se já for um código ISO, retorna como está
  if (CURRENCY_SYMBOLS[symbol.toUpperCase()]) {
    return symbol.toUpperCase();
  }
  
  // Converte símbolo para código ISO
  return SYMBOL_TO_CODE[symbol] || 'BRL'; // Default para BRL
}

/**
 * Normaliza currency para código ISO 4217
 * Aceita tanto símbolos quanto códigos e retorna sempre código ISO
 * @param currency Símbolo ou código de moeda
 * @returns Código ISO 4217
 */
export function normalizeCurrency(currency: string): string {
  // Se já tiver 3 caracteres e for um código válido, retorna
  if (currency.length === 3 && CURRENCY_SYMBOLS[currency.toUpperCase()]) {
    return currency.toUpperCase();
  }
  
  // Tenta converter símbolo para código
  const code = getCurrencyCode(currency);
  return code;
}

/**
 * Formata valor monetário com símbolo
 * @param value Valor numérico
 * @param currency Código ISO ou símbolo de moeda
 * @param decimals Número de casas decimais (padrão: 2)
 * @returns String formatada (ex: "R$ 1.000,00")
 */
export function formatCurrency(value: number, currency: string, decimals: number = 2): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol} ${value.toFixed(decimals)}`;
}

