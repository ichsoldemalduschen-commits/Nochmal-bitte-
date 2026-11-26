import { Project, VisionCaptureCategory, VisionCaptureItem } from '../types';
import { compressImageFile } from './aiRouter';
import { formatNow } from './storage';

export interface GeneralVisionAnalysisResult {
  ok: boolean;
  item: VisionCaptureItem;
  usedFallback: boolean;
  notice?: string;
}

const CATEGORY_LABELS: Record<VisionCaptureCategory, string> = {
  nameplate: 'Typenschild',
  sketch: 'Skizze',
  'site-photo': 'Baustellen-Foto'
};

const GENERAL_VISION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: {
      type: 'STRING',
      description: 'Klarer, präziser Titel (z. B. Gerät/Bauteil/Skizze, max. 8 Wörter)'
    },
    summary: {
      type: 'STRING',
      description: 'Kurze fachliche Zusammenfassung des Bildinhalts (1-3 Sätze)'
    },
    extractedSpecs: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description:
        'Konkrete technische Daten, Modellnummern, Volt/Watt/Ampere, Maße oder Materialangaben'
    },
    suggestedTaskTitle: {
      type: 'STRING',
      description: 'Optionaler kurzer Aufgabenvorschlag (max. 6 Wörter), falls Handlungsbedarf erkennbar'
    },
    suggestedCartItems: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Optionale erkannte benötigte Teile/Materialien für die Einkaufsliste'
    }
  },
  required: ['title', 'summary', 'extractedSpecs']
};

export function getVisionCategoryLabel(category: VisionCaptureCategory): string {
  return CATEGORY_LABELS[category] || 'Foto';
}

async function createThumbnailDataUrl(sourceDataUrl: string, maxDim = 480): Promise<string | undefined> {
  if (!sourceDataUrl || typeof document === 'undefined') return undefined;
  if (sourceDataUrl.startsWith('data:image/svg+xml')) {
    return sourceDataUrl.length <= 80_000 ? sourceDataUrl : undefined;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (!width || !height) {
          resolve(sourceDataUrl.length <= 140_000 ? sourceDataUrl : undefined);
          return;
        }
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.max(1, Math.round((height * maxDim) / width));
            width = maxDim;
          } else {
            width = Math.max(1, Math.round((width * maxDim) / height));
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(sourceDataUrl.length <= 140_000 ? sourceDataUrl : undefined);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      } catch {
        resolve(sourceDataUrl.length <= 140_000 ? sourceDataUrl : undefined);
      }
    };
    img.onerror = () => {
      resolve(sourceDataUrl.length <= 140_000 ? sourceDataUrl : undefined);
    };
    img.src = sourceDataUrl;
  });
}

function buildFallbackCapture(
  category: VisionCaptureCategory,
  userHint: string,
  activeProject: Project,
  fileName: string,
  thumbnailDataUrl?: string,
  notice?: string
): GeneralVisionAnalysisResult {
  const cleanHint = userHint.trim();
  const catLabel = getVisionCategoryLabel(category);
  const cleanFileName = fileName.replace(/\.[a-z0-9]+$/i, '').trim();
  const title = cleanHint || (cleanFileName ? `${catLabel}: ${cleanFileName}` : `${catLabel}-Aufnahme`);

  const specs: string[] = [`Kategorie: ${catLabel}`];
  if (cleanHint) {
    specs.push(`Kontext: ${cleanHint}`);
  }
  specs.push('Offline-Ablage (ohne Live-KI)');

  return {
    ok: true,
    usedFallback: true,
    notice:
      notice ||
      'Offline-Fallback aktiv: Foto & Kontext wurden sicher im Projekt abgelegt.',
    item: {
      id: `vis-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: activeProject.id,
      category,
      title,
      summary: cleanHint
        ? `Lokale ${catLabel}-Notiz zu „${cleanHint}“ im Projekt ${activeProject.name} gesichert.`
        : `Lokales ${catLabel} im Projekt ${activeProject.name} ohne API-Analyse gesichert.`,
      extractedSpecs: specs,
      ...(cleanHint ? { suggestedTaskTitle: `${catLabel} prüfen: ${cleanHint.slice(0, 28)}` } : {}),
      ...(thumbnailDataUrl ? { thumbnailDataUrl } : {}),
      createdAt: formatNow()
    }
  };
}

export async function analyzeGeneralImageWithGemini(
  file: File,
  category: VisionCaptureCategory,
  userHint: string,
  activeProject: Project,
  apiKey: string
): Promise<GeneralVisionAnalysisResult> {
  const { dataUrl } = await compressImageFile(file);
  const thumbnailDataUrl = await createThumbnailDataUrl(dataUrl, 480);

  const cleanKey = (apiKey || '').trim();
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;

  if (!cleanKey) {
    return buildFallbackCapture(
      category,
      userHint,
      activeProject,
      file.name,
      thumbnailDataUrl,
      'Kein Gemini API-Key hinterlegt – Foto & Notiz im Offline-Modus gesichert.'
    );
  }

  if (!isOnline) {
    return buildFallbackCapture(
      category,
      userHint,
      activeProject,
      file.name,
      thumbnailDataUrl,
      'Funkloch erkannt – Foto & Notiz lokal im Projekt gesichert.'
    );
  }

  const [meta = '', base64Data = ''] = dataUrl.split(',');
  const mimeMatch = meta.match(/data:(.*?);base64/);
  const resolvedMimeType = mimeMatch?.[1] || file.type || 'image/jpeg';
  const catLabel = getVisionCategoryLabel(category);

  const categoryInstruction =
    category === 'nameplate'
      ? 'Fokus TYPENSCHILD: Lies Hersteller, Modellbezeichnung, Seriennummer, Spannung (V), Leistung (W/kW), Strom (A), Schutzart (IP), Gasart/Druck (mbar) oder Baujahr exakt ab.'
      : category === 'sketch'
        ? 'Fokus SKIZZE / PLAN: Extrahiere alle sichtbaren Maße, Winkel, Beschriftungen, Bauteile und benötigte Materialien.'
        : 'Fokus BAUSTELLEN-FOTO: Beschreibe Zustand, Montage-Details, Anschlüsse, erkennbare Maße/Mängel und sinnvolle nächste Schritte.';

  const prompt = [
    `Analysiere dieses Bild (${catLabel}) für das Projekt "${activeProject.name}".`,
    categoryInstruction,
    userHint.trim() ? `Nutzer-Hinweis: "${userHint.trim()}"` : '',
    'Antworte ausschließlich im vorgegebenen JSON-Schema auf Deutsch.'
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const endpoint =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' +
      encodeURIComponent(cleanKey);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: resolvedMimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.15,
          responseMimeType: 'application/json',
          responseSchema: GENERAL_VISION_SCHEMA
        }
      })
    });

    if (!res.ok) {
      return buildFallbackCapture(
        category,
        userHint,
        activeProject,
        file.name,
        thumbnailDataUrl,
        `Vision-API nicht erreichbar (${res.status}) – Foto lokal gesichert.`
      );
    }

    const data = await res.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) {
      return buildFallbackCapture(
        category,
        userHint,
        activeProject,
        file.name,
        thumbnailDataUrl,
        'Keine strukturierte Antwort erhalten – Foto lokal gesichert.'
      );
    }

    const parsed = JSON.parse(rawJson) as {
      title?: string;
      summary?: string;
      extractedSpecs?: string[];
      suggestedTaskTitle?: string;
      suggestedCartItems?: string[];
    };

    const specs = Array.isArray(parsed.extractedSpecs)
      ? parsed.extractedSpecs.map((s) => String(s || '').trim()).filter(Boolean)
      : [];
    const cartItems = Array.isArray(parsed.suggestedCartItems)
      ? parsed.suggestedCartItems.map((s) => String(s || '').trim()).filter(Boolean)
      : [];

    return {
      ok: true,
      usedFallback: false,
      item: {
        id: `vis-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        projectId: activeProject.id,
        category,
        title: (parsed.title || userHint || `${catLabel}-Analyse`).trim(),
        summary: (parsed.summary || `${catLabel} ausgewertet.`).trim(),
        extractedSpecs: specs.length > 0 ? specs : [`Kategorie: ${catLabel}`],
        ...(cartItems.length > 0 ? { suggestedCartItems: cartItems } : {}),
        ...(parsed.suggestedTaskTitle?.trim()
          ? { suggestedTaskTitle: parsed.suggestedTaskTitle.trim() }
          : {}),
        ...(thumbnailDataUrl ? { thumbnailDataUrl } : {}),
        createdAt: formatNow()
      }
    };
  } catch {
    return buildFallbackCapture(
      category,
      userHint,
      activeProject,
      file.name,
      thumbnailDataUrl,
      'Verbindung unterbrochen – Foto & Notiz im Offline-Modus gesichert.'
    );
  }
}
