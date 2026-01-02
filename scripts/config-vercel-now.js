#!/usr/bin/env node

/**
 * Script para configurar variáveis de ambiente no Vercel
 * Com credenciais já fornecidas
 */

import https from 'https';

// Configure suas credenciais aqui ou via variáveis de ambiente
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://seu-projeto.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const PROJECT_ID = 'prj_9FbuXZfoOQOa7KbrdFVJh7E13f2b';
const TEAM_ID = 'team_kkGObV1opBJxGVS6whDZM2ly';

function addEnvVariable(token, key, value) {
  return new Promise((resolve, reject) => {
    // Para múltiplos targets, precisamos fazer múltiplas requisições
    const targets = ['production', 'preview', 'development'];
    const promises = targets.map((target) => {
      return new Promise((resolveTarget, rejectTarget) => {
        const postData = new URLSearchParams({
          key: key,
          value: value,
          type: 'plain',
          target: target,
        }).toString();

        const options = {
          hostname: 'api.vercel.com',
          path: `/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}&upsert=true`,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
          },
        };

        const req = https.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolveTarget({ target, success: true });
            } else {
              rejectTarget(new Error(`HTTP ${res.statusCode} for ${target}: ${data}`));
            }
          });
        });

        req.on('error', (error) => {
          rejectTarget(error);
        });

        req.write(postData);
        req.end();
      });
    });

    Promise.all(promises)
      .then((results) => resolve(results))
      .catch((error) => reject(error));
  });
}

async function main() {
  console.log('🚀 Configurando Variáveis de Ambiente no Vercel\n');
  console.log(`📋 Projeto: goal-scan-pro-analisador-over-1-5`);
  console.log(`🔗 URL: ${SUPABASE_URL}`);
  console.log(`🔑 Chave: ${SUPABASE_ANON_KEY.substring(0, 20)}...\n`);

  // Verificar se há token do Vercel
  const token = process.env.VERCEL_TOKEN;

  if (!token) {
    console.log('⚠️  Token do Vercel não encontrado!\n');
    console.log('📝 Para configurar automaticamente, você precisa:');
    console.log('   1. Acesse: https://vercel.com/account/tokens');
    console.log('   2. Crie um novo token');
    console.log('   3. Execute: $env:VERCEL_TOKEN="seu_token"; npm run config:vercel\n');
    console.log('📝 Ou configure manualmente:\n');
    console.log('1. Acesse: https://vercel.com/dashboard');
    console.log('2. Selecione: goal-scan-pro-analisador-over-1-5');
    console.log('3. Vá em Settings > Environment Variables');
    console.log('4. Adicione:\n');
    console.log(`   Key: VITE_SUPABASE_URL`);
    console.log(`   Value: ${SUPABASE_URL}`);
    console.log(`   Target: ☑ Production, ☑ Preview, ☑ Development\n`);
    console.log(`   Key: VITE_SUPABASE_ANON_KEY`);
    console.log(`   Value: ${SUPABASE_ANON_KEY}`);
    console.log(`   Target: ☑ Production, ☑ Preview, ☑ Development\n`);
    console.log('5. Faça um redeploy\n');
    return;
  }

  try {
    console.log('🔧 Configurando via API do Vercel...\n');

    console.log('1. Adicionando VITE_SUPABASE_URL...');
    await addEnvVariable(token, 'VITE_SUPABASE_URL', SUPABASE_URL);
    console.log('   ✅ VITE_SUPABASE_URL configurada!\n');

    console.log('2. Adicionando VITE_SUPABASE_ANON_KEY...');
    await addEnvVariable(token, 'VITE_SUPABASE_ANON_KEY', SUPABASE_ANON_KEY);
    console.log('   ✅ VITE_SUPABASE_ANON_KEY configurada!\n');

    console.log('🎉 Variáveis configuradas com sucesso!\n');
    console.log('📝 Próximos passos:');
    console.log('   1. Vá em: https://vercel.com/dashboard');
    console.log('   2. Selecione: goal-scan-pro-analisador-over-1-5');
    console.log('   3. Vá em Deployments > Redeploy');
    console.log('   4. Aguarde 2-3 minutos\n');
  } catch (error) {
    console.error('\n❌ Erro ao configurar via API:', error.message);
    console.log('\n📝 Configure manualmente seguindo as instruções acima.\n');
  }
}

main().catch((error) => {
  console.error('❌ Erro:', error);
  process.exit(1);
});
