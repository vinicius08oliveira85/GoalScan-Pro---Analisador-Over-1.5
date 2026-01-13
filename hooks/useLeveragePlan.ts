import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LeverageProgressionRow } from '../types';
import { calculateLeverageProgressionWithVariableOdds } from '../utils/leverageProgression';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'goalscan_leverage_plan';

export type LeveragePlan = {
  days: number;
  initialInvestment: number;
  defaultOdd: number;
  oddsByDay: number[]; // tamanho === days
  updatedAt: number;
};

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.trunc(clampNumber(value, min, max));
}

function buildDefaultPlan(): LeveragePlan {
  const days = 15;
  const defaultOdd = 1.3;
  return {
    days,
    initialInvestment: 5,
    defaultOdd,
    oddsByDay: new Array(days).fill(defaultOdd),
    updatedAt: Date.now(),
  };
}

function normalizeOddsArray(
  rawOdds: unknown,
  days: number,
  defaultOdd: number
): number[] {
  const base = Array.isArray(rawOdds) ? rawOdds : [];
  const normalized: number[] = new Array(days).fill(defaultOdd);

  for (let i = 0; i < days; i++) {
    const v = Number(base[i]);
    if (Number.isFinite(v) && v >= 1.01 && v <= 50) {
      normalized[i] = v;
    }
  }

  return normalized;
}

function normalizePlan(raw: unknown): LeveragePlan {
  const fallback = buildDefaultPlan();
  if (!raw || typeof raw !== 'object') return fallback;

  const obj = raw as Partial<LeveragePlan> & { oddsByDay?: unknown };

  const days = clampInt(Number(obj.days ?? fallback.days), 1, 30);
  const defaultOdd = clampNumber(Number(obj.defaultOdd ?? fallback.defaultOdd), 1.01, 50);
  const initialInvestment = clampNumber(Number(obj.initialInvestment ?? fallback.initialInvestment), 0.01, 1_000_000);
  const oddsByDay = normalizeOddsArray(obj.oddsByDay, days, defaultOdd);

  return {
    days,
    defaultOdd,
    initialInvestment,
    oddsByDay,
    updatedAt: Number.isFinite(Number(obj.updatedAt)) ? Number(obj.updatedAt) : Date.now(),
  };
}

function readPlanFromStorage(): LeveragePlan {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return buildDefaultPlan();
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return buildDefaultPlan();
    return normalizePlan(JSON.parse(stored));
  } catch (e) {
    logger.warn('[useLeveragePlan] Erro ao ler plano do localStorage:', e);
    return buildDefaultPlan();
  }
}

function writePlanToStorage(plan: LeveragePlan): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch (e) {
    logger.warn('[useLeveragePlan] Erro ao salvar plano no localStorage:', e);
  }
}

// Store simples (singleton) para manter o plano sincronizado entre múltiplos componentes
let cachedPlan: LeveragePlan = readPlanFromStorage();
const listeners = new Set<(plan: LeveragePlan) => void>();

function emitPlan(plan: LeveragePlan) {
  for (const listener of listeners) {
    try {
      listener(plan);
    } catch (e) {
      logger.warn('[useLeveragePlan] Listener falhou:', e);
    }
  }
}

function setPlan(updater: (prev: LeveragePlan) => LeveragePlan) {
  const next = normalizePlan(updater(cachedPlan));
  cachedPlan = next;
  writePlanToStorage(next);
  emitPlan(next);
}

export type UseLeveragePlanResult = {
  plan: LeveragePlan;
  progression: LeverageProgressionRow[];
  setDays: (days: number) => void;
  setInitialInvestment: (value: number) => void;
  setDefaultOdd: (odd: number) => void;
  setOddForDay: (day: number, odd: number) => void;
  setOddsByDay: (odds: number[]) => void;
  resetOddsToDefault: () => void;
  getInvestmentForDay: (day: number) => number | null;
};

export function useLeveragePlan(): UseLeveragePlanResult {
  const [plan, setPlanState] = useState<LeveragePlan>(() => cachedPlan);

  useEffect(() => {
    const listener = (p: LeveragePlan) => setPlanState(p);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const progression = useMemo(() => {
    return calculateLeverageProgressionWithVariableOdds(
      plan.initialInvestment,
      plan.oddsByDay,
      plan.days
    );
  }, [plan.days, plan.initialInvestment, plan.oddsByDay]);

  const setDays = useCallback((daysRaw: number) => {
    setPlan((prev) => {
      const nextDays = clampInt(Number(daysRaw), 1, 30);
      if (nextDays === prev.days) return prev;

      const nextOddsByDay =
        nextDays > prev.days
          ? [...prev.oddsByDay, ...new Array(nextDays - prev.days).fill(prev.defaultOdd)]
          : prev.oddsByDay.slice(0, nextDays);

      return {
        ...prev,
        days: nextDays,
        oddsByDay: normalizeOddsArray(nextOddsByDay, nextDays, prev.defaultOdd),
        updatedAt: Date.now(),
      };
    });
  }, []);

  const setInitialInvestment = useCallback((value: number) => {
    setPlan((prev) => ({
      ...prev,
      initialInvestment: clampNumber(Number(value), 0.01, 1_000_000),
      updatedAt: Date.now(),
    }));
  }, []);

  const setDefaultOdd = useCallback((oddRaw: number) => {
    setPlan((prev) => {
      const nextDefaultOdd = clampNumber(Number(oddRaw), 1.01, 50);
      if (nextDefaultOdd === prev.defaultOdd) return prev;

      // Mantém comportamento anterior: ao mudar a odd padrão, reseta a lista diária
      return {
        ...prev,
        defaultOdd: nextDefaultOdd,
        oddsByDay: new Array(prev.days).fill(nextDefaultOdd),
        updatedAt: Date.now(),
      };
    });
  }, []);

  const setOddForDay = useCallback((dayRaw: number, oddRaw: number) => {
    setPlan((prev) => {
      const day = clampInt(Number(dayRaw), 1, prev.days);
      const odd = clampNumber(Number(oddRaw), 1.01, 50);
      const idx = day - 1;
      if (prev.oddsByDay[idx] === odd) return prev;

      const nextOdds = [...prev.oddsByDay];
      nextOdds[idx] = odd;
      return {
        ...prev,
        oddsByDay: normalizeOddsArray(nextOdds, prev.days, prev.defaultOdd),
        updatedAt: Date.now(),
      };
    });
  }, []);

  const setOddsByDay = useCallback((oddsRaw: number[]) => {
    setPlan((prev) => {
      const nextOdds = normalizeOddsArray(oddsRaw, prev.days, prev.defaultOdd);
      const isSame =
        nextOdds.length === prev.oddsByDay.length &&
        nextOdds.every((v, i) => v === prev.oddsByDay[i]);
      if (isSame) return prev;
      return {
        ...prev,
        oddsByDay: nextOdds,
        updatedAt: Date.now(),
      };
    });
  }, []);

  const resetOddsToDefault = useCallback(() => {
    setPlan((prev) => ({
      ...prev,
      oddsByDay: new Array(prev.days).fill(prev.defaultOdd),
      updatedAt: Date.now(),
    }));
  }, []);

  const getInvestmentForDay = useCallback(
    (dayRaw: number): number | null => {
      const day = clampInt(Number(dayRaw), 1, plan.days);
      const row = progression.find((r) => r.day === day);
      return row ? row.investment : null;
    },
    [plan.days, progression]
  );

  return {
    plan,
    progression,
    setDays,
    setInitialInvestment,
    setDefaultOdd,
    setOddForDay,
    setOddsByDay,
    resetOddsToDefault,
    getInvestmentForDay,
  };
}


