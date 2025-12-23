import { describe, it, expect } from 'vitest';
import { calculateBankUpdate } from '../../utils/bankCalculator';
import { BetInfo } from '../../types';

describe('calculateBankUpdate', () => {
  it('deve descontar valor quando aposta muda de undefined para pending', () => {
    const result = calculateBankUpdate(undefined, 'pending', 100, 200);
    expect(result).toBe(-100);
  });

  it('deve adicionar retorno total quando aposta muda de pending para won', () => {
    const result = calculateBankUpdate('pending', 'won', 100, 200);
    // Quando pending: impacto = -100 (descontou)
    // Quando won: adiciona o retorno total (200)
    // Como o desconto já foi aplicado quando pending, ao mudar para won
    // adicionamos apenas o retorno total para compensar e adicionar o lucro
    expect(result).toBe(200); // Retorno total (o desconto já foi aplicado anteriormente)
  });

  it('não deve alterar banca quando aposta muda de pending para lost', () => {
    const result = calculateBankUpdate('pending', 'lost', 100, 200);
    expect(result).toBe(0); // Já estava descontado
  });

  it('deve devolver valor quando aposta é cancelada', () => {
    const result = calculateBankUpdate('pending', 'cancelled', 100, 200);
    expect(result).toBe(100); // Devolve o valor apostado
  });
});

