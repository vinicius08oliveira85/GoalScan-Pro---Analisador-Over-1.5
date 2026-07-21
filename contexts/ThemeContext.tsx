import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type ThemeMode = 'light' | 'dark' | 'auto';
type ResolvedTheme = 'goalscan_glass' | 'goalscan_light';

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = 'goalscan_theme_mode';

const THEME_MAP: Record<ThemeMode, () => ResolvedTheme> = {
  light: () => 'goalscan_light',
  dark: () => 'goalscan_glass',
  auto: () =>
    window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'goalscan_light'
      : 'goalscan_glass',
};

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return THEME_MAP[mode]();
}

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
  } catch { /* ignore */ }
  return 'auto';
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'auto',
  resolved: 'goalscan_glass',
  setMode: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(mode));

  const applyTheme = useCallback((m: ThemeMode) => {
    const r = resolveTheme(m);
    setResolved(r);
    document.documentElement.setAttribute('data-theme', r);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch { /* ignore */ }
    applyTheme(m);
  }, [applyTheme]);

  // Apply on mount + listen for OS changes in auto mode
  useEffect(() => {
    applyTheme(mode);

    if (mode !== 'auto') return;

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => applyTheme('auto');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode, applyTheme]);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
