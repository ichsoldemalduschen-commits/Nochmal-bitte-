import { AppStateSnapshot } from '../types';

const createBlueprintSvg = (title: string, subtitle: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="460" viewBox="0 0 800 460">
    <rect width="800" height="460" fill="#181A1B"/>
    <rect x="40" y="40" width="720" height="380" fill="#24292E" stroke="#14B8A6" stroke-width="2" rx="12"/>
    <line x1="80" y1="120" x2="720" y2="120" stroke="#0A9396" stroke-width="2" stroke-dasharray="8,6"/>
    <rect x="80" y="150" width="200" height="220" fill="#2F363D" stroke="#F8F9FA" stroke-width="1.5" rx="6"/>
    <rect x="300" y="150" width="200" height="220" fill="#2F363D" stroke="#14B8A6" stroke-width="1.5" rx="6"/>
    <rect x="520" y="150" width="200" height="220" fill="#2F363D" stroke="#EF4444" stroke-width="1.5" rx="6"/>
    <text x="80" y="95" fill="#F8F9FA" font-family="monospace" font-size="20" font-weight="bold">${title}</text>
    <text x="80" y="400" fill="#14B8A6" font-family="monospace" font-size="14">${subtitle}</text>
    <text x="95" y="255" fill="#F8F9FA" font-family="monospace" font-size="13">BG 1-2: Auszug/Lift</text>
    <text x="315" y="255" fill="#14B8A6" font-family="monospace" font-size="13">BG 3-4: Ofen/Wasser</text>
    <text x="535" y="255" fill="#FCA5A5" font-family="monospace" font-size="13">BG 5-6: Shelly/Box</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const INITIAL_APP_SNAPSHOT: AppStateSnapshot = {
  schemaVersion: 2,
  userApiKey: '',
  realityCheckEnabled: true,
  haWebhookUrl: 'http://homeassistant.local:8123/api/webhook/nexusflow_tsa_shelly',
  haEmbedUrl: 'http://localhost:5173/?mode=cover',
  projects: [
    {
      id: 'proj-foodtruck',
      domain: 'business',
      name: 'Pizza Bandit (TSA & Foodtruck)',
      subtitle: 'Feuerwehranhänger-Ausbau (6 Baugruppen), 450 °C Kuppelofen & Live-Streetfood',
      icon: 'RaccoonBandit',
      customLogoUrl: null,
      accentColor: '#14B8A6',
      archived: false,
      enabledPlugins: ['pos-tap-clicker', 'event-quantity-calc'],
      customMeta: {
        fahrzeugBasis: 'Feuerwehr-TSA (Tragkraftspritzenanhänger)',
        ofenTyp: 'Gas-Kuppelofen 450 °C (50 mbar Gewerbe)',
        shellyIp: '192.168.30.88 (Shelly Plus 2PM)',
        feuerwehrautoFondsGesamt: 142.5
      },
      tasks: [
        {
          id: 'tsa-bg1-t1',
          title: 'Schwerlastauszüge 130 kg mit Rastbolzen montieren',
          completed: true,
          priority: 'Hoch',
          estimatedMinutes: 60,
          dayBlock: 'morning',
          reminderAt: '08:00',
          aiTouched: false,
          lastModified: '13.11.2026, 08:00 Uhr',
          changeReason: 'Grundrahmen ausgerichtet',
          source: 'TSA-Seed',
          assemblyGroup: '1. Auszugtisch',
          customMeta: { auszugLaengeMm: 1200 }
        },
        {
          id: 'tsa-bg2-t1',
          title: 'Scherenhub-Gestell & GN-1/6-Kühlaufsatz einpassen',
          completed: false,
          priority: 'Hoch',
          estimatedMinutes: 55,
          dayBlock: 'focus',
          reminderAt: '10:00',
          aiTouched: false,
          lastModified: '13.11.2026, 08:15 Uhr',
          changeReason: 'Arbeitshöhe 92 cm definiert',
          source: 'TSA-Seed',
          assemblyGroup: '2. Saladette-Lift',
          customMeta: { zielArbeitshoeheCm: 92 }
        },
        {
          id: 'tsa-bg3-t1',
          title: '50 mbar Duomatic-Regler & Hecktür-Hitzeschutz prüfen',
          completed: false,
          priority: 'Hoch',
          estimatedMinutes: 40,
          dayBlock: 'focus',
          reminderAt: '11:00',
          aiTouched: true,
          lastModified: '13.11.2026, 08:30 Uhr',
          changeReason: 'DVGW-Prüfpunkt per KI hervorgehoben',
          source: 'KI-Zuordnung',
          assemblyGroup: '3. Pizzaofen/Hecktür/Gas',
          customMeta: { steinTempZiel: '445 °C' }
        },
        {
          id: 'tsa-bg4-t1',
          title: 'Doppelwaschbecken, Tauchpumpe & 12V/230V Boiler anschließen',
          completed: false,
          priority: 'Hoch',
          estimatedMinutes: 45,
          dayBlock: 'focus',
          reminderAt: '12:30',
          aiTouched: false,
          lastModified: '13.11.2026, 08:40 Uhr',
          changeReason: 'Hygiene-Abnahme Vorbereitung',
          source: 'TSA-Seed',
          assemblyGroup: '4. Waschbecken/Hygiene',
          customMeta: { frischwasserLiter: 30, abwasserLiter: 30 }
        },
        {
          id: 'tsa-bg5-t1',
          title: 'Shelly Plus 2PM für Arbeitslicht & Deko-Blaulicht verdrahten',
          completed: false,
          priority: 'Mittel',
          estimatedMinutes: 35,
          dayBlock: 'evening',
          reminderAt: '17:30',
          aiTouched: true,
          lastModified: '13.11.2026, 09:00 Uhr',
          changeReason: 'Shelly-Szenen verknüpft',
          source: 'KI-Zuordnung',
          assemblyGroup: '5. Elektrik/Beleuchtung/Blaulicht',
          customMeta: { shellyChannel0: 'LED-Arbeitsfeld', shellyChannel1: 'Rundum-Kennleuchte (Privatgelände)' }
        },
        {
          id: 'tsa-bg6-t1',
          title: 'Teigballen-Eurobox-Schiene (60x40) & Anthrazit-Folierung anbringen',
          completed: false,
          priority: 'Mittel',
          estimatedMinutes: 50,
          dayBlock: 'evening',
          reminderAt: '18:30',
          aiTouched: false,
          lastModified: '13.11.2026, 09:10 Uhr',
          changeReason: 'Eurobox-Raster 600x400 mm festgelegt',
          source: 'TSA-Seed',
          assemblyGroup: '6. Eurobox-Lager/Außenoptik',
          customMeta: { boxKapazitaet: '12 Pizzaballen-Boxen' }
        }
      ],
      knowledge: [
        {
          id: 'tsa-exp-all6',
          kind: 'explanation',
          title: 'TSA-Ausbau Masterplan: Alle 6 Baugruppen & Montage-Reihenfolge',
          content: [
            '1. Baugruppe 1 (Auszugtisch): Alu-Systemprofil 40x40 auf Siebdruck-Bodenplatte verschrauben, 130-kg-Vollauszüge mit Verriegelung im eingeklappten und ausgezogenen Zustand sichern, CNS-Edelstahlplatte kantenbündig aufsetzen.',
            '2. Baugruppe 2 (Saladette-Lift): Verstellbares Hubgestell seitlich neben dem Auszugtisch montieren, Transportsicherung für die Fahrt verbolzen, GN-Kühlwanne vibrationsgedämpft lagern.',
            '3. Baugruppe 3 (Pizzaofen / Hecktür / Gas): Hecktür-Feststeller sturmsicher auf 110° arretieren, Alu-Hitzeschutzschild zum Türblatt montieren, 2x 11 kg Propangas über GOK Gewerbe-Duomatic (50 mbar + Schlauchbruchsicherung nach BGV D34) anschließen.',
            '4. Baugruppe 4 (Waschbecken / Hygiene): Berührungsfreie Armatur / Kniehebel, Seifen- & Papierhandtuchspender, je 30L Frisch- und Abwasser-Weithalskanister frostsicher verbauen.',
            '5. Baugruppe 5 (Elektrik / Beleuchtung / Blaulicht inkl. Shelly): CEE 16A Einspeisung -> Personenschutz-FI 30mA -> 2x LS B16A. Shelly Plus 2PM im Kleinverteiler schaltet Kanal 1 (blendfreie 4000K Teig-Beleuchtung) und Kanal 2 (12V/24V Feuerwehr-Kennleuchte für Show-Momente auf Events).',
            '6. Baugruppe 6 (Eurobox-Lager / Außenoptik): Durchgehende Winkelprofile für 60x40 cm Pizzaballen-Boxen im Vorderwagen; Außenhaut in Seidenmatt-Anthrazit (#181A1B) mit Petrol-Akzentstreifen & Pizza-Bandit-Waschbär.'
          ].join('\n'),
          attachments: [],
          lastModified: '13.11.2026, 09:15 Uhr',
          changeReason: 'Alle 6 TSA-Baugruppen dokumentiert',
          source: 'TSA-Seed',
          aiTouched: false,
          customMeta: { baugruppenAnzahl: 6 }
        },
        {
          id: 'tsa-exp-event',
          kind: 'explanation',
          title: 'Event-Aufbau Checkliste vor Ort (15-Minuten-Routine)',
          content: [
            '1. Anhängerkeile setzen, Stützfüße auskurbeln und TSA per Kreuzwasserwaage exakt ins Wasser stellen.',
            '2. CEE 16A Kabel einstecken, FI-Prüftaste drücken, Saladette & Shelly-Arbeitslicht einschalten.',
            '3. Hecktür verriegeln, Gas-Dichtheitsprüfung (Manometer/Lecksuchspray), Kuppelofen auf 440 °C Steintemperatur vorheizen.',
            '4. Auszugtisch ausfahren & einrasten, Pizzaschaufeln einhängen und im Reiter „Extras“ den Live-Verkaufs-Clicker nullen.'
          ].join('\n'),
          attachments: [],
          lastModified: '13.11.2026, 09:20 Uhr',
          changeReason: 'Standard-Eventroutine',
          source: 'TSA-Seed',
          aiTouched: false,
          customMeta: {}
        },
        {
          id: 'tsa-info-1',
          kind: 'info',
          title: 'TSA Feuerwehranhänger – Baugruppen-Maße, Gewichte & Shelly-Endpunkte',
          content: [
            '• Basis-Fahrzeug: Feuerwehr-TSA | Zul. Gesamtgewicht: 1.000 kg (ungebremst/gebremst je Achse prüfen)',
            '• Innenmaß Kofferaufbau: ca. 2.000 x 1.350 x 1.150 mm',
            '• Baugruppe 5 (Shelly Plus 2PM): Lokaler AP / WLAN -> http://192.168.30.88/rpc/Switch.Toggle?id=0',
            '• Gasprüfung nach G 607 / DGUV Vorschrift 79: Vor Erstbetrieb abnehmen lassen'
          ].join('\n'),
          attachments: [
            {
              id: 'att-tsa-plan',
              name: 'TSA_6_Baugruppen_Layout.svg',
              type: 'image',
              mimeType: 'image/svg+xml',
              size: '24 KB',
              dataUrl: createBlueprintSvg(
                'Pizza Bandit TSA • 6-Baugruppen-Riss',
                'Auszugtisch • Saladette-Lift • Ofen/Gas • Hygiene • Shelly • Eurobox'
              )
            }
          ],
          lastModified: '13.11.2026, 09:25 Uhr',
          changeReason: 'TSA-Layoutzeichnung hinterlegt',
          source: 'TSA-Seed',
          aiTouched: false,
          customMeta: {}
        }
      ],
      cart: [
        {
          id: 'tsa-c1',
          title: 'Schwerlastauszüge Vollauszug 1200 mm mit Verriegelung (130 kg)',
          quantity: '2 Paar',
          price: '168.00',
          completed: false,
          aiTouched: false,
          lastModified: '13.11.2026, 09:30 Uhr',
          changeReason: 'Für Baugruppe 1 (Auszugtisch)',
          source: 'TSA-Seed',
          customMeta: { baugruppe: '1. Auszugtisch' }
        },
        {
          id: 'tsa-c2',
          title: 'Gewerbe-Gasdruckregler 50 mbar + Schlauchbruchsicherung',
          quantity: '1 Set',
          price: '54.90',
          completed: false,
          aiTouched: true,
          lastModified: '13.11.2026, 09:32 Uhr',
          changeReason: 'Für Baugruppe 3 (Ofen/Gas)',
          source: 'KI-Zuordnung',
          customMeta: { baugruppe: '3. Pizzaofen/Hecktür/Gas' }
        },
        {
          id: 'tsa-c3',
          title: 'Shelly Plus 2PM Hutschienen-Halter + IP65 Kleinverteiler',
          quantity: '1 Set',
          price: '49.50',
          completed: false,
          aiTouched: false,
          lastModified: '13.11.2026, 09:35 Uhr',
          changeReason: 'Für Baugruppe 5 (Elektrik/Blaulicht)',
          source: 'TSA-Seed',
          customMeta: { baugruppe: '5. Elektrik/Beleuchtung/Blaulicht' }
        },
        {
          id: 'tsa-c4',
          title: 'Pizzaballen-Euroboxen 60x40x7 cm lebensmittelecht inkl. Deckel',
          quantity: '10 Stück',
          price: '119.00',
          completed: false,
          aiTouched: false,
          lastModified: '13.11.2026, 09:38 Uhr',
          changeReason: 'Für Baugruppe 6 (Eurobox-Lager)',
          source: 'TSA-Seed',
          customMeta: { baugruppe: '6. Eurobox-Lager/Außenoptik' }
        }
      ]
    },
    {
      id: 'proj-baeckerei',
      domain: 'business',
      name: 'Bäckerei',
      subtitle: 'Sauerteigführung, Etagenöfen, Langzeit-Rezepturen & Rohstoff-Disposition',
      icon: 'Croissant',
      customLogoUrl: null,
      accentColor: '#0A9396',
      archived: false,
      enabledPlugins: ['event-quantity-calc'],
      customMeta: { standort: 'Backstube', zielTeigausbeute: 'TA 175' },
      tasks: [
        {
          id: 't-b1',
          title: 'Roggen-Sauerteig Anstellgut auffrischen (TA 180)',
          completed: true,
          priority: 'Hoch',
          estimatedMinutes: 20,
          dayBlock: 'morning',
          reminderAt: '05:45',
          aiTouched: false,
          lastModified: '13.11.2026, 05:45 Uhr',
          changeReason: 'Morgen-Charge angesetzt',
          source: 'Manuell',
          customMeta: {}
        },
        {
          id: 't-b2',
          title: 'Schwadenapparat Etagenofen 2 entkalken & Düsen prüfen',
          completed: false,
          priority: 'Hoch',
          estimatedMinutes: 45,
          dayBlock: 'focus',
          reminderAt: '11:30',
          aiTouched: true,
          lastModified: '13.11.2026, 06:15 Uhr',
          changeReason: 'Dringlichkeit per KI erhöht',
          source: 'KI-Zuordnung',
          customMeta: {}
        }
      ],
      knowledge: [
        {
          id: 'e-b1',
          kind: 'explanation',
          title: 'Weizen-Langzeitführung (Baguette & Ciabatta – 75% Hydration)',
          content:
            '1. Autolyse: 100% Weizenmehl T550 mit 70% kaltem Wasser 4 Min. mischen, 45 Min. ruhen.\n2. Hauptteig: 5% Restwasser, 2,4% Meersalz, 0,4% Frischhefe & 10% Lievito Madre einkneten.\n3. Stockgare: 3x Dehnen & Falten alle 40 Min., danach 18 Std. bei 5 °C reifen lassen.',
          attachments: [],
          lastModified: '13.11.2026, 06:10 Uhr',
          changeReason: 'Restwasser präzisiert',
          source: 'Manuell',
          aiTouched: false,
          customMeta: {}
        },
        {
          id: 'i-b1',
          kind: 'info',
          title: 'Mehl-Silo & Kühlhaus Referenzwerte',
          content:
            '• Silo 1 (Weizen T550): 1.450 kg | Silo 2 (Roggen T1150): 820 kg\n• Gärverzögerer: +4,5 °C bei 84% rel. Luftfeuchtigkeit',
          attachments: [],
          lastModified: '12.11.2026, 17:30 Uhr',
          changeReason: 'Bestand geprüft',
          source: 'Manuell',
          aiTouched: false,
          customMeta: {}
        }
      ],
      cart: [
        {
          id: 'c-b1',
          title: 'Bäckerleinen / Couche 75x120 cm unbehandelt',
          quantity: '10 Stück',
          price: '189.00',
          completed: false,
          aiTouched: false,
          lastModified: '12.11.2026, 15:00 Uhr',
          changeReason: 'Nachbestellung Backstube',
          source: 'Manuell',
          customMeta: {}
        }
      ]
    },
    {
      id: 'proj-smarthome',
      domain: 'private',
      name: 'Smart Home',
      subtitle: 'Home Assistant, Zigbee2MQTT, Shelly-Flotte & Proxmox-Rack',
      icon: 'Wifi',
      customLogoUrl: null,
      accentColor: '#0891B2',
      archived: false,
      enabledPlugins: [],
      customMeta: { haVersion: '2026.11', koordinator: 'SLZB-06 PoE' },
      tasks: [
        {
          id: 't-s1',
          title: 'Zigbee Fensterkontakt Werkstatt anlernen & benennen',
          completed: false,
          priority: 'Mittel',
          estimatedMinutes: 20,
          dayBlock: 'evening',
          reminderAt: '19:00',
          aiTouched: true,
          lastModified: '13.11.2026, 06:30 Uhr',
          changeReason: 'Aus Sprachnotiz angelegt',
          source: 'KI-Zuordnung',
          customMeta: {}
        }
      ],
      knowledge: [
        {
          id: 'e-s1',
          kind: 'explanation',
          title: 'WLAN / Zigbee Kanal-Trennung (Störungsfreier Betrieb)',
          content:
            '1. 2,4 GHz WLAN fest auf Kanal 1 & 6 fixieren.\n2. Zigbee2MQTT auf Kanal 25 betreiben.\n3. Shelly-Aktoren ins isolierte IoT-VLAN 30 einbinden.',
          attachments: [],
          lastModified: '10.11.2026, 20:00 Uhr',
          changeReason: 'Frequenzplan hinterlegt',
          source: 'Manuell',
          aiTouched: false,
          customMeta: {}
        },
        {
          id: 'i-s1',
          kind: 'info',
          title: 'VLAN & Shelly IP-Übersicht',
          content:
            '• VLAN 10 (Server): 192.168.10.0/24\n• VLAN 30 (IoT & TSA-Shelly): 192.168.30.0/24',
          attachments: [],
          lastModified: '11.11.2026, 19:00 Uhr',
          changeReason: 'IP-Plan aktualisiert',
          source: 'Manuell',
          aiTouched: false,
          customMeta: {}
        }
      ],
      cart: [
        {
          id: 'c-s1',
          title: 'Knopfzellen CR2032 Lithium 10er Blister',
          quantity: '2 Packungen',
          price: '11.80',
          completed: false,
          aiTouched: false,
          lastModified: '12.11.2026, 17:00 Uhr',
          changeReason: 'Sensor-Reserve',
          source: 'Manuell',
          customMeta: {}
        }
      ]
    },
    {
      id: 'proj-gewohnheiten',
      domain: 'private',
      name: 'Gewohnheiten',
      subtitle: 'Ruhige Alltags-Routinen, Fokus-Anker & Regeneration ohne Bewertungsdruck',
      icon: 'Repeat',
      customLogoUrl: null,
      accentColor: '#0D9488',
      archived: false,
      enabledPlugins: [],
      customMeta: { leitmotiv: 'Konstanz vor Perfektion' },
      tasks: [
        {
          id: 't-g1',
          title: 'Morgens 500 ml warmes Wasser vor dem ersten Kaffee',
          completed: true,
          priority: 'Mittel',
          estimatedMinutes: 5,
          dayBlock: 'morning',
          reminderAt: '06:15',
          aiTouched: false,
          lastModified: '13.11.2026, 06:15 Uhr',
          changeReason: 'Morgenroutine erledigt',
          source: 'Manuell',
          customMeta: {}
        },
        {
          id: 't-g2',
          title: '10 Minuten Schulter- & Rücken-Mobilität nach der Schicht',
          completed: false,
          priority: 'Mittel',
          estimatedMinutes: 10,
          dayBlock: 'evening',
          reminderAt: '18:00',
          aiTouched: false,
          lastModified: '12.11.2026, 18:00 Uhr',
          changeReason: 'Ausgleich zur Backstube',
          source: 'Manuell',
          customMeta: {}
        }
      ],
      knowledge: [],
      cart: []
    },
    {
      id: 'proj-alltag',
      domain: 'private',
      name: 'Alltag',
      subtitle: 'Haushalt, Fahrzeug, Steuerbelege & private Besorgungen',
      icon: 'Sun',
      customLogoUrl: null,
      accentColor: '#06B6D4',
      archived: false,
      enabledPlugins: [],
      customMeta: {},
      tasks: [
        {
          id: 't-a1',
          title: 'Steuerbelege für Buchhaltung scannen & ablegen',
          completed: false,
          priority: 'Hoch',
          estimatedMinutes: 30,
          dayBlock: 'evening',
          reminderAt: '19:30',
          aiTouched: false,
          lastModified: '13.11.2026, 07:00 Uhr',
          changeReason: 'Monatsabschluss',
          source: 'Manuell',
          customMeta: {}
        }
      ],
      knowledge: [],
      cart: [
        {
          id: 'c-a1',
          title: 'Kaffeefettlöser 500g + Silikon-Brühgruppendichtung',
          quantity: '1 Set',
          price: '19.40',
          completed: false,
          aiTouched: false,
          lastModified: '12.11.2026, 12:30 Uhr',
          changeReason: 'Siebträger-Pflege',
          source: 'Manuell',
          customMeta: {}
        }
      ]
    },
    {
      id: 'proj-archiv-hafenfest',
      domain: 'business',
      name: 'Pizza Bandit Sommer-Catering Hafenfest (Archiv)',
      subtitle: 'Abgeschlossene Event-Abrechnung & Mengen-Nachkalkulation',
      icon: 'RaccoonBandit',
      customLogoUrl: null,
      accentColor: '#64748B',
      archived: true,
      archivedAt: '02.10.2026, 18:00 Uhr',
      enabledPlugins: [],
      customMeta: { pizzenVerkauft: 540, umsatzBrutto: '6.480,00 €' },
      tasks: [
        {
          id: 't-arch-1',
          title: 'Standgebühr & Strompauschale abgerechnet',
          completed: true,
          priority: 'Mittel',
          estimatedMinutes: 20,
          dayBlock: null,
          reminderAt: '',
          aiTouched: false,
          lastModified: '02.10.2026, 17:45 Uhr',
          changeReason: 'Archiviert im Aktenschrank',
          source: 'Manuell',
          customMeta: {}
        }
      ],
      knowledge: [],
      cart: []
    }
  ],
  eventSalesLogs: [
    {
      id: 'sale-seed-1',
      timestamp: '08.11.2026, 21:30 Uhr',
      eventName: 'Feierabendmarkt Rathausplatz',
      projectId: 'proj-foodtruck',
      totalPizzas: 138,
      grossRevenue: 1749.0,
      cogsTotal: 421.4,
      grossProfit: 1327.6,
      firetruckTipFund: 86.5,
      items: [
        { id: 'v-marg', name: 'Margherita DOP', unitPrice: 11.5, unitCost: 2.65, count: 52 },
        { id: 'v-diav', name: 'Diavola Piccante', unitPrice: 13.5, unitCost: 3.35, count: 41 },
        { id: 'v-fior', name: 'Prosciutto & Funghi', unitPrice: 13.0, unitCost: 3.2, count: 25 },
        { id: 'v-band', name: 'Bandit Special Trüffel', unitPrice: 14.5, unitCost: 3.85, count: 20 }
      ]
    }
  ],
  aiLogs: [
    {
      id: 'log-seed-1',
      timestamp: '13.11.2026, 09:00 Uhr',
      rawInput:
        'Lege bei Pizza Bandit das 50 mbar Gewerbe-Gasregler-Set in den Einkaufswagen und markiere den Shelly Plus 2PM Einbau für das Blaulicht.',
      summary: '2 Punkte im Projekt Pizza Bandit angelegt und mit KI-Punkt markiert.',
      engine: 'Gemini 2.5 Flash (JSON-Schema)',
      undone: false,
      actions: [
        {
          actionId: 'act-seed-1',
          actionType: 'ADD_CART_ITEM',
          targetProjectId: 'proj-foodtruck',
          targetSubTab: 'cart',
          targetItemId: 'tsa-c2',
          shortCheckableTitle: 'Gewerbe-Gasdruckregler 50 mbar + Schlauchbruchsicherung',
          detailedExplanation: 'DVGW-geprüftes Set für Baugruppe 3 (Ofen/Hecktür/Gas).',
          changeFooterNote: 'Für Baugruppe 3 (Ofen/Gas)',
          undone: false
        },
        {
          actionId: 'act-seed-2',
          actionType: 'ADD_TASK',
          targetProjectId: 'proj-foodtruck',
          targetSubTab: 'tasks',
          targetItemId: 'tsa-bg5-t1',
          shortCheckableTitle: 'Shelly Plus 2PM für Blaulicht verdrahten',
          detailedExplanation: 'Kanal 1 Arbeitslicht, Kanal 2 Deko-Blaulicht.',
          changeFooterNote: 'Shelly-Szenen verknüpft',
          undone: false
        }
      ]
    }
  ],
  selfChecks: [
    {
      id: 'sc-seed-1',
      timestamp: '13.11.2026, 06:30 Uhr',
      energy: 'Solide',
      focus: 'Klar',
      moodTags: ['Sachlich', 'Neugierig'],
      note: 'Backstube läuft ruhig, heute Nachmittag geht es an Baugruppe 2 am TSA-Anhänger.',
      customMeta: { kontext: 'Morgen-Check' }
    }
  ]
};