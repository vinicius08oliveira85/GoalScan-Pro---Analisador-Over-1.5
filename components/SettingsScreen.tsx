import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Settings, Bell, Moon, Sun, Info, Shield, Database, Sparkles, Download, Upload, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { animations } from '../utils/animations';
import { useTheme } from '../contexts/ThemeContext';
import { exportAllData, downloadJson } from '../services/exportService';
import { importFromFile } from '../services/importService';
import type { ImportResult } from '../services/importService';

const SettingsScreen: React.FC = () => {
  const { mode: theme, setMode: setTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);

  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportAllData();
      downloadJson(data);
    } catch (e) {
      console.error('Erro ao exportar:', e);
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingFileRef.current = file;
    setConfirmImport(true);
    setImportResult(null);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    const file = pendingFileRef.current;
    if (!file) return;
    setConfirmImport(false);
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importFromFile(file);
      setImportResult(result);
    } catch (e) {
      setImportResult({
        success: false,
        message: e instanceof Error ? e.message : 'Erro desconhecido ao importar.',
        details: { championships: 0, tables: 0, teams: 0, complement: 0, analyses: 0, bankSettings: 0, transactions: 0, localStorageKeys: 0 },
      });
    } finally {
      setImporting(false);
      pendingFileRef.current = null;
    }
  };

  const handleCancelImport = () => {
    setConfirmImport(false);
    pendingFileRef.current = null;
  };

  const settingsSections = [
    {
      id: 'notifications',
      title: 'Notificações',
      icon: Bell,
      description: 'Gerencie suas preferências de notificações',
      items: [
        {
          id: 'notifications-toggle',
          label: 'Ativar Notificações',
          description: 'Receba alertas sobre suas partidas e apostas',
          type: 'toggle' as const,
          value: notificationsEnabled,
          onChange: setNotificationsEnabled,
        },
      ],
    },
    {
      id: 'appearance',
      title: 'Aparência',
      icon: isDark ? Moon : Sun,
      description: 'Personalize a aparência do aplicativo',
      items: [
        {
          id: 'theme-select',
          label: 'Tema',
          description: 'Escolha o tema do aplicativo',
          type: 'select' as const,
          value: theme,
          onChange: setTheme,
          options: [
            { value: 'light', label: 'Claro' },
            { value: 'dark', label: 'Escuro' },
            { value: 'auto', label: 'Automático' },
          ],
        },
      ],
    },
    {
      id: 'data',
      title: 'Dados',
      icon: Database,
      description: 'Exportar e importar todos os dados do aplicativo',
      items: [
        {
          id: 'export-data',
          label: 'Exportar Dados',
          description: 'Baixar backup completo em JSON (campeonatos, tabelas, análises, apostas, banca)',
          type: 'action' as const,
          action: handleExport,
          loading: exporting,
          icon: Download,
          color: 'primary' as const,
        },
        {
          id: 'import-data',
          label: 'Importar Dados',
          description: 'Restaurar dados de um backup JSON anterior',
          type: 'action' as const,
          action: () => fileInputRef.current?.click(),
          loading: importing,
          icon: Upload,
          color: 'secondary' as const,
        },
      ],
    },
    {
      id: 'about',
      title: 'Sobre o App',
      icon: Info,
      description: 'Informações sobre o GoalScan Pro',
      items: [
        {
          id: 'version',
          label: 'Versão',
          description: 'v3.9.0',
          type: 'info' as const,
        },
      ],
    },
  ];

  return (
    <div className="space-y-5 md:space-y-6 pb-20 md:pb-8">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Header */}
      <motion.div
        variants={animations.fadeInUp}
        initial="initial"
        animate="animate"
        className="flex items-center gap-4"
      >
        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/10">
          <Settings className="w-6 h-6 md:w-7 md:h-7 text-primary" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tight">
            <span className="text-gradient">Configuracoes</span>
          </h2>
          <p className="text-xs md:text-sm text-base-content/50">Personalize sua experiencia</p>
        </div>
      </motion.div>

      {/* Import Confirmation Dialog */}
      {confirmImport && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-2xl border-2 border-warning/30 bg-warning/5 p-4 md:p-5"
        >
          <div className="orb-warning absolute -top-16 -right-16 h-40 w-40" />
          <div className="flex items-start gap-3 relative z-10">
            <AlertTriangle className="w-6 h-6 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-sm md:text-base">Confirmar Importacao</h4>
              <p className="text-xs md:text-sm text-base-content/60 mt-1">
                Isso importara todos os dados do backup para o Supabase e localStorage.
                Dados existentes com o mesmo ID serao substituidos.
              </p>
              {pendingFileRef.current && (
                <p className="text-[10px] md:text-xs text-base-content/40 mt-2">
                  Arquivo: {pendingFileRef.current.name} ({(pendingFileRef.current.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4 relative z-10">
            <button onClick={handleCancelImport} className="btn btn-ghost btn-sm">
              Cancelar
            </button>
            <button onClick={handleConfirmImport} className="btn btn-warning btn-sm gap-2">
              <Upload className="w-4 h-4" />
              Importar
            </button>
          </div>
        </motion.div>
      )}

      {/* Import Result */}
      {importResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative overflow-hidden rounded-2xl border p-4 md:p-5 ${
            importResult.success
              ? 'border-success/30 bg-success/5'
              : 'border-error/30 bg-error/5'
          }`}
        >
          <div className={`absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl pointer-events-none ${
            importResult.success ? 'bg-success/10' : 'bg-error/10'
          }`} />
          <div className="flex items-start gap-3 relative z-10">
            {importResult.success ? (
              <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">
                    {importResult.success ? 'Importacao Concluida' : 'Erro na Importacao'}
                  </p>
                  <p className="text-xs text-base-content/50 mt-0.5">{importResult.message}</p>
                </div>
                <button onClick={() => setImportResult(null)} className="btn btn-ghost btn-xs shrink-0">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              {importResult.success && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                  {[
                    { label: 'Campeonatos', value: importResult.details.championships },
                    { label: 'Tabelas', value: importResult.details.tables },
                    { label: 'Analises', value: importResult.details.analyses },
                    { label: 'Chaves Locais', value: importResult.details.localStorageKeys },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-base-300/30 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-base-content/40 uppercase tracking-wider">{label}</p>
                      <p className="text-sm md:text-base font-black tabular-nums mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Settings Sections */}
      {settingsSections.map((section, sectionIndex) => {
        const Icon = section.icon;
        return (
          <motion.div
            key={section.id}
            variants={animations.fadeInUp}
            initial="initial"
            animate="animate"
            custom={sectionIndex}
            className="relative overflow-hidden rounded-2xl border border-base-300/50 bg-base-200/80 p-4 md:p-5 border-l-4 border-l-primary/40"
          >
            <div className="absolute -top-16 -right-16 h-36 w-36 rounded-full bg-primary/6 blur-3xl pointer-events-none" />
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <Icon className="w-4 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-black">{section.title}</h3>
                <p className="text-[10px] md:text-xs text-base-content/40">{section.description}</p>
              </div>
            </div>

            <div className="space-y-2 relative z-10">
              {section.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 md:p-4 rounded-xl bg-base-300/30 border border-base-300/30 hover:border-base-300/50 transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="font-semibold text-xs md:text-sm">{item.label}</p>
                    {item.description && <p className="text-[10px] md:text-xs text-base-content/40 mt-0.5">{item.description}</p>}
                  </div>

                  {item.type === 'toggle' && (
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={item.value as boolean}
                      onChange={(e) => item.onChange?.(e.target.checked)}
                    />
                  )}

                  {item.type === 'select' && (
                    <select
                      className="select select-bordered select-sm w-28 md:w-36"
                      value={item.value as string}
                      onChange={(e) => item.onChange?.(e.target.value as 'light' | 'dark' | 'auto')}
                    >
                      {item.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {item.type === 'info' && (
                    <span className="text-xs md:text-sm font-semibold text-base-content/60">{item.description}</span>
                  )}

                  {item.type === 'action' && (
                    <button
                      onClick={item.action}
                      disabled={item.loading}
                      className={`btn btn-sm gap-1.5 ${
                        item.color === 'primary' ? 'btn-primary' : 'btn-secondary'
                      }`}
                    >
                      {item.loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : item.icon ? (
                        <item.icon className="w-3.5 h-3.5" />
                      ) : null}
                      {item.loading ? 'Processando...' : item.label}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}

      {/* Additional Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <motion.div
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
          custom={settingsSections.length}
          className="relative overflow-hidden rounded-2xl border border-info/20 bg-info/5 p-4 md:p-5 border-l-4 border-l-info/50"
        >
          <div className="absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-info/10 blur-3xl pointer-events-none" />
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <Shield className="w-5 h-5 text-info" />
            <h4 className="font-black text-sm">Seguranca</h4>
          </div>
          <p className="text-xs text-base-content/60 leading-relaxed relative z-10">
            Seus dados sao armazenados localmente (localStorage) e sincronizados com o Supabase.
            Se o Supabase ficar indisponivel, o app continua funcionando com os dados locais.
          </p>
        </motion.div>

        <motion.div
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
          custom={settingsSections.length + 1}
          className="relative overflow-hidden rounded-2xl border border-secondary/20 bg-secondary/5 p-4 md:p-5 border-l-4 border-l-secondary/50"
        >
          <div className="absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-secondary/10 blur-3xl pointer-events-none" />
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <Database className="w-5 h-5 text-secondary" />
            <h4 className="font-black text-sm">Armazenamento</h4>
          </div>
          <p className="text-xs text-base-content/60 leading-relaxed relative z-10">
            Exporte um backup completo periodicamente para proteger seus dados.
            O backup inclui campeonatos, tabelas, analises, apostas e configuracoes da banca.
          </p>
        </motion.div>
      </div>

      {/* Footer Info */}
      <motion.div
        variants={animations.fadeInUp}
        initial="initial"
        animate="animate"
        custom={settingsSections.length + 2}
        className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 to-secondary/8 p-4 md:p-5 text-center"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h4 className="font-black text-sm text-gradient">GoalScan Pro</h4>
          </div>
          <p className="text-xs text-base-content/50 leading-relaxed max-w-lg mx-auto">
            Sistema avancado de analise de apostas esportivas com modelo estatistico (Poisson + Dixon-Coles) e metricas de valor.
          </p>
          <div className="divider-gradient my-3" />
          <p className="text-[10px] text-base-content/30">
            Desenvolvido com React, TypeScript e analise estatistica avancada.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsScreen;
