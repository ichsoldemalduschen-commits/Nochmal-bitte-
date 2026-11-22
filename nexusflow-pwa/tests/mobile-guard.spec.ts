import { test, expect, Page } from '@playwright/test';

/**
 * Helper to ensure there is no horizontal viewport overflow on 390px width.
 * Requirement: document.documentElement.scrollWidth <= window.innerWidth + 1
 */
async function assertNoHorizontalOverflow(page: Page, contextName: string) {
  const overflow = await page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
    const innerWidth = window.innerWidth;
    return {
      scrollWidth,
      innerWidth,
      hasOverflow: scrollWidth > innerWidth + 1,
    };
  });

  expect(
    overflow.hasOverflow,
    `Horizontaler 390px-Überlauf in [${contextName}]: scrollWidth (${overflow.scrollWidth}px) > innerWidth (${overflow.innerWidth}px)`
  ).toBe(false);
}

/**
 * Attach global error listeners for uncaught page errors and critical console errors.
 */
function attachGlobalErrorWatchers(page: Page, errorLog: string[]) {
  page.on('pageerror', (err) => {
    errorLog.push(`PageError: ${err.message}\n${err.stack || ''}`);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore benign offline / network fetch errors or service worker registration noise
      if (
        text.includes('Failed to load resource') ||
        text.includes('net::ERR_') ||
        text.includes('ServiceWorker') ||
        text.includes('serviceWorker') ||
        text.includes('favicon.ico') ||
        text.includes('manifest.webmanifest')
      ) {
        return;
      }
      errorLog.push(`ConsoleError: ${text}`);
    }
  });
}

test.describe('Block C: Mobile-Guard 390×844 px Gesamt-Schutznetz', () => {
  let capturedErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    capturedErrors = [];
    attachGlobalErrorWatchers(page, capturedErrors);
    // Explicit 390x844 viewport safeguard
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test.afterEach(async () => {
    expect(
      capturedErrors,
      `Kritische JavaScript- oder Konsolenfehler entdeckt:\n${capturedErrors.join('\n')}`
    ).toEqual([]);
  });

  test('Station 1 – Start & Kopfleiste: App lädt sauber, Projektname ungekürzt, kein alter Tausch-Knopf, kein Überlauf', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // Header mit vollem Projektnamen
    const headerTitle = page.locator('h1');
    await expect(headerTitle).toBeVisible({ timeout: 10000 });
    const titleText = (await headerTitle.textContent()) || '';
    expect(titleText).toContain('Pizza Bandit');
    expect(titleText).not.toMatch(/Pizza…|Pizza\.\.\./);

    // Kein grüner Bild-Tausch-Knopf mehr im Header
    const oldHeaderSwapBtn = page.locator('header button:has(svg.lucide-camera), div:has(> button[aria-label="Navigation öffnen"]) button:has(svg.lucide-camera)');
    await expect(oldHeaderSwapBtn).toHaveCount(0);

    // Viewport-Überlauf prüfen
    await assertNoHorizontalOverflow(page, 'Station 1 – Start & Kopfleiste');
  });

  test('Station 2 – NavigationDrawer: Öffnet im Vordergrund, genau 1 zentraler Einkaufswagen, Punkt „Zentrale“', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // Drawer öffnen über Menu-Button
    const menuBtn = page.locator('button[aria-label="Navigation öffnen"]');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    // Drawer Titel sichtbar
    const drawerTitle = page.locator('text=BANDIT.OS Navigation');
    await expect(drawerTitle).toBeVisible();

    // Genau EIN zentraler Einkaufswagen (nicht pro Projekt)
    const centralCartBtn = page.locator('button:has-text("Zentraler Einkaufswagen")');
    await expect(centralCartBtn).toHaveCount(1);
    await expect(centralCartBtn).toBeVisible();

    // Prüfen, dass in den Projekten (ARBEIT/PRIVAT) keine separaten Warenkorb-Buttons liegen
    const subCartButtons = page.locator('div.space-y-3 button:has(svg.lucide-shopping-cart)');
    await expect(subCartButtons).toHaveCount(0);

    // Punkt „Zentrale“ im Footer des Drawers vorhanden
    const zentraleBtn = page.getByRole('button', { name: 'Zentrale', exact: true });
    await expect(zentraleBtn).toBeVisible();

    // Überlauf im geöffneten Drawer prüfen
    await assertNoHorizontalOverflow(page, 'Station 2 – NavigationDrawer offen');

    // Drawer schließen
    const closeBtn = page.locator('button:has(svg.lucide-x)').first();
    await closeBtn.click();
    await expect(page.locator('.fixed.inset-0.z-\\[55\\]')).toHaveClass(/opacity-0/);
  });

  test('Station 3 – Aufgaben (TasksView): Keine alten •••-Buttons, In-Place Details/Kopieren, 4-Sekunden-Rückgängig, kein Überlauf', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // Tasks-Sektion vorhanden
    const tasksHeading = page.locator('h3:has-text("Tasks")');
    await expect(tasksHeading).toBeVisible();

    // Erste Task-Karte ansteuern
    const firstTaskCard = page.locator('div[id^="item-card-"]').first();
    await expect(firstTaskCard).toBeVisible();

    // Keine alten ••• Buttons auf der Karte
    const moreMenuBtn = firstTaskCard.locator('button:has-text("•••"), button:has-text("...")');
    await expect(moreMenuBtn).toHaveCount(0);

    // Antippen der Karte klappt In-Place Details & Aktionen auf (Zone 2)
    const cardTitleArea = firstTaskCard.locator('.cursor-pointer').nth(1);
    await cardTitleArea.click();

    // Kopieren-Button muss nun in-place sichtbar sein
    const copyBtn = firstTaskCard.locator('button:has-text("Kopieren")');
    await expect(copyBtn).toBeVisible();

    // Bearbeiten-Button muss ebenfalls sichtbar sein
    const editBtn = firstTaskCard.locator('button:has-text("Bearbeiten")');
    await expect(editBtn).toBeVisible();

    // Überlauf bei aufgeklappter Task-Karte prüfen
    await assertNoHorizontalOverflow(page, 'Station 3 – Task-Karte aufgeklappt');

    // Linke Abhak-Zone (Zone 1) betätigen -> 4-Sekunden-Rückgängig-Leiste
    const checkBtn = firstTaskCard.locator('button[aria-label="Als erledigt markieren"]');
    await checkBtn.click();

    // 4-Sekunden-Rückgängig-Leiste erscheint
    const undoStatus = page.locator('div[role="status"]');
    await expect(undoStatus).toBeVisible({ timeout: 3000 });
    const undoBtn = undoStatus.locator('button:has-text("Rückgängig")');
    await expect(undoBtn).toBeVisible();

    // Rückgängig machen
    await undoBtn.click();
    await expect(undoStatus).toBeHidden();

    // Überlauf nach Toggle prüfen
    await assertNoHorizontalOverflow(page, 'Station 3 – Aufgaben-Ansicht');
  });

  test('Station 4 – Einkauf (CartView): Globale Einkaufsliste öffnet, genau 1 Filterleiste, Preise sauber mit €, kein Überlauf', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // Über Drawer in Zentralen Einkaufswagen navigieren
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('button:has-text("Zentraler Einkaufswagen")').click();

    // Einkaufswagen Ansicht sichtbar
    const cartHeading = page.locator('h3:has-text("Einkaufswagen")');
    await expect(cartHeading).toBeVisible();

    // Genau eine gepinnte Filterleiste (sticky top-0) sichtbar
    const stickyFilterBars = page.locator('section:has(h3:has-text("Einkaufswagen")) div.sticky.top-0');
    await expect(stickyFilterBars).toHaveCount(1);
    await expect(stickyFilterBars).toBeVisible();

    // Filterchips (z. B. Alle) vorhanden
    const allChip = stickyFilterBars.locator('button:has-text("Alle")').first();
    await expect(allChip).toBeVisible();

    // Preise sauber mit € formatiert
    const euroPrices = page.locator('section:has(h3:has-text("Einkaufswagen")) span.font-mono:has-text("€")');
    const priceCount = await euroPrices.count();
    expect(priceCount).toBeGreaterThan(0);
    const firstPriceText = await euroPrices.first().textContent();
    expect(firstPriceText).toContain('€');

    // Überlauf prüfen
    await assertNoHorizontalOverflow(page, 'Station 4 – Einkauf (CartView)');
  });

  test('Station 5 – Wissen & Abläufe (KnowledgeView): Geschlossene Karten schlank ohne Außen-Buttons, In-Place Aktionen aufklappbar', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // In Drawer Wissen für Pizza Bandit ansteuern
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    const knowledgeDrawerBtn = page.locator('button:has-text("Wissen")').first();
    await knowledgeDrawerBtn.click();

    // Wissen Sektion aktiv
    const knowledgeHeading = page.locator('h3:has-text("Wissen")');
    await expect(knowledgeHeading).toBeVisible();

    // Erste Wissenskarte
    const firstKnowledgeCard = page.locator('section:has(h3:has-text("Wissen")) div[id^="item-card-"]').first();
    await expect(firstKnowledgeCard).toBeVisible();

    // Im geschlossenen Zustand: Titel sichtbar, kein dominantes Vorlese-/Audio-Guide-Element in Kopfzeile
    const closedHeaderAudioBtn = firstKnowledgeCard.locator('> div.cursor-pointer button:has(svg.lucide-volume-2), > div.cursor-pointer button:has(svg.lucide-volume-x)');
    await expect(closedHeaderAudioBtn).toHaveCount(0);

    // Aufklappen per Antippen
    await firstKnowledgeCard.locator('> div.cursor-pointer').click();

    // In-Place Aktionen sichtbar: Vorlesen / Audio-Guide, Kopieren, Bearbeiten, Verschieben, KI
    const audioBtn = firstKnowledgeCard.locator('button:has-text("Vorlesen"), button:has-text("Audio-Guide")');
    await expect(audioBtn).toBeVisible();

    const copyBtn = firstKnowledgeCard.locator('button:has-text("Kopieren")');
    await expect(copyBtn).toBeVisible();

    const editBtn = firstKnowledgeCard.locator('button:has-text("Bearbeiten")');
    await expect(editBtn).toBeVisible();

    const moveSelect = firstKnowledgeCard.locator('select');
    await expect(moveSelect).toBeVisible();

    const aiBtn = firstKnowledgeCard.locator('button:has-text("KI")');
    await expect(aiBtn).toBeVisible();

    // Überlauf prüfen
    await assertNoHorizontalOverflow(page, 'Station 5 – Wissen (KnowledgeView)');
  });

  test('Station 6 – Sprach-KI (AiBottomBar & VoiceModal): Leiste sichtbar, Modal öffnet ohne 390px-Überlauf, Modus-Schalter ohne Doppel-Blitz', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // Untere KI-Leiste sichtbar
    const bottomBarInput = page.locator('input[placeholder*="Frag mich"]');
    await expect(bottomBarInput).toBeVisible();

    const voiceBtn = page.locator('button[aria-label="Sofort sprechen"]');
    await expect(voiceBtn).toBeVisible();

    // Öffnen des VoiceModal
    await voiceBtn.click();

    // VoiceModal Dialog sichtbar
    const modalHeader = page.locator('text=KI-Kontext & Dialog');
    await expect(modalHeader).toBeVisible();

    // Überlauf prüfen bei geöffnetem VoiceModal
    await assertNoHorizontalOverflow(page, 'Station 6 – VoiceModal geöffnet');

    // Modus-Schalter (Flash/Pro) sichtbar
    const modeSwitchBtn = page.locator('button[aria-label="KI-Modus umschalten"]').first();
    await expect(modeSwitchBtn).toBeVisible();
    await expect(modeSwitchBtn).toContainText(/Sprech|Research/);

    // Prüfen: Kein doppelter Blitz (max. 1 Zap Icon im Modus-Button)
    const zapIconsInModeBtn = modeSwitchBtn.locator('svg.lucide-zap');
    const zapCount = await zapIconsInModeBtn.count();
    expect(zapCount).toBeLessThanOrEqual(1);

    // Modal sauber schließen
    const closeVoiceBtn = page.locator('button[aria-label="Schließen"]').first();
    await closeVoiceBtn.click();
    await expect(modalHeader).toBeHidden();
  });

  test('Station 7 – Die „Zentrale“ (BackofficeWorkspace): Komplettes Inventar, 4 Bereiche zugeklappt, Fußzeile, alle Bereiche funktionstüchtig', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // Über NavigationDrawer in die Zentrale navigieren
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();

    // Zentrale geöffnet
    const zentraleTitle = page.locator('text=BANDIT.OS Zentrale');
    await expect(zentraleTitle).toBeVisible();

    // 4 Überbereiche prüfen
    const section1Btn = page.locator('button:has-text("Projekte & Werkzeuge")');
    const section2Btn = page.locator('button:has-text("Fokus, Bedienung & Optik")');
    const section3Btn = page.locator('button:has-text("KI & Stimme")');
    const section4Btn = page.locator('button:has-text("Daten, Backup & System")');

    await expect(section1Btn).toBeVisible();
    await expect(section2Btn).toBeVisible();
    await expect(section3Btn).toBeVisible();
    await expect(section4Btn).toBeVisible();

    // Standardmäßig alle 4 ZUGEKLAPPT (Inhalte verborgen)
    await expect(page.locator('text=Aktive Modul-Bereiche')).toBeHidden();
    await expect(page.locator('text=ADHS- & Fokus-Unterstützung')).toBeHidden();
    await expect(page.locator('input[placeholder*="Gemini API-Key"]')).toBeHidden();
    await expect(page.locator('text=Vorlagen-Tresor (Blueprints)')).toBeHidden();

    // Fußzeile: Build-Stempel und „Neu laden“-Button sichtbar
    const buildStamp = page.locator('text=/Build .+/');
    await expect(buildStamp).toBeVisible();
    const reloadBtn = page.locator('button:has-text("Neu laden")');
    await expect(reloadBtn).toBeVisible();

    // ── Bereich 1 aufklappen: Projekte & Werkzeuge ──
    await section1Btn.click();
    await assertNoHorizontalOverflow(page, 'Station 7 – Bereich 1 geöffnet');

    // Volle Projektnamen ohne Pi…/Ba…-Quetschung
    const pizzaCard = page.locator('button:has-text("Pizza Bandit")').first();
    const backstubeCard = page.locator('button:has-text("Baustelle Bäckerei")').first();
    const privatCard = page.locator('button:has-text("Privat & Alltag")').first();
    await expect(pizzaCard).toBeVisible();
    await expect(backstubeCard).toBeVisible();
    await expect(privatCard).toBeVisible();

    // Projekt Pizza Bandit aufklappen
    await pizzaCard.click();
    await assertNoHorizontalOverflow(page, 'Station 7 – Projekt Pizza Bandit aufgeklappt');

    // Farb-Presets, Bild-Tausch, enabledTabs/Module, JSON-Export, Archivieren vorhanden
    await expect(page.locator('text=Akzentfarbe:')).toBeVisible();
    await expect(page.locator('button:has-text("Bild ändern")')).toBeVisible();
    await expect(page.locator('text=Aktive Modul-Bereiche')).toBeVisible();
    await expect(page.locator('button:has-text("JSON")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Archivieren")').first()).toBeVisible();

    // ── Bereich 2 aufklappen: Fokus, Bedienung & Optik ──
    await section2Btn.click();
    await assertNoHorizontalOverflow(page, 'Station 7 – Bereich 2 geöffnet');

    // ADHS & Fokus
    await expect(page.locator('text=ADHS- & Fokus-Unterstützung')).toBeVisible();
    await expect(page.locator('text=ADHS-Unterstützung insgesamt')).toBeVisible();

    // Tagesplaner
    await expect(page.locator('text=Tagesplaner & Kalender-Export')).toBeVisible();
    await expect(page.locator('button:has-text(".ics Export")')).toBeVisible();

    // Cover-Display
    await expect(page.locator('text=Flip-7-Cover-Display & Selbst-Checks')).toBeVisible();
    await expect(page.locator('button:has-text("Frontdisplay-Kompaktansicht öffnen")')).toBeVisible();

    // ── Bereich 3 aufklappen: KI & Stimme ──
    await section3Btn.click();
    await assertNoHorizontalOverflow(page, 'Station 7 – Bereich 3 geöffnet');

    // Gemini API-Key
    const apiKeyInput = page.locator('input[placeholder*="Gemini API-Key"]');
    await expect(apiKeyInput).toBeVisible();

    // Modellwahl
    const modelSelect = page.locator('select:has(option[value="SMART_PRO"])');
    await expect(modelSelect).toBeVisible();

    // Stimme „Gisela“ (Azure Speech + Test-Button)
    await expect(page.locator('text=Stimme „Gisela" (Microsoft Azure Neural TTS)')).toBeVisible();
    await expect(page.locator('input[placeholder*="Azure Speech API-Key"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="Azure Region"]')).toBeVisible();
    await expect(page.locator('button:has-text("Stimme Gisela testen")')).toBeVisible();

    // ── Bereich 4 aufklappen: Daten, Backup & System ──
    await section4Btn.click();
    await assertNoHorizontalOverflow(page, 'Station 7 – Bereich 4 geöffnet');

    // Backup, Export & Import
    await expect(page.locator('text=Backup, Export & Import')).toBeVisible();
    await expect(page.locator('button:has-text("Backup speichern")')).toBeVisible();
    await expect(page.locator('text=Backup laden')).toBeVisible();

    // Vorlagen-Tresor (Blueprints)
    await expect(page.locator('text=Vorlagen-Tresor (Blueprints)')).toBeVisible();
    await expect(page.locator('text=Aktuelles Projekt als wiederverwendbare Vorlage sichern')).toBeVisible();

    // Zurück zur Hauptansicht
    await page.locator('button:has-text("Zurück")').click();
    await expect(zentraleTitle).toBeHidden();
  });

  test('Station 8 – Deep-Links: Unterer Bereichs-Button in Tasks öffnet gezielt die Zentrale mit Bereich „Fokus, Bedienung & Optik“', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // Unten in den Tasks den Bereichs-Einstellungs-Button klicken
    const taskSettingsBtn = page.locator('button:has-text("Aufgaben-Einstellungen & ADHS")');
    await expect(taskSettingsBtn).toBeVisible();
    await taskSettingsBtn.click();

    // Zentrale ist geöffnet
    const zentraleTitle = page.locator('text=BANDIT.OS Zentrale');
    await expect(zentraleTitle).toBeVisible();

    // Bereich „Fokus, Bedienung & Optik“ ist direkt gezielt aufgeklappt
    await expect(page.locator('text=ADHS- & Fokus-Unterstützung')).toBeVisible();
    await expect(page.locator('text=ADHS-Unterstützung insgesamt')).toBeVisible();

    // Kein Überlauf
    await assertNoHorizontalOverflow(page, 'Station 8 – Deep-Link Zentrale Fokus');
  });
});
