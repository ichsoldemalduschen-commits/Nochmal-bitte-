import { DomainType } from '../types';

export interface BrandProjectConfig {
  id: string;
  name: string;
  subtitle: string;
  domain: DomainType;
  accentColor: string;
  highlightColor: string;
  domainLabel: string;
  customLogoUrl?: string;
  routingKeywords: RegExp;
  systemPromptContext: string;
}

export interface BrandConfig {
  appName: string;
  defaultProjectId: string;
  defaultWorkspaceId: string;
  defaultDomain: DomainType;
  defaultAccentColor: string;
  defaultHighlightColor: string;
  domainColors: {
    arbeit: { primary: string; highlight: string; label: string };
    privat: { primary: string; highlight: string; label: string };
  };
  projects: Record<string, BrandProjectConfig>;
  criticalAuditKeywords: RegExp;
  defaultAuditWatchlist: Array<{
    id: string;
    projectId: string;
    projectName: string;
    topic: string;
    detectedReason: string;
    createdAt?: string;
    completed: boolean;
  }>;
  systemPromptProjectContext: string;
}

export const BRAND_CONFIG: BrandConfig = {
  appName: 'BANDIT.OS',
  defaultProjectId: 'proj-foodtruck',
  defaultWorkspaceId: 'pizza-bandit-main',
  defaultDomain: 'arbeit',
  defaultAccentColor: '#0A9396',
  defaultHighlightColor: '#14B8A6',
  domainColors: {
    arbeit: {
      primary: '#0A9396',
      highlight: '#14B8A6',
      label: 'ARBEIT / BETRIEB'
    },
    privat: {
      primary: '#4F46E5',
      highlight: '#818CF8',
      label: 'PRIVAT'
    }
  },
  projects: {
    'proj-foodtruck': {
      id: 'proj-foodtruck',
      name: 'Pizza Bandit (Foodtruck)',
      subtitle: 'DDR-TSA Anhänger & Event-Betrieb',
      domain: 'arbeit',
      accentColor: '#0A9396',
      highlightColor: '#14B8A6',
      domainLabel: 'ARBEIT / BETRIEB',
      customLogoUrl: '/raccoon-logo.png',
      routingKeywords:
        /(pizza|bandit|anhänger|tsa|auszug|saladette|ofen|gas|sauerteig|mehl|dinkel|teig|backen|event|waschbecken|eurobox)/i,
      systemPromptContext:
        'Alles rund um den DDR-TSA-Anhänger (Auszugtisch, Saladette-Lift, Ofen, Gas, Waschbecken, 12V/230V-Elektrik, Euroboxen) SOWIE das gesamte Back-, Teig-, Rezept- und Event-Geschäft.'
    },
    'proj-baeckerei': {
      id: 'proj-baeckerei',
      name: 'Baustelle Bäckerei (Umbau)',
      subtitle: 'Reine Baustelle & Renovierung (150 m² Backstube)',
      domain: 'arbeit',
      accentColor: '#D97706',
      highlightColor: '#F59E0B',
      domainLabel: 'ARBEIT / BAUSTELLE',
      routingKeywords:
        /(baustelle\s*bäckerei|backstube.*umbau|umbau.*bäckerei|decke|tiefgrund|lüftung|abluft|wickelfalz|trockenbau|fliesen|wände|baustelle)/i,
      systemPromptContext:
        'AUSSCHLIESSLICH baulicher Umbau und Renovierung der 150m² Backstube (Decke, Wände, Lüftung, Trockenbau, Baustrom).'
    },
    'proj-smarthome': {
      id: 'proj-smarthome',
      name: 'Smart Home & Server',
      subtitle: 'Proxmox, Zigbee & Home Assistant',
      domain: 'privat',
      accentColor: '#4F46E5',
      highlightColor: '#818CF8',
      domainLabel: 'PRIVAT',
      routingKeywords: /(smart\s*home|zigbee|proxmox|home\s*assistant|sensor|vlan)/i,
      systemPromptContext: 'Proxmox, Zigbee, Home Assistant, Netzwerk und Smarthome-Infrastruktur.'
    },
    'proj-gewohnheiten': {
      id: 'proj-gewohnheiten',
      name: 'Körper & Routinen',
      subtitle: 'Mobilität, Training & Gesundheit',
      domain: 'privat',
      accentColor: '#10B981',
      highlightColor: '#34D399',
      domainLabel: 'PRIVAT',
      routingKeywords: /(gewohnheit|routine|mobilität|training|sport)/i,
      systemPromptContext: 'Mobilität, Training, Bewegung und tägliche Routinen.'
    },
    'proj-alltag': {
      id: 'proj-alltag',
      name: 'Privat & Alltag',
      subtitle: 'Haushalt, Steuern & Familie',
      domain: 'privat',
      accentColor: '#8B5CF6',
      highlightColor: '#A78BFA',
      domainLabel: 'PRIVAT',
      routingKeywords: /(privat|alltag|haushalt|steuer|auto|wochenende|familie)/i,
      systemPromptContext: 'Alltag, Steuern, Behörden, Auto und persönliche Erledigungen.'
    }
  },
  criticalAuditKeywords:
    /(gas|mbar|duomatic|abnahme|tüv|dguv|g\s*607|hygiene|gesundheitsamt|lmhv|waschbecken|abwasser|frischwasser|kühlkette|brandschutz|lüftung|abluft|baustrom|fi-schalter|zulassung|behörde|vorschrift|norm)/i,
  defaultAuditWatchlist: [
    {
      id: 'watch-gas-g607',
      projectId: 'proj-foodtruck',
      projectName: 'Pizza Bandit (Foodtruck)',
      topic:
        'Gewerbliche Flüssiggasanlage 50 mbar im Verkaufsanhänger & Hitzeschutz an der Hecktür (DVGW G 607 / DGUV Vorschrift 79)',
      detectedReason: 'Kritischer Sicherheits- & Abnahmepunkt (Gas / Ofen)',
      createdAt: '19.11.2026',
      completed: false
    },
    {
      id: 'watch-hygiene-lmhv',
      projectId: 'proj-foodtruck',
      projectName: 'Pizza Bandit (Foodtruck)',
      topic:
        'Berührungslose Handwaschgelegenheit (Knie-/Fußtaster), Warmwasser & Frisch-/Abwassertrennung im mobilen Foodstand nach LMHV und DIN 10500',
      detectedReason: 'Lebensmittelüberwachung / HACCP-Abnahme',
      createdAt: '19.11.2026',
      completed: false
    },
    {
      id: 'watch-lueftung-backstube',
      projectId: 'proj-baeckerei',
      projectName: 'Baustelle Bäckerei (Umbau)',
      topic:
        'Be- und Entlüftung, Brandschutzklappen und Feuchtraum-Deckenbeschichtung einer 150 m² gewerblichen Backstube (ASR A3.6 / VDI 2052 / Baurecht)',
      detectedReason: 'Baurecht & Brandschutz Backstube',
      createdAt: '19.11.2026',
      completed: false
    }
  ],
  systemPromptProjectContext: `PROJEKT-ZUORDNUNG:
1. "proj-foodtruck" (Pizza Bandit): Alles rund um den DDR-TSA-Anhänger (Auszugtisch, Saladette-Lift, Ofen, Gas, Waschbecken, 12V/230V-Elektrik, Euroboxen) SOWIE das gesamte Back-, Teig-, Rezept- und Event-Geschäft.
2. "proj-baeckerei" (Baustelle Bäckerei): AUSSCHLIESSLICH baulicher Umbau und Renovierung der 150m² Backstube (Decke, Wände, Lüftung, Trockenbau, Baustrom).
3. "proj-smarthome", "proj-gewohnheiten", "proj-alltag": Private Projekte.`
};
