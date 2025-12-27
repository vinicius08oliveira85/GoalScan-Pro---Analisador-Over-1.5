import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, KeyRound, ShieldAlert, Trash2, Save, ArrowLeft } from 'lucide-react';
import { useAiSettings } from '../hooks/useAiSettings';

type Props = {
  onBack: () => void;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
};

function maskKey(key: string) {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}••••••••${trimmed.slice(-4)}`;
}

const SettingsScreen: React.FC<Props> = ({ onBack, onSuccess, onError }) => {
  const { loaded, geminiApiKey, hasGeminiApiKey, saveGeminiApiKey, clearGeminiApiKey } = useAiSettings();
  const [draftKey, setDraftKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    setDraftKey(geminiApiKey || '');
  }, [loaded, geminiApiKey]);

  const statusLabel = useMemo(() => {
    if (!loaded) return 'Carregando...';
    if (!hasGeminiApiKey) return 'Não configurada';
    return 'Configurada';
  }, [loaded, hasGeminiApiKey]);

  return (
    <div className="min-h-screen pb-12 md:pb-20">
      <header className="bg-base-200/80 backdrop-blur-md border-b border-base-300 py-3 md:py-4 mb-6 md:mb-8 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 md:px-4 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <button
              onClick={onBack}
              className="btn btn-sm btn-ghost gap-1 md:gap-2 hover:bg-base-300/50 flex-shrink-0"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center text-primary-content font-black italic text-lg md:text-xl shadow-lg flex-shrink-0">
              G
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-black tracking-tighter leading-none truncate">Configurações</h1>
              <span className="text-[9px] md:text-[10px] uppercase font-bold tracking-widest text-primary opacity-80 hidden sm:inline">
                Chaves e preferências do app
              </span>
            </div>
          </div>
          <span
            className={`badge badge-sm font-bold ${
              hasGeminiApiKey ? 'badge-success' : 'badge-ghost'
            }`}
            title={hasGeminiApiKey ? 'Chave IA configurada' : 'Sem chave IA'}
          >
            {statusLabel}
          </span>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <div className="custom-card p-5 md:p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 flex-shrink-0">
              <KeyRound className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black">Chave da IA (Gemini)</h2>
              <p className="text-sm opacity-70">
                Salve sua chave para habilitar a análise IA no app. Ela fica armazenada <b>apenas neste dispositivo</b>.
              </p>
            </div>
          </div>

          <div className="alert alert-warning mb-4">
            <ShieldAlert className="w-5 h-5" />
            <div className="min-w-0">
              <p className="text-sm font-bold">Atenção: a chave fica no navegador (localStorage).</p>
              <p className="text-xs opacity-80">
                Em apps web, isso não é segredo “à prova de vazamento”. Prefira restringir a chave no Google Cloud por domínio/referrer.
              </p>
            </div>
          </div>

          <div className="form-control">
            <label className="label" htmlFor="geminiApiKey">
              <span className="label-text font-bold">GEMINI API KEY</span>
              {hasGeminiApiKey && (
                <span className="label-text-alt opacity-60" title="Chave atual (mascarada)">
                  Atual: {maskKey(geminiApiKey)}
                </span>
              )}
            </label>

            <div className="join w-full">
              <input
                id="geminiApiKey"
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                type={showKey ? 'text' : 'password'}
                className="input input-bordered join-item w-full min-h-[44px]"
                placeholder="Cole sua chave aqui (ex.: AIza...)"
                autoComplete="off"
                inputMode="text"
                spellCheck={false}
              />
              <button
                type="button"
                className="btn join-item min-h-[44px]"
                onClick={() => setShowKey((s) => !s)}
                aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                title={showKey ? 'Ocultar' : 'Mostrar'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              className="btn btn-primary gap-2 min-h-[44px]"
              onClick={() => {
                try {
                  saveGeminiApiKey(draftKey);
                  if (onSuccess) onSuccess(draftKey.trim().length ? 'Chave IA salva com sucesso!' : 'Chave IA removida.');
                } catch (e) {
                  if (onError) onError('Não foi possível salvar a chave neste dispositivo.');
                }
              }}
            >
              <Save className="w-4 h-4" />
              Salvar
            </button>

            <button
              type="button"
              className="btn btn-outline btn-error gap-2 min-h-[44px]"
              onClick={() => {
                try {
                  clearGeminiApiKey();
                  setDraftKey('');
                  if (onSuccess) onSuccess('Chave IA removida.');
                } catch (e) {
                  if (onError) onError('Não foi possível remover a chave neste dispositivo.');
                }
              }}
              disabled={!hasGeminiApiKey && draftKey.trim().length === 0}
            >
              <Trash2 className="w-4 h-4" />
              Limpar
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SettingsScreen;

