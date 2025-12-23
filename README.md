<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# GoalScan Pro - Analisador Over 1.5

Análise inteligente de partidas de futebol com cálculo de EV (Expected Value) e probabilidades usando algoritmo Poisson v3.8.

View your app in AI Studio: https://ai.studio/apps/drive/1_EPMzvkySu16yY9rSyIWPMHCdc_FhykO

## Executar Localmente

**Pré-requisitos:** Node.js

1. Instalar dependências:
   ```bash
   npm install
   ```
2. Configurar a chave da API Gemini no arquivo `.env.local`:
   ```
   GEMINI_API_KEY=sua_chave_aqui
   ```
3. Executar o app:
   ```bash
   npm run dev
   ```

## Instalar no Android

O GoalScan Pro pode ser instalado no Android de duas formas:

### Opção 1: PWA (Progressive Web App)

1. Acesse o app no navegador Chrome do Android
2. Toque no menu (três pontos) e selecione "Adicionar à tela inicial"
3. O app será instalado como um aplicativo nativo

### Opção 2: APK Nativo

#### Pré-requisitos

- Node.js instalado
- Android Studio instalado
- JDK 11 ou superior
- Android SDK configurado

#### Gerar o APK

1. **Fazer o build do projeto web:**
   ```bash
   npm run build
   ```

2. **Sincronizar com o projeto Android:**
   ```bash
   npm run build:android
   ```
   Este comando faz o build e sincroniza os arquivos com o projeto Android.

3. **Abrir no Android Studio:**
   ```bash
   npm run android:open
   ```
   Isso abrirá o projeto Android no Android Studio.

4. **Gerar o APK no Android Studio:**
   - No Android Studio, vá em **Build > Build Bundle(s) / APK(s) > Build APK(s)**
   - Aguarde a compilação
   - O APK será gerado em `android/app/build/outputs/apk/debug/app-debug.apk`

5. **Instalar no dispositivo:**
   - Transfira o APK para o dispositivo Android
   - Ative "Fontes desconhecidas" nas configurações de segurança
   - Toque no arquivo APK para instalar

#### Scripts Disponíveis

- `npm run build:android` - Build web + sincronizar com Android
- `npm run android:open` - Abrir projeto no Android Studio
- `npm run android:sync` - Sincronizar apenas (sem build)
- `npm run android:run` - Executar no dispositivo/emulador conectado

#### Gerar APK via Linha de Comando (Alternativa)

Se preferir gerar o APK via linha de comando:

```bash
cd android
./gradlew assembleDebug
```

O APK será gerado em `android/app/build/outputs/apk/debug/app-debug.apk`

#### Assinar o APK para Produção

Para publicar na Play Store, você precisará assinar o APK:

1. Gerar uma keystore:
   ```bash
   keytool -genkey -v -keystore goalscan-pro.keystore -alias goalscan-pro -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Configurar no `capacitor.config.ts`:
   ```typescript
   android: {
     buildOptions: {
       keystorePath: 'path/to/goalscan-pro.keystore',
       keystorePassword: 'sua_senha',
       keystoreAlias: 'goalscan-pro',
       keystoreAliasPassword: 'sua_senha'
     }
   }
   ```

3. Gerar APK assinado:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

## Estrutura do Projeto

- `components/` - Componentes React
- `services/` - Serviços e lógica de negócio
- `utils/` - Utilitários
- `public/` - Arquivos estáticos (ícones, manifest, service worker)
- `android/` - Projeto Android nativo (gerado pelo Capacitor)
- `capacitor.config.ts` - Configuração do Capacitor

## Tecnologias

- React 19
- Vite
- Capacitor (para Android)
- TypeScript
- Tailwind CSS + DaisyUI
