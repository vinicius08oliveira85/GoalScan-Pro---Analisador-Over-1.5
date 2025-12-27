import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'goalscan_gemini_api_key';

function safeRead(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return null;
    const trimmed = v.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function safeWrite(value: string) {
  localStorage.setItem(STORAGE_KEY, value);
}

function safeRemove() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useAiSettings() {
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const existing = safeRead();
    setGeminiApiKey(existing ?? '');
    setLoaded(true);
  }, []);

  const hasGeminiApiKey = useMemo(() => geminiApiKey.trim().length > 0, [geminiApiKey]);

  const saveGeminiApiKey = useCallback((key: string) => {
    const trimmed = key.trim();
    if (trimmed.length === 0) {
      safeRemove();
      setGeminiApiKey('');
      return;
    }
    safeWrite(trimmed);
    setGeminiApiKey(trimmed);
  }, []);

  const clearGeminiApiKey = useCallback(() => {
    safeRemove();
    setGeminiApiKey('');
  }, []);

  return {
    loaded,
    geminiApiKey,
    hasGeminiApiKey,
    saveGeminiApiKey,
    clearGeminiApiKey
  };
}

