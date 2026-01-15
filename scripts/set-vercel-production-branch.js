/**
 * Script para configurar a branch de produção no Vercel
 * 
 * Uso:
 *   npm run set:vercel:production-branch
 *   ou
 *   node scripts/set-vercel-production-branch.js
 * 
 * Requer:
 *   - VERCEL_TOKEN como variável de ambiente ou será solicitado
 *   - VERCEL_PROJECT_ID como variável de ambiente ou será solicitado
 */

import readline from 'readline';
import { execSync } from 'child_process';

const PROJECT_ID = 'prj_9FbuXZfoOQOa7KbrdFVJh7E13f2b';
const TEAM_ID = 'team_kkGObV1opBJxGVS6whDZM2ly';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
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
  } catch {
    // CLI não disponível ou não logado
  }

  // Pedir ao usuário
  console.log('\n📝 Para configurar via API, você precisa de um token do Vercel:');
  console.log('   1. Acesse: https://vercel.com/account/tokens');
  console.log('   2. Crie um novo token');
  console.log('   3. Cole o token abaixo\n');

  const token = await question('Token do Vercel: ');
  return token.trim() || null;
}

async function setProductionBranch(token, projectId, teamId, branch = 'producao') {
  try {
    const url = teamId 
      ? `https://api.vercel.com/v9/projects/${projectId}?teamId=${teamId}`
      : `https://api.vercel.com/v9/projects/${projectId}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gitRepository: {
          productionBranch: branch,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro ao atualizar branch de produção: ${response.status} ${response.statusText}\n${error}`);
    }

    const data = await response.json();
    console.log(`✅ Branch de produção configurada para: ${branch}`);
    return data;
  } catch (error) {
    console.error('❌ Erro:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🔧 Configurando branch de produção no Vercel...\n');

    const token = await getVercelToken();
    if (!token) {
      throw new Error('VERCEL_TOKEN é obrigatório');
    }

    const projectId = process.env.VERCEL_PROJECT_ID || PROJECT_ID;
    const teamId = process.env.VERCEL_TEAM_ID || TEAM_ID;

    const branch = process.argv[2] || 'producao';
    console.log(`\n📦 Configurando branch de produção para: ${branch}`);
    console.log(`📋 Project ID: ${projectId}`);
    console.log(`📋 Team ID: ${teamId}\n`);

    await setProductionBranch(token, projectId, teamId, branch);

    console.log('\n✅ Configuração concluída!');
    console.log('💡 Nota: Pode levar alguns minutos para o Vercel processar a mudança.');
    console.log('💡 Verifique em Settings > Git do seu projeto no Vercel.');
  } catch (error) {
    console.error('\n❌ Erro ao configurar:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();

