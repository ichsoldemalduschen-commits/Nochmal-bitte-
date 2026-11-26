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
- **Ambient-Glow & 3-Stufen-Hintergrundbeleuchtung (`ambientLightMode`):**
  - `'off'`: Ruhiger `#111317`-Canvas ohne zusätzliche Lichtelemente.
  - `'static'`: Dezenter, großflächiger Grundschimmer (~8–10 % Deckkraft) in aktiver Projektfarbe ohne Bewegung.
  - `'shimmer'` (Standard): Drei weichgezeichnete GPU-Farbflächen (blur, Deckkraft 6–10 %) in Projektfarbe, die sich in einem langsamen 18–22s-Zyklus hinter den Karten bewegen (`pointer-events-none`, `@media (prefers-reduced-motion: reduce)`-konform).
- **Dunkler Fade-Out:** Weicher Verlauf (`transparent → #111317`) am unteren Bildschirmrand vor der Aktionsleiste.

---

## 3  ADHS-Regeln & Karten-Bedienung

- **Tasks-Kopfzeile beruhigt:**
  - Rechts neben „Tasks“ stehen genau zwei kompakte Buttons: `+` (Aufgabe anlegen, einziger direkter 1-Tipp-Button) und `⋮` (Mehr-Aktionen).
  - Das `⋮`-Menü (`min-h-[44px] min-w-[44px]`, ruhiges Dropdown mit `rounded-2xl bg-[#191C22] border border-white/10 shadow-xl`) bündelt 1-Fokus, Checkliste zurücksetzen und Aufgaben-Einstellungen (Deep-Link in Zentrale Bereich `focus`).
  - Doppelter Einstellungsbutton am Listenende entfällt.
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

### Storage-Hierarchie & Schema v2 (`schemaVersion: 2`)
1. **IndexedDB (`idb-keyval`, Key `nexusflow_pwa_v1_state`):** Primärer Speicher für den gesamten `AppStateSnapshot` (Projekte, Tasks, Cart, `knowledge`, `aiLogs`, `userApiKey`, `schemaVersion: 2`).
2. **Idempotente Migration (`migrateAppState` / `migrateProject` in `src/services/storage.ts`):** Läuft an allen 3 Eingängen (IDB-Start, Voll-Backup-Import, Projekt-JSON-Import). Normalisiert Domänen strikt auf `'business' | 'private'`, Prioritäten auf `'Hoch' | 'Mittel' | 'Niedrig'`, überführt Alt-Arrays (`explanations`/`infos`) verlustfrei in `project.knowledge` (Single Source of Truth) und extrahiert `[Gruppe]`-Titelpräfixe sauber in `task.assemblyGroup`.
3. **LocalStorage (Key `nexusflow_pwa_v1_fallback`):** Nur als Fallback bei IDB-Fehler.
4. **LocalStorage / IDB (spezifische Keys):** Transiente UI-Zustände & Zusatz-Stores (Foto-Pins, Prefs, Chat-Historie, Belege, Dossiers, POS-Slots, Pizza-Katalog).

> **Regel:** Neue persistente Nutzerdaten gehören in `AppStateSnapshot` (→ IDB), nicht in neue `localStorage`-Keys.

### Zentrale Konfigurations-Tokens (`src/config/`)
- **`src/config/designTokens.ts` (`DESIGN_TOKENS`):** Single Source of Truth für Design-DNA (`canvas: '#111317'`, `surface: '#191C22'`, `accentHoney: '#E5A93C'`, Projekt-Presets, `minTouchPx: 44`, `minFontPx: 12`).
- **`src/config/runtimeConfig.ts`:** Zentrale Timing- & Schwellenwert-Konstanten für Sprach-KI (`VOICE_START_DEBOUNCE_MS`, `TTS_ECHO_COOLDOWN_MS`, `TTS_PLAYBACK_WATCHDOG_MIN_MS`, `STT_ABORT_RETRY_DELAY_MS`, `STT_MAX_CONSECUTIVE_ABORTS`, `API_TIMEOUT_FLASH_MS`, `API_TIMEOUT_PRO_MS`) sowie UI-Timer (`CHECK_GLOW_MS`, `UNDO_TOAST_MS`, `REMINDER_POLL_INTERVAL_MS`).

### Modularität & Modal-Konsolidierung
- **Plugins:** Neue isolierte Werkzeuge ausschließlich in `src/plugins/` anlegen und über `src/plugins/registry.ts` registrieren.
- **Kern-Code:** Keine projektspezifischen IDs, Namen oder Farben direkt im Kern-Code hardcoden. Farb-Tokens stammen aus `designTokens.ts` über `brandConfig.ts`.
- **Feature-Flags:** Neue optionale Funktionen über `Project.enabledPlugins[]` oder `Project.customMeta` steuerbar machen.
- **Modal-Wrapper (`DeepResearchAndAuditModal.tsx`):** Schlanker Wrapper über `DeepResearchView.tsx`, `ReceiptScanView.tsx` und Cloud/Push ohne duplizierte IDB-Logik.

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
| `front/NavigationDrawer.tsx` | Linker Swipe-Drawer mit Projekt-/Domain-Navigation & 3er-Schnellleiste |
| `front/FrontHeader.tsx` | Projekt-Kopfzeile, Suche, Logo-Upload |
| `front/TasksView.tsx` | Task-Liste, Kopfzeile (+ & ⋮-Menü), Sortierung, ADHS-Features |
| `front/CartView.tsx` | Einkaufswagen-Sektion |
| `front/KnowledgeView.tsx` | Wissens-Sektion (Erklärungen, Infos, Attachments) |
| `front/ExtrasView.tsx` | Plugin-Rendering |
| `front/ReceiptScanView.tsx` | Beleg-Scan-Kartenansicht (Kamera/Upload, Erkennung, Abgleich mit Einkaufswagen) |
| `front/DeepResearchView.tsx` | Deep-Research-Kartenansicht (Recherche-Start, Dossier-Karten, Quellen, To-do-Übernahme) |
| `front/HexThumbHub.tsx` | Sechskant-Daumenmodul & Daumen-Fächer (Block D) |
| `front/SingleFocusOverlay.tsx` | 1-Fokus Lesebrillen-Overlay (Block D) |
| `front/index.ts` | Barrel-Reexport aller Module |

> **Regel:** Neue Front-Features gehören in das passende Modul oder ein neues Modul unter `src/core/front/`, nicht zurück in die Shell.

---

## 11  Zentrale (ehemals Backoffice/Einstellungen)

Die gesamte Einstellungs-Ansicht heißt für den Nutzer **„Zentrale"** (intern bleibt der Dateiname `BackofficeWorkspace.tsx` stabil). Die Zentrale ist in **4 Überbereiche** aufgeteilt, die beim Öffnen standardmäßig **alle zugeklappt** sind:

| Nr | Bereich | `ZentraleSectionId` | Inhalt |
|---|---|---|---|
| 1 | Projekte & Werkzeuge | `projects` | Projektkarten (390px-Fix: nur Farbpunkt + voller Name + Pfeil), Gesamt-Übersicht-Schalter (`overviewEnabled`), Bild-Tausch, Farb-Presets, Lifecycle, Domain, Module, Plugins, JSON-Export, Archiv |
| 2 | Fokus, Bedienung & Optik | `focus` | 3-Stufen-Hintergrundbeleuchtung (`off` / `static` / `shimmer`), ADHS & Fokus, Personalisierung, Tagesplaner (4 Blöcke & .ics), Cover-Display & Checks |
| 3 | KI & Stimme „Gisela" | `ai` | Gemini API-Key & Modellwahl, Azure Speech + Gisela-Test + Offline-Fallback |
| 4 | Daten, Backup & System | `system` | Cloud-Synchronisation & Push-Zentrale (URL, Token, Auto-Sync, Manuell Hochladen/Herunterladen), Backup/Export/Import, Vorlagen-Tresor (Blueprints), Aktenschrank, Smart Home |

**Fußzeile (immer sichtbar):** Build-Stempel in `font-mono` + „Neu laden"-Button.

**Deep-Link via `initialSection`:** Honig-Gold-Toasts und View-Settings-Buttons springen direkt zum passenden Bereich (`TasksView` → `focus`, `CartView`/`KnowledgeView` → `projects`, API-Key fehlt → `ai`, Cloud-Sync / Status → `system`).

---

## 12  Automatisches Schutznetz & Pflicht-Gate (`npm run verify`)

Für jede künftige Änderung gilt ein verbindliches E2E-Qualitätsgate auf mobilem Viewport (**390×844 px**):

- **Befehl:** `npm run verify` im Verzeichnis `nexusflow-pwa` (führt `npm run build && npm run test:guard` aus).
- **Pflicht vor jedem Git-Push:**
  1. `npm run build` muss fehlerfrei durchlaufen.
  2. Playwright Mobile-Guard (`tests/mobile-guard.spec.ts`) muss alle 14 Stationen (Start & Kopfleiste, NavigationDrawer, TasksView, CartView, KnowledgeView, Block D & VoiceModal, Zentrale mit allen 4 Überbereichen, Deep-Links, Werkzeuge/POS, Wissen-Lösch-Undo & konsolidiertes Modal, Sammel-Tasks/`subTasks`, proaktive Erinnerungen, unsichtbare 3-Modi-Erkennung, Sprach-KI Rundum-Sanierung) zu 100 % grün durchlaufen.
  3. Strikte Wächter: 0 ungefangene `pageerror`-Exceptions, 0 unberechtigte `console.error`-Meldungen, 0 horizontale Viewport-Überläufe (`document.documentElement.scrollWidth <= window.innerWidth + 1`).

---

## 13  Block D – Lebendiger Sechseck-Begleiter (3-Stufen-Morph) & Schnellauswahl-Menü

- **`front/HexThumbHub.tsx`:** Lebendiger KI-Begleiter im unteren Daumenbogen:
  - **Stufe 0 – Präsenter Sechseck-Anker (~72×72 px):** SVG-Hexagon mit doppelter Kontur (Projektfarben-Außenrand + feiner weißer Innenrand, dunkler Kern `#14171D`, Tiefenschatten und sanft atmendem äußerem Projektfarben-Lichtsaum via GPU-Animation `.hex-companion-breathing`, respektiert `prefers-reduced-motion`).
  - **Feature-Flag `thumbHubEnabled`:** Steuert Umschaltung zwischen `HexThumbHub` (Standard: `true`) und der klassischen unteren Leiste als Fallback.
  - **Parkplatz `thumbHubPosition`:** `'left' | 'center' | 'right'` (Standard: `'center'`), sicherer Abstand zur Android-Wischleiste (`pb-[max(1rem,env(safe-area-inset-bottom))]`), `touch-action: none`.
  - **Gesten-Trennung (0 ms Latenz für die KI):**
    1. **1× kurzer Tipp:** Sofortiges Aufwachen ohne Wartezeit in **Stufe 1** (Start der Sprachaufnahme/Zuhören-Sitzung, 1–2 konzentrische Sechseck-Lichtringe in Projektfarbe `.hex-pulse-ring-anim`).
    2. **Kurzer Wisch nach oben (~30 px) ODER ~320 ms gedrückt halten:** Dezente Lade-Kontur in Honig-Gold (`#E5A93C`) + 20-ms-Vibration öffnet das Schnellauswahl-Kontextmenü (Projekte, Bereiche, Werkzeuge mit 1-Fokus, Einkauf (Schwebend), Vorschriften-Wächter ⚖️, Zentrale, „⌨ Kurz tippen…“).
- **`core/VoiceModal.tsx` – 3-Stufen-Morphing:**
  - **Stufe 1 – Kompakter, wacher Begleiter:** Schwebt als abgerundete Karte (~170–190 px, `rounded-[26px] bg-[#191C22]/94 backdrop-blur-md`, Projektfarben-Rand) am unteren Bildschirmrand OHNE Vollbild-Backdrop-Blur (Bühne dahinter sichtbar und scrollbar).
    - Zieh-Griff: Hochziehen -> Stufe 2, Runterziehen -> Stufe 0.
    - Mini-Sechseck (44×44 px): Status-Visualisierung (Zuhören: Wellen/Pulsieren, Denken: Honig-Gold `#E5A93C` Spinner, Sprechen: rhythmisches Leuchten `.hex-speak-anim`).
    - Textbereich (2 Zeilen): Live-Transkript bzw. Quittung mit In-Place Rückgängig-Button.
    - 3 Kontrollen (44×44 px): ⌨ (Textzeile ein-/ausklappen), ⊞ (Schnellauswahl öffnen), ⤢ (Vergrößern zu Stufe 2).
    - Smart Auto-Expand: Bei `needsClarification: true` oder Antworten > 120 Zeichen automatisches Expandieren zu Stufe 2.
  - **Stufe 2 – Volles Gespräch & Protokoll:** Vollbild-Backdrop (`bg-[#0B0D11]/78 backdrop-blur-md`), 100 % Erhalt der realen KI- & Sprach-Engine (Web-Speech-API, 5s-Timer, Send-Lock, persistenter Chat, Bestätigungskarten mit Rückgängig, Modus-Schalter ⚡/🧠, Foto-Anhang, Azure Gisela).
    - Kopfzeile mit ⤡ (Verkleinern zu Stufe 1) und ✕ (Schließen zu Stufe 0).
- **`front/FloatingCartOverlay.tsx` – Schwebender Einkaufswagen:**
  - Schwebende Karte (`rounded-[26px] bg-[#191C22]/94 backdrop-blur-md border border-white/10 shadow-2xl`, ca. 75 % Höhe, max-w-[480px], z-[45]) über der aktuellen Ansicht.
  - Z-Index-Hierarchie: NavigationDrawer (`z-[55]`) > FloatingCartOverlay (`z-[45]`) > Sechseck-Begleiter (`z-[40]`).
  - Kopfzeile mit 3 Kontrollen: `—` (Minimieren als Pill `🛒 X offen` oben rechts; Klick stellt Overlay wieder her), `⤢` (Umschalten auf Vollbild-Bühne), `✕` (Schließen).
  - 100 % Konsistenz durch direkte Einbettung von `CartView.tsx` ohne Code-Duplikation.
- **`front/SingleFocusOverlay.tsx`:** Reines Aufsatz-Overlay (`bg-[#0B0D11]/88 backdrop-blur-md`, z-50).
  - Zeigt genau **eine** große Aufgaben-Karte (`#191C22`, 3px Projektfarbstreifen links, Titel groß in `Inter`, Zeit in `JetBrains Mono`).
  - Kleiner Schalter **„5-Min-Start“** mit hauchdünner, gleichmäßig schrumpfender Fortschritts-Linie in Projektfarbe.
  - Genau zwei große wertfreie Daumen-Knöpfe (`min-h-[48px]`): **„Erstmal parken“** und **„Erledigt ✓“** (inkl. 4-Sekunden-Rückgängig-Leiste).
- **Vorschriften-Wächter-Schalter (`legalWatchEnabled`):** Pro Projekt in der Zentrale konfigurierbar. Bei Deaktivierung verschwindet das Waage-Icon nach dem Prinzip der geschlossenen Schublade komplett aus der Oberfläche.




---

## 14  Werkzeug-Einstellungen & IndexedDB-Pizza-Katalog (Paket 3)

### ⚙ Progressive-Disclosure-Einstellungen in `src/plugins/`

Beide Werkzeuge besitzen oben rechts einen ruhigen `⚙`-Button (`min-h-[44px] min-w-[44px]`), der **standardmäßig zugeklappt** ist:

| Werkzeug | Datei | Einstellungs-Inhalt |
|---|---|---|
| Live-Verkaufs-Clicker (POS) | `posTapClicker.tsx` | Tab „Aktive Slots": Katalog-Dropdown, lokale Überschreibung pro Slot; Tab „Pizza-Katalog": CRUD der Stammdaten |
| Teigballen-Kalkulator | `eventQuantityCalc.tsx` | Standard-Teigballen-Gewicht (g), Hydration (%), Ballen/Eurobox → persistent in IDB |

### IndexedDB-Pizza-Katalog & POS-Slots

| IDB-Schlüssel | Typ | Beschreibung |
|---|---|---|
| `banditos_pizza_catalog_v1` | `PizzaCatalogItem[]` | Stammdaten-Katalog (5 Beispiel-Pizzen als Default) |
| `banditos_pos_slots_v1` | `PosPizzaSlot[]` | 3 aktive Standard-Slots (erweiterbar), **Zählerstände werden nicht persistiert** |
| `banditos_dough_calc_defaults_v1` | `DoughCalcDefaults` | Vorgaben für Teigrechner |

### Lokale Slot-Überschreibung (isLocallyOverridden)

- Auswahl einer Sorte im Katalog-Dropdown → `isLocallyOverridden = false`, Werte werden aus Stammdaten übernommen.
- Direkte Eingabe von Titel/Preis/Umfang im Slot → `isLocallyOverridden = true`, **Stammdaten in IDB bleiben 100 % unverändert.**
- „In Katalog speichern": schreibt erst nach bewusstem Klick in die Stammdatenbank zurück.
- „Zurücksetzen": holt Originalwerte aus dem verknüpften Katalog-Eintrag.
- Löschen eines Katalog-Eintrags: betroffene Slots behalten ihre aktuellen Werte, `catalogId` wird auf `null` gesetzt.

> **Regel:** Neue `PosPizzaSlot`-Daten gehören in `banditos_pos_slots_v1` (IDB), keine losen `localStorage`-Keys.


---

## 15  Organischer, mittiger Sechseck-Begleiter & 100-%-Voll-Backup (v2)

### Organischer, mittiger Sechseck-Begleiter (Stufe 0 → Stufe 1 → Stufe 2)

- **Fester Daumen-Anker mittig unten:** Das lebendige Sechseck (~64–72 px) verbleibt beim Aufwachen in Stufe 1 als fester Daumen-Anker unten mittig (`bottom-[max(1rem,env(safe-area-inset-bottom))]`, kein Wegspringen nach oben links).
- **Ruhiges Öffnen erst beim Loslassen (pointerup):** Bei `pointerdown` erfolgt ein sanftes, kontrolliertes Eindrücken (`scale(0.94)`) mit subtilem Lichtaufbau. Erst beim Loslassen eines kurzen Tipps (ohne Wisch oder 320-ms-Halten) feuern konzentrische Lichtringe und das Kontextfeld entfaltet sich per GPU-Animation (`transform`, `opacity`, `cubic-bezier(0.22, 1, 0.36, 1)`, ~340 ms, respektiert `prefers-reduced-motion`) organisch nach oben heraus.
- **Kontextfeld direkt über Sechseck:** Das kompakte Sprach-/Kontextfeld (2 Zeilen Live-Transkript / Quittung inkl. Rückgängig-Button) liegt direkt über dem Sechseck (`bottom-[calc(max(1rem,env(safe-area-inset-bottom))+82px)]`). Die Listen dahinter bleiben vollständig sichtbar und scrollbar (Semi-Integration ohne Fullscreen-Blur).
- **1-Tipp-Schließen:** Ein erneuter Tipp auf das mittige Sechseck beendet sofort das Zuhören, stoppt Gisela und schließt Stufe 1 sanft zurück in Stufe 0.
- **Begleiter-Status:** Zuhören (Projektfarben-Puls), Denken (Honig-Gold #E5A93C) und Sprechen/Gisela (weiches Atmen #14B8A6).
- **Vollwertige Stufe 2:** Umschalten per `⤢` oder Hochziehen auf volles Gesprächs-Modal (Web Speech API, Silence-Timer, Foto-Anhang, Azure TTS „Gisela“) und Rückkehr per `⤡`.

### 100-%-Voll-Backup (backupVersion: 2) & 1-Klick-Projekt-Import

- **Vollständiger JSON-Export (Zentrale Bereich 4):** Exportiert abwärtskompatibel alle lokalen IndexedDB-Daten:
  1. `AppStateSnapshot`: Projekte (inkl. `overviewEnabled`, `legalWatchEnabled`, `enabledTabs`, `lifecycle`, `domain`, `archived`), alle Tasks, Einkäufe, Wissens-Einträge.
  2. Alle Zusatz-Stores aus `storage.ts`: Nutzer-Präferenzen (`ambientLightMode`, `thumbHubEnabled`, `thumbHubPosition`), Vorlagen-Blueprints, Foto-Pins, persistenter KI-Chat, Beleg-Scans (`scannedReceipts`) und Deep-Research-Dossiers (`savedDossiers`).
  3. Paket-3-Werkzeugdaten: `pizzaCatalog`, `posSlots` (inkl. lokaler Event-Überschreibungen) und `doughCalcDefaults`.
- **Dateiname:** `bandit-os-vollbackup-YYYY-MM-DD.json`.
- **Verlustfreier Import:** Stellt alle Stores in IndexedDB und den aktuellen App-State wieder her (abwärtskompatibel für v1-Backups). Quittungskarte direkt in Bereich 4 zeigt gesicherte/wiederhergestellte Elemente an.
- **1-Klick-Projekt-JSON-Import:** Hängt Tasks, Einkäufe und Wissens-Einträge an das Zielprojekt an, ohne Bestehendes zu löschen, und füllt fehlende optionale Felder mit robusten Defaults.

---

## 16  Phase 3 – Sammel-Tasks, Proaktive Erinnerungen & Unsichtbare 3-Modi-Sprach-KI

- **Aufklappbare Sammel-Tasks (`TaskItem.subTasks`):** Aufgaben können beliebig viele Einzelschritte (`SubTaskItem[]`) bündeln. Zugeklappt zeigt die Karte den Fortschrittszähler in `font-mono` (`0/N`) und rotiert automatisch auf den ersten offenen Schritt; bei Erledigung des letzten offenen Sub-Tasks wird der Haupt-Task inkl. 4-Sekunden-Rückgängig-Leiste abgeschlossen (`TasksView.tsx`, `SingleFocusOverlay.tsx`, `Station 11`).
- **Proaktive Erinnerungen (`src/hooks/useReminderEngine.ts`):** Polling bei Start, `visibilitychange` und `REMINDER_POLL_INTERVAL_MS` (`30000 ms`) auf fällige `reminderAt`-Zeiten (ISO & `"HH:mm"`) ohne Doppelfeuer (`lastReminderFiredAt`). Löst ruhiges Honig-Gold-In-App-Banner (`#E5A93C` mit `Erledigt ✓`, `+30 Min`, `OK`), ServiceWorker-/Web-Notifications sowie `DTSTART`/`DTEND`-Werte im `.ics`-Export aus (`Station 12`).
- **Unsichtbare 3-Modi-Erkennung (`src/services/voiceModeClassifier.ts` & `aiRouter.ts`):** Klassifiziert laufende Spracheingaben im Hintergrund nach `quick` (`2800 ms`), `dialog` (`3800 ms`) oder `collect` (`5500 ms`), ersetzt hektisch springende Countdown-Sekunden in `VoiceModal.tsx` durch eine ruhige Fortschrittslinie und steuert automatisches Nachhören über `detectedMode`, `expectFollowUp` und `autoModeDetection` (Default `true`, umschaltbar in Zentrale Bereich 3; `Station 13`).

---

## 17  Sprach-KI Rundum-Sanierung (Audio-Unlock, Gemini-Tempo, Android-STT & Station 14)

- **Synchroner Mobile-Audio-Unlock & Playback-Watchdog (`src/services/azureSpeech.ts`, `HexThumbHub.tsx`, `VoiceModal.tsx`):**
  - Ein einzelnes, wiederverwendbares `HTMLAudioElement` (`sharedAudioElement`) wird via `unlockAudioPlayback()` synchron im direkten User-Tap (Sechseck, „Sofort sprechen“, Mikrofon-Toggle, Senden-Buttons, `testGiselaVoice()`) entsperrt und weckt bei Bedarf `window.speechSynthesis` still auf, sodass asynchrone Antworten nach Gemini + Azure auf Android Chrome / iOS Safari nicht an `NotAllowedError` scheitern.
  - `onEngineUsed?.('azure-gisela')` feuert erst nach erfolgreichem `await audio.play()`.
  - Ein dynamischer Sicherheits-Watchdog (`TTS_PLAYBACK_WATCHDOG_MIN_MS = 12000`, `Math.max(12000, Math.min(45000, text.length * 140))`) schützt sowohl `HTMLAudioElement` als auch `speakBrowserSynthesis` gegen verschluckte `onend`/`onerror`-Events und verhindert `'SPEAKING'`/`micLockedRef`-Deadlocks.
- **Gemini-2.5-Flash-First-Routing & Prompt-Diät (`src/services/aiRouter.ts`, `runtimeConfig.ts`):**
  - Veraltete `gemini-1.5-*`-Modelle sind aus allen Fallback-Listen entfernt (`defaultsFlashFirst: ['gemini-2.5-flash', 'gemini-2.5-pro']`, `defaultsProFirst: ['gemini-2.5-pro', 'gemini-2.5-flash']`).
  - Im `SMART_PRO`-Modus mit ⚡ `Sprech` bleiben Befehle und normale Fragen (`?`) auf `gemini-2.5-flash` mit `thinkingConfig: { thinkingBudget: 0 }` (inkl. sicherem Retry ohne `thinkingConfig` bei HTTP 400); Pro-Eskalation erfolgt gezielt nur bei 🧠 `Research`, `ALWAYS_PRO`, Foto-Anhang oder Tiefenanalyse-Schlüsselwörtern.
  - `fetchAvailableGeminiModels()` läuft ausschließlich bei `404` (nicht bei `400`/`401`/`403`/`429`/`AbortError`/Netzwerkfehler).
  - `buildWorkspaceContextSummary` begrenzt das aktive Projekt auf 10 offene Tasks, 8 Einkäufe und 5 Wissens-Titel (≤ 80 Zeichen) und übrige aktive Projekte auf max. 3 offene Anker-Titel.
  - `askQuickAssistantQuestion` nutzt sauber die aktuelle Projekt-ID und `aiVoiceSettings`; Timeouts sind getrennt (`API_TIMEOUT_FLASH_MS = 12000`, `API_TIMEOUT_PRO_MS = 25000`).
- **Android-Chrome-STT-Härtung & Satzende-Schutz (`VoiceModal.tsx`, `voiceModeClassifier.ts`, `storage.ts`):**
  - `rec.onend` mit bereits erkanntem Text hält die Sitzung mit `1200 ms` Nachlauf bzw. Sammel-Fortsetzung offen; `accumulatedPrefixRef` bewahrt bisheriges Transkript über Auto-Restarts inkl. Überlappungs- und 1-/2-/3-Wort-Phrasen-Deduplizierung.
  - Offene Satzenden (z. B. *„Notiere mal Aufgabe für“*) blockieren `quick` zuverlässig; `importFullBackupV2` synchronisiert `aiVoiceSettings` konsistent in alle Einzel-Keys (`Station 14`).
