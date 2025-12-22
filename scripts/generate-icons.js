// Script para gerar ícones PWA a partir do SVG
// Este script requer sharp: npm install sharp --save-dev
// Execute: node scripts/generate-icons.js

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputSvg = path.join(__dirname, '../public/icons/icon.svg');
const outputDir = path.join(__dirname, '../public/icons');

// Garantir que o diretório existe
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcons() {
  console.log('Gerando ícones PWA...');
  
  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    
    try {
      await sharp(inputSvg)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Gerado: icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`✗ Erro ao gerar icon-${size}x${size}.png:`, error.message);
    }
  }
  
  console.log('\nÍcones gerados com sucesso!');
}

generateIcons().catch(console.error);

