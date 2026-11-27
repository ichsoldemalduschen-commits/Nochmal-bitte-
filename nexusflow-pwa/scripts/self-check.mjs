#!/usr/bin/env node
/**
 * Automatischer Selbst-Check für nexusflow-pwa (Pre-Build & Post-Build `--dist`).
 * Keine externen Abhängigkeiten – läuft plattformunabhängig mit Node.js (Windows & Linux).
 *
 * Pre-Build (Standard: `node scripts/self-check.mjs`):
 *   1. Kein doppeltes `BanditUserPreferences`-Interface außerhalb `src/types.ts`
 *   2. Voll-Backup-v2-Vollständigkeit (alle STORAGE_KEYS in Export & Import)
 *   3. Keine hardcoded Projekt-IDs (`proj-foodtruck`, `proj-baeckerei`) außerhalb BrandConfig/Seeds/Migration
 *   4. Keine BYOK-Marken-Leaks (`Pizza Bandit`, `BANDIT.OS`) in Core-UI oder Services
 *   5. Design-DNA-Wächter: Keine Mini-Schriften `< 12px` (`text-[8px]`..`text-[11px]`)
 *   6. Alarm-Rot-Wächter: Keine unerwarteten `red-400/500/600` / `#EF4444` außerhalb Lösch-Aktionen
 *   7. Repo-Hygiene: Keine versehentlichen Hilfsdateien (`commit*.txt`, `merge*.txt`, `output.txt`)
 *
 * Post-Build (`node scripts/self-check.mjs --dist`):
 *   8. Chunk-Größen-Wächter: Alle `.js`-Dateien in `dist/assets/` unter 900 KB
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REPO_PARENT_ROOT = path.resolve(PROJECT_ROOT, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const DIST_ASSETS_DIR = path.join(PROJECT_ROOT, 'dist', 'assets');

const isDistMode = process.argv.includes('--dist');

function toPosixRel(absPath, baseDir = PROJECT_ROOT) {
  return path.relative(baseDir, absPath).replace(/\\/g, '/');
}

function collectFiles(dir, extensions) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full, extensions));
    } else if (entry.isFile()) {
      if (!extensions || extensions.some((ext) => entry.name.endsWith(ext))) {
        out.push(full);
      }
    }
  }
  return out;
}

/**
 * Entfernt `//`- und `/* ... *\/`-Kommentare unter Erhalt aller Zeilenumbrüche,
 * sodass gefundene Treffer exakte Zeilennummern behalten.
 */
function stripCommentsPreserveLines(source) {
  let result = '';
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        result += '\n';
      }
      i += 1;
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 2;
      } else {
        if (ch === '\n') result += '\n';
        i += 1;
      }
      continue;
    }

    if (inSingle) {
      result += ch;
      if (ch === '\\' && i + 1 < source.length) {
        result += next;
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i += 1;
      continue;
    }

    if (inDouble) {
      result += ch;
      if (ch === '\\' && i + 1 < source.length) {
        result += next;
        i += 2;
        continue;
      }
      if (ch === '"') inDouble = false;
      i += 1;
      continue;
    }

    if (inTemplate) {
      result += ch;
      if (ch === '\\' && i + 1 < source.length) {
        result += next;
        i += 2;
        continue;
      }
      if (ch === '`') inTemplate = false;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }

    if (ch === "'") inSingle = true;
    else if (ch === '"') inDouble = true;
    else if (ch === '`') inTemplate = true;

    result += ch;
    i += 1;
  }

  return result;
}

function skipBalancedBlock(source, openIdx, openChar, closeChar) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openIdx; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inSingle) {
      if (ch === '\\') i += 1;
      else if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === '\\') i += 1;
      else if (ch === '"') inDouble = false;
      continue;
    }
    if (inTemplate) {
      if (ch === '\\') i += 1;
      else if (ch === '`') inTemplate = false;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      continue;
    }

    if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Extrahiert einen Funktions- oder Objektblock (überspringt Parameter & TS-Rückgabetypen).
 */
function extractBlockBySignature(source, signatureRegex) {
  const match = signatureRegex.exec(source);
  if (!match) return null;
  const startIdx = match.index;
  let searchFrom = startIdx;

  if (/\bfunction\b/.test(match[0])) {
    const openParen = source.indexOf('(', startIdx);
    if (openParen !== -1) {
      const closeParen = skipBalancedBlock(source, openParen, '(', ')');
      if (closeParen !== -1) searchFrom = closeParen + 1;
    }
  }

  let angleDepth = 0;
  for (let i = searchFrom; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '=' && source[i + 1] === '>') {
      i += 1;
      continue;
    }
    if (ch === '<') {
      angleDepth += 1;
      continue;
    }
    if (ch === '>' && angleDepth > 0) {
      angleDepth -= 1;
      continue;
    }
    if (ch === '{' && angleDepth === 0) {
      const closeBrace = skipBalancedBlock(source, i, '{', '}');
      if (closeBrace === -1) return null;
      // Falls direkt auf ein Return-Type-Objekt `{ ... } {` folgt, zur Funktionsklammer springen
      let peek = closeBrace + 1;
      while (peek < source.length && /\s/.test(source[peek])) peek += 1;
      if (/\bfunction\b/.test(match[0]) && source[peek] === '{') {
        i = peek - 1;
        continue;
      }
      return {
        body: source.slice(startIdx, closeBrace + 1),
        startLine: source.slice(0, startIdx).split('\n').length,
        endLine: source.slice(0, closeBrace + 1).split('\n').length
      };
    }
  }
  return null;
}

function findPatternLines(text, regex) {
  const hits = [];
  const lines = text.split('\n');
  for (let idx = 0; idx < lines.length; idx += 1) {
    regex.lastIndex = 0;
    const match = regex.exec(lines[idx]);
    if (match) {
      hits.push({ line: idx + 1, match: match[0], text: lines[idx].trim() });
    }
  }
  return hits;
}

function runPreBuildChecks() {
  const errors = [];
  const srcFiles = collectFiles(SRC_DIR, ['.ts', '.tsx']);
  const fileContents = new Map();
  for (const file of srcFiles) {
    fileContents.set(file, fs.readFileSync(file, 'utf8'));
  }

  // ── 1. Kein doppeltes BanditUserPreferences-Interface ──────────────────────
  let typesCount = 0;
  for (const [file, content] of fileContents.entries()) {
    const rel = toPosixRel(file);
    const hits = findPatternLines(content, /\binterface\s+BanditUserPreferences\b/);
    for (const h of hits) {
      if (rel === 'src/types.ts') {
        typesCount += 1;
      } else {
        errors.push(`[1-Prefs] ${rel}:${h.line} — doppeltes interface BanditUserPreferences (${h.text})`);
      }
    }
  }
  if (typesCount === 0) {
    errors.push('[1-Prefs] src/types.ts — kanonisches interface BanditUserPreferences fehlt');
  }

  // ── 2. Voll-Backup-v2-Vollständigkeit (STORAGE_KEYS in Export & Import) ───
  const storagePath = path.join(SRC_DIR, 'services', 'storage.ts');
  const storageSrc = fs.readFileSync(storagePath, 'utf8');
  const keysBlock = extractBlockBySignature(storageSrc, /export\s+const\s+STORAGE_KEYS\s*=/);
  if (!keysBlock) {
    errors.push('[2-Backup] src/services/storage.ts — STORAGE_KEYS nicht gefunden');
  } else {
    const keyMatches = [...keysBlock.body.matchAll(/^\s*([A-Z0-9_]+)\s*:/gm)].map((m) => m[1]);
    const exportBlock = extractBlockBySignature(
      storageSrc,
      /export\s+async\s+function\s+downloadFullBackupV2\b/
    );
    const importBlock = extractBlockBySignature(
      storageSrc,
      /export\s+async\s+function\s+importFullBackupV2\b/
    );

    if (!exportBlock || !importBlock) {
      errors.push('[2-Backup] src/services/storage.ts — downloadFullBackupV2 oder importFullBackupV2 nicht gefunden');
    } else {
      // Erfasse alle lokalen Speicher-/Lade-Helfer in storage.ts, die von Export/Import aufgerufen werden
      const fnBlocks = new Map();
      const fnHeaderRegex = /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/g;
      let fnMatch;
      while ((fnMatch = fnHeaderRegex.exec(storageSrc)) !== null) {
        const fnName = fnMatch[1];
        const block = extractBlockBySignature(
          storageSrc.slice(fnMatch.index),
          new RegExp(`function\\s+${fnName}\\b`)
        );
        if (block) fnBlocks.set(fnName, block.body);
      }

      const collectResolvedStorageKeys = (rootBody) => {
        const visitedFns = new Set();
        const queue = [rootBody];
        const foundKeys = new Set();

        while (queue.length > 0) {
          const chunk = queue.shift();
          for (const m of chunk.matchAll(/STORAGE_KEYS\.([A-Z0-9_]+)/g)) {
            foundKeys.add(m[1]);
          }
          for (const m of chunk.matchAll(/\b([a-zA-Z0-9_]+)\s*\(/g)) {
            const callee = m[1];
            if (!visitedFns.has(callee) && fnBlocks.has(callee)) {
              visitedFns.add(callee);
              queue.push(fnBlocks.get(callee));
            }
          }
        }
        return foundKeys;
      };

      const exportedKeys = collectResolvedStorageKeys(exportBlock.body);
      const importedKeys = collectResolvedStorageKeys(importBlock.body);

      // Explizite kleine Allowlist ausschließlich für den Snapshot-Hauptkey & flüchtigen Tages-Cache
      const BACKUP_ALLOWLIST = new Set([
        'STATE', // Haupt-Snapshot (AppStateSnapshot / IDB_STATE_KEY via savePersistedState)
        'FIRED_REMINDERS' // Flüchtiger Tages-Deduplizierungs-Cache für aktive Erinnerungen
      ]);

      for (const key of keyMatches) {
        if (BACKUP_ALLOWLIST.has(key)) continue;
        if (!exportedKeys.has(key)) {
          errors.push(
            `[2-Backup] src/services/storage.ts — STORAGE_KEYS.${key} fehlt in downloadFullBackupV2 (Export)`
          );
        }
        if (!importedKeys.has(key)) {
          errors.push(
            `[2-Backup] src/services/storage.ts — STORAGE_KEYS.${key} fehlt in importFullBackupV2 (Import)`
          );
        }
      }
    }
  }

  // ── 3. Keine hardcoded Projekt-IDs außerhalb BrandConfig / Seeds / Migration ──
  const migrationBlock = extractBlockBySignature(storageSrc, /function\s+migrateProjectInternal\b/);
  const ALLOWED_PROJECT_ID_FILES = new Set([
    'src/config/brandConfig.ts',
    'src/data/pizzaBanditTsaSeed.ts',
    'src/services/neutralStarterSeed.ts'
  ]);
  for (const [file, content] of fileContents.entries()) {
    const rel = toPosixRel(file);
    if (ALLOWED_PROJECT_ID_FILES.has(rel)) continue;
    const hits = findPatternLines(content, /['"`](?:proj-foodtruck|proj-baeckerei)['"`]/);
    for (const h of hits) {
      if (
        rel === 'src/services/storage.ts' &&
        migrationBlock &&
        h.line >= migrationBlock.startLine &&
        h.line <= migrationBlock.endLine
      ) {
        continue;
      }
      errors.push(`[3-ProjId] ${rel}:${h.line} — verbotene hardcoded Projekt-ID ${h.match}`);
    }
  }

  // ── 4. Keine BYOK-Marken-Leaks ('Pizza Bandit', 'BANDIT.OS') ──────────────
  const ALLOWED_BRAND_FILES = new Set([
    'src/config/brandConfig.ts',
    'src/data/pizzaBanditTsaSeed.ts'
  ]);
  for (const [file, content] of fileContents.entries()) {
    const rel = toPosixRel(file);
    if (ALLOWED_BRAND_FILES.has(rel)) continue;
    const codeOnly = stripCommentsPreserveLines(content);
    const hits = findPatternLines(codeOnly, /Pizza Bandit|BANDIT\.OS/);
    for (const h of hits) {
      errors.push(`[4-BYOK] ${rel}:${h.line} — harter Marken-Leak "${h.match}" (${h.text})`);
    }
  }

  // ── 5. Design-DNA-Wächter: Keine Mini-Schriften < 12px ────────────────────
  for (const [file, content] of fileContents.entries()) {
    const rel = toPosixRel(file);
    const hits = findPatternLines(content, /\btext-\[(?:[0-9]|10|11)px\]/);
    for (const h of hits) {
      errors.push(`[5-Font] ${rel}:${h.line} — Schriftgröße < 12px unzulässig: ${h.match}`);
    }
  }

  // ── 6. Alarm-Rot-Wächter ──────────────────────────────────────────────────
  const ALLOWED_RED_FILES = new Set([
    'src/core/front/CartView.tsx',
    'src/core/front/TasksView.tsx',
    'src/core/front/KnowledgeView.tsx',
    'src/core/front/DeepResearchView.tsx',
    'src/data/pizzaBanditTsaSeed.ts'
  ]);
  for (const [file, content] of fileContents.entries()) {
    const rel = toPosixRel(file);
    if (ALLOWED_RED_FILES.has(rel)) continue;
    const codeOnly = stripCommentsPreserveLines(content);
    const hits = findPatternLines(
      codeOnly,
      /\b(?:text|bg|border|ring|from|to|via)-red-(?:400|500|600|700)\b|#EF4444/i
    );
    for (const h of hits) {
      errors.push(
        `[6-AlarmRed] ${rel}:${h.line} — Alarm-Rot außerhalb destruktiver Allowlist: ${h.match}`
      );
    }
  }

  // ── 7. Repo-Hygiene (keine temporären Commit-/Merge-/Output-Textdateien) ──
  const TEMP_TXT_REGEX = /^(?:commit.*|merge.*|output)\.txt$/i;
  for (const checkDir of [PROJECT_ROOT, REPO_PARENT_ROOT]) {
    if (!fs.existsSync(checkDir)) continue;
    const entries = fs.readdirSync(checkDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && TEMP_TXT_REGEX.test(entry.name)) {
        const rel = toPosixRel(path.join(checkDir, entry.name), REPO_PARENT_ROOT);
        errors.push(`[7-Hygiene] ${rel} — temporäre Hilfsdatei im Repo gefunden`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('❌ Selbst-Check (Pre-Build) FEHLGESCHLAGEN:\n');
    for (const err of errors) {
      console.error(`  • ${err}`);
    }
    console.error(`\nGesamt: ${errors.length} Verstoß/Verstöße.`);
    process.exit(1);
  }

  console.log('✅ Selbst-Check (Pre-Build): Alle 7 Regeln bestanden (0 Verstöße).');
}

function runDistChecks() {
  if (!fs.existsSync(DIST_ASSETS_DIR)) {
    console.error('❌ Selbst-Check (--dist): dist/assets/ nicht gefunden. Zuerst `vite build` ausführen.');
    process.exit(1);
  }

  const MAX_CHUNK_BYTES = 900 * 1024; // 900 KB Obergrenze (< 1 MiB esbuild/Windows-Schutz)
  const jsFiles = collectFiles(DIST_ASSETS_DIR, ['.js']);
  if (jsFiles.length === 0) {
    console.error('❌ Selbst-Check (--dist): Keine .js-Chunks in dist/assets/ gefunden.');
    process.exit(1);
  }

  const oversized = [];
  let maxChunkName = '';
  let maxChunkBytes = 0;

  for (const file of jsFiles) {
    const stat = fs.statSync(file);
    const rel = toPosixRel(file);
    if (stat.size > maxChunkBytes) {
      maxChunkBytes = stat.size;
      maxChunkName = rel;
    }
    if (stat.size > MAX_CHUNK_BYTES) {
      oversized.push(`${rel}: ${(stat.size / 1024).toFixed(1)} KB (Limit: 900.0 KB)`);
    }
  }

  if (oversized.length > 0) {
    console.error('❌ Selbst-Check (--dist) FEHLGESCHLAGEN – Chunk-Limit überschritten:');
    for (const item of oversized) {
      console.error(`  • ${item}`);
    }
    process.exit(1);
  }

  console.log(
    `✅ Selbst-Check (--dist): ${jsFiles.length} JS-Chunks geprüft, größter Chunk ${maxChunkName} (${(
      maxChunkBytes / 1024
    ).toFixed(1)} KB < 900 KB).`
  );
}

if (isDistMode) {
  runDistChecks();
} else {
  runPreBuildChecks();
}
