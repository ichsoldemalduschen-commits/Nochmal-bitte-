# SPEC.md – Feste Architektur-Gesetze (NexusFlow PWA)

## 1. Visuelles Design-System (Anthrazit & Petrol)
- **Hintergrund Hauptfläche (`bgMain`):** `#181A1B`
- **Karten & Container (`bgCard`):** `#24292E`
- **Unterpunkte & Listen-Elemente (`bgSub`):** `#2F363D`
- **Primär-Akzent (`accentPrimary`):** `#0A9396`
- **Highlight-Akzent (`accentHighlight`):** `#14B8A6`
- **Text Primär / Meta:** `#F8F9FA` / `#9CA3AF`
- **KI-Indikator:**
  - **Vorne (Mobil / Alltag):** Ausschließlich ein dezenter `6px` roter Punkt (`#EF4444`), antippbar zum Bestätigen. Keine überladenen Metadaten-Fußzeilen unter kompakten Tasks.
  - **Hinten (Desktop-Backoffice):** Volles „KI-bearbeitet“-Badge inklusive Änderungszeitpunkt, Quelle und Undo-/Verschiebe-Option.
- **Abhak-Regel:** Erledigte Tasks und Einkäufe werden **niemals durchgestrichen**, damit Maße, Bezeichnungen und Mengen jederzeit lesbar bleiben.

## 2. Zwei-Schichten-Navigation
### Schicht 1: Front-Ansicht (Mobil Hochkant `max-w-md` / Ziehharmonika-Fokus)
1. **Domänen-Umschalter:** `?? ARBEIT` (Pizza Bandit, Bäckerei) vs. `? PRIVAT` (Smart Home, Gewohnheiten, Alltag).
2. **Ziehharmonika-Auswahl:** Sobald ein Projekt aktiv ist, zieht sich die Projektliste zu einer schmalen Breadcrumb-Leiste zusammen.
3. **5 feste Reiter pro Projekt:**
   - `Tasks` (inkl. „Checkliste für Einsatz zurücksetzen“ & 1-Klick-Übertrag in den Einkaufswagen)
   - `Arbeitserklärungen` (Schritt-für-Schritt-Abläufe, Metadaten nur im aufgeklappten Zustand)
   - `Allgemeine Infos` (Referenzwerte + IndexedDB Datei-/Foto-/PDF-Anhänge)
   - `Einkaufswagen` (inkl. ausklappbarem Beschaffungs-Check)
   - `? Extras` (Rendert isolierte Steckkarten-Plugins des jeweiligen Projekts)
4. **Flip-7-Cover-Modus (`?mode=cover`):** Quadratisches 3.4"-Widget mit großem Petrol-Mikrofon-Button und den Top 3 offenen Tasks zum Sofort-Abhaken.

### Schicht 2: Backoffice-Zentrale (Desktop `max-w-6xl` – 4 Hauptbereiche)
1. `? Auswertung & Historie` (POS Event-Abrechnungen mit CSV/TSV-Export, KI-Protokoll mit Undo/Move, Selbst-Check-Verlauf, Aktenschrank/Archiv)
2. `? Planung & Automatisierung` (4 Tagesblöcke, KI-Tagesstrukturierung, Großprojekt-Etappenrechner, `.ics`-Export)
3. `? Add-on Zentrale` (Plugin-Verwaltung je Projekt + Schnell-Timer/Notizrechner & Teigrechner)
4. `?? System & Schnittstellen` (Gemini API-Key, JSON-Schema, Flip-7-Direktstart, Home Assistant Webpage-Card & Webhook, IndexedDB Voll-Backup)

## 3. Strikte Plugin-Isolation (`src/plugins/`)
- Jedes Zusatz-Werkzeug liegt isoliert in `src/plugins/`.
- Plugins verändern niemals direkt den globalen App-Kern, sondern kommunizieren ausschließlich über typisierte Callbacks (`PluginContextProps`) und `project.customMeta`.
