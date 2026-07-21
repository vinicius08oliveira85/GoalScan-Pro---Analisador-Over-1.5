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
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8">
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
        className="flex items-center gap-3 mb-6"
      >
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
          <Settings className="w-6 h-6 md:w-8 md:h-8 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-black">Configurações</h2>
          <p className="text-xs md:text-sm opacity-60">Personalize sua experiência</p>
        </div>
      </motion.div>

      {/* Import Confirmation Dialog */}
      {confirmImport && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="custom-card p-4 md:p-6 border-2 border-warning bg-warning/5"
        >
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-black text-base">Confirmar Importação</h4>
              <p className="text-sm opacity-70 mt-1">
                Isso irá importar todos os dados do backup para o Supabase e localStorage.
                Dados existentes com o mesmo ID serão substituídos.
              </p>
              {pendingFileRef.current && (
                <p className="text-xs opacity-50 mt-2">
                  Arquivo: {pendingFileRef.current.name} ({(pendingFileRef.current.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
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
          className={`custom-card p-4 border ${importResult.success ? 'border-success bg-success/5' : 'border-error bg-error/5'}`}
        >
          <div className="flex items-start gap-3">
            {importResult.success ? (
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-semibold text-sm">{importResult.success ? 'Importação Concluída' : 'Erro na Importação'}</p>
              <p className="text-xs opacity-70 mt-1">{importResult.message}</p>
              {importResult.success && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                  <div className="bg-base-200/50 rounded p-2">
                    <span className="opacity-50">Campeonatos</span>
                    <div className="font-bold">{importResult.details.championships}</div>
                  </div>
                  <div className="bg-base-200/50 rounded p-2">
                    <span className="opacity-50">Tabelas</span>
                    <div className="font-bold">{importResult.details.tables}</div>
                  </div>
                  <div className="bg-base-200/50 rounded p-2">
                    <span className="opacity-50">Análises</span>
                    <div className="font-bold">{importResult.details.analyses}</div>
                  </div>
                  <div className="bg-base-200/50 rounded p-2">
                    <span className="opacity-50">Chaves Locais</span>
                    <div className="font-bold">{importResult.details.localStorageKeys}</div>
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setImportResult(null)} className="btn btn-ghost btn-xs">
              <XCircle className="w-4 h-4" />
            </button>
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
            className="custom-card p-4 md:p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-black">{section.title}</h3>
                <p className="text-xs opacity-60">{section.description}</p>
              </div>
            </div>

            <div className="space-y-3">
              {section.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-base-200/50 border border-base-300"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="font-semibold text-sm md:text-base mb-1">{item.label}</p>
                    {item.description && <p className="text-xs opacity-60">{item.description}</p>}
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
                      className="select select-bordered select-sm w-32 md:w-40"
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
                    <span className="text-sm font-semibold opacity-70">{item.description}</span>
                  )}

                  {item.type === 'action' && (
                    <button
                      onClick={item.action}
                      disabled={item.loading}
                      className={`btn btn-sm gap-2 ${
                        item.color === 'primary' ? 'btn-primary' : 'btn-secondary'
                      }`}
                    >
                      {item.loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : item.icon ? (
                        <item.icon className="w-4 h-4" />
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <motion.div
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
          custom={settingsSections.length}
          className="custom-card p-4 md:p-6 bg-info/10 border border-info/20"
        >
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-5 h-5 text-info" />
            <h4 className="font-black text-sm md:text-base">Segurança</h4>
          </div>
          <p className="text-xs opacity-70">
            Seus dados são armazenados localmente (localStorage) e sincronizados com o Supabase.
            Se o Supabase ficar indisponível, o app continua funcionando com os dados locais.
          </p>
        </motion.div>

        <motion.div
          variants={animations.fadeInUp}
          initial="initial"
          animate="animate"
          custom={settingsSections.length + 1}
          className="custom-card p-4 md:p-6 bg-secondary/10 border border-secondary/20"
        >
          <div className="flex items-center gap-3 mb-3">
            <Database className="w-5 h-5 text-secondary" />
            <h4 className="font-black text-sm md:text-base">Armazenamento</h4>
          </div>
          <p className="text-xs opacity-70">
            Exporte um backup completo periodicamente para proteger seus dados.
            O backup inclui campeonatos, tabelas, análises, apostas e configurações da banca.
          </p>
        </motion.div>
      </div>

      {/* Footer Info */}
      <motion.div
        variants={animations.fadeInUp}
        initial="initial"
        animate="animate"
        custom={settingsSections.length + 2}
        className="custom-card p-4 md:p-6 bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20"
      >
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h4 className="font-black text-sm md:text-base">GoalScan Pro</h4>
        </div>
        <p className="text-xs opacity-70 mb-2">
          Sistema avançado de análise de apostas esportivas com modelo estatístico (Poisson + Dixon-Coles) e métricas de valor.
        </p>
        <p className="text-xs opacity-50">
          Desenvolvido com React, TypeScript e análise estatística avançada.
        </p>
      </motion.div>
    </div>
  );
};

export default SettingsScreen;
