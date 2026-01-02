import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.goalscanpro.app',
  appName: 'GoalScan Pro',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      releaseType: 'APK', // 'APK' para gerar APK diretamente ou 'AAB' para Android App Bundle
    },
  },
  // Plugins podem ser adicionados aqui quando necessário
  // Exemplo: instalar @capacitor/splash-screen e configurar
};

export default config;
