#!/usr/bin/env node

/**
 * Script para configurar variáveis de ambiente no Vercel
 *
 * Uso:
 *   node scripts/setup-vercel-env.js
 *
 * Ou com valores diretos:
 *   node scripts/setup-vercel-env.js --url=https://seu-projeto.supabase.co --key=sua_chave_aqui
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log('🚀 Configurador de Variáveis de Ambiente do Vercel\n');
  console.log(
    'Este script irá ajudá-lo a configurar as variáveis de ambiente do Supabase no Vercel.\n'
  );

  // Verificar argumentos da linha de comando
  const args = process.argv.slice(2);
  let supabaseUrl = null;
  let supabaseKey = null;

  args.forEach((arg) => {
    if (arg.startsWith('--url=')) {
      supabaseUrl = arg.split('=')[1];
    } else if (arg.startsWith('--key=')) {
      supabaseKey = arg.split('=')[1];
    }
  });

  // Se não foram fornecidos via argumentos, perguntar
  if (!supabaseUrl) {
    console.log('📋 Para encontrar suas credenciais do Supabase:');
    console.log('   1. Acesse: https://supabase.com/dashboard');
    console.log('   2. Selecione seu projeto');
    console.log('   3. Vá em Settings > API\n');

    supabaseUrl = await question('Digite a URL do Supabase (VITE_SUPABASE_URL): ');
  }

  if (!supabaseKey) {
    supabaseKey = await question('Digite a chave anônima do Supabase (VITE_SUPABASE_ANON_KEY): ');
  }

  // Validar
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Erro: Ambas as credenciais são obrigatórias!');
    rl.close();
    process.exit(1);
  }

  // Validar formato da URL
  try {
    new URL(supabaseUrl);
  } catch {
    console.error('❌ Erro: URL do Supabase inválida!');
    rl.close();
    process.exit(1);
  }

  console.log('\n✅ Credenciais validadas!');
  console.log('\n📝 Instruções para configurar no Vercel:\n');
  console.log('1. Acesse: https://vercel.com/dashboard');
  console.log('2. Selecione o projeto: goal-scan-pro-analisador-over-1-5');
  console.log('3. Vá em Settings > Environment Variables');
  console.log('4. Adicione as seguintes variáveis:\n');

  console.log('   Variável 1:');
  console.log('   ┌─────────────────────────────────────────┐');
  console.log('   │ Key:   VITE_SUPABASE_URL                │');
  console.log(`   │ Value: ${supabaseUrl.padEnd(35)}│`);
  console.log('   │ Target: Production, Preview, Development│');
  console.log('   └─────────────────────────────────────────┘\n');

  console.log('   Variável 2:');
  console.log('   ┌─────────────────────────────────────────┐');
  console.log('   │ Key:   VITE_SUPABASE_ANON_KEY          │');
  console.log(`   │ Value: ${supabaseKey.substring(0, 20)}... (oculto)    │`);
  console.log('   │ Target: Production, Preview, Development│');
  console.log('   └─────────────────────────────────────────┘\n');

  console.log('5. Após adicionar, vá em Deployments > Redeploy\n');

  // Perguntar se quer usar a CLI do Vercel
  const useCLI = await question(
    'Deseja tentar configurar automaticamente via CLI do Vercel? (s/n): '
  );

  if (useCLI.toLowerCase() === 's' || useCLI.toLowerCase() === 'sim') {
    console.log('\n📦 Verificando se Vercel CLI está instalado...');

    const { execSync } = require('child_process');

    try {
      // Verificar se está instalado
      execSync('vercel --version', { stdio: 'ignore' });
      console.log('✅ Vercel CLI encontrado!\n');

      console.log('⚠️  Para configurar via CLI, você precisa:');
      console.log('   1. Fazer login: vercel login');
      console.log('   2. Executar os seguintes comandos:\n');

      console.log(`   vercel env add VITE_SUPABASE_URL production preview development`);
      console.log(`   (Quando solicitado, cole: ${supabaseUrl})\n`);

      console.log(`   vercel env add VITE_SUPABASE_ANON_KEY production preview development`);
      console.log(`   (Quando solicitado, cole: ${supabaseKey})\n`);

      const runNow = await question('Deseja executar esses comandos agora? (s/n): ');

      if (runNow.toLowerCase() === 's' || runNow.toLowerCase() === 'sim') {
        console.log('\n🔧 Executando comandos...\n');

        try {
          // Adicionar primeira variável
          console.log('Adicionando VITE_SUPABASE_URL...');
          const proc1 = require('child_process').spawn(
            'vercel',
            ['env', 'add', 'VITE_SUPABASE_URL', 'production', 'preview', 'development'],
            {
              stdio: 'inherit',
              shell: true,
            }
          );

          proc1.on('close', (code) => {
            if (code === 0) {
              console.log('\n✅ VITE_SUPABASE_URL adicionada!');

              // Adicionar segunda variável
              console.log('\nAdicionando VITE_SUPABASE_ANON_KEY...');
              const proc2 = require('child_process').spawn(
                'vercel',
                ['env', 'add', 'VITE_SUPABASE_ANON_KEY', 'production', 'preview', 'development'],
                {
                  stdio: 'inherit',
                  shell: true,
                }
              );

              proc2.on('close', (code2) => {
                if (code2 === 0) {
                  console.log('\n✅ VITE_SUPABASE_ANON_KEY adicionada!');
                  console.log('\n🎉 Variáveis configuradas com sucesso!');
                  console.log('📝 Agora faça um redeploy no Vercel para aplicar as mudanças.\n');
                } else {
                  console.log('\n⚠️  Erro ao adicionar segunda variável. Configure manualmente.');
                }
                rl.close();
              });
            } else {
              console.log('\n⚠️  Erro ao adicionar primeira variável. Configure manualmente.');
              rl.close();
            }
          });
        } catch (error) {
          console.error('❌ Erro ao executar comandos:', error.message);
          console.log('\n📝 Configure manualmente seguindo as instruções acima.\n');
          rl.close();
        }
      } else {
        rl.close();
      }
    } catch {
      console.log('❌ Vercel CLI não encontrado.');
      console.log('📦 Para instalar: npm install -g vercel');
      console.log('\n📝 Configure manualmente seguindo as instruções acima.\n');
      rl.close();
    }
  } else {
    rl.close();
  }
}

main().catch((error) => {
  console.error('❌ Erro:', error);
  rl.close();
  process.exit(1);
});
