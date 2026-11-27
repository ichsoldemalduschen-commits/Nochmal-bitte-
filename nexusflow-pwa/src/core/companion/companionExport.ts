import { AiExecutedAction } from '../../types';
import { getActiveBrandMeta } from '../../config/brandConfig';
import { loadUserPrefs } from '../../services/storage';

export interface ExportableChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  engine?: string;
  actions?: AiExecutedAction[];
  attachmentName?: string;
  isErrorFallback?: boolean;
}

function formatExportTimestamp(): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${d}.${m}.${y}, ${hh}:${mm} Uhr`;
}

/**
 * Formatiert den Begleiter-Verlauf als sauberes deutsches Markdown inkl. Aktionsliste.
 */
export function formatChatAsMarkdown(
  messages: ExportableChatMessage[],
  projectName: string
): string {
  const appName = getActiveBrandMeta(loadUserPrefs().starterProfile).appName;
  const header = [
    `# ${appName} Begleiter-Verlauf`,
    '',
    `- **Projekt:** ${projectName}`,
    `- **Exportiert:** ${formatExportTimestamp()}`,
    ''
  ];

  if (messages.length === 0) {
    return [...header, '_Keine Nachrichten im Verlauf._'].join('\n');
  }

  const sections = messages.map((msg) => {
    const speaker = msg.role === 'user' ? 'Du' : 'Gisela';
    const meta = msg.role === 'assistant' && msg.engine ? ` · ${msg.engine}` : '';
    const lines: string[] = [`### ${speaker} (${msg.timestamp}${meta})`];

    if (msg.attachmentName) {
      lines.push(`_Anhang: ${msg.attachmentName}_`);
    }
    lines.push('', msg.text.trim() || '_Leer_');

    if (msg.actions && msg.actions.length > 0) {
      lines.push('', '**Ausgeführte Aktionen:**');
      for (const act of msg.actions) {
        const target = `${act.targetProjectName || projectName} / ${act.targetSubTab}`;
        const status = act.undone ? ' *(Rückgängig gemacht)*' : '';
        lines.push(`- ${act.shortCheckableTitle} (${target})${status}`);
      }
    }

    return lines.join('\n');
  });

  return [...header, ...sections].join('\n\n---\n\n');
}

/**
 * Formatiert den Begleiter-Verlauf als ruhigen Klartext zum direkten Kopieren oder Teilen.
 */
export function formatChatAsPlainText(
  messages: ExportableChatMessage[],
  projectName: string
): string {
  const appName = getActiveBrandMeta(loadUserPrefs().starterProfile).appName;
  const lines: string[] = [`${appName} Verlauf – ${projectName}`, `Stand: ${formatExportTimestamp()}`, ''];

  if (messages.length === 0) {
    lines.push('Keine Nachrichten im Verlauf.');
    return lines.join('\n');
  }

  for (const msg of messages) {
    const speaker = msg.role === 'user' ? 'Du' : 'Gisela';
    lines.push(`[${msg.timestamp}] ${speaker}: ${msg.text.trim()}`);
    if (msg.attachmentName) {
      lines.push(`  Anhang: ${msg.attachmentName}`);
    }
    if (msg.actions && msg.actions.length > 0) {
      for (const act of msg.actions) {
        const target = `${act.targetProjectName || projectName} / ${act.targetSubTab}`;
        const undoneTag = act.undone ? ' [Rückgängig]' : '';
        lines.push(`  • ${act.shortCheckableTitle} (${target})${undoneTag}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Löst einen sauberen Browser-Download für eine Text-/Markdown-Datei aus.
 */
export function triggerTextDownload(
  filename: string,
  content: string,
  mimeType = 'text/plain;charset=utf-8'
): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    // Graceful No-Op bei eingeschränkter Browser-Umgebung
  }
}

/**
 * Kopiert Text zuverlässig in die Zwischenablage (inkl. Fallback für Headless-Browser).
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback über temporäres Textarea
  }

  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return Boolean(ok);
    }
  } catch {
    // Niemals ungefangene Exceptions werfen
  }

  return false;
}
