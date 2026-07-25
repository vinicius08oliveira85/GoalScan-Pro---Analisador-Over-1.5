import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Globe, Upload, Clipboard, FileJson, Loader2, AlertTriangle, CheckCircle, Terminal } from 'lucide-react';
import type { Championship, ChampionshipTable, TableRowGeral, TableRowComplement } from '../types';
import { parseFbrefHtml, type FbrefScrapeResult } from '../services/fbrefScraper';
import { parseAndNormalizeLeagueStandingJson } from '../utils/leagueStandingJson';
import { detectTableFormatFromData } from '../utils/tableFormatDetector';

interface FbrefImportModalProps {
  onSave: (championship: Championship, tables: ChampionshipTable[]) => Promise<void>;
  onClose: () => void;
}

type ImportMode = 'url' | 'html' | 'json' | 'script';
type ImportStatus = 'idle' | 'parsing' | 'success' | 'error';

const EXAMPLE_URL = 'https://fbref.com/en/comps/24/2025/2025-Serie-A-Stats';

const FbrefImportModal: React.FC<FbrefImportModalProps> = ({ onSave, onClose }) => {
  const [mode, setMode] = useState<ImportMode>('script');
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FbrefScrapeResult | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [htmlText, setHtmlText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleParseHtml = (raw: string) => {
    setStatus('parsing');
    setError(null);
    try {
      const parsed = parseFbrefHtml(raw, EXAMPLE_URL);
      if (parsed.tableRows.length === 0) {
        throw new Error('Nenhuma tabela de classificação encontrada no HTML.');
      }
      setResult(parsed);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar HTML');
      setStatus('error');
    }
  };

  const handleParseJson = (raw: string) => {
    setStatus('parsing');
    setError(null);
    try {
      const data = JSON.parse(raw);

      if (data.tableRows && Array.isArray(data.tableRows)) {
        const parsed: FbrefScrapeResult = {
          championshipName: data.championshipName || 'Campeonato Importado',
          season: data.season || String(new Date().getFullYear()),
          fbrefUrl: data.fbrefUrl || '',
          tableRows: data.tableRows,
          complementRows: data.complementRows || [],
          tableFormat: data.tableFormat || 'basica',
        };
        setResult(parsed);
        setStatus('success');
        return;
      }

      if (Array.isArray(data)) {
        const normalized = parseAndNormalizeLeagueStandingJson(data);
        if (!normalized.ok) {
          throw new Error(normalized.error);
        }
        const parsed: FbrefScrapeResult = {
          championshipName: 'Campeonato Importado',
          season: String(new Date().getFullYear()),
          fbrefUrl: '',
          tableRows: normalized.rows,
          complementRows: [],
          tableFormat: detectTableFormatFromData(normalized.rows),
        };
        setResult(parsed);
        setStatus('success');
        return;
      }

      throw new Error('Formato JSON não reconhecido. Envie um array de linhas ou objeto com tableRows.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar JSON');
      setStatus('error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = (reader.result as string) || '';
      if (file.name.endsWith('.json')) {
        setJsonText(content);
        handleParseJson(content);
      } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        setHtmlText(content);
        handleParseHtml(content);
      } else {
        setError('Formato não suportado. Use .json ou .html');
        setStatus('error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      const championshipId = crypto.randomUUID();
      const championship: Championship = {
        id: championshipId,
        nome: result.championshipName,
        fbrefUrl: result.fbrefUrl || null,
        table_format: result.tableFormat,
      };

      const geralTable: ChampionshipTable = {
        id: crypto.randomUUID(),
        championship_id: championshipId,
        table_type: 'geral',
        table_name: 'Classificação Geral',
        table_data: result.tableRows,
      };

      const tables: ChampionshipTable[] = [geralTable];

      if (result.complementRows.length > 0) {
        const complementTable: ChampionshipTable = {
          id: crypto.randomUUID(),
          championship_id: championshipId,
          table_type: 'complement',
          table_name: 'Estatísticas por Squad',
          table_data: result.complementRows,
        };
        tables.push(complementTable);
      }

      await onSave(championship, tables);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: { key: ImportMode; label: string; icon: React.ReactNode }[] = [
    { key: 'script', label: 'CLI Script', icon: <Terminal className="h-4 w-4" /> },
    { key: 'json', label: 'Colar JSON', icon: <FileJson className="h-4 w-4" /> },
    { key: 'html', label: 'Colar HTML', icon: <Clipboard className="h-4 w-4" /> },
    { key: 'url', label: 'Upload Arquivo', icon: <Upload className="h-4 w-4" /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/55 p-3 backdrop-blur-md sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="max-h-[min(92dvh,90vh)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-base-100/92 shadow-2xl shadow-primary/15 ring-1 ring-white/10 backdrop-blur-2xl dark:bg-base-200/90"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-base-100/90 px-4 py-3 backdrop-blur-xl dark:bg-base-200/85 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-inner shadow-primary/20">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black sm:text-xl">Importar do FBref</h2>
              <p className="text-xs text-base-content/50">Classificação completa com Home/Away e xG</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-sm btn-circle btn-ghost" aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <div className="tabs tabs-boxed mb-4 bg-base-200/50 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`tab flex-1 gap-1.5 text-xs font-bold ${mode === tab.key ? 'tab-active' : ''}`}
                onClick={() => { setMode(tab.key); setStatus('idle'); setError(null); setResult(null); }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {mode === 'script' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-primary">
                  <Terminal className="h-4 w-4" />
                  Método recomendado: CLI Script
                </h3>
                <p className="mb-3 text-xs leading-relaxed text-base-content/70">
                  O script Node.js busca os dados diretamente do FBref com headers adequados, sem problemas de CORS.
                </p>
                <div className="rounded-xl bg-base-300/50 p-3 font-mono text-xs">
                  <p className="mb-1 text-base-content/50"># 1. Execute o script no terminal:</p>
                  <p className="font-bold text-primary">node scripts/fbref-import.mjs &gt; data/fbref.json</p>
                  <p className="mt-2 mb-1 text-base-content/50"># 2. Cole o JSON abaixo:</p>
                  <p className="text-base-content/70"># Ou faça upload do arquivo data/fbref.json</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-base-200/30 p-3">
                <p className="text-xs text-base-content/60">
                  <strong>URL padrão:</strong> {EXAMPLE_URL}
                </p>
                <p className="mt-1 text-xs text-base-content/60">
                  Para outro campeonato, passe a URL como argumento:
                </p>
                <code className="mt-1 block rounded-lg bg-base-300/50 p-2 font-mono text-[10px] text-primary">
                  node scripts/fbref-import.mjs https://fbref.com/en/comps/12/2025/2025-La-Liga-Stats
                </code>
              </div>

              <div className="flex items-center gap-2 text-xs text-base-content/50">
                <span>Cole o JSON gerado na aba</span>
                <span className="badge badge-sm badge-primary font-bold">Colar JSON</span>
              </div>
            </div>
          )}

          {mode === 'json' && (
            <div className="space-y-3">
              <textarea
                value={jsonText}
                onChange={(e) => { setJsonText(e.target.value); setResult(null); setStatus('idle'); setError(null); }}
                placeholder='[{"Squad":"Flamengo","MP":"38","W":"23",...}, ...]'
                className="textarea textarea-bordered h-40 w-full resize-none rounded-xl font-mono text-xs focus:border-primary"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm rounded-xl font-bold"
                  onClick={() => handleParseJson(jsonText)}
                  disabled={!jsonText.trim()}
                >
                  Processar JSON
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.html,.htm"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  className="btn btn-sm rounded-xl border border-white/10 bg-base-200/40 font-bold"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                </button>
              </div>
            </div>
          )}

          {mode === 'html' && (
            <div className="space-y-3">
              <p className="text-xs text-base-content/50">
                Cole o HTML completo da página FBref. Copie via <kbd className="kbd kbd-xs">Ctrl+A</kbd> → <kbd className="kbd kbd-xs">Ctrl+C</kbd> no navegador.
              </p>
              <textarea
                value={htmlText}
                onChange={(e) => { setHtmlText(e.target.value); setResult(null); setStatus('idle'); setError(null); }}
                  placeholder={'<table id="results2025241_overall">...'}
                className="textarea textarea-bordered h-40 w-full resize-none rounded-xl font-mono text-xs focus:border-primary"
              />
              <button
                type="button"
                className="btn btn-primary btn-sm rounded-xl font-bold"
                onClick={() => handleParseHtml(htmlText)}
                disabled={!htmlText.trim()}
              >
                Processar HTML
              </button>
            </div>
          )}

          {mode === 'url' && (
            <div className="space-y-3">
              <p className="text-xs text-base-content/50">
                Faça upload de um arquivo <strong>.json</strong> (exportado pelo script) ou <strong>.html</strong> (página FBref salva).
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.html,.htm"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="btn btn-primary gap-2 rounded-xl font-bold"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Selecionar arquivo
              </button>
            </div>
          )}

          {status === 'parsing' && (
            <div className="mt-4 flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processando...
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {status === 'success' && result && (
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-bold">{result.championshipName}</p>
                  <p className="text-xs opacity-80">
                    {result.tableRows.length} times | Formato: {result.tableFormat} |{' '}
                    {result.complementRows.length} dados complementares
                  </p>
                </div>
              </div>

              <div className="max-h-48 overflow-auto rounded-xl border border-white/10">
                <table className="table table-xs w-full">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase">
                      <th>#</th>
                      <th>Time</th>
                      <th>MP</th>
                      <th>W</th>
                      <th>D</th>
                      <th>L</th>
                      <th>GF</th>
                      <th>GA</th>
                      <th>Pts</th>
                      <th>xG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.tableRows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="text-xs">
                        <td>{row.Rk}</td>
                        <td className="font-bold">{row.Squad}</td>
                        <td>{(row as Record<string, unknown>)['MP'] as string || '-'}</td>
                        <td>{(row as Record<string, unknown>)['W'] as string || '-'}</td>
                        <td>{(row as Record<string, unknown>)['D'] as string || '-'}</td>
                        <td>{(row as Record<string, unknown>)['L'] as string || '-'}</td>
                        <td>{(row as Record<string, unknown>)['GF'] as string || '-'}</td>
                        <td>{(row as Record<string, unknown>)['GA'] as string || '-'}</td>
                        <td className="font-bold">{(row as Record<string, unknown>)['Pts'] as string || '-'}</td>
                        <td>{(row as Record<string, unknown>)['xG'] as string || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-block gap-2 rounded-2xl font-black shadow-lg shadow-primary/25"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                {isSaving ? 'Salvando...' : `Salvar ${result.championshipName}`}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default FbrefImportModal;
