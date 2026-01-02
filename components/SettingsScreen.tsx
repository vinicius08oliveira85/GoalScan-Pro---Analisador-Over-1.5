import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Bell, Moon, Sun, Info, Shield, Database, Sparkles } from 'lucide-react';
import { animations } from '../utils/animations';

const SettingsScreen: React.FC = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');

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
      icon: theme === 'dark' ? Moon : Sun,
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
      id: 'about',
      title: 'Sobre o App',
      icon: Info,
      description: 'Informações sobre o GoalScan Pro',
      items: [
        {
          id: 'version',
          label: 'Versão',
          description: 'v3.8.2 Elite Edition',
          type: 'info' as const,
        },
        {
          id: 'build',
          label: 'Build',
          description: '2024.12.30',
          type: 'info' as const,
        },
      ],
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8">
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

            <div className="space-y-4">
              {section.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-base-200/50 border border-base-300"
                >
                  <div className="flex-1 min-w-0">
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
            Seus dados são armazenados localmente e sincronizados com segurança no Supabase.
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
            Dados sincronizados em tempo real. Funciona offline com cache local.
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
          Sistema avançado de análise de apostas esportivas com IA integrada.
        </p>
        <p className="text-xs opacity-50">
          Desenvolvido com React, TypeScript e análise estatística avançada.
        </p>
      </motion.div>
    </div>
  );
};

export default SettingsScreen;
