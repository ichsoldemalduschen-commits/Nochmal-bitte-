# FOCUS.OS / NexusFlow PWA – BYOK & Open-Source-Starter

Sprachgeführtes externes Gedächtnis auf Basis von **Bring Your Own Key (BYOK)**.
Alle Projekte, Aufgaben, Einkaufslisten, Belege und API-Keys bleiben zu **100 % lokal in deinem Browser (IndexedDB)** – es gibt keinen zentralen Server-Zwang.

## 1. Forken & Lokal Starten

```bash
git clone <dein-fork-url>
cd nexusflow-pwa
npm install
npm run dev
```

## 2. Neutrales Open-Source-Starter-Profil (ohne persönliche Daten)

Um die App komplett ohne persönliche Vorbelegungen mit zwei neutralen Projekten (**Arbeit** & **Privat**) zu starten oder zu bauen:

- **Direkt im Browser (Test / Erststart):**
  `http://localhost:5173/Nochmal-bitte-/?starter=neutral`
- **Als eigener neutraler Produktions-Build:**
  ```bash
  VITE_STARTER_PROFILE=neutral npm run build
  ```

Beim Erststart öffnet sich automatisch der ruhige **3-Schritte-Assistent**:
1. **Profil & Ruhe:** Neutrales Starter-Profil (*Arbeit & Privat*) wählen oder bestehende Projekte behalten.
2. **Eigene API-Keys (optional):** Eigenen **Gemini API-Key** (z. B. über Google AI Studio) und optional **Azure Speech Key & Region** (für Stimme „Gisela“) eintragen – Spracheingabe & lokale Listen laufen auch komplett ohne Key offline.
3. **Einhand-Bedienung & Start:** Sechseck-Parkplatz (`Links` / `Mitte` / `Rechts`) und Begleiter-Startmodus festlegen.

Alle Einstellungen lassen sich jederzeit in der **Zentrale → 5. Daten, Backup & System → BYOK & Open-Source-Starter** anpassen oder als personenfreie Starter-JSON (`focus-os-neutral-starter.json`) exportieren.

## 3. Pflicht-Qualitätsgate (Build & 26 Playwright-Stationen)

Vor jedem Commit/Merge auf 390×844 px prüfen:

```bash
npm run verify
```
