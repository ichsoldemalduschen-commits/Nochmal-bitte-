# NexusFlow PWA – Architektur-Leitplanken

> Verbindliche Designregeln für alle künftigen Änderungen an der Codebasis.
> Abweichungen erfordern eine bewusste Entscheidung und einen Kommentar im Commit.

---

## 1  Touch & Typografie

- **Touch-Ziele:** Alle interaktiven Flächen (Buttons, Links, Icons) mindestens `min-h-[44px] min-w-[44px]`.
  - Kompakte Icon-Buttons in engen Layouts: `w-11 h-11` (44 px) als Minimum.
  - Niemals `w-7 h-7` (28 px) oder kleiner für tappbare Elemente.
- **Kartentitel:** `text-base` (16 px / 1 rem) als Mindestgröße für Überschriften, kein `truncate` / `text-overflow: ellipsis` (Titel brechen sauber mehrzeilig um).
- **Zwei klare Schrift-Ebenen:**
  - Weiche Leseschrift (`Inter`, Fallback System-Sans) für alle Titel und Fließtexte.
  - Präzise Mono-Schrift (`JetBrains Mono`, Fallback `ui-monospace`) für Mengen (`10 Stk`), Maße (`60x40x7 cm`), Preise (`119,00 €`) und Zeitangaben (`font-mono`).
- **Fließtext / Labels:** Mindestens `text-xs` (12 px). `text-[10px]` oder `text-[11px]` nur für dekorative, nicht klickbare Hilfstexte.

---

## 2  Kartendesign & Farb-DNA

| Ebene / Element | Farbe / Token | Rahmen / Border |
|---|---|---|
| App-Hintergrund (Canvas) | `#111317` | – |
| Kartenfläche (Surface) | `#191C22` | `rgba(255,255,255,0.04)` |
| Sub-Items / Dropdowns | `#111317` / `#22262F` | `rgba(255,255,255,0.06)` |
| Haupttext (Titel) | `#F1F5F9` | – |
| Meta-Text (Mengen, Preise, Zeiten) | `#94A3B8` | – |
| Schultertipp- / Hinweis-Farbe | `#E5A93C` (Honig-Gold) | `rgba(229,169,60,0.2)` |

Standard-Projektfarben (Defaults):
- **Pizza Bandit:** `#0D9488` (Tiefes Petrol)
- **Backstube:** `#D96B43` (Warmes Ziegel-Terrakotta)
- **Privat:** `#8B7EC8` (Ruhiges Rauch-Violett)

Atmosphäre & Listenaufbau:
- **Weg mit „Kasten-in-Kasten“:** Keine unnötigen äußeren Container-Rahmen um Listen. Karten sitzen direkt mit ruhigem Abstand auf dem `#111317`-Canvas.
- **Ambient-Glow:** Hauchfeiner Glow (ca. 14–18 % Deckkraft der aktuellen Projektfarbe) oben am Bildschirmrand.
- **Dunkler Fade-Out:** Weicher Verlauf (`transparent → #111317`) am unteren Bildschirmrand vor der Aktionsleiste.

---

## 3  ADHS-Regeln & Karten-Bedienung

- **Einheitliche Zwei-Zonen-Karten ohne „•••“:**
  - **Linke Abhak-Zone (mind. 44×44 px, `e.stopPropagation()`):** Tippen hakt NUR ab bzw. streicht zart durch (`line-through text-[#94A3B8]/60`) – klappt die Karte niemals auf.
  - **Rest der Karte (Titel & Fläche):** Tippen klappt die Karte In-Place auf. Oben Kontext-Infos (Beschreibung, Baugruppe, Preis/Händler, Link, Zeit), darunter die kompakte Aktionsleiste (Bearbeiten, Verschieben, Kopieren, Löschen).
- **Sanftes Abhaken & 4-Sekunden-Rückgängig-Leiste:**
  - Beim Abhaken leuchtet der Status ca. 400–500 ms weich auf, bevor der erledigte Eintrag sanft umsortiert wird.
  - Nach jedem Abhaken oder Löschen erscheint für 4 Sekunden direkt über der unteren Leiste eine ruhige „Rückgängig“-Leiste (`min-h-[44px]`).
- **KI-Hinweise ohne Alarm-Rot:** Hinweis-/Schultertipp-Farbe ist warmes Honig-Gold `#E5A93C`. Ersetzt jegliches Alarm-/Vorwurfs-Rot (z. B. dezentes Honig-Gold-Badge `#E5A93C` statt grellroter Flächen).
- **Klare Hinweise bei fehlender Konfiguration:** Keine „toten“, stummen Buttons. Bei fehlendem Gemini-Key, inaktivem Sync oder fehlenden Funktionen erscheint ein zentraler, unaufdringlicher Honig-Gold-Toast (`#E5A93C`) mit direktem Sprung-Link in den passenden Zentrale-Bereich (`projects`, `focus`, `ai` oder `system`).
- **Progressive Disclosure:** Formulare, Einstellungen und Extras sind standardmäßig eingeklappt und öffnen erst auf Nutzerinteraktion.
- **Fokus-Anker:** Der „Wo war ich gerade?"-Anker (`adhdFocusAnchor`) bleibt immer sichtbar ganz oben, solange aktiviert.

---

## 4  Storage & Modularität

### Storage-Hierarchie
1. **IndexedDB (`idb-keyval`, Key `nexusflow_pwa_v1_state`):** Primärer Speicher für den gesamten `AppStateSnapshot` (Projekte, Tasks, Cart, Infos, Abläufe, Logs, `userApiKey`).
2. **LocalStorage (Key `nexusflow_pwa_v1_fallback`):** Nur als Fallback bei IDB-Fehler.
3. **LocalStorage (spezifische Keys):** Ausschließlich für transiente UI-Zustände (Foto-Pins, Prefs, Chat-Historie). Langfristig in IDB migrieren.

> **Regel:** Neue persistente Nutzerdaten gehören in `AppStateSnapshot` (→ IDB), nicht in neue `localStorage`-Keys.

### Modularität
- **Plugins:** Neue isolierte Werkzeuge ausschließlich in `src/plugins/` anlegen und über `src/plugins/registry.ts` registrieren.
- **Kern-Code:** Keine projektspezifischen IDs, Namen oder Farben direkt im Kern-Code hardcoden. Branching-Logik für Projekte gehört in eine künftige `brandConfig.ts`.
- **Feature-Flags:** Neue optionale Funktionen über `Project.enabledPlugins[]` oder `Project.customMeta` steuerbar machen.

---

## 5  Drawer & Gesten

- **Edge-Swipe-Erkennung:** Der Touch-Start muss innerhalb von `≤ 30 px` vom linken Viewport-Rand liegen (gemessen an `clientX`, nicht an einem inneren Element-Offset).
- **Progressives Mitführen:** `onTouchMove` aktualisiert eine `drawerTranslateX`-State-Variable mit `transform: translateX()`, damit das Menü flüssig am Finger mitfährt.
- **Öffnungs-Schwelle:** deltaX > 50 px bei deltaY < 60 px → Drawer öffnet mit Feder-Animation.
- **Schließ-Schwelle:** deltaX < −50 px bei deltaY < 60 px → Drawer schließt.

---

## 6  PWA / Manifest

- **Icons:** Separate Einträge für `purpose: 'any'` und `purpose: 'maskable'` – nie kombiniert als `'any maskable'`.
- **`index.html`:** Enthält immer `<link rel="icon">` und `<link rel="apple-touch-icon">` für iOS-Home-Screen-Unterstützung.
- **`?mode=cover`:** Resize-Handler aktualisiert Cover-Mode bidirektional, es sei denn, `?mode=cover` ist explizit als URL-Parameter gesetzt.

---

## 7  Versionierung & Commits

- Commit-Format: `<type>: <kurze Beschreibung>` (z.B. `fix:`, `feat:`, `refactor:`, `docs:`)
- Vor jedem Merge: `npm run build` muss fehlerfrei durchlaufen.
- Keine Commits mit `console.error`-Lücken in Produktionspfaden.

---

## 8  Mobile-Overflow-Regel (390 px)

Auf **390 px Viewportbreite** darf kein Element horizontal aus Karten oder dem Viewport ragen.

- Alle Flex-Children: `min-w-0` setzen, damit `text-overflow` / `truncate` greift.
- Button-Leisten: `flex-wrap` statt erzwungener Einzeiligkeit.
- Keine fixe `min-width` auf Karten-Inhalten, die breiter als der Container werden kann.
- Testlauf: DevTools → 390 × 844 (iPhone 14) → kein horizontaler Scrollbalken auf `<body>`.

---

## 9  git diff Schutzregel

Vor jedem Commit **muss** per `git diff --stat` geprüft werden, dass keine bestehenden UI-Bereiche oder Features außerhalb des aktuellen Auftrags gelöscht wurden.

- Große negative Zeilendifferenzen ohne Gegenstück (z. B. Rename/Move) sind ein Warnsignal.
- Stichproben im Diff: Bestehende Sektionen (Azure, Gisela, Backoffice-Tabs, v4.0-Funktionen) müssen vollständig erhalten bleiben.
- Erst nach bestandener Prüfung darf committed werden.

---

## 10  Modulare Ordnerstruktur `src/core/front/`

Die ehemalige Mono-Datei `FrontWorkspace.tsx` (> 2 500 Zeilen) ist in eigenständige Module zerlegt:

| Modul | Verantwortung |
|---|---|
| `FrontWorkspace.tsx` (Shell) | Shared State (Prefs, Drawer, Theme), Touch-Handler, Layout-Orchestrierung |
| `front/NavigationDrawer.tsx` | Linker Swipe-Drawer mit Projekt-/Domain-Navigation |
| `front/FrontHeader.tsx` | Projekt-Kopfzeile, Suche, Logo-Upload |
| `front/TasksView.tsx` | Task-Liste, Hinzufügen, Sortierung, ADHS-Features |
| `front/CartView.tsx` | Einkaufswagen-Sektion |
| `front/KnowledgeView.tsx` | Wissens-Sektion (Erklärungen, Infos, Attachments) |
| `front/ExtrasView.tsx` | Plugin-Rendering |
| `front/AiBottomBar.tsx` | Untere KI-Eingabeleiste |
| `front/HexThumbHub.tsx` | Sechskant-Daumenmodul & Daumen-Fächer (Block D) |
| `front/SingleFocusOverlay.tsx` | 1-Fokus Lesebrillen-Overlay (Block D) |
| `front/index.ts` | Barrel-Reexport aller Module |

> **Regel:** Neue Front-Features gehören in das passende Modul oder ein neues Modul unter `src/core/front/`, nicht zurück in die Shell.

---

## 11  Zentrale (ehemals Backoffice/Einstellungen)

Die gesamte Einstellungs-Ansicht heißt für den Nutzer **„Zentrale"** (intern bleibt der Dateiname `BackofficeWorkspace.tsx` stabil). Die Zentrale ist in **4 Überbereiche** aufgeteilt, die beim Öffnen standardmäßig **alle zugeklappt** sind:

| Nr | Bereich | `ZentraleSectionId` | Inhalt |
|---|---|---|---|
| 1 | Projekte & Werkzeuge | `projects` | Projektkarten (390px-Fix: nur Farbpunkt + voller Name + Pfeil), Bild-Tausch, Farb-Presets, Lifecycle, Domain, Module, Plugins, JSON-Export, Archiv |
| 2 | Fokus, Bedienung & Optik | `focus` | ADHS & Fokus, Personalisierung, Tagesplaner (4 Blöcke & .ics), Cover-Display & Checks |
| 3 | KI & Stimme „Gisela" | `ai` | Gemini API-Key & Modellwahl, Azure Speech + Gisela-Test + Offline-Fallback |
| 4 | Daten, Backup & System | `system` | Backup/Export/Import, Vorlagen-Tresor (Blueprints), Aktenschrank, Cloud-Sync, Push, Smart Home |

**Fußzeile (immer sichtbar):** Build-Stempel in `font-mono` + „Neu laden"-Button.

**Deep-Link via `initialSection`:** Honig-Gold-Toasts und View-Settings-Buttons springen direkt zum passenden Bereich (`TasksView` → `focus`, `CartView`/`KnowledgeView` → `projects`, API-Key fehlt → `ai`).

---

## 12  Automatisches Schutznetz & Pflicht-Gate (`npm run verify`)

Für jede künftige Änderung gilt ein verbindliches E2E-Qualitätsgate auf mobilem Viewport (**390×844 px**):

- **Befehl:** `npm run verify` im Verzeichnis `nexusflow-pwa` (führt `npm run build && npm run test:guard` aus).
- **Pflicht vor jedem Git-Push:**
  1. `npm run build` muss fehlerfrei durchlaufen.
  2. Playwright Mobile-Guard (`tests/mobile-guard.spec.ts`) muss alle Stationen (Start & Kopfleiste, NavigationDrawer, TasksView, CartView, KnowledgeView, AiBottomBar & VoiceModal, Zentrale mit allen 4 Überbereichen, Deep-Links) zu 100 % grün durchlaufen.
  3. Strikte Wächter: 0 ungefangene `pageerror`-Exceptions, 0 unberechtigte `console.error`-Meldungen, 0 horizontale Viewport-Überläufe (`document.documentElement.scrollWidth <= window.innerWidth + 1`).

---

## 13  Block D – Sechskant-Daumenmodul, Daumen-Fächer, 1-Fokus-Overlay & Vorschriften-Wächter

- **`front/HexThumbHub.tsx`:** Ergonomisches Sechskant-Daumenmodul (~64×64 px, SVG-Hexagon mit weichen Ecken) im unteren Daumenbogen mit feinem Rahmen & Lichtsaum in Projektfarbe.
  - **Feature-Flag `thumbHubEnabled`:** Steuert Umschaltung zwischen `HexThumbHub` (Standard: `true`) und der klassischen unteren Leiste als Fallback.
  - **Parkplatz `thumbHubPosition`:** `'left' | 'center' | 'right'` (Standard: `'center'`).
  - **Android-Schutz:** Sicheres Padding (`bottom-[max(1rem,env(safe-area-inset-bottom))]`), kein Lichtsaum ganz unten am Bildschirmrand. Beim Nach-unten-Scrollen sanftes `scale-90 opacity-80`.
  - **Zwei werkstatttaugliche Handgriffe:**
    1. **Kurzer Tipp:** Öffnet Daumen-Fächer (`bg-[#0B0D11]/80 backdrop-blur-md`, Übergang `cubic-bezier(0.22, 1, 0.36, 1)`) mit Sprechen-Direktknopf, Projektwechsel, Bereichswechsel (Aufgaben · Einkauf · Wissen), Werkzeugen (1-Fokus, Vorschriften-Wächter ⚖️, Zentrale) sowie „⌨ Kurz tippen…“ für Lautlos-Eingabe.
    2. **Drücken & Halten (~350 ms):** Kurzer Impuls (`vibrate(20)`), Sechskant atmet auf und startet direkt das bestehende `VoiceModal` im Einrast-Modus.
- **`front/SingleFocusOverlay.tsx`:** Reines Aufsatz-Overlay (`bg-[#0B0D11]/88 backdrop-blur-md`, z-50).
  - Zeigt genau **eine** große Aufgaben-Karte (`#191C22`, 3px Projektfarbstreifen links, Titel groß in `Inter`, Zeit in `JetBrains Mono`).
  - Kleiner Schalter **„5-Min-Start“** mit hauchdünner, gleichmäßig schrumpfender Fortschritts-Linie in Projektfarbe (keine hektisch springenden Ziffern).
  - Genau zwei große wertfreie Daumen-Knöpfe (`min-h-[48px]`): **„Erstmal parken“** (schaltet wertfrei zur nächsten Aufgabe oder schließt) und **„Erledigt ✓“** (hakt ab inkl. 4-Sekunden-Rückgängig-Leiste).
- **Vorschriften-Wächter-Schalter (`legalWatchEnabled`):** Pro Projekt in der Zentrale konfigurierbar (Standard: `true` für Business, `false` für Privat). Bei Deaktivierung verschwindet das Waage-Icon nach dem Prinzip der geschlossenen Schublade komplett aus der Oberfläche.


