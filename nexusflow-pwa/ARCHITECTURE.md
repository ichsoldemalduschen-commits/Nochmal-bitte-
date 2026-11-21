# NexusFlow PWA – Architektur-Leitplanken

> Verbindliche Designregeln für alle künftigen Änderungen an der Codebasis.
> Abweichungen erfordern eine bewusste Entscheidung und einen Kommentar im Commit.

---

## 1  Touch & Typografie

- **Touch-Ziele:** Alle interaktiven Flächen (Buttons, Links, Icons) mindestens `min-h-[44px] min-w-[44px]`.
  - Kompakte Icon-Buttons in engen Layouts: `w-11 h-11` (44 px) als Minimum.
  - Niemals `w-7 h-7` (28 px) oder kleiner für tappbare Elemente.
- **Kartentitel:** `text-base` (16 px / 1 rem) als Mindestgröße für Überschriften.
- **Fließtext / Labels:** Mindestens `text-xs` (12 px). `text-[10px]` oder `text-[11px]` nur für dekorative, nicht klickbare Hilfstexte.
- **Monospace-Ziffern:** `font-mono` für Zähler, Preise und Messangaben.

---

## 2  Kartendesign

| Kontext | `border-radius` | `border` | Hintergrundfarbe |
|---|---|---|---|
| Ruhige Karten (Haupt-Content) | `rounded-3xl` | `border-white/5` | `#1C2026` / `#242930` |
| Kompakte Sub-Items | `rounded-2xl` | `border-white/10` | `#181A1B` |
| Modals | `rounded-2xl` | `border-white/15` | `#1C2026` |
| Accent-Modals (Teal) | `rounded-2xl` | `border-[#14B8A6]/50` | `#1C2026` |

Hintergrundfarben der App-Ebenen:
- **Root-Hintergrund:** `#181A1B`
- **Karten / Panels:** `#1C2026`
- **Kompakte Sub-Items:** `#242930`

---

## 3  ADHS-Regeln

- **Zartes Durchstreichen erlaubt:** Erledigte Einträge dürfen zart durchgestrichen (`line-through`) und leicht ausgegraut werden, um Platz auf schmalen Screens zu sparen. Die Markierung muss jederzeit umkehrbar sein.
- **KI-Änderungsmarkierung:** Automatische KI-Modifikationen an Einträgen immer mit rotem Punkt `●` (`color: #EF4444`) kennzeichnen (entspricht dem `aiTouched`-Flag).
- **Progressive Disclosure:** Formulare, Einstellungen und Extras sind standardmäßig eingeklappt und werden erst auf Nutzerinteraktion geöffnet (`isAddingTask`, `isAddingInfo` etc.). Niemals beim Laden aufgeklappte Formulare zeigen.
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
| `front/index.ts` | Barrel-Reexport aller Module |

> **Regel:** Neue Front-Features gehören in das passende Modul oder ein neues Modul unter `src/core/front/`, nicht zurück in die Shell.
