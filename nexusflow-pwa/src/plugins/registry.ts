import React from 'react';
import { PluginDefinition } from '../types';
import { PosTapClickerPlugin } from './posTapClicker';
import { EventQuantityCalcPlugin } from './eventQuantityCalc';
import { HaccpProtocolPlugin } from './haccpProtocol';

export const PLUGIN_REGISTRY: PluginDefinition[] = [
  {
    id: 'pos-tap-clicker',
    name: 'Pizza Bandit Live-Verkaufs-Clicker (POS)',
    shortLabel: 'Live-POS Clicker',
    description:
      '4 Pizza-Sorten mit Einzelpreis & Wareneinsatz + Feuerwehrauto-Fonds Trinkgeld-Zähler + 1-Klick Event-Abschluss.',
    recommendedDomains: ['arbeit'],
    metaKeysUsed: ['letztesEventUmsatz', 'feuerwehrautoFondsGesamt'],
    render: (ctx) => React.createElement(PosTapClickerPlugin, ctx)
  },
  {
    id: 'event-quantity-calc',
    name: 'Besucher- & Teigballen-Kalkulator',
    shortLabel: 'Teig- & Event-Rechner',
    description:
      'Berechnet Teigballen, Mehl, Wasser, Sugo, Fior di Latte & Euroboxen aus Besucherzahlen inkl. Einkaufswagen-Übertrag.',
    recommendedDomains: ['arbeit'],
    metaKeysUsed: ['geplanteTeigballen', 'benoetigteEuroboxen'],
    render: (ctx) => React.createElement(EventQuantityCalcPlugin, ctx)
  },
  {
    id: 'haccp-protocol',
    name: '1-Klick-HACCP-Protokoll',
    shortLabel: 'HACCP-Protokoll',
    description:
      'Schnelle Temperatur- und Hygiene-Dokumentation (Kühlung, Saladette, Warmwasser, 4 Checks) inkl. Tagesverlauf & CSV-Nachweis.',
    recommendedDomains: ['arbeit'],
    metaKeysUsed: [],
    render: (ctx) => React.createElement(HaccpProtocolPlugin, ctx)
  }
];
