#!/usr/bin/env node

/**
 * Script para configurar variáveis de ambiente no Vercel via API
 * 
 * Uso:
 *   npm run setup:vercel:api
 * 
 * Ou com chave direta:
 *   node scripts/setup-vercel-env-api.js --key=sua_chave_aqui
 */

import readline from 'readline';
import https from 'https';
import { execSync } from 'child_process';

const SUPABASE_URL = 'https://vebpalhcvzbbzmdzglag.supabase.co';
const PROJECT_ID = 'prj_9FbuXZfoOQOa7KbrdFVJh7E13f2b';
const TEAM_ID = 'team_kkGObV1opBJxGVS6whDZM2ly';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function getVercelToken() {
  // Tentar obter do ambiente
  if (process.env.VERCEL_TOKEN) {
    return process.env.VERCEL_TOKEN;
  }
  
  // Tentar obter via CLI do Vercel (se disponível)
  try {
    const config = execSync('vercel whoami --token', { encoding: 'utf-8', stdio: 'pipe' });
    if (config && config.trim()) {
      return config.trim();
    }
  } catch (e) {
    // CLI não disponível ou não logado
  }
  
  // Pedir ao usuário
  console.log('\n📝 Para configurar via API, você precisa de um token do Vercel:');
  console.log('   1. Acesse: https://vercel.com/account/tokens');
  console.log('   2. Crie um novo token');
  console.log('   3. Cole o token abaixo\n');
  
  const token = await question('Token do Vercel (ou pressione Enter para instruções manuais): ');
  return token.trim() || null;
}

function addEnvVariable(token, key, value) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      key: key,
      value: value,
      type: 'plain',
      target: 'production',
      target: 'preview',
      target: 'development'
    }).toString();
    
    const options = {
      hostname: 'api.vercel.com',
      path: `/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}&upsert=true`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🚀 Configurador Automático de Variáveis de Ambiente no Vercel\n');
  console.log(`📋 Projeto: goal-scan-pro-analisador-over-1-5`);
  console.log(`🔗 URL do Supabase: ${SUPABASE_URL}\n`);
  
  // Obter chave anônima do Supabase
  let supabaseKey = process.argv.find(arg => arg.startsWith('--key='))?.split('=')[1];
  
  if (!supabaseKey) {
    console.log('📝 Para encontrar sua chave anônima do Supabase:');
    console.log('   1. Acesse: https://supabase.com/dashboard');
    console.log('   2. Selecione seu projeto');
    console.log('   3. Vá em Settings > API');
    console.log('   4. Copie a chave "anon" "public" (não a service_role!)\n');
    
    supabaseKey = await question('Digite a chave anônima do Supabase (VITE_SUPABASE_ANON_KEY): ');
  }
  
  if (!supabaseKey || supabaseKey.length < 50) {
    console.error('❌ Erro: Chave anônima inválida ou muito curta!');
    rl.close();
    process.exit(1);
  }
  
  // Obter token do Vercel
  const token = await getVercelToken();
  
  if (!token) {
    console.log('\n⚠️  Token não fornecido. Seguindo com instruções manuais...\n');
    console.log('📝 Para configurar manualmente no Vercel:\n');
    console.log('1. Acesse: https://vercel.com/dashboard');
    console.log('2. Selecione: goal-scan-pro-analisador-over-1-5');
    console.log('3. Vá em Settings > Environment Variables');
    console.log('4. Adicione:\n');
    console.log(`   Key: VITE_SUPABASE_URL`);
    console.log(`   Value: ${SUPABASE_URL}`);
    console.log(`   Target: Production, Preview, Development\n`);
    console.log(`   Key: VITE_SUPABASE_ANON_KEY`);
    console.log(`   Value: ${supabaseKey.substring(0, 20)}... (oculto)`);
    console.log(`   Target: Production, Preview, Development\n`);
    console.log('5. Faça um redeploy\n');
    rl.close();
    return;
  }
  
  // Configurar via API
  try {
    console.log('\n🔧 Configurando variáveis via API do Vercel...\n');
    
    console.log('1. Adicionando VITE_SUPABASE_URL...');
    await addEnvVariable(token, 'VITE_SUPABASE_URL', SUPABASE_URL);
    console.log('   ✅ VITE_SUPABASE_URL configurada!\n');
    
    console.log('2. Adicionando VITE_SUPABASE_ANON_KEY...');
    await addEnvVariable(token, 'VITE_SUPABASE_ANON_KEY', supabaseKey);
    console.log('   ✅ VITE_SUPABASE_ANON_KEY configurada!\n');
    
    console.log('🎉 Variáveis configuradas com sucesso!\n');
    console.log('📝 Próximos passos:');
    console.log('   1. Vá em: https://vercel.com/dashboard');
    console.log('   2. Selecione o projeto: goal-scan-pro-analisador-over-1-5');
    console.log('   3. Vá em Deployments > Redeploy');
    console.log('   4. Aguarde o deploy concluir (2-3 minutos)\n');
    
  } catch (error) {
    console.error('\n❌ Erro ao configurar via API:', error.message);
    console.log('\n📝 Configure manualmente seguindo as instruções acima.');
    console.log('   Ou veja o guia em: CONFIGURAR_VERCEL.md\n');
  }
  
  rl.close();
}

main().catch(error => {
  console.error('❌ Erro:', error);
  rl.close();
  process.exit(1);
});
