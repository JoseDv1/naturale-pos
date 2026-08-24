import { mkdir, cp, rm, writeFile, chmod } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const ROOT_DIR = process.cwd();
const DIST_DIR = join(ROOT_DIR, 'dist-release');

async function runCommand(cmd: string, cwd: string = ROOT_DIR) {
  console.log(`> [${cwd}] ${cmd}`);
  const proc = Bun.spawn(cmd.split(' '), {
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed with exit code ${exitCode}: ${cmd}`);
  }
}

async function createReadme(targetDir: string) {
  const content = `# Naturale POS - Punto de Venta Local

¡Bienvenido a Naturale POS! Este paquete contiene todo lo necesario para ejecutar el sistema de punto de venta de forma 100% local e independiente.

---

## 🚀 Cómo Iniciar

### En Windows:
1. Haz doble clic en \`start.bat\` (o ejecuta \`naturale-pos.exe\`).
2. Se abrirá automáticamente tu navegador en **http://localhost:3001**.

### En Linux / Mac:
1. Abre una terminal en esta carpeta.
2. Ejecuta:
   \`\`\`bash
   ./start.sh
   \`\`\`
3. Se abrirá automáticamente tu navegador en **http://localhost:3001**.

---

## 🔑 Credenciales de Acceso por Defecto (PINs):

- **Administrador:**
  - Usuario: \`admin\`
  - PIN: \`1234\` (o usuario con PIN en la pantalla táctil)

- **Cajero:**
  - Usuario: \`cajero\`
  - PIN: \`0000\`

---

## 📦 Estructura del Paquete:
- \`naturale-pos\` / \`naturale-pos.exe\`: Servidor y motor de base de datos compilado en un solo ejecutable.
- \`frontend/dist/\`: Interfaz gráfica táctil y responsiva.
- \`prisma/dev.db\`: Base de datos SQLite local (tus ventas, productos y mesas se guardan aquí).

---

## 💡 Copias de Seguridad (Backups):
Para respaldar tu información o moverla a otro computador, simplemente copia el archivo \`prisma/dev.db\`.
`;
  await writeFile(join(targetDir, 'README.md'), content, 'utf-8');
}

async function createStartScripts(targetDir: string, isWindows: boolean) {
  if (isWindows) {
    const batContent = `@echo off
title Naturale POS
cd /d "%~dp0"
echo ==========================================
echo       Iniciando Naturale POS...
echo ==========================================
echo.
echo Servidor en ejecucion.
echo Abriendo navegador en http://localhost:3001
start http://localhost:3001
naturale-pos.exe
pause
`;
    await writeFile(join(targetDir, 'start.bat'), batContent, 'utf-8');
  } else {
    const shContent = `#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
chmod +x ./naturale-pos 2>/dev/null

echo "=========================================="
echo "      Iniciando Naturale POS..."
echo "=========================================="
echo ""
echo "Servidor corriendo en: http://localhost:3001"

if command -v xdg-open > /dev/null 2>&1; then
  (sleep 1 && xdg-open http://localhost:3001) &
elif command -v open > /dev/null 2>&1; then
  (sleep 1 && open http://localhost:3001) &
fi

./naturale-pos
`;
    const shPath = join(targetDir, 'start.sh');
    await writeFile(shPath, shContent, 'utf-8');
    await chmod(shPath, 0o755);
  }
}

async function packagePlatform(target: 'linux' | 'windows') {
  const isWin = target === 'windows';
  const folderName = `naturale-pos-${target}-x64`;
  const packageDir = join(DIST_DIR, folderName);

  console.log(`\n📦 Empaquetando para ${target.toUpperCase()} en ${packageDir}...`);

  if (existsSync(packageDir)) {
    await rm(packageDir, { recursive: true, force: true });
  }
  await mkdir(packageDir, { recursive: true });

  // 1. Compile Binary
  const binaryName = isWin ? 'naturale-pos.exe' : 'naturale-pos';
  const bunTarget = isWin ? 'bun-windows-x64' : 'bun-linux-x64';
  const binaryDest = join(packageDir, binaryName);

  await runCommand(`bun build --compile --minify --target=${bunTarget} --outfile ${binaryDest} src/index.ts`);
  if (!isWin) {
    await chmod(binaryDest, 0o755);
  }

  // 2. Copy Frontend Dist
  const frontendDistSrc = join(ROOT_DIR, 'frontend', 'dist');
  const frontendDistDest = join(packageDir, 'frontend', 'dist');
  await mkdir(join(packageDir, 'frontend'), { recursive: true });
  await cp(frontendDistSrc, frontendDistDest, { recursive: true });

  // 3. Copy/Create Prisma Dev DB
  const prismaDest = join(packageDir, 'prisma');
  await mkdir(prismaDest, { recursive: true });
  const dbSrc = join(ROOT_DIR, 'prisma', 'dev.db');
  if (existsSync(dbSrc)) {
    await cp(dbSrc, join(prismaDest, 'dev.db'));
  }

  // 4. Create Start Scripts & Readme
  await createStartScripts(packageDir, isWin);
  await createReadme(packageDir);

  // 5. Create Archive (ZIP or TAR.GZ)
  console.log(`🗜️  Comprimiendo ${folderName}...`);
  try {
    const zipName = `${folderName}.zip`;
    const zipPath = join(DIST_DIR, zipName);
    if (existsSync(zipPath)) {
      await rm(zipPath, { force: true });
    }
    await runCommand(`zip -r ${zipName} ${folderName}`, DIST_DIR);
    console.log(`✅ ${target.toUpperCase()} comprimido en ZIP: ${zipPath}`);
  } catch (e) {
    console.log(`⚠️  'zip' no disponible, comprimiendo en .tar.gz...`);
    const tarName = `${folderName}.tar.gz`;
    const tarPath = join(DIST_DIR, tarName);
    if (existsSync(tarPath)) {
      await rm(tarPath, { force: true });
    }
    await runCommand(`tar -czf ${tarName} ${folderName}`, DIST_DIR);
    console.log(`✅ ${target.toUpperCase()} comprimido en TAR.GZ: ${tarPath}`);
  }
}

async function main() {
  console.log('🚀 Iniciando proceso de empaquetado de Naturale POS...');

  // Ensure frontend is built
  console.log('🔨 Compilando frontend...');
  await runCommand('bun run build:frontend');

  // Ensure DB client & dev.db exists
  console.log('🔨 Generando cliente Prisma y verificando base de datos...');
  await runCommand('bun run db:generate');
  if (!existsSync(join(ROOT_DIR, 'prisma', 'dev.db'))) {
    await runCommand('bun run db:migrate');
    await runCommand('bun prisma/seed.ts');
  }

  await mkdir(DIST_DIR, { recursive: true });

  // Package Linux & Windows
  await packagePlatform('linux');
  await packagePlatform('windows');

  console.log('\n🎉 ¡Empaquetado completo! Archivos disponibles en dist-release/');
}

main().catch((err) => {
  console.error('❌ Error durante el empaquetado:', err);
  process.exit(1);
});
