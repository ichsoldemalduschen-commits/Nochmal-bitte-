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

  test('Station 2 – NavigationDrawer: 3er-Icon-Schnellleiste (Einkauf, Beleg-Scan, Deep Research), Beleg-Scan & Deep Research Ansichten, Punkt „Zentrale“', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // Drawer öffnen über Menu-Button
    const menuBtn = page.locator('button[aria-label="Navigation öffnen"]');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    // Drawer Titel sichtbar
    const drawerTitle = page.locator('text=BANDIT.OS Navigation');
    await expect(drawerTitle).toBeVisible();

    // 3er-Icon-Schnellleiste oben vorhanden (min-h-[56px], Einkauf, Beleg-Scan, Deep Research)
    const quickBar = page.locator('div[role="toolbar"][aria-label="Schnellzugriff"]');
    await expect(quickBar).toBeVisible();
    const quickBarButtons = quickBar.locator('button');
    await expect(quickBarButtons).toHaveCount(3);

    const cartQuickBtn = quickBar.locator('button:has-text("Einkauf")');
    const scanQuickBtn = quickBar.locator('button:has-text("Beleg-Scan")');
    const researchQuickBtn = quickBar.locator('button:has-text("Deep Research")');

    await expect(cartQuickBtn).toBeVisible();
    await expect(scanQuickBtn).toBeVisible();
    await expect(researchQuickBtn).toBeVisible();

    // Alter Zeileneintrag "Zentraler Einkaufswagen" und alter Cloud-Eintrag existieren nicht mehr im Seitenmenü
    await expect(page.locator('button:has-text("Zentraler Einkaufswagen")')).toHaveCount(0);
    await expect(page.locator('div.space-y-3 button:has(svg.lucide-cloud)')).toHaveCount(0);

    // Punkt „Zentrale“ im Footer des Drawers vorhanden
    const zentraleBtn = page.getByRole('button', { name: 'Zentrale', exact: true });
    await expect(zentraleBtn).toBeVisible();

    // Überlauf im geöffneten Drawer prüfen
    await assertNoHorizontalOverflow(page, 'Station 2 – NavigationDrawer offen');

    // 1. Klick auf Beleg-Scan öffnet eigenständige Beleg-Scan-Kartenansicht
    await scanQuickBtn.click();
    const scanHeading = page.locator('h3:has-text("Beleg-Scan")');
    await expect(scanHeading).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 2 – Beleg-Scan-Ansicht geöffnet');

    // 2. Erneut Drawer öffnen und Deep Research aufrufen
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('div[role="toolbar"][aria-label="Schnellzugriff"] button:has-text("Deep Research")').click();
    const researchHeading = page.locator('h3:has-text("Deep Research")');
    await expect(researchHeading).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 2 – Deep-Research-Ansicht geöffnet');

    // 3. Erneut Drawer öffnen und Einkauf aufrufen
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('div[role="toolbar"][aria-label="Schnellzugriff"] button:has-text("Einkauf")').click();
    const cartHeading = page.locator('h3:has-text("Einkaufswagen")');
    await expect(cartHeading).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 2 – Einkaufswagen über Schnellleiste');
  });

  test('Station 3 – Aufgaben (TasksView): Kopfzeile mit + und ⋮-Menü, 1-Fokus & Reset im Menü, flache Zwei-Zonen-Karten, 4-Sekunden-Rückgängig', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // Tasks-Sektion vorhanden
    const tasksHeading = page.locator('h3:has-text("Tasks")');
    await expect(tasksHeading).toBeVisible();

    // Kopfzeile beruhigt: Nur genau zwei Buttons (+ und ⋮) rechts neben Tasks
    const addTaskBtn = page.locator('button[aria-label="Aufgabe hinzufügen"]');
    const moreMenuBtn = page.locator('button[aria-label="Weitere Aufgaben-Aktionen"]');
    await expect(addTaskBtn).toBeVisible();
    await expect(moreMenuBtn).toBeVisible();

    // ⋮-Menü öffnen
    await moreMenuBtn.click();
    const overflowMenu = page.locator('div[role="menu"][aria-label="Aufgaben-Aktionen"]');
    await expect(overflowMenu).toBeVisible();
    await expect(overflowMenu.locator('button:has-text("1-Fokus")')).toBeVisible();
    await expect(overflowMenu.locator('button:has-text("Checkliste zurücksetzen")')).toBeVisible();
    await expect(overflowMenu.locator('button:has-text("Aufgaben-Einstellungen & ADHS")')).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 3 – Tasks ⋮-Menü geöffnet');

    // Menü per Klick außerhalb / Escape schließen
    await page.keyboard.press('Escape');
    await expect(overflowMenu).toBeHidden();

    // Erste Task-Karte ansteuern
    const firstTaskCard = page.locator('div[id^="item-card-"]').first();
    await expect(firstTaskCard).toBeVisible();

    // Keine alten ••• Buttons auf der Karte
    const moreBtn = firstTaskCard.locator('button:has-text("•••"), button:has-text("...")');
    await expect(moreBtn).toHaveCount(0);

    // Antippen der Karte klappt In-Place Details & Aktionen auf (Zone 2)
    const cardTitleArea = firstTaskCard.locator('.cursor-pointer').nth(1);
    await cardTitleArea.click();

    // Kopieren-Button muss nun in-place sichtbar sein
    const copyBtn = firstTaskCard.locator('button:has-text("Kopieren")');
    await expect(copyBtn).toBeVisible();

    // Bearbeiten-Button muss ebenfalls sichtbar sein
    const editBtn = firstTaskCard.locator('button:has-text("Bearbeiten")');
    await expect(editBtn).toBeVisible();

    // Neuer 1-Fokus Button in der Task-Aktionsleiste
    const singleFocusBtn = firstTaskCard.locator('button:has-text("1-Fokus")');
    await expect(singleFocusBtn).toBeVisible();
    await singleFocusBtn.click();
    const taskFocusOverlay = page.locator('div[role="dialog"][aria-label="1-Fokus-Modus"]');
    await expect(taskFocusOverlay).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 3 – 1-Fokus-Overlay aus Task geöffnet');
    await taskFocusOverlay.locator('button[aria-label="Schließen"]').click();
    await expect(taskFocusOverlay).toBeHidden();

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

    // Über Drawer 3er-Schnellleiste in Einkauf navigieren
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('div[role="toolbar"][aria-label="Schnellzugriff"] button:has-text("Einkauf")').click();

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
    const audioBtn = firstKnowledgeCard
      .locator('button:has-text("Vorlesen"), button:has-text("Audio-Guide")')
      .last();
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

  test('Station 6 – Block D Daumen-Steuerung & Sprach-KI: 3-Stufen-Morph, Schnellauswahl-Menü, Schwebender Einkaufswagen & Umschalten auf klassische Leiste', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // 1. Stufe 0: Präsenter Sechskant-Button (~72×72 px) sichtbar
    const hexBtn = page.locator('button[aria-label="Daumen-Steuerung"]');
    await expect(hexBtn).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 6 – Stufe 0 Sechskant-Button sichtbar');

    // 2. Stufe 0 -> Stufe 1: 1× Tipp auf Sechseck weckt kompakten Begleiter auf
    await hexBtn.click();
    const stage1Region = page.locator('div[role="region"][aria-label="KI-Begleiter Kompakt"]');
    await expect(stage1Region).toBeVisible();

    // Mini-Sechseck, Quittungs-/Text-Bereich und genau 3 Icons (⌨, ⊞, ⤢) prüfen
    const miniHex = stage1Region.locator('button[aria-label="Begleiter Status & Mikrofon"]');
    await expect(miniHex).toBeVisible();
    const keyboardBtn = stage1Region.locator('button[aria-label="Textfeld öffnen"]');
    const fanFromStage1Btn = stage1Region.locator('button[aria-label="Schnellauswahl öffnen"]');
    const expandToStage2Btn = stage1Region.locator('button[aria-label="Vergrößern zu Vollbild"]');
    await expect(keyboardBtn).toBeVisible();
    await expect(fanFromStage1Btn).toBeVisible();
    await expect(expandToStage2Btn).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 6 – Stufe 1 Kompakter Begleiter');

    // 3. Stufe 1 -> Stufe 2: Klick auf ⤢ vergrößert auf volles Gesprächs-Modal
    await expandToStage2Btn.click();
    const modalHeader = page.locator('div[role="dialog"][aria-label="KI-Sprachassistent Dialog"]');
    await expect(modalHeader).toBeVisible();
    await expect(stage1Region).toBeHidden();

    // Stufe 2 Kontrollen: ⤡ (Verkleinern) und ✕ (Schließen)
    const shrinkBtn = page.locator('button[aria-label="Verkleinern zu Stufe 1"]');
    const closeStage2Btn = page.locator('button[aria-label="Schließen"]').first();
    await expect(shrinkBtn).toBeVisible();
    await expect(closeStage2Btn).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 6 – Stufe 2 Volles Gesprächs-Modal');

    // 4. Stufe 2 -> Stufe 1: Klick auf ⤡ verkleinert zurück zu Stufe 1
    await shrinkBtn.click();
    await expect(stage1Region).toBeVisible();
    await expect(modalHeader).toBeHidden();

    // 5. Schnellauswahl-Menü über ⊞ öffnen
    await fanFromStage1Btn.click();
    const fanRegion = page.locator('div[role="region"][aria-label="Daumen-Fächer"]');
    await expect(fanRegion).toBeVisible();

    // Schnellauswahl-Inhalte prüfen: Projekte, Bereiche, Werkzeuge (1-Fokus, Einkauf Schwebend, Wächter)
    await expect(fanRegion.locator('text=Projekte')).toBeVisible();
    await expect(fanRegion.locator('button:has-text("Aufgaben")')).toBeVisible();
    await expect(fanRegion.locator('button:has-text("Einkauf")').first()).toBeVisible();
    await expect(fanRegion.locator('button:has-text("Wissen")')).toBeVisible();
    await expect(fanRegion.locator('button:has-text("1-Fokus")')).toBeVisible();
    await expect(fanRegion.locator('button:has-text("Einkauf (Schwebend)")')).toBeVisible();
    await expect(fanRegion.locator('button:has-text("Wächter ⚖️")')).toBeVisible();
    await expect(fanRegion.locator('input[placeholder*="Kurz tippen"]')).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 6 – Schnellauswahl geöffnet');

    // 6. Test des Schwebenden Einkaufswagens (FloatingCartOverlay)
    const floatingCartBtn = fanRegion.locator('button:has-text("Einkauf (Schwebend)")');
    await floatingCartBtn.click();
    await expect(fanRegion).toBeHidden();

    const floatingCart = page.locator('div[role="dialog"][aria-label="Schwebender Einkaufswagen"]');
    await expect(floatingCart).toBeVisible();

    // 3 Kopfzeilen-Knöpfe im FloatingCart: —, ⤢, ✕
    const parkPillBtn = floatingCart.locator('button[aria-label="Einkaufswagen minimieren"]');
    const fullScreenCartBtn = floatingCart.locator('button[aria-label="Einkaufswagen Vollbild"]');
    const closeCartBtn = floatingCart.locator('button[aria-label="Einkaufswagen schließen"]');
    await expect(parkPillBtn).toBeVisible();
    await expect(fullScreenCartBtn).toBeVisible();
    await expect(closeCartBtn).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 6 – Schwebender Einkaufswagen geöffnet');

    // Pill-Minimierung testen: Klick auf —
    await parkPillBtn.click();
    await expect(floatingCart).toBeHidden();
    const restoredPill = page.locator('button[aria-label="Einkaufswagen Pill wiederherstellen"]');
    await expect(restoredPill).toBeVisible();
    await expect(restoredPill).toContainText('offen');

    // Pill antippen -> stellt schwebenden Einkaufswagen wieder her
    await restoredPill.click();
    await expect(floatingCart).toBeVisible();

    // Schließen testen: Klick auf ✕
    await closeCartBtn.click();
    await expect(floatingCart).toBeHidden();

    // 7. 1-Fokus-Overlay testen
    await hexBtn.click();
    await stage1Region.locator('button[aria-label="Schnellauswahl öffnen"]').click();
    await expect(fanRegion).toBeVisible();
    const focusBtn = fanRegion.locator('button:has-text("1-Fokus")');
    await focusBtn.click();

    const focusOverlay = page.locator('div[role="dialog"][aria-label="1-Fokus-Modus"]');
    await expect(focusOverlay).toBeVisible();
    const parkBtn = focusOverlay.locator('button:has-text("Erstmal parken")');
    const doneBtn = focusOverlay.locator('button:has-text("Erledigt ✓")');
    await expect(parkBtn).toBeVisible();
    await expect(doneBtn).toBeVisible();
    await expect(focusOverlay.locator('button:has-text("5-Min-Start")')).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 6 – 1-Fokus-Overlay geöffnet');

    // 1-Fokus schließen
    await focusOverlay.locator('button[aria-label="Schließen"]').click();
    await expect(focusOverlay).toBeHidden();

    // 6b. Organischer Fluss: Kurztipper schließt Stufe 1 wieder
    // (der hexBtn ist nach dem 1-Fokus-Test noch verfügbar)
    // Stufe 1 erneut öffnen
    await hexBtn.click();
    await expect(stage1Region).toBeVisible();
    // Erneuter Tipp auf das mittige Sechseck schließt Stufe 1
    await hexBtn.click();
    await expect(stage1Region).toBeHidden();
    await expect(hexBtn).toBeVisible(); // Sechseck bleibt sichtbar (Stufe 0)
    await assertNoHorizontalOverflow(page, 'Station 6 – Stufe 1 schließt per Hex-Tipp');

    // 8. Umschalten in der Zentrale auf die klassische Leiste
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();

    const section2Btn = page.locator('button:has-text("Fokus, Bedienung & Smartphone")');
    await section2Btn.click();

    // Umschalter für Sechskant-Daumenmodul betätigen -> ausschalten
    const thumbToggleBtn = page.locator('button[aria-label="Sechskant-Daumenmodul umschalten"]');
    await expect(thumbToggleBtn).toBeVisible();
    await expect(thumbToggleBtn).toContainText('Eingeschaltet');
    await thumbToggleBtn.click();
    await expect(thumbToggleBtn).toContainText('Ausgeschaltet');

    // Zurück zur Hauptansicht
    await page.locator('button:has-text("Zurück")').click();

    // Sechskant ist ausgeblendet, klassische Leiste ist eingeblendet
    await expect(hexBtn).toBeHidden();
    const bottomBarInput = page.locator('input[placeholder*="Frag mich"]');
    await expect(bottomBarInput).toBeVisible();
    const voiceBtn = page.locator('button[aria-label="Sofort sprechen"]');
    await expect(voiceBtn).toBeVisible();

    // VoiceModal über klassische Leiste öffnen
    await voiceBtn.click();
    const classicModalHeader = page.locator('div[role="dialog"][aria-label="KI-Sprachassistent Dialog"]');
    await expect(classicModalHeader).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 6 – VoiceModal geöffnet');

    // Modus-Schalter prüfen (kein Doppel-Blitz)
    const modeSwitchBtn = page.locator('button[aria-label="KI-Modus umschalten"]').first();
    await expect(modeSwitchBtn).toBeVisible();
    const zapIconsInModeBtn = modeSwitchBtn.locator('svg.lucide-zap');
    expect(await zapIconsInModeBtn.count()).toBeLessThanOrEqual(1);

    // VoiceModal schließen
    await page.locator('button[aria-label="Schließen"]').first().click();
    await expect(classicModalHeader).toBeHidden();

    // 9. Zurück zur Zentrale und Sechskant wieder aktivieren
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await section2Btn.click();
    const thumbOffBtn = page.locator('button[aria-label="Sechskant-Daumenmodul umschalten"]');
    await expect(thumbOffBtn).toContainText('Ausgeschaltet');
    await thumbOffBtn.click();
    await expect(thumbOffBtn).toContainText('Eingeschaltet');
    await page.locator('button:has-text("Zurück")').click();

    // Sechskant-Button ist wieder sichtbar
    await expect(hexBtn).toBeVisible();
  });

  test('Station 7 – Die „Zentrale“ (BackofficeWorkspace): Komplettes Inventar, 5 Bereiche zugeklappt, Fußzeile, alle Bereiche funktionstüchtig', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // Über NavigationDrawer in die Zentrale navigieren
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();

    // Zentrale geöffnet
    const zentraleTitle = page.locator('text=BANDIT.OS Zentrale');
    await expect(zentraleTitle).toBeVisible();

    // 5 Überbereiche prüfen
    const section1Btn = page.locator('button:has-text("Projekte & Werkzeuge")');
    const section2Btn = page.locator('button:has-text("Fokus, Bedienung & Smartphone")');
    const section3Btn = page.locator('button:has-text("KI & Stimme")');
    const section4Btn = page.locator('button:has-text("Erinnerungen, Vorarbeiter & Smart Home")');
    const section5Btn = page.locator('button:has-text("Daten, Backup & System")');

    await expect(section1Btn).toBeVisible();
    await expect(section2Btn).toBeVisible();
    await expect(section3Btn).toBeVisible();
    await expect(section4Btn).toBeVisible();
    await expect(section5Btn).toBeVisible();

    // Standardmäßig alle 5 ZUGEKLAPPT (Inhalte verborgen)
    await expect(page.locator('text=Aktive Modul-Bereiche')).toBeHidden();
    await expect(page.locator('text=ADHS- & Fokus-Unterstützung')).toBeHidden();
    await expect(page.locator('input[placeholder*="Gemini API-Key"]')).toBeHidden();
    await expect(page.locator('text=Proaktive Erinnerungen (Banner & Desktop)')).toBeHidden();
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

    // Schalter „Gesamt-Übersicht“ prüfen
    const overviewToggle = page.locator('button[aria-label="Gesamt-Übersicht für dieses Projekt umschalten"]');
    await expect(overviewToggle).toBeVisible();
    await expect(overviewToggle).toContainText('Aktiviert');

    // Farb-Presets, Bild-Tausch, enabledTabs/Module, JSON-Export, Archivieren, Vorschriften-Wächter Schalter vorhanden
    await expect(page.locator('text=Akzentfarbe:')).toBeVisible();
    await expect(page.locator('button:has-text("Bild ändern")')).toBeVisible();
    await expect(page.locator('text=Aktive Modul-Bereiche')).toBeVisible();
    await expect(page.locator('text=Vorschriften-Wächter (⚖️) im Fächer anzeigen')).toBeVisible();
    await expect(page.locator('button:has-text("JSON")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Archivieren")').first()).toBeVisible();

    // ── Bereich 2 aufklappen: Fokus, Bedienung & Optik ──
    await section2Btn.click();
    await assertNoHorizontalOverflow(page, 'Station 7 – Bereich 2 geöffnet');

    // Sechskant-Daumenmodul & Parkplatz
    await expect(page.locator('text=Sechskant-Daumenmodul (Einhand-Steuerung)')).toBeVisible();
    await expect(page.locator('text=Parkplatz für Einhand-Bedienung:')).toBeVisible();

    // 3-Stufen Hintergrundbeleuchtung
    await expect(page.locator('text=Organische Hintergrundbeleuchtung')).toBeVisible();
    const ambientOffBtn = page.locator('button[aria-label="Hintergrundbeleuchtung Aus"]');
    const ambientStaticBtn = page.locator('button[aria-label="Hintergrundbeleuchtung Statisch"]');
    const ambientShimmerBtn = page.locator('button[aria-label="Hintergrundbeleuchtung Sanftes Schimmern"]');
    await expect(ambientOffBtn).toBeVisible();
    await expect(ambientStaticBtn).toBeVisible();
    await expect(ambientShimmerBtn).toBeVisible();

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

    // ── Bereich 4 aufklappen: Erinnerungen, Vorarbeiter & Smart Home ──
    await section4Btn.click();
    await assertNoHorizontalOverflow(page, 'Station 7 – Bereich 4 geöffnet');
    await expect(page.locator('text=Proaktive Erinnerungen (Banner & Desktop)')).toBeVisible();
    await expect(page.locator('[data-testid="toggle-reminders-enabled"]')).toBeVisible();

    // ── Bereich 5 aufklappen: Daten, Backup & System ──
    await section5Btn.click();
    await assertNoHorizontalOverflow(page, 'Station 7 – Bereich 5 geöffnet');

    // Cloud-Sync & Push-Konfiguration
    await expect(page.locator('text=Cloud-Synchronisation & Push-Zentrale')).toBeVisible();
    await expect(page.locator('input[placeholder*="https://sync.example.com"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="ws_bandit_geheim"]')).toBeVisible();
    await expect(page.locator('button:has-text("Jetzt hochladen")')).toBeVisible();
    await expect(page.locator('button:has-text("Jetzt herunterladen")')).toBeVisible();

    // Backup, Export & Import
    await expect(page.locator('text=Backup, Export & Import')).toBeVisible();
    await expect(page.locator('button:has-text("Backup speichern")')).toBeVisible();
    await expect(page.locator('text=Backup laden')).toBeVisible();

    // Backup-Buttons touch-sicher prüfen (>= 44px)
    const backupSaveBtn = page.locator('button:has-text("Backup speichern")');
    const backupSaveBtnBox = await backupSaveBtn.boundingBox();
    expect(backupSaveBtnBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    const backupLoadLabel = page.locator('label:has-text("Backup laden")');
    await expect(backupLoadLabel).toBeVisible();
    const backupLoadBtnBox = await backupLoadLabel.boundingBox();
    expect(backupLoadBtnBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    const projectImportLabel = page.locator('label:has-text("Projekt importieren")');
    await expect(projectImportLabel).toBeVisible();
    const projectImportBtnBox = await projectImportLabel.boundingBox();
    expect(projectImportBtnBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    await assertNoHorizontalOverflow(page, 'Station 7 – Backup-Kontrollen touch-sicher');

    // Vorlagen-Tresor (Blueprints)
    await expect(page.locator('text=Vorlagen-Tresor (Blueprints)')).toBeVisible();
    await expect(page.locator('text=Aktuelles Projekt als wiederverwendbare Vorlage sichern')).toBeVisible();

    // Zurück zur Hauptansicht
    await page.locator('button:has-text("Zurück")').click();
    await expect(zentraleTitle).toBeHidden();
  });

  test('Station 8 – Deep-Links & Gesamt-Schalter: Aufgaben-⋮-Menü öffnet gezielt Fokus in Zentrale & Gesamt-Schalter verbirgt Gesamt-Tab', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // 1. Im Tasks-⋮-Menü den Button "Aufgaben-Einstellungen & ADHS" anklicken
    const moreMenuBtn = page.locator('button[aria-label="Weitere Aufgaben-Aktionen"]');
    await expect(moreMenuBtn).toBeVisible();
    await moreMenuBtn.click();

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

    // 2. Gesamt-Schalter in Bereich 1 testen: Wenn deaktiviert, verschwindet der Gesamt-Tab
    await page.locator('button:has-text("Projekte & Werkzeuge")').click();
    const pizzaCard = page.locator('button:has-text("Pizza Bandit")').first();
    await pizzaCard.click();

    const overviewToggle = page.locator('button[aria-label="Gesamt-Übersicht für dieses Projekt umschalten"]');
    await expect(overviewToggle).toBeVisible();
    await expect(overviewToggle).toContainText('Aktiviert');

    // Ausschalten
    await overviewToggle.click();
    await expect(overviewToggle).toContainText('Deaktiviert');

    // Zurück zur Hauptansicht
    await page.locator('button:has-text("Zurück")').click();

    // Drawer öffnen und prüfen, dass "Gesamt" für Pizza Bandit nicht mehr sichtbar ist
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    const gesamtTabBtn = page.locator('div.space-y-3 button:has-text("Gesamt")');
    await expect(gesamtTabBtn).toHaveCount(0);

    // Drawer wieder schließen
    await page.locator('button:has(svg.lucide-x)').first().click();
  });

  test('Station 9 – Werkzeuge / ExtrasView: 3 POS-Slots, touch-sichere Buttons, ⚙-Einstellungen, Katalog-Dropdown, lokale Überschreibung & Teigrechner-Einstellungen', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // In Extras navigieren (über Drawer -> Werkzeuge oder direkt Tab)
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    // Suche nach Werkzeuge-Button im Drawer
    const extrasBtn = page.locator('button:has-text("Werkzeuge"), button:has-text("Extras")').first();
    await expect(extrasBtn).toBeVisible({ timeout: 5000 });
    await extrasBtn.click();

    // ExtrasView muss sichtbar sein (POS-Clicker oder Teigrechner vorhanden)
    await assertNoHorizontalOverflow(page, 'Station 9 – ExtrasView geöffnet');

    // ── 1. Genau 3 aktive Pizza-Slots mit touch-sicheren Minus-Buttons prüfen ──
    const posSection = page.locator('[aria-label="POS Pizza-Slots"]');
    await expect(posSection).toBeVisible({ timeout: 8000 });

    const slots = posSection.locator('[data-testid^="pos-slot-"]');
    await expect(slots).toHaveCount(3);

    // Minus-Buttons müssen >= 44px sein
    const firstSlot = slots.first();
    const minusBtn = firstSlot.locator('button[aria-label$="minus"]');
    await expect(minusBtn).toBeVisible();
    const minusBtnBox = await minusBtn.boundingBox();
    expect(minusBtnBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(minusBtnBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    // Plus-Button ebenfalls touch-sicher
    const plusBtn = firstSlot.locator('button[aria-label$="plus"]');
    await expect(plusBtn).toBeVisible();
    const plusBtnBox = await plusBtn.boundingBox();
    expect(plusBtnBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(plusBtnBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    await assertNoHorizontalOverflow(page, 'Station 9 – 3 POS-Slots sichtbar');

    // ── 2. ⚙-Einstellungsmenü öffnen ──
    const settingsBtn = page.locator('button[aria-label="Einstellungen öffnen"]').first();
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    // Einstellungen-Panel muss sichtbar sein
    const slotsPanel = page.locator('[aria-label="Aktive Zähler-Slots Einstellungen"]');
    await expect(slotsPanel).toBeVisible({ timeout: 3000 });
    await assertNoHorizontalOverflow(page, 'Station 9 – ⚙ Einstellungen geöffnet');

    // ── 3. Katalog-Dropdown im ersten Slot ansteuern und andere Sorte wählen ──
    const firstDropdown = slotsPanel.locator('select[aria-label="Sorte aus Katalog wählen"]').first();
    await expect(firstDropdown).toBeVisible();

    // Optionen laden und zweite Option wählen
    const options = await firstDropdown.locator('option').all();
    expect(options.length).toBeGreaterThan(1);
    const secondOptionValue = await options[1].getAttribute('value') ?? '';
    if (secondOptionValue) {
      await firstDropdown.selectOption(secondOptionValue);
    }

    // ── 4. Titel lokal bearbeiten ──
    const titleInput = slotsPanel.locator('input[aria-label="Slot-Titel lokal bearbeiten"]').first();
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Event-Spezial 🍕');

    // Event-Anpassung-Indikator muss in Haupt-Slot erscheinen
    // (isLocallyOverridden = true nach Titeländerung)
    // Einstellungen schließen und Bühne prüfen
    const closeSettingsBtn = page.locator('button[aria-label="Einstellungen schließen"]').first();
    await closeSettingsBtn.click();

    // Im Slot: Event-Anpassung-Badge muss sichtbar sein
    const overrideIndicator = firstSlot.locator('[aria-label="Event-Anpassung aktiv"]');
    await expect(overrideIndicator).toBeVisible({ timeout: 3000 });
    await assertNoHorizontalOverflow(page, 'Station 9 – Lokale Überschreibung angezeigt');

    // ── 5. Katalog-Tab prüfen: Original-Stammdaten unverändert ──
    // Einstellungen erneut öffnen
    await settingsBtn.click();
    // Zum Katalog-Tab wechseln
    const catalogTabBtn = page.locator('button[aria-label="Pizza-Katalog"]');
    await expect(catalogTabBtn).toBeVisible();
    await catalogTabBtn.click();

    const catalogSection = page.locator('[aria-label="Pizza-Katalog Stammdaten"]');
    await expect(catalogSection).toBeVisible({ timeout: 3000 });

    // Mindestens 3 Catalog-Einträge vorhanden (Stammdaten unverändert)
    const catalogEntries = catalogSection.locator('span.text-xs.font-semibold.text-white');
    const entryCount = await catalogEntries.count();
    expect(entryCount).toBeGreaterThanOrEqual(3);

    // Originaltitel aus Katalog noch vorhanden (nicht überschrieben)
    // "Margherita Klassik" ist der Standard-Erststart-Eintrag
    await expect(catalogSection.locator('span:has-text("Margherita Klassik")')).toBeVisible();

    await assertNoHorizontalOverflow(page, 'Station 9 – Katalog-Stammdaten unverändert');

    // ── 6. Einstellungen schließen ──
    await closeSettingsBtn.click();
    await expect(slotsPanel).toBeHidden({ timeout: 3000 });

    // ── 7. Teigrechner-⚙-Button prüfen: auf- und zuklappen, 0px Überlauf ──
    const doughSettingsBtn = page.locator('button[aria-label="Teigrechner-Einstellungen öffnen"]');
    await expect(doughSettingsBtn).toBeVisible({ timeout: 5000 });
    await doughSettingsBtn.click();

    const doughSettingsPanel = page.locator('[aria-label="Teigrechner Standard-Vorgaben"]');
    await expect(doughSettingsPanel).toBeVisible({ timeout: 3000 });
    await assertNoHorizontalOverflow(page, 'Station 9 – Teigrechner-Einstellungen geöffnet');

    // Zuklappen – den X-Button INNERHALB des Panels verwenden
    const doughClosePanelXBtn = doughSettingsPanel.locator('button[aria-label="Teigrechner-Einstellungen schließen"]');
    await doughClosePanelXBtn.click();
    await expect(doughSettingsPanel).toBeHidden({ timeout: 3000 });
    await assertNoHorizontalOverflow(page, 'Station 9 – Teigrechner-Einstellungen geschlossen');
  });

  test('Station 10 – Wissen-Löschen mit 4s-Rückgängig & konsolidiertes DeepResearch/Beleg-Scanner-Modal (390px-Schutz)', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // 1. Wissen-Ansicht über Drawer öffnen
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('button:has-text("Wissen")').first().click();

    const knowledgeSection = page.locator('section:has(h3:has-text("Wissen"))');
    await expect(knowledgeSection).toBeVisible();

    const knowledgeCards = knowledgeSection.locator('div[id^="item-card-"]');
    const initialCount = await knowledgeCards.count();
    expect(initialCount).toBeGreaterThan(0);

    const firstCard = knowledgeCards.first();
    const firstTitle = ((await firstCard.locator('h4').textContent()) || '').trim();
    expect(firstTitle.length).toBeGreaterThan(0);

    // Wissenseintrag aufklappen
    await firstCard.locator('> div.cursor-pointer').click();

    // Touch-sicheren Löschen-Button (>= 44px) prüfen und klicken
    const deleteBtn = firstCard.locator('button:has-text("Löschen")');
    await expect(deleteBtn).toBeVisible();
    const deleteBox = await deleteBtn.boundingBox();
    expect(deleteBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await deleteBtn.click();

    await expect(knowledgeCards).toHaveCount(initialCount - 1);

    // 4-Sekunden-Rückgängig-Leiste prüfen & antippen
    const undoStatus = page.locator('div[role="status"]');
    await expect(undoStatus).toBeVisible({ timeout: 3000 });
    const undoBtn = undoStatus.locator('button:has-text("Rückgängig")');
    await expect(undoBtn).toBeVisible();
    await undoBtn.click();
    await expect(undoStatus).toBeHidden();

    // Eintrag ist wiederhergestellt
    await expect(knowledgeCards).toHaveCount(initialCount);
    await expect(knowledgeSection.locator(`h4:has-text("${firstTitle}")`)).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 10 – Wissen Löschen & Rückgängig');

    // 2. Konsolidiertes Modal (Deep Research & Beleg-Scanner) über Hex-Button -> Schnellauswahl -> Wächter ⚖️ öffnen
    await page.locator('button[aria-label="Daumen-Steuerung"]').click();
    const stage1Region = page.locator('div[role="region"][aria-label="KI-Begleiter Kompakt"]');
    await expect(stage1Region).toBeVisible();
    await stage1Region.locator('button[aria-label="Schnellauswahl öffnen"]').click();

    const fanRegion = page.locator('div[role="region"][aria-label="Daumen-Fächer"]');
    await expect(fanRegion).toBeVisible();
    await fanRegion.locator('button:has-text("Wächter ⚖️")').click();

    const researchDialog = page.locator('div[role="dialog"][aria-label="Deep Research, Beleg-Scanner & Cloud"]');
    await expect(researchDialog).toBeVisible();
    await expect(researchDialog.locator('h3:has-text("Deep Research")')).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 10 – Modal Deep Research');

    // Auf Beleg-Scanner umschalten & prüfen
    await researchDialog.locator('button:has-text("Beleg-Scanner")').click();
    await expect(researchDialog.locator('h3:has-text("Beleg-Scan")')).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 10 – Modal Beleg-Scanner');

    // Modal sauber schließen
    await researchDialog.locator('button[aria-label="Schließen"]').click();
    await expect(researchDialog).toBeHidden();
  });

  test('Station 11 – Aufklappbare Sammel-Tasks: subTasks anlegen, Vorschau & Zähler (0/2 -> 1/2), Schritt-Rotation, Auto-Abschluss & Rückgängig', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    const tasksSection = page.locator('section:has(h3:has-text("Tasks"))');
    await expect(tasksSection).toBeVisible();

    // Ersten offenen Task ansteuern und über ID verfolgen
    const firstCard = tasksSection.locator('div[id^="item-card-"]').first();
    await expect(firstCard).toBeVisible();
    const cardId = await firstCard.getAttribute('id');
    expect(cardId).toBeTruthy();
    const card = page.locator(`#${cardId}`);

    // 1. Aufgabe aufklappen (Zone 2) & 2 Arbeitsschritte anlegen
    await card.locator('.cursor-pointer').nth(1).click();

    const subInput = card.locator('input[placeholder*="Arbeitsschritt hinzufügen"]');
    const subAddBtn = card.locator('button[aria-label="Arbeitsschritt hinzufügen"]');
    await expect(subInput).toBeVisible();

    await subInput.fill('Schritt A');
    await subAddBtn.click();
    await subInput.fill('Schritt B');
    await subAddBtn.click();

    await expect(card.locator('text=Schritt A')).toBeVisible();
    await expect(card.locator('text=Schritt B')).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 11 – Arbeitsschritte angelegt');

    // 2. Karte zuklappen -> Mono-Zähler 0/2 und Vorschauzeile „Nächster: Schritt A“ prüfen
    await card.locator('.cursor-pointer').nth(1).click();
    await expect(card.locator('span.font-mono:has-text("0/2")')).toBeVisible();
    await expect(card.locator('text=Nächster:')).toBeVisible();
    await expect(card.locator('text=Schritt A')).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 11 – Sammel-Task zugeklappt');

    // 3. Wieder aufklappen & Schritt A abhaken -> Zähler 1/2 & Rotation auf Schritt B
    await card.locator('.cursor-pointer').nth(1).click();
    await card.locator('button[aria-label="Arbeitsschritt Schritt A abhaken"]').click();
    await expect(card.locator('span.font-mono:has-text("1/2")')).toBeVisible({ timeout: 3000 });
    await expect(card.locator('[data-active-step="true"]:has-text("Schritt B")')).toBeVisible();

    // Zuklappen und verifizieren, dass Vorschau auf Schritt B rotiert ist
    await card.locator('.cursor-pointer').nth(1).click();
    await expect(card.locator('text=Schritt B')).toBeVisible();

    // 4. Wieder aufklappen & Schritt B abhaken -> Auto-Abschluss des Haupt-Tasks + 4s-Rückgängig-Leiste
    await card.locator('.cursor-pointer').nth(1).click();
    await card.locator('button[aria-label="Arbeitsschritt Schritt B abhaken"]').click();

    const undoStatus = page.locator('div[role="status"]');
    await expect(undoStatus).toBeVisible({ timeout: 3000 });
    const undoBtn = undoStatus.locator('button:has-text("Rückgängig")');
    await expect(undoBtn).toBeVisible();

    // Haupt-Task ist nun automatisch als erledigt markiert
    await expect(card.locator('button[aria-label="Als unerledigt markieren"]')).toBeVisible();

    // Rückgängig tippen -> Haupt-Task & Schritt B wieder offen
    await undoBtn.click();
    await expect(undoStatus).toBeHidden();
    await expect(card.locator('button[aria-label="Als erledigt markieren"]')).toBeVisible();
    await expect(card.locator('span.font-mono:has-text("1/2")')).toBeVisible();
    await expect(card.locator('[data-active-step="true"]:has-text("Schritt B")')).toBeVisible();

    await assertNoHorizontalOverflow(page, 'Station 11 – Auto-Abschluss & Rückgängig');
  });

  test('Station 12 – Proaktive Erinnerungen: Schnell-Chip setzen, fälliges Honig-Gold-Banner auslösen & +30 Min Snooze (390px-Schutz)', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    const tasksSection = page.locator('section:has(h3:has-text("Tasks"))');
    await expect(tasksSection).toBeVisible();

    const firstCard = tasksSection.locator('div[id^="item-card-"]').first();
    await expect(firstCard).toBeVisible();
    const cardId = await firstCard.getAttribute('id');
    expect(cardId).toBeTruthy();
    const card = page.locator(`#${cardId}`);

    // 1. Aufgabe aufklappen -> Bearbeiten öffnen -> Schnell-Chip „Abend-Check 20:00“ setzen & speichern
    await card.locator('.cursor-pointer').nth(1).click();
    await card.locator('button:has-text("Bearbeiten")').click();

    const eveningChip = card.locator('button:has-text("Abend-Check 20:00")');
    await expect(eveningChip).toBeVisible();
    await eveningChip.click();
    await card.locator('button:has-text("Speichern")').click();

    // Ruhiges Mono-Meta-Tag ⏰ 20:00 auf der Karte prüfen
    const reminderMeta = card.locator('span.font-mono:has-text("⏰")');
    await expect(reminderMeta).toBeVisible();
    await expect(reminderMeta).toContainText('20:00');
    await assertNoHorizontalOverflow(page, 'Station 12 – Erinnerung auf Karte gesetzt');

    // 2. Fällige Erinnerungszeit (2 Minuten in der Vergangenheit) setzen -> Honig-Gold-Banner erscheint
    await card.locator('button:has-text("Bearbeiten")').click();
    const pastLocalValue = await page.evaluate(() => {
      const d = new Date(Date.now() - 2 * 60 * 1000);
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${mo}-${day}T${h}:${mi}`;
    });
    const dtInput = card.locator('input[type="datetime-local"]');
    await expect(dtInput).toBeVisible();
    await dtInput.fill(pastLocalValue);
    await card.locator('button:has-text("Speichern")').click();

    const reminderBanner = page.locator('[data-testid="in-app-reminder-banner"]');
    await expect(reminderBanner).toBeVisible({ timeout: 5000 });

    const doneBtn = reminderBanner.locator('button:has-text("Erledigt")');
    const snoozeBtn = reminderBanner.locator('button:has-text("+30 Min")');
    const okBtn = reminderBanner.locator('button:has-text("OK")');

    await expect(doneBtn).toBeVisible();
    await expect(snoozeBtn).toBeVisible();
    await expect(okBtn).toBeVisible();

    for (const btn of [doneBtn, snoozeBtn, okBtn]) {
      const box = await btn.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await assertNoHorizontalOverflow(page, 'Station 12 – Erinnerungsbanner sichtbar');

    // 3. Auf +30 Min tippen -> Banner verschwindet sauber und poppt nicht erneut auf
    await snoozeBtn.click();
    await expect(reminderBanner).toBeHidden();
    await page.waitForTimeout(300);
    await expect(reminderBanner).toBeHidden();
    await assertNoHorizontalOverflow(page, 'Station 12 – Nach +30 Min Snooze');
  });

  test('Station 13 – Unsichtbare 3-Modi-Erkennung: Zentrale-Schalter (min-h-[44px]), Reload-Persistenz & VoiceModal ohne UI-Überladung (390px-Schutz)', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // 1. Zentrale -> Sektion 3 KI & Stimme „Gisela“ öffnen
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("KI & Stimme")').click();
    await assertNoHorizontalOverflow(page, 'Station 13 – Zentrale Sektion 3 geöffnet');

    const continuousToggle = page.locator('button[aria-label="Durchgehendes Gespräch umschalten"]');
    const autoModeToggle = page.locator('button[aria-label="Automatische Gesprächsmodus-Erkennung umschalten"]');

    await expect(continuousToggle).toBeVisible();
    await expect(autoModeToggle).toBeVisible();
    await expect(continuousToggle).toContainText('Aktiv');
    await expect(autoModeToggle).toContainText('Aktiv');

    for (const btn of [continuousToggle, autoModeToggle]) {
      const box = await btn.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    // 2. Beide Schalter umschalten & nach Reload auf Persistenz prüfen
    await autoModeToggle.click();
    await expect(autoModeToggle).toContainText('Aus');
    await continuousToggle.click();
    await expect(continuousToggle).toContainText('Aus');
    await assertNoHorizontalOverflow(page, 'Station 13 – Schalter umgeschaltet');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("KI & Stimme")').click();

    await expect(autoModeToggle).toContainText('Aus');
    await expect(continuousToggle).toContainText('Aus');

    // Sauber wieder aktivieren & zurück zur Startansicht
    await autoModeToggle.click();
    await expect(autoModeToggle).toContainText('Aktiv');
    await continuousToggle.click();
    await expect(continuousToggle).toContainText('Aktiv');
    await page.locator('button:has-text("Zurück")').click();

    // 3. VoiceModal öffnen & prüfen, dass kein manueller 3-Modi-Klotz den Header überlädt
    const hexBtn = page.locator('button[aria-label="Daumen-Steuerung"]');
    await expect(hexBtn).toBeVisible();
    await hexBtn.click();

    const stage1Region = page.locator('div[role="region"][aria-label="KI-Begleiter Kompakt"]');
    await expect(stage1Region).toBeVisible();
    await stage1Region.locator('button[aria-label="Vergrößern zu Vollbild"]').click();

    const dialog = page.locator('div[role="dialog"][aria-label="KI-Sprachassistent Dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('button[aria-label="KI-Modus umschalten"]')).toBeVisible();
    await expect(dialog.locator('button:has-text("Sammel")')).toHaveCount(0);
    await expect(dialog.locator('button:has-text("Quick")')).toHaveCount(0);

    await assertNoHorizontalOverflow(page, 'Station 13 – VoiceModal ohne 3-Modi-UI-Klotz');

    await dialog.locator('button[aria-label="Schließen"]').click();
    await expect(dialog).toBeHidden();
  });

  test('Station 14 – Sprach-KI Rundum-Sanierung: Satzende-Schutz, Stufe-1-Eingabe & Senden, 0 Fehler & 390px-Schutz', async ({ page }) => {
    // Kontrollierte Web-Speech-Simulation für Android/Mobile-STT-Prüfung (offener Satzanfang)
    await page.addInitScript(() => {
      class MockSpeechRecognition {
        lang = 'de-DE';
        continuous = true;
        interimResults = true;
        maxAlternatives = 1;
        onstart: (() => void) | null = null;
        onresult: ((ev: any) => void) | null = null;
        onerror: ((ev: any) => void) | null = null;
        onend: (() => void) | null = null;

        start() {
          setTimeout(() => {
            this.onstart?.();
            setTimeout(() => {
              const resultItem = [{ transcript: 'Notiere mal Aufgabe für' }];
              this.onresult?.({ results: [resultItem] });
            }, 60);
          }, 20);
        }

        stop() {
          this.onend?.();
        }
      }
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;
      (window as any).SpeechRecognition = MockSpeechRecognition;
    });

    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    const hexBtn = page.locator('button[aria-label="Daumen-Steuerung"]');
    await expect(hexBtn).toBeVisible();

    // 1. Sechskant-Begleiter öffnen (Stufe 1) -> Synchroner Audio-Unlock & STT startet
    await hexBtn.click();
    const stage1Region = page.locator('div[role="region"][aria-label="KI-Begleiter Kompakt"]');
    await expect(stage1Region).toBeVisible();

    // Offener Satzanfang ("Notiere mal Aufgabe für") darf NICHT nach 2000ms durch Quick abgehackt werden
    await expect(stage1Region.locator('text=Notiere mal Aufgabe für')).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(2300);
    await expect(stage1Region.locator('text=Höre zu...')).toBeVisible();
    await expect(stage1Region.locator('text=Notiere mal Aufgabe für')).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 14 – Offener Satzanfang bleibt aktiv');

    // 2. Textfeld in Stufe 1 öffnen (pausiert Auto-Send-Timer), Text vervollständigen & absenden
    await stage1Region.locator('button[aria-label="Textfeld öffnen"]').click();
    const stage1Input = stage1Region.locator('input[placeholder*="Befehl oder Notiz"]');
    await expect(stage1Input).toBeVisible();
    await stage1Input.fill('Notiere mal Aufgabe für Pizzaofen prüfen');

    const sendBtn = stage1Region.locator('button[aria-label="Befehl senden"]');
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // Aufgabe wurde lokal angelegt und in TasksView eingetragen
    const tasksSection = page.locator('section:has(h3:has-text("Tasks"))');
    await expect(tasksSection.locator('text=/Pizzaofen prüfen/i')).toBeVisible({ timeout: 5000 });
    await expect(stage1Region.locator('text=/Gisela antwortet|Rückgängig|Pizzaofen|Aufgabe/i').first()).toBeVisible({ timeout: 5000 });
    await assertNoHorizontalOverflow(page, 'Station 14 – Nach Stufe-1-Eingabe & Senden');

    // 2b. Langer Grübel-/Sabbel-Text (ohne API-Key / im Offline-Fallback) legt KEINEN unerwünschten Task automatisch an
    const taskCountBefore = await tasksSection.locator('div[id^="item-card-"]').count();
    await stage1Region.locator('button[aria-label="Textfeld öffnen"]').click();
    await expect(stage1Input).toBeVisible();
    await stage1Input.fill(
      'Ich überlege gerade ob wir beim nächsten Event vielleicht den Arbeitstisch etwas weiter nach links schieben sollten damit alle genug Platz haben'
    );
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    await expect(stage1Region.locator('text=/nichts automatisch|Offline|Gisela antwortet/i').first()).toBeVisible({
      timeout: 5000
    });
    await expect(tasksSection.locator('div[id^="item-card-"]')).toHaveCount(taskCountBefore);
    await expect(tasksSection).not.toContainText('Ich überlege gerade');
    await assertNoHorizontalOverflow(page, 'Station 14 – Langer Grübel-Text ohne blinde Task-Anlage');

    // 3. Sauberes Schließen zurück auf Stufe 0 per erneutem Tipp auf das mittige Sechseck
    await hexBtn.click();
    await expect(stage1Region).toBeHidden();
    await expect(hexBtn).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 14 – Sauber geschlossen zurück auf Stufe 0');
  });

  test('Station 15 – Zentrale v2: 5 Bereiche standardmäßig zugeklappt, 390-px-Hygiene in allen 5 Bereichen, 2-Stufen-Reset-Schutz & Knowledge-Deep-Link auf KI', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // 1. Zentrale normal öffnen -> alle 5 Überbereiche sind standardmäßig ZUGEKLAPPT, Build-Stempel sichtbar
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();

    await expect(page.locator('text=BANDIT.OS Zentrale')).toBeVisible();
    await expect(page.locator('text=/Build .+/')).toBeVisible();

    const sections = [
      { label: 'Projekte & Werkzeuge', name: 'Bereich 1' },
      { label: 'Fokus, Bedienung & Smartphone', name: 'Bereich 2' },
      { label: 'KI & Stimme', name: 'Bereich 3' },
      { label: 'Erinnerungen, Vorarbeiter & Smart Home', name: 'Bereich 4' },
      { label: 'Daten, Backup & System', name: 'Bereich 5' }
    ];

    for (const sec of sections) {
      const btn = page.locator(`button:has-text("${sec.label}")`);
      await expect(btn).toBeVisible();
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
    }
    await assertNoHorizontalOverflow(page, 'Station 15 – Zentrale Start (alle 5 zugeklappt)');

    // 2. Alle 5 Bereiche nacheinander aufklappen & 390px-Überlauf + 2-Stufen-Schutz in Bereich 1 prüfen
    for (const sec of sections) {
      const btn = page.locator(`button:has-text("${sec.label}")`);
      await btn.click();
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
      await assertNoHorizontalOverflow(page, `Station 15 – ${sec.name} aufgeklappt`);

      if (sec.name === 'Bereich 1') {
        const resetBtn = page.locator('button:has-text("Projekt-Stammdaten aktualisieren")');
        await expect(resetBtn).toBeVisible();
        await resetBtn.click();

        const warnText = page.locator('text=Setzt alle Projekte auf Werkszustand zurück');
        const cancelResetBtn = page.locator('button:has-text("Abbrechen")');
        const confirmResetBtn = page.locator('button:has-text("Ja, zurücksetzen")');
        await expect(warnText).toBeVisible();
        await expect(cancelResetBtn).toBeVisible();
        await expect(confirmResetBtn).toBeVisible();
        await assertNoHorizontalOverflow(page, 'Station 15 – 2-Stufen-Reset-Schutz sichtbar');

        await cancelResetBtn.click();
        await expect(warnText).toBeHidden();
        await expect(page.locator('button:has-text("Pizza Bandit")').first()).toBeVisible();
      }
    }

    // Zentrale schließen
    await page.locator('button:has-text("Zurück")').click();

    // 3. Deep-Link aus KnowledgeView -> landet direkt in Bereich 3 (KI & Stimme „Gisela“)
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('button:has-text("Wissen")').first().click();

    const knowledgeSettingsBtn = page.locator('button:has-text("Wissen-Einstellungen & Sprachausgabe")');
    await expect(knowledgeSettingsBtn).toBeVisible();
    await knowledgeSettingsBtn.click();

    await expect(page.locator('text=BANDIT.OS Zentrale')).toBeVisible();
    const section3Btn = page.locator('button:has-text("KI & Stimme")');
    await expect(section3Btn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('input[placeholder*="Gemini API-Key"]')).toBeVisible();
    await expect(page.locator('button:has-text("Stimme Gisela testen")')).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 15 – Knowledge-Deep-Link in Bereich 3');
  });

  test('Station 16 – Zentrale v2 Toggle-Offensive: uiDensity large (390px-Schutz), IDB-Persistenz neuer Toggles & Smart-Home geschlossene Schublade', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');

    // 1. Zentrale öffnen -> Bereich 2 (Fokus, Bedienung & Smartphone) aufklappen
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();

    const section2Btn = page.locator('button:has-text("Fokus, Bedienung & Smartphone")');
    await expect(section2Btn).toBeVisible();
    await section2Btn.click();
    await assertNoHorizontalOverflow(page, 'Station 16 – Bereich 2 geöffnet');

    // 2. uiDensity auf Groß umschalten -> data-density="large" & scrollWidth <= 390 prüfen -> zurück auf Standard
    const largeDensityBtn = page.locator('[data-testid="ui-density-large"]');
    const standardDensityBtn = page.locator('[data-testid="ui-density-standard"]');
    await expect(largeDensityBtn).toBeVisible();
    await largeDensityBtn.click();

    await expect
      .poll(async () => page.evaluate(() => document.documentElement.dataset.density))
      .toBe('large');
    await assertNoHorizontalOverflow(page, 'Station 16 – uiDensity large (17px root)');

    await standardDensityBtn.click();
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.dataset.density))
      .toBe('standard');

    // 3. Neue Toggles prüfen, umschalten & Reload-Persistenz in IndexedDB verifizieren
    const organicMotionToggle = page.locator('[data-testid="toggle-organic-motion"]');
    const realityCheckToggle = page.locator('[data-testid="toggle-reality-check"]');
    const flipAutoDetectToggle = page.locator('[data-testid="toggle-flip-cover-auto-detect"]');
    const hapticsToggle = page.locator('[data-testid="toggle-haptics-enabled"]');

    await expect(organicMotionToggle).toContainText('An');
    await expect(realityCheckToggle).toContainText('An');
    await expect(flipAutoDetectToggle).toContainText('An');
    await expect(hapticsToggle).toContainText('An');

    // Selbst-Check-Verlauf standardmäßig zugeklappt prüfen
    const selfCheckHistoryBtn = page.locator('[data-testid="toggle-selfcheck-history"]');
    await expect(selfCheckHistoryBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(selfCheckHistoryBtn).toContainText(/\d+\s+Eintr(ag|äge)/);
    await selfCheckHistoryBtn.click();
    await expect(selfCheckHistoryBtn).toHaveAttribute('aria-expanded', 'true');
    await assertNoHorizontalOverflow(page, 'Station 16 – Selbst-Check-Verlauf aufgeklappt');
    await selfCheckHistoryBtn.click();
    await expect(selfCheckHistoryBtn).toHaveAttribute('aria-expanded', 'false');

    await organicMotionToggle.click();
    await realityCheckToggle.click();
    await flipAutoDetectToggle.click();

    await expect(organicMotionToggle).toContainText('Aus');
    await expect(realityCheckToggle).toContainText('Aus');
    await expect(flipAutoDetectToggle).toContainText('Aus');
    await assertNoHorizontalOverflow(page, 'Station 16 – Toggles umgeschaltet');

    // Kurzes Warten bis IDB-Speicherung abgeschlossen ist, dann Reload
    await page.waitForTimeout(250);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("Fokus, Bedienung & Smartphone")').click();

    await expect(page.locator('[data-testid="toggle-organic-motion"]')).toContainText('Aus');
    await expect(page.locator('[data-testid="toggle-reality-check"]')).toContainText('Aus');
    await expect(page.locator('[data-testid="toggle-flip-cover-auto-detect"]')).toContainText('Aus');

    // Sauber zurück auf An schalten
    await page.locator('[data-testid="toggle-organic-motion"]').click();
    await page.locator('[data-testid="toggle-reality-check"]').click();
    await page.locator('[data-testid="toggle-flip-cover-auto-detect"]').click();

    // 4. Bereich 4 (Erinnerungen, Vorarbeiter & Smart Home) öffnen -> Prinzip der geschlossenen Schublade
    const section4Btn = page.locator('button:has-text("Erinnerungen, Vorarbeiter & Smart Home")');
    await section4Btn.click();
    await assertNoHorizontalOverflow(page, 'Station 16 – Bereich 4 geöffnet');

    const smartHomeToggle = page.locator('[data-testid="toggle-smart-home"]');
    const haWebhookInput = page.locator('[data-testid="input-ha-webhook-url"]');
    const haEmbedInput = page.locator('[data-testid="input-ha-embed-url"]');

    await expect(smartHomeToggle).toBeVisible();
    await expect(smartHomeToggle).toContainText('Aus');
    await expect(haWebhookInput).toHaveCount(0);
    await expect(haEmbedInput).toHaveCount(0);

    // Smart Home einschalten -> HA-Felder erscheinen ohne 390-px-Überlauf
    await smartHomeToggle.click();
    await expect(smartHomeToggle).toContainText('An');
    await expect(haWebhookInput).toBeVisible();
    await expect(haEmbedInput).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 16 – Smart Home Felder eingeblendet');

    // Smart Home wieder ausschalten -> Felder wieder komplett versteckt
    await smartHomeToggle.click();
    await expect(smartHomeToggle).toContainText('Aus');
    await expect(haWebhookInput).toHaveCount(0);
    await expect(haEmbedInput).toHaveCount(0);
    await assertNoHorizontalOverflow(page, 'Station 16 – Smart Home geschlossen');
  });

  test('Station 17 – Smartphone-Verfügbarkeit Stufe A: App-Shortcut ?action=receipt, Share-Target-Übernahme & Zentrale-Schalter inkl. Reload-Sperre', async ({ page }) => {
    // 1. Aufruf mit ?action=receipt -> Beleg-Scanner direkt sichtbar, ?action=receipt bereinigt
    await page.goto('./?action=receipt');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h3:has-text("Beleg-Scan")')).toBeVisible({ timeout: 10000 });
    await expect.poll(() => page.url()).not.toContain('action=receipt');
    await assertNoHorizontalOverflow(page, 'Station 17 – ?action=receipt');

    // 2. Aufruf mit ?share_title & ?share_text -> VoiceModal öffnet mit vorbefülltem Text, Honig-Gold-Hinweis & URL bereinigt
    await page.goto('./?share_title=Bauhaus&share_text=2x+Silikon+fuer+Pizza+Bandit');
    await page.waitForLoadState('domcontentloaded');

    const stage1Region = page.locator('div[role="region"][aria-label="KI-Begleiter Kompakt"]');
    await expect(stage1Region).toBeVisible({ timeout: 10000 });

    const shareInput = stage1Region.locator('input[placeholder*="Befehl oder Notiz"]');
    await expect(shareInput).toBeVisible();
    await expect(shareInput).toHaveValue(/Bauhaus.*2x Silikon fuer Pizza Bandit/);

    const shareNotice = stage1Region.locator('[data-testid="share-intake-notice"]');
    await expect(shareNotice).toBeVisible();
    await expect(shareNotice).toContainText('Geteilter Inhalt übernommen');

    await expect.poll(() => page.url()).not.toContain('share_title');
    await expect.poll(() => page.url()).not.toContain('share_text');
    await assertNoHorizontalOverflow(page, 'Station 17 – Share-Target Übernahme');

    // Begleiter sauber schließen
    await page.locator('button[aria-label="Daumen-Steuerung"]').click();
    await expect(stage1Region).toBeHidden();

    // 3. Zentrale Bereich 2 öffnen -> alle 3 neuen Smartphone-Schalter prüfen
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("Fokus, Bedienung & Smartphone")').click();
    await assertNoHorizontalOverflow(page, 'Station 17 – Zentrale Bereich 2 geöffnet');

    const wakeLockToggle = page.locator('[data-testid="toggle-wake-lock"]');
    const shareTargetToggle = page.locator('[data-testid="toggle-share-target"]');
    const appShortcutsToggle = page.locator('[data-testid="toggle-app-shortcuts"]');

    for (const toggle of [wakeLockToggle, shareTargetToggle, appShortcutsToggle]) {
      await expect(toggle).toBeVisible();
      await expect(toggle).toContainText('An');
      const box = await toggle.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    // shareTargetEnabled ausschalten -> Reload -> Persistenz prüfen
    await shareTargetToggle.click();
    await expect(shareTargetToggle).toContainText('Aus');
    await page.waitForTimeout(250);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("Fokus, Bedienung & Smartphone")').click();
    await expect(page.locator('[data-testid="toggle-share-target"]')).toContainText('Aus');

    // Erneuter Aufruf mit ?share_text -> VoiceModal darf NICHT öffnen, URL wird bereinigt
    await page.goto('./?share_text=Soll+ignoriert+werden');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    await expect.poll(() => page.url()).not.toContain('share_text');

    await expect(page.locator('div[role="region"][aria-label="KI-Begleiter Kompakt"]')).toHaveCount(0);
    await expect(page.locator('div[role="dialog"][aria-label="KI-Sprachassistent Dialog"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page, 'Station 17 – Share-Target im Aus-Zustand ignoriert');

    // Schalter sauber wieder einschalten
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("Fokus, Bedienung & Smartphone")').click();
    const shareToggleAgain = page.locator('[data-testid="toggle-share-target"]');
    await shareToggleAgain.click();
    await expect(shareToggleAgain).toContainText('An');
    await assertNoHorizontalOverflow(page, 'Station 17 – Abschluss');
  });

  test('Station 18 – Beleg- & Rechnungs-Vorarbeiter: Zentrale-Schalter, geschlossene Schublade, Dubletten-Check, 1-Tipp-Abgleich & Steuerberater-CSV (390px-Schutz)', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // 1. Zentrale Bereich 4 öffnen -> Toggle prüfen (min-h >= 44px) & ausschalten
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("Erinnerungen, Vorarbeiter & Smart Home")').click();
    await assertNoHorizontalOverflow(page, 'Station 18 – Bereich 4 geöffnet');

    const foremanToggle = page.locator('[data-testid="toggle-receipt-foreman"]');
    await expect(foremanToggle).toBeVisible();
    await expect(foremanToggle).toContainText('An');
    const toggleBox = await foremanToggle.boundingBox();
    expect(toggleBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    await foremanToggle.click();
    await expect(foremanToggle).toContainText('Aus');
    await page.waitForTimeout(250);

    // Reload -> Persistenz prüfen & geschlossene Schublade in ReceiptScanView verifizieren
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("Erinnerungen, Vorarbeiter & Smart Home")').click();
    await expect(page.locator('[data-testid="toggle-receipt-foreman"]')).toContainText('Aus');
    await page.locator('button:has-text("Zurück")').click();

    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('div[role="toolbar"][aria-label="Schnellzugriff"] button:has-text("Beleg-Scan")').click();
    await expect(page.locator('h3:has-text("Beleg-Scan")')).toBeVisible();
    await expect(page.locator('[data-testid="tax-advisor-package-card"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="receipt-duplicate-banner"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="foreman-cart-reconcile-card"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page, 'Station 18 – Beleg-Vorarbeiter im Aus-Zustand');

    // 2. Vorarbeiter wieder einschalten
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("Erinnerungen, Vorarbeiter & Smart Home")').click();
    await page.locator('[data-testid="toggle-receipt-foreman"]').click();
    await expect(page.locator('[data-testid="toggle-receipt-foreman"]')).toContainText('An');
    await page.waitForTimeout(250);

    // 3. Deterministische Test-Belege (2 identische Bauhaus-Belege + passender Einkaufswagen-Artikel) in IDB ablegen
    await page.evaluate(async () => {
      const seededReceipts = [
        {
          id: 'rcpt-seed-1',
          projectId: 'proj-foodtruck',
          projectName: 'Pizza Bandit (TSA & Foodtruck)',
          storeName: 'Bauhaus',
          purchaseDate: '15.11.2026',
          totalAmount: '119,00',
          vatRate: 19,
          category: 'Material',
          items: [
            { title: 'Bauhaus Gasdruckregler 50 mbar', quantity: '1x', price: '54,90' },
            { title: 'Edelstahl Schrauben Set', quantity: '2x', price: '64,10' }
          ],
          createdAt: '15.11.2026, 12:00 Uhr',
          reconciled: false
        },
        {
          id: 'rcpt-seed-2',
          projectId: 'proj-foodtruck',
          projectName: 'Pizza Bandit (TSA & Foodtruck)',
          storeName: 'Bauhaus',
          purchaseDate: '15.11.2026',
          totalAmount: '119,00',
          vatRate: 19,
          category: 'Material',
          items: [
            { title: 'Bauhaus Gasdruckregler 50 mbar', quantity: '1x', price: '54,90' },
            { title: 'Edelstahl Schrauben Set', quantity: '2x', price: '64,10' }
          ],
          createdAt: '15.11.2026, 12:05 Uhr',
          reconciled: false
        }
      ];

      localStorage.setItem('banditos_scanned_receipts_v1', JSON.stringify(seededReceipts));
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('keyval-store');
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains('keyval')) {
            req.result.createObjectStore('keyval');
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(seededReceipts, 'banditos_scanned_receipts_v1');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    await page.goto('./?action=receipt');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h3:has-text("Beleg-Scan")')).toBeVisible({ timeout: 10000 });

    // Steuerberater-Monatspaket sichtbar mit korrekten Brutto-/Netto-Summen & CSV-Download
    const taxCard = page.locator('[data-testid="tax-advisor-package-card"]');
    await expect(taxCard).toBeVisible();
    await expect(page.locator('[data-testid="tax-summary-count"]')).toHaveText('2');
    await expect(page.locator('[data-testid="tax-summary-net"]')).toContainText('200,00 €');
    await expect(page.locator('[data-testid="tax-summary-vat"]')).toContainText('38,00 €');
    await expect(page.locator('[data-testid="tax-summary-gross"]')).toContainText('238,00 €');

    const csvBtn = page.locator('[data-testid="btn-download-tax-csv"]');
    await expect(csvBtn).toBeVisible();
    const csvBox = await csvBtn.boundingBox();
    expect(csvBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    const downloadPromise = page.waitForEvent('download');
    await csvBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('banditos-belege-alle.csv');

    // Dubletten-Hinweis in Honig-Gold sichtbar
    const dupBanner = page.locator('[data-testid="receipt-duplicate-banner"]');
    await expect(dupBanner).toBeVisible();
    await expect(dupBanner).toContainText('Bauhaus');

    // 1-Tipp-Einkaufswagen-Abgleich sichtbar & ausführbar
    const reconcileCard = page.locator('[data-testid="foreman-cart-reconcile-card"]');
    await expect(reconcileCard).toBeVisible();
    await expect(reconcileCard).toContainText('Gewerbe-Gasdruckregler 50 mbar');
    await assertNoHorizontalOverflow(page, 'Station 18 – Vorarbeiter-Karten sichtbar');

    const reconcileBtn = page.locator('[data-testid="btn-reconcile-selected-cart"]');
    await expect(reconcileBtn).toBeVisible();
    const reconcileBox = await reconcileBtn.boundingBox();
    expect(reconcileBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await reconcileBtn.click();

    // Nach Abgleich: Karte verschwindet (oder Beleg als Abgeglichen markiert)
    await expect(page.locator('[data-testid="receipt-card-rcpt-seed-1"]')).toContainText('Abgeglichen');
    await assertNoHorizontalOverflow(page, 'Station 18 – Nach 1-Tipp-Abgleich');

    // Im Einkaufswagen verifizieren, dass der Artikel abgehakt wurde
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('div[role="toolbar"][aria-label="Schnellzugriff"] button:has-text("Einkauf")').click();
    const cartSection = page.locator('section:has(h3:has-text("Einkaufswagen"))');
    await expect(cartSection).toBeVisible();
    const gasReglerCard = cartSection.locator('div[id^="item-card-"]:has-text("Gewerbe-Gasdruckregler 50 mbar")');
    await expect(gasReglerCard.locator('button[aria-label="Als offen markieren"]')).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 18 – Artikel im Einkaufswagen abgehakt');
  });

  test('Station 19 – Stiller Mitdenker & Nebenbei-Murmel-Autopilot: 2 Zentrale-Schalter, geschlossene Schublade, leere Bühne, Ja/Später/Nein-Freigabekarten & Hintergrund-Recherche (390px-Schutz)', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // 1. Zentrale Bereich 4 öffnen -> beide neuen Schalter prüfen (min-h >= 44px, Default An) & ausschalten
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("Erinnerungen, Vorarbeiter & Smart Home")').click();
    await assertNoHorizontalOverflow(page, 'Station 19 – Bereich 4 geöffnet');

    const thinkerToggle = page.locator('[data-testid="toggle-silent-thinker"]');
    const murmurToggle = page.locator('[data-testid="toggle-murmur-autopilot"]');
    await expect(thinkerToggle).toBeVisible();
    await expect(murmurToggle).toBeVisible();
    await expect(thinkerToggle).toContainText('An');
    await expect(murmurToggle).toContainText('An');

    for (const toggle of [thinkerToggle, murmurToggle]) {
      const box = await toggle.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await thinkerToggle.click();
    await murmurToggle.click();
    await expect(thinkerToggle).toContainText('Aus');
    await expect(murmurToggle).toContainText('Aus');
    await page.waitForTimeout(250);

    // Reload -> Persistenz & Prinzip der geschlossenen Schublade verifizieren
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Im Aus-Zustand: kein Vorarbeiter-Posteingang auf der Front-Bühne
    await expect(page.locator('[data-testid="foreman-inbox-header"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page, 'Station 19 – Front im Aus-Zustand');

    // In Deep Research: Nebenbei-prüfen-Button komplett ausgeblendet
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('div[role="toolbar"][aria-label="Schnellzugriff"] button:has-text("Deep Research")').click();
    await expect(page.locator('h3:has-text("Deep Research")')).toBeVisible();
    await expect(page.locator('[data-testid="btn-murmur-research"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page, 'Station 19 – Deep Research im Aus-Zustand');

    // Zentrale Bereich 4 -> beide Schalter wieder einschalten
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("Erinnerungen, Vorarbeiter & Smart Home")').click();
    await expect(page.locator('[data-testid="toggle-silent-thinker"]')).toContainText('Aus');
    await expect(page.locator('[data-testid="toggle-murmur-autopilot"]')).toContainText('Aus');
    await page.locator('[data-testid="toggle-silent-thinker"]').click();
    await page.locator('[data-testid="toggle-murmur-autopilot"]').click();
    await expect(page.locator('[data-testid="toggle-silent-thinker"]')).toContainText('An');
    await expect(page.locator('[data-testid="toggle-murmur-autopilot"]')).toContainText('An');
    await page.waitForTimeout(250);
    await page.locator('button:has-text("Zurück")').click();

    // 2. Auf sauberes Projekt "Bäckerei" wechseln -> 0 Hinweise -> Bühne zu 100 % leer (kein "0 Hinweise"-Kasten)
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('button:has-text("Bäckerei")').first().click();
    await expect(page.locator('h1')).toContainText('Bäckerei');
    await expect(page.locator('[data-testid="foreman-inbox-header"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page, 'Station 19 – Leere Bühne bei 0 Hinweisen');

    // 3. Deterministische Widersprüche (Checks 1, 2, 3) für proj-baeckerei in IDB einspeisen
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('keyval-store');
        req.onsuccess = () => {
          const db = req.result;
          const readTx = db.transaction('keyval', 'readonly');
          const getReq = readTx.objectStore('keyval').get('nexusflow_pwa_v1_state');
          getReq.onsuccess = () => {
            const snap = getReq.result;
            if (!snap || !Array.isArray(snap.projects)) {
              reject(new Error('Kein AppState in IDB gefunden'));
              return;
            }
            const nextProjects = snap.projects.map((p: any) => {
              if (p.id !== 'proj-baeckerei') return p;
              return {
                ...p,
                tasks: [
                  {
                    id: 'thinker-seed-t-measure',
                    title: 'Arbeitsplatte auf 140 cm zuschneiden',
                    completed: false,
                    priority: 'Hoch',
                    estimatedMinutes: 30,
                    dayBlock: null,
                    reminderAt: '',
                    aiTouched: false,
                    lastModified: '26.11.2026, 12:00 Uhr',
                    changeReason: 'Test-Seed Maßkonflikt',
                    source: 'Manuell',
                    customMeta: {}
                  },
                  {
                    id: 'thinker-seed-t-done',
                    title: 'Teigschaber reinigen und prüfen',
                    completed: true,
                    priority: 'Mittel',
                    estimatedMinutes: 10,
                    dayBlock: null,
                    reminderAt: '',
                    aiTouched: false,
                    lastModified: '26.11.2026, 12:00 Uhr',
                    changeReason: 'Test-Seed erledigt',
                    source: 'Manuell',
                    customMeta: {}
                  },
                  ...(p.tasks || [])
                ],
                knowledge: [
                  {
                    id: 'thinker-seed-k-measure',
                    kind: 'info',
                    title: 'Backstube Arbeitsplatte Vorgabe',
                    content: 'Arbeitsplatte: max. 120 cm Tiefe wegen Durchgang.',
                    attachments: [],
                    lastModified: '26.11.2026, 12:00 Uhr',
                    changeReason: 'Test-Seed Wissen',
                    source: 'Manuell',
                    aiTouched: false,
                    customMeta: {}
                  },
                  ...(p.knowledge || [])
                ],
                cart: [
                  {
                    id: 'thinker-seed-c-dup1',
                    title: '2x Silikon Kartusche',
                    quantity: '2x',
                    price: '',
                    completed: false,
                    aiTouched: false,
                    lastModified: '26.11.2026, 12:00 Uhr',
                    changeReason: 'Test-Seed Dublette 1',
                    source: 'Manuell',
                    customMeta: {}
                  },
                  {
                    id: 'thinker-seed-c-dup2',
                    title: 'Silikon Kartusche',
                    quantity: '1x',
                    price: '',
                    completed: false,
                    aiTouched: false,
                    lastModified: '26.11.2026, 12:00 Uhr',
                    changeReason: 'Test-Seed Dublette 2',
                    source: 'Manuell',
                    customMeta: {}
                  },
                  {
                    id: 'thinker-seed-c-done',
                    title: 'Teigschaber Silikon',
                    quantity: '1x',
                    price: '',
                    completed: false,
                    aiTouched: false,
                    lastModified: '26.11.2026, 12:00 Uhr',
                    changeReason: 'Test-Seed offener Kauf',
                    source: 'Manuell',
                    customMeta: {}
                  },
                  ...(p.cart || [])
                ]
              };
            });
            const writeTx = db.transaction('keyval', 'readwrite');
            writeTx.objectStore('keyval').put({ ...snap, projects: nextProjects }, 'nexusflow_pwa_v1_state');
            writeTx.oncomplete = () => resolve();
            writeTx.onerror = () => reject(writeTx.error);
          };
          getReq.onerror = () => reject(getReq.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('button:has-text("Bäckerei")').first().click();

    // 4. Zugeklappte Kopfzeile mit Mono-Zähler 3 sichtbar, Kartenliste noch eingeklappt
    const inboxHeader = page.locator('[data-testid="foreman-inbox-header"]');
    await expect(inboxHeader).toBeVisible({ timeout: 5000 });
    await expect(inboxHeader).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('[data-testid="foreman-inbox-count"]')).toHaveText('3');
    await expect(page.locator('[data-testid="foreman-inbox-list"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page, 'Station 19 – Zugeklappte Vorarbeiter-Kopfzeile');

    // Aufklappen -> 3 ruhige Freigabekarten sichtbar
    await inboxHeader.click();
    await expect(inboxHeader).toHaveAttribute('aria-expanded', 'true');
    const inboxList = page.locator('[data-testid="foreman-inbox-list"]');
    await expect(inboxList).toBeVisible();
    await expect(inboxList.locator('article')).toHaveCount(3);
    await assertNoHorizontalOverflow(page, 'Station 19 – Aufgeklappte Freigabekarten');

    // Touch-Ziele (>= 44px) auf erster Karte prüfen
    const measureCard = page.locator(
      '[data-testid="foreman-proposal-card-thinker:measure-conflict:proj-baeckerei:thinker-seed-t-measure:thinker-seed-k-measure:cm"]'
    );
    await expect(measureCard).toBeVisible();
    await expect(measureCard).toContainText('140 cm');
    await expect(measureCard).toContainText('120 cm');

    const acceptBtn = page.locator(
      '[data-testid="foreman-accept-thinker:measure-conflict:proj-baeckerei:thinker-seed-t-measure:thinker-seed-k-measure:cm"]'
    );
    const snoozeBtn = page.locator(
      '[data-testid="foreman-snooze-thinker:measure-conflict:proj-baeckerei:thinker-seed-t-measure:thinker-seed-k-measure:cm"]'
    );
    const dismissBtn = page.locator(
      '[data-testid="foreman-dismiss-thinker:measure-conflict:proj-baeckerei:thinker-seed-t-measure:thinker-seed-k-measure:cm"]'
    );
    for (const btn of [acceptBtn, snoozeBtn, dismissBtn]) {
      const box = await btn.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    // Später (Snooze 4h) auf Maßkonflikt -> Zähler sinkt auf 2
    await snoozeBtn.click();
    await expect(page.locator('[data-testid="foreman-inbox-count"]')).toHaveText('2');

    // Nein (dauerhaft stummschalten) auf Check 3 (erledigte Aufgabe vs. offener Einkauf) -> Zähler sinkt auf 1
    await page
      .locator('[data-testid="foreman-dismiss-thinker:cart-task:proj-baeckerei:thinker-seed-c-done"]')
      .click();
    await expect(page.locator('[data-testid="foreman-inbox-count"]')).toHaveText('1');

    // Ja (Doppelten Einkaufsposten bereinigen) auf Check 1 -> Posteingang leert sich komplett
    await page
      .locator('[data-testid="foreman-accept-thinker:dedupe-cart:proj-baeckerei:silikon-kartusche"]')
      .click();
    await expect(page.locator('[data-testid="foreman-inbox-header"]')).toHaveCount(0);

    // Reload -> Snooze & Dismiss bleiben persistent unterdrückt
    await page.waitForTimeout(250);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('button:has-text("Bäckerei")').first().click();
    await expect(page.locator('[data-testid="foreman-inbox-header"]')).toHaveCount(0);

    // 5. „Nebenbei-Murmel“-Autopilot in Deep Research testen
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('div[role="toolbar"][aria-label="Schnellzugriff"] button:has-text("Deep Research")').click();
    await expect(page.locator('h3:has-text("Deep Research")')).toBeVisible();

    const topicInput = page.locator('textarea[placeholder*="DVGW G 607"]');
    await topicInput.fill('DVGW G 607 Prüfung Pizzaofen');

    const murmurBtn = page.locator('[data-testid="btn-murmur-research"]');
    await expect(murmurBtn).toBeVisible();
    const murmurBox = await murmurBtn.boundingBox();
    expect(murmurBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await murmurBtn.click();

    // Ruhiger Honig-Gold-Hinweis erscheint sofort, UI bleibt bedienbar
    const murmurNotice = page.locator('[data-testid="murmur-background-notice"]');
    await expect(murmurNotice).toBeVisible();
    await expect(murmurNotice).toContainText('Vorarbeiter prüft im Hintergrund');
    await assertNoHorizontalOverflow(page, 'Station 19 – Nebenbei prüfen ausgelöst');

    // Zurück in die Projektansicht (Bäckerei -> Tasks/Gesamt) und entstandene Freigabekarte prüfen
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('button:has-text("Bäckerei")').first().click();

    const researchInboxHeader = page.locator('[data-testid="foreman-inbox-header"]');
    await expect(researchInboxHeader).toBeVisible({ timeout: 8000 });
    await researchInboxHeader.click();

    const researchCard = page.locator('[data-testid^="foreman-proposal-card-murmur:"]').first();
    await expect(researchCard).toBeVisible();
    await expect(researchCard).toContainText('Nebenbei-Prüfung');
    await assertNoHorizontalOverflow(page, 'Station 19 – Murmel-Freigabekarte sichtbar');

    await researchCard.locator('[data-testid^="foreman-accept-murmur:"]').click();
    await expect(page.locator('[data-testid="foreman-inbox-header"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page, 'Station 19 – Abschluss');
  });

  test('Station 20 – Allgemeine Bild-Vision & Offline-Audio-Puffer: 2 Zentrale-Schalter, geschlossene Schublade, Typenschild-Galerie mit 1-Tipp-Übernahme & Funkloch-Memo-Puffer (390px-Schutz)', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // 1. Zentrale Bereich 4 & Bereich 3 öffnen -> beide neuen Schalter prüfen (min-h >= 44px, Default An) & ausschalten
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("Erinnerungen, Vorarbeiter & Smart Home")').click();

    const visionToggle = page.locator('[data-testid="toggle-general-vision"]');
    await expect(visionToggle).toBeVisible();
    await expect(visionToggle).toContainText('An');
    expect((await visionToggle.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await visionToggle.click();
    await expect(visionToggle).toContainText('Aus');
    await assertNoHorizontalOverflow(page, 'Station 20 – Bereich 4 Toggle Aus');

    await page.locator('button:has-text("KI & Stimme")').click();
    const audioBufferToggle = page.locator('[data-testid="toggle-offline-audio-buffer"]');
    await expect(audioBufferToggle).toBeVisible();
    await expect(audioBufferToggle).toContainText('An');
    expect((await audioBufferToggle.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await audioBufferToggle.click();
    await expect(audioBufferToggle).toContainText('Aus');
    await assertNoHorizontalOverflow(page, 'Station 20 – Bereich 3 Toggle Aus');

    // Reload -> Persistenz beider Schalter verifizieren
    await page.waitForTimeout(250);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("Erinnerungen, Vorarbeiter & Smart Home")').click();
    await expect(page.locator('[data-testid="toggle-general-vision"]')).toContainText('Aus');
    await page.locator('button:has-text("KI & Stimme")').click();
    await expect(page.locator('[data-testid="toggle-offline-audio-buffer"]')).toContainText('Aus');
    await page.locator('button:has-text("Zurück")').click();

    // 2. Geschlossene Schublade: in ReceiptScanView darf Umschalter "Foto & Typenschild" nicht sichtbar sein
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('div[role="toolbar"][aria-label="Schnellzugriff"] button:has-text("Beleg-Scan")').click();
    await expect(page.locator('h3:has-text("Beleg-Scan")')).toBeVisible();
    await expect(page.locator('[data-testid="vision-mode-switch"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mode-tab-vision"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page, 'Station 20 – Beleg-Scan bei deaktivierter Vision');

    // Beide Schalter wieder einschalten
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("Erinnerungen, Vorarbeiter & Smart Home")').click();
    await page.locator('[data-testid="toggle-general-vision"]').click();
    await expect(page.locator('[data-testid="toggle-general-vision"]')).toContainText('An');
    await page.locator('button:has-text("KI & Stimme")').click();
    await page.locator('[data-testid="toggle-offline-audio-buffer"]').click();
    await expect(page.locator('[data-testid="toggle-offline-audio-buffer"]')).toContainText('An');
    await page.waitForTimeout(250);

    // 3. Allgemeine Bild-Vision End-to-End (Moduswechsel, Upload im Offline-Fallback, Galerie & 1-Tipp-Übernahme)
    await page.goto('./?action=receipt');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="vision-mode-switch"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="mode-tab-vision"]').click();

    const visionPanel = page.locator('[data-testid="general-vision-panel"]');
    await expect(visionPanel).toBeVisible();

    for (const catId of ['nameplate', 'sketch', 'site-photo']) {
      const chip = page.locator(`[data-testid="vision-cat-${catId}"]`);
      await expect(chip).toBeVisible();
      expect((await chip.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await page.locator('[data-testid="vision-hint-input"]').fill('Ooni Koda 16 Typenschild');
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    await page.locator('[data-testid="vision-file-input"]').setInputFiles({
      name: 'typenschild.png',
      mimeType: 'image/png',
      buffer: Buffer.from(pngBase64, 'base64')
    });

    const resultCard = page.locator('[data-testid="vision-result-card"]');
    await expect(resultCard).toBeVisible({ timeout: 8000 });
    await expect(resultCard).toContainText('Ooni Koda 16 Typenschild');
    await expect(page.locator('[data-testid="vision-gallery-list"]')).toContainText('Ooni Koda 16 Typenschild');
    await assertNoHorizontalOverflow(page, 'Station 20 – Vision-Ergebnis & Galerie sichtbar');

    // 1-Tipp-Übernahme als Wissen & Aufgabe prüfen
    const saveKnowledgeBtn = page.locator('[data-testid="vision-btn-save-knowledge"]');
    const addTaskBtn = page.locator('[data-testid="vision-btn-add-task"]');
    expect((await saveKnowledgeBtn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((await addTaskBtn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    await saveKnowledgeBtn.click();
    await expect(page.locator('[data-testid="vision-action-confirmed"]')).toContainText('Als Wissen gesichert');
    await addTaskBtn.click();
    await expect(page.locator('[data-testid="vision-action-confirmed"]')).toContainText('Als Aufgabe angelegt');

    // Sicherstellen, dass Beleg & Rechnung sauber getrennt bleibt (0 Belege)
    await page.locator('[data-testid="mode-tab-receipt"]').click();
    await expect(page.locator('text=Noch keine Belege erfasst')).toBeVisible();

    // Im Projekt prüfen, dass Wissen-Eintrag übernommen wurde
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('button:has-text("Wissen")').first().click();
    await expect(page.locator('section:has(h3:has-text("Wissen"))')).toContainText('Ooni Koda 16 Typenschild');
    await assertNoHorizontalOverflow(page, 'Station 20 – Vision-Eintrag in Wissen');

    // 4. Offline-Audio-Puffer End-to-End über IDB-Seed
    await page.evaluate(async () => {
      const seededMemos = [
        {
          id: 'memo-seed-1',
          projectId: 'proj-foodtruck',
          createdAt: '26.11.2026, 14:10 Uhr',
          durationSec: 18,
          mimeType: 'audio/webm',
          noteText: 'Funkloch-Check: 2x Silikonspray für Ofen einpacken',
          status: 'queued'
        }
      ];
      localStorage.setItem('banditos_offline_audio_memos_v1', JSON.stringify(seededMemos));
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('keyval-store');
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains('keyval')) {
            req.result.createObjectStore('keyval');
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(seededMemos, 'banditos_offline_audio_memos_v1');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // VoiceModal öffnen -> OfflineAudioBufferBar zeigt Zähler & lässt sich aufklappen
    await page.locator('button[aria-label="Daumen-Steuerung"]').click();
    const stage1 = page.locator('div[role="region"][aria-label="KI-Begleiter Kompakt"]');
    await expect(stage1).toBeVisible();

    const bufferBar = stage1.locator('[data-testid="offline-audio-buffer-bar"]');
    await expect(bufferBar).toBeVisible();
    await expect(bufferBar.locator('[data-testid="offline-buffer-count"]')).toContainText('1 gepuffertes Memo');
    await assertNoHorizontalOverflow(page, 'Station 20 – Offline-Audio-Puffer sichtbar');

    await bufferBar.locator('[data-testid="offline-buffer-toggle"]').click();
    await expect(bufferBar.locator('[data-testid="offline-buffer-list"]')).toBeVisible();
    const memoCard = bufferBar.locator('[data-testid="offline-memo-memo-seed-1"]');
    await expect(memoCard).toContainText('Funkloch-Check: 2x Silikonspray');
    const deleteMemoBtn = memoCard.locator('[data-testid="btn-delete-offline-memo-memo-seed-1"]');
    await expect
      .poll(async () => (await deleteMemoBtn.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(44);
    await assertNoHorizontalOverflow(page, 'Station 20 – Offline-Audio-Memo aufgeklappt');

    // Memo löschen -> Balken verschwindet im Online-Modus wieder komplett
    await deleteMemoBtn.click();
    await expect(stage1.locator('[data-testid="offline-audio-buffer-bar"]')).toHaveCount(0);

    // Begleiter schließen
    await page.locator('button[aria-label="Daumen-Steuerung"]').click();
    await expect(stage1).toBeHidden();
    await assertNoHorizontalOverflow(page, 'Station 20 – Abschluss');
  });

  test('Station 21 – Stetiger Begleiter v2 (Gemini-UI): 3 Zentrale-Schalter, geschlossene Schublade, Eingabe-Kapsel, Nachrichten-Werkzeuge & Chat-Export (390px-Schutz)', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // 1. Zentrale Bereich 3 öffnen -> alle 3 Begleiter-Schalter prüfen (min-h >= 44px)
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("KI & Stimme")').click();
    await assertNoHorizontalOverflow(page, 'Station 21 – Bereich 3 geöffnet');

    const toolsToggle = page.locator('[data-testid="toggle-companion-tools"]');
    const chipsToggle = page.locator('[data-testid="toggle-companion-quick-chips"]');
    const expandedToggle = page.locator('[data-testid="toggle-companion-start-expanded"]');

    await expect(toolsToggle).toBeVisible();
    await expect(chipsToggle).toBeVisible();
    await expect(expandedToggle).toBeVisible();
    await expect(toolsToggle).toContainText('An');
    await expect(chipsToggle).toContainText('An');
    await expect(expandedToggle).toContainText('Aus');

    for (const toggle of [toolsToggle, chipsToggle, expandedToggle]) {
      expect((await toggle.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    // toggle-companion-tools ausschalten -> Reload -> Persistenz prüfen
    await toolsToggle.click();
    await expect(toolsToggle).toContainText('Aus');
    await page.waitForTimeout(250);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("KI & Stimme")').click();
    await expect(page.locator('[data-testid="toggle-companion-tools"]')).toContainText('Aus');
    await page.locator('button:has-text("Zurück")').click();

    // 2. Begleiter öffnen (Stufe 2) & geschlossene Schublade prüfen (Export-/Werkzeug-Einträge verborgen)
    await page.locator('button[aria-label="Daumen-Steuerung"]').click();
    const stage1 = page.locator('div[role="region"][aria-label="KI-Begleiter Kompakt"]');
    await expect(stage1).toBeVisible();
    await stage1.locator('button[aria-label="Vergrößern zu Vollbild"]').click();

    const dialog = page.locator('div[role="dialog"][aria-label="KI-Sprachassistent Dialog"]');
    await expect(dialog).toBeVisible();

    const chatMenuBtn = dialog.locator('button[aria-label="Chat-Optionen"]');
    await expect(chatMenuBtn).toBeVisible();
    await chatMenuBtn.click();
    const chatMenu = dialog.locator('div[role="menu"][aria-label="Chat-Optionen Menü"]');
    await expect(chatMenu).toBeVisible();
    await expect(chatMenu.locator('button:has-text("Verlauf kopieren")')).toHaveCount(0);
    await expect(chatMenu.locator('button:has-text("Als Markdown (.md) exportieren")')).toHaveCount(0);
    await expect(chatMenu.locator('button:has-text("Als Text (.txt) exportieren")')).toHaveCount(0);
    await expect(chatMenu.locator('button:has-text("Verlauf als Projekt-Wissen sichern")')).toHaveCount(0);
    await expect(chatMenu.locator('button:has-text("Verlauf leeren")')).toBeVisible();

    await dialog.locator('button[aria-label="Schließen"]').click();
    await expect(dialog).toBeHidden();

    // Schalter wieder einschalten
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("KI & Stimme")').click();
    await page.locator('[data-testid="toggle-companion-tools"]').click();
    await expect(page.locator('[data-testid="toggle-companion-tools"]')).toContainText('An');
    await page.waitForTimeout(250);
    await page.locator('button:has-text("Zurück")').click();

    // 3. Gemini-Eingabe-Kapsel, Nachrichten-Werkzeuge & Chat-Export testen
    await page.locator('button[aria-label="Daumen-Steuerung"]').click();
    await expect(stage1).toBeVisible();
    await stage1.locator('button[aria-label="Vergrößern zu Vollbild"]').click();
    await expect(dialog).toBeVisible();

    const textarea = dialog.locator('textarea');
    const photoAttachLabel = dialog.locator('label[aria-label="Foto oder Datei anhängen"]');
    const modePill = dialog.locator('button[aria-label="KI-Modus umschalten"]');
    const micBtn = dialog.locator('button[aria-label="Mikrofon umschalten"]');
    const sendBtn = dialog.locator('button[aria-label="Senden"]');

    await expect(textarea).toBeVisible();
    await expect(photoAttachLabel).toBeVisible();
    await expect(modePill).toBeVisible();
    await expect(micBtn).toBeVisible();
    await expect(sendBtn).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 21 – Gemini-Eingabe-Kapsel');

    // Nachricht eintippen & absenden
    const testPrompt = 'Welche Aufgaben sind im Projekt noch offen?';
    await textarea.fill(testPrompt);
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // Nutzer-Nachricht mit Kopieren, Bearbeiten & Nochmal senden (>= 44px)
    const userCopyBtn = dialog.locator('button:has-text("Kopieren")').first();
    const userEditBtn = dialog.locator('button:has-text("Bearbeiten")').first();
    const userResendBtn = dialog.locator('button:has-text("Nochmal senden")').first();
    await expect(userCopyBtn).toBeVisible({ timeout: 5000 });
    await expect(userEditBtn).toBeVisible();
    await expect(userResendBtn).toBeVisible();

    for (const btn of [userCopyBtn, userEditBtn, userResendBtn]) {
      expect((await btn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    // KI-Antwort mit Kopieren, Neu verarbeiten, Mit 🧠 Pro & Als Wissen
    const reprocessBtn = dialog.locator('button:has-text("Neu verarbeiten")').first();
    const proBtn = dialog.locator('button:has-text("Pro")').first();
    const saveInfoBtn = dialog.locator('button:has-text("Als Wissen")').first();
    await expect(reprocessBtn).toBeVisible({ timeout: 5000 });
    await expect(proBtn).toBeVisible();
    await expect(saveInfoBtn).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 21 – Nachrichten-Werkzeuge sichtbar');

    // Bearbeiten tippen -> Text landet zurück im Eingabefeld
    await userEditBtn.click();
    await expect(textarea).toHaveValue(testPrompt);
    await textarea.fill('');

    // Chat-Menü (⋮) öffnen & alle 4 Export-/Wissen-Optionen prüfen
    await chatMenuBtn.click();
    await expect(chatMenu).toBeVisible();
    const copyAllBtn = chatMenu.locator('button:has-text("Verlauf kopieren")');
    const exportMdBtn = chatMenu.locator('button:has-text("Als Markdown (.md) exportieren")');
    const exportTxtBtn = chatMenu.locator('button:has-text("Als Text (.txt) exportieren")');
    const saveChatKnowledgeBtn = chatMenu.locator('button:has-text("Verlauf als Projekt-Wissen sichern")');

    for (const btn of [copyAllBtn, exportMdBtn, exportTxtBtn, saveChatKnowledgeBtn]) {
      await expect(btn).toBeVisible();
      expect((await btn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await assertNoHorizontalOverflow(page, 'Station 21 – Chat-Optionen Menü offen');

    // Verlauf als Projekt-Wissen sichern & ruhige Bestätigung prüfen
    await saveChatKnowledgeBtn.click();
    await expect(dialog.locator('[data-testid="companion-chat-action-notice"]')).toContainText(
      'Verlauf als Projekt-Wissen gesichert'
    );
    await assertNoHorizontalOverflow(page, 'Station 21 – Abschluss');

    await dialog.locator('button[aria-label="Schließen"]').click();
    await expect(dialog).toBeHidden();
  });

  test('Station 22 – Wacher Begleiter, Antriebs-Würfel & Energie-Tagesplaner: 3 Zentrale-Schalter, geschlossene Schublade, Akku-Filter & Schweinehund-Pool im 1-Fokus (390px-Schutz)', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // 1. Zentrale Bereich 2 & Bereich 4 öffnen -> 3 neue Schalter prüfen
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();

    await page.locator('button:has-text("Fokus, Bedienung & Smartphone")').click();
    const driveDiceToggle = page.locator('[data-testid="toggle-drive-dice"]');
    const energyPlannerToggle = page.locator('[data-testid="toggle-energy-planner"]');
    await expect(driveDiceToggle).toBeVisible();
    await expect(energyPlannerToggle).toBeVisible();
    await expect(driveDiceToggle).toContainText('An');
    await expect(energyPlannerToggle).toContainText('An');
    expect((await driveDiceToggle.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((await energyPlannerToggle.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await assertNoHorizontalOverflow(page, 'Station 22 – Bereich 2 Toggles');

    // Bereich 4 öffnen -> Schultertipp initial AUS & Ruhezeiten-Schublade geschlossen
    await page.locator('button:has-text("Erinnerungen, Vorarbeiter & Smart Home")').click();
    const shoulderTapToggle = page.locator('[data-testid="toggle-shoulder-tap"]');
    await expect(shoulderTapToggle).toBeVisible();
    await expect(shoulderTapToggle).toContainText('Aus');
    await expect(page.locator('[data-testid="shoulder-tap-settings-drawer"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="input-quiet-start"]')).toHaveCount(0);

    // Schultertipp einschalten -> Ruhezeiten (22:00-08:00) & Tonfall sichtbar
    await shoulderTapToggle.click();
    await expect(shoulderTapToggle).toContainText('An');
    await expect(page.locator('[data-testid="shoulder-tap-settings-drawer"]')).toBeVisible();
    const quietStartInput = page.locator('[data-testid="input-quiet-start"]');
    const quietEndInput = page.locator('[data-testid="input-quiet-end"]');
    await expect(quietStartInput).toHaveValue('22:00');
    await expect(quietEndInput).toHaveValue('08:00');

    const toneCalmBtn = page.locator('[data-testid="shoulder-tap-tone-calm"]');
    const toneDirectBtn = page.locator('[data-testid="shoulder-tap-tone-direct"]');
    await expect(toneCalmBtn).toBeVisible();
    await expect(toneDirectBtn).toBeVisible();
    expect((await toneCalmBtn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((await toneDirectBtn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await toneDirectBtn.click();
    await assertNoHorizontalOverflow(page, 'Station 22 – Schultertipp Schublade offen');

    // Reload -> Persistenz prüfen -> wieder sauber auf AUS
    await page.waitForTimeout(250);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("Erinnerungen, Vorarbeiter & Smart Home")').click();
    await expect(page.locator('[data-testid="toggle-shoulder-tap"]')).toContainText('An');
    await expect(page.locator('[data-testid="shoulder-tap-settings-drawer"]')).toBeVisible();
    await page.locator('[data-testid="toggle-shoulder-tap"]').click();
    await expect(page.locator('[data-testid="toggle-shoulder-tap"]')).toContainText('Aus');
    await expect(page.locator('[data-testid="shoulder-tap-settings-drawer"]')).toHaveCount(0);

    // 2. Geschlossene Schublade: toggle-energy-planner auf AUS -> Akku-Filterleiste in TasksView komplett weg
    await page.locator('button:has-text("Fokus, Bedienung & Smartphone")').click();
    await page.locator('[data-testid="toggle-energy-planner"]').click();
    await expect(page.locator('[data-testid="toggle-energy-planner"]')).toContainText('Aus');
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Zurück")').click();

    await expect(page.locator('[data-testid="energy-filter-bar"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page, 'Station 22 – Akku-Filter im Aus-Zustand ausgeblendet');

    // Wieder einschalten
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    await page.locator('button:has-text("Fokus, Bedienung & Smartphone")').click();
    await page.locator('[data-testid="toggle-energy-planner"]').click();
    await expect(page.locator('[data-testid="toggle-energy-planner"]')).toContainText('An');
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Zurück")').click();

    // 3. Energie-Filter & Schweinehund-Pool End-to-End in TasksView
    const energyBar = page.locator('[data-testid="energy-filter-bar"]');
    await expect(energyBar).toBeVisible();
    for (const chipId of ['all', 'low', 'medium', 'high']) {
      const chip = page.locator(`[data-testid="energy-filter-${chipId}"]`);
      await expect(chip).toBeVisible();
      expect((await chip.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    const addBtn = page.locator('button[aria-label="Aufgabe hinzufügen"]');
    // Aufgabe 1: Niedrig + Schweinehund-Pool
    await addBtn.click();
    await page.locator('input[placeholder="Neue Aufgabe beschreiben..."]').fill('Belegordner vorsortieren');
    await page.locator('[data-testid="task-form-energy-low"]').click();
    await page.locator('[data-testid="task-form-hurdle-toggle"]').click();
    await page.locator('form button[type="submit"]:has-text("Speichern")').click();

    // Aufgabe 2: Hoch
    await addBtn.click();
    await page.locator('input[placeholder="Neue Aufgabe beschreiben..."]').fill('Schwerlastrahmen ausrichten');
    await page.locator('[data-testid="task-form-energy-high"]').click();
    await page.locator('form button[type="submit"]:has-text("Speichern")').click();

    const tasksSection = page.locator('section:has(h3:has-text("Tasks"))');
    await expect(tasksSection).toContainText('Belegordner vorsortieren');
    await expect(tasksSection).toContainText('Schwerlastrahmen ausrichten');
    await assertNoHorizontalOverflow(page, 'Station 22 – Neue Aufgaben angelegt');

    // Filter Niedrig -> deterministisch nur Aufgabe 1 sichtbar
    await page.locator('[data-testid="energy-filter-low"]').click();
    await expect(tasksSection).toContainText('Belegordner vorsortieren');
    await expect(tasksSection).not.toContainText('Schwerlastrahmen ausrichten');
    await assertNoHorizontalOverflow(page, 'Station 22 – Filter Niedrig');

    // Filter zurück auf Alle
    await page.locator('[data-testid="energy-filter-all"]').click();
    await expect(tasksSection).toContainText('Schwerlastrahmen ausrichten');

    // 4. Antriebs-Würfel im 1-Fokus über das ⋮-Menü starten
    await page.locator('button[aria-label="Weitere Aufgaben-Aktionen"]').click();
    const diceMenuItem = page.locator('[data-testid="menu-drive-dice"]');
    await expect(diceMenuItem).toBeVisible();
    expect((await diceMenuItem.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await diceMenuItem.click();

    const focusOverlay = page.locator('div[role="dialog"][aria-label="1-Fokus-Modus"]');
    await expect(focusOverlay).toBeVisible();
    await expect(focusOverlay.locator('[data-testid="single-focus-hurdle-badge"]')).toBeVisible();
    await expect(focusOverlay.locator('h2')).toContainText('Belegordner vorsortieren');

    const rollBtn = focusOverlay.locator('[data-testid="btn-roll-another-task"]');
    await expect(rollBtn).toBeVisible();
    expect((await rollBtn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await assertNoHorizontalOverflow(page, 'Station 22 – Antriebs-Würfel 1-Fokus offen');

    // Andere Aufgabe würfeln -> Overlay bleibt offen, andere Aufgabe wird geladen
    await rollBtn.click();
    await expect(focusOverlay).toBeVisible();
    await expect(focusOverlay.locator('h2')).not.toContainText('Belegordner vorsortieren');
    await assertNoHorizontalOverflow(page, 'Station 22 – Nach Andere Aufgabe würfeln');

    await focusOverlay.locator('button[aria-label="Schließen"]').click();
    await expect(focusOverlay).toBeHidden();
    await assertNoHorizontalOverflow(page, 'Station 22 – Abschluss');
  });

  test('Station 23 – Gastro- & TSA-Automatik: Einkaufswagen-Brücke, 1-Klick-HACCP-Protokoll & geschlossene Smart-Home-Schnellschalter (390px-Schutz)', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    const openExtras = async () => {
      await page.locator('button[aria-label="Navigation öffnen"]').click();
      const extrasBtn = page.locator('button:has-text("Werkzeuge"), button:has-text("Extras")').first();
      await expect(extrasBtn).toBeVisible({ timeout: 5000 });
      await extrasBtn.click();
    };

    const openAutomationSection = async () => {
      await page.locator('button[aria-label="Navigation öffnen"]').click();
      await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
      await page.locator('button:has-text("Erinnerungen, Vorarbeiter & Smart Home")').click();
    };

    // 1. Toggle-Prüfung Bereich 4: gastroCartBridgeEnabled ausschalten -> Reload -> Persistenz -> ExtrasView ausgeblendet
    await openAutomationSection();
    const gastroToggle = page.locator('[data-testid="toggle-gastro-cart-bridge"]');
    await expect(gastroToggle).toBeVisible();
    await expect(gastroToggle).toContainText('An');
    expect((await gastroToggle.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await gastroToggle.click();
    await expect(gastroToggle).toContainText('Aus');
    await page.waitForTimeout(250);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    await openAutomationSection();
    await expect(page.locator('[data-testid="toggle-gastro-cart-bridge"]')).toContainText('Aus');
    await page.locator('button:has-text("Zurück")').click();

    await openExtras();
    await expect(page.locator('[aria-label="POS Pizza-Slots"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="pos-restock-bridge"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="dough-restock-bridge"]')).toHaveCount(0);
    // Bei smartHomeEnabled = false darf in ExtrasView kein Smart-Home-Panel sichtbar sein
    await expect(page.locator('[data-testid="smart-home-quick-panel"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page, 'Station 23 – Brücken & Smart Home ausgeblendet');

    // Gastro-Brücke wieder einschalten
    await openAutomationSection();
    await page.locator('[data-testid="toggle-gastro-cart-bridge"]').click();
    await expect(page.locator('[data-testid="toggle-gastro-cart-bridge"]')).toContainText('An');
    await page.waitForTimeout(250);
    await page.locator('button:has-text("Zurück")').click();

    // 2. Gastro-Einkaufswagen-Brücke End-to-End (POS-Clicker + Dubletten-Schutz im Teigrechner)
    await openExtras();
    await expect(page.locator('[data-testid="pos-restock-bridge"]')).toBeVisible();
    await expect(page.locator('[data-testid="dough-restock-bridge"]')).toBeVisible();

    const firstSlotPlus = page.locator('[data-testid^="pos-slot-"] button[aria-label$="plus"]').first();
    await firstSlotPlus.click();

    await page.locator('[data-testid="pos-restock-toggle"]').click();
    const posSubmitBtn = page.locator('[data-testid="pos-restock-submit"]');
    await expect(posSubmitBtn).toBeVisible();
    expect((await posSubmitBtn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await posSubmitBtn.click();
    await expect(page.locator('[data-testid="pos-restock-confirmation"]')).toContainText('auf Einkaufsliste gelegt');
    await assertNoHorizontalOverflow(page, 'Station 23 – POS Nachorderung ausgelöst');

    // Teigrechner-Abgleich ohne Dubletten prüfen (Mehl, Fior di Latte, Sugo bereits durch POS im Wagen)
    const doughSyncBtn = page.locator('[data-testid="dough-restock-sync-btn"]');
    expect((await doughSyncBtn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await doughSyncBtn.click();
    await expect(page.locator('[data-testid="dough-restock-status"]')).toContainText('bereits im Einkaufswagen');

    // Im Einkaufswagen verifizieren, dass neue Artikel angekommen sind
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('div[role="toolbar"][aria-label="Schnellzugriff"] button:has-text("Einkauf")').click();
    const floatingCart = page.locator('div[role="dialog"][aria-label="Schwebender Einkaufswagen"]');
    const cartSection = page.locator('section:has(h3:has-text("Einkaufswagen"))');
    await expect(cartSection).toContainText('Pizzakartons');
    await assertNoHorizontalOverflow(page, 'Station 23 – Einkaufswagen nach Gastro-Brücke');
    if (await floatingCart.isVisible()) {
      await floatingCart.locator('button[aria-label="Einkaufswagen schließen"]').click();
      await expect(floatingCart).toBeHidden();
    }

    // 3. 1-Klick-HACCP-Protokoll End-to-End
    await openExtras();
    const haccpPlugin = page.locator('[data-testid="haccp-protocol-plugin"]');
    await expect(haccpPlugin).toBeVisible();

    await page.locator('[data-testid="haccp-fridge-temp"]').fill('3.5');
    const checkAllBtn = page.locator('[data-testid="haccp-check-all"]');
    expect((await checkAllBtn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await checkAllBtn.click();

    const saveHaccpBtn = page.locator('[data-testid="haccp-save-btn"]');
    expect((await saveHaccpBtn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await saveHaccpBtn.click();
    await expect(page.locator('[data-testid="haccp-history-list"]')).toContainText('3,5 °C');
    await assertNoHorizontalOverflow(page, 'Station 23 – HACCP gesichert');

    await page.waitForTimeout(250);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    await openExtras();
    await expect(page.locator('[data-testid="haccp-protocol-plugin"]')).toBeVisible();
    const exportCsvBtn = page.locator('[data-testid="haccp-export-csv"]');
    await expect(exportCsvBtn).toBeVisible();
    expect((await exportCsvBtn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await page.locator('[data-testid="haccp-history-toggle"]').click();
    await expect(page.locator('[data-testid="haccp-history-list"]')).toContainText('3,5 °C');
    await assertNoHorizontalOverflow(page, 'Station 23 – HACCP nach Reload persistent');

    // 4. Smart-Home-Schublade & Schnellschalter End-to-End
    await openAutomationSection();
    const smartHomeToggle = page.locator('[data-testid="toggle-smart-home"]');
    await expect(smartHomeToggle).toContainText('Aus');
    await smartHomeToggle.click();
    await expect(smartHomeToggle).toContainText('An');

    await page.locator('[data-testid="input-smart-switch-label"]').fill('TSA Test-Arbeitslicht');
    await page.locator('[data-testid="input-smart-switch-url"]').fill('http://127.0.0.1:9/relay/0?turn=toggle');
    await page.locator('[data-testid="btn-add-smart-switch"]').click();
    await assertNoHorizontalOverflow(page, 'Station 23 – Smart-Home-Schalter angelegt');
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Zurück")').click();

    await openExtras();
    const quickPanel = page.locator('[data-testid="smart-home-quick-panel"]');
    await expect(quickPanel).toBeVisible();
    await expect(quickPanel).toContainText('TSA Test-Arbeitslicht');
    await assertNoHorizontalOverflow(page, 'Station 23 – Smart-Home-QuickPanel in ExtrasView');

    // Smart Home sauber wieder auf AUS stellen (Standard-Ruhezustand)
    await openAutomationSection();
    await page.locator('[data-testid="toggle-smart-home"]').click();
    await expect(page.locator('[data-testid="toggle-smart-home"]')).toContainText('Aus');
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Zurück")').click();

    await openExtras();
    await expect(page.locator('[data-testid="smart-home-quick-panel"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page, 'Station 23 – Abschluss');
  });

  test('Station 24 – Komfort-Politur: 4 Zentrale-Schalter, Task-Edit-Metadaten, Einzelpunkt-Vorlesen, Änderungs-Chronologie & zugeklappte aiLogs-Einsicht (390px-Schutz)', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    const openZentrale = async () => {
      await page.locator('button[aria-label="Navigation öffnen"]').click();
      await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
    };

    // 1. Alle 4 neuen Zentrale-Schalter prüfen + aiLogs-Schublade inkl. Reload-Persistenz
    await openZentrale();

    await page.locator('button:has-text("Fokus, Bedienung & Smartphone")').click();
    const taskMetaToggle = page.locator('[data-testid="toggle-task-extended-meta"]');
    await expect(taskMetaToggle).toBeVisible();
    await expect(taskMetaToggle).toContainText('An');
    expect((await taskMetaToggle.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    await page.locator('button:has-text("KI & Stimme")').click();
    const stepReadToggle = page.locator('[data-testid="toggle-knowledge-step-read"]');
    await expect(stepReadToggle).toBeVisible();
    await expect(stepReadToggle).toContainText('An');
    expect((await stepReadToggle.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    await page.locator('button:has-text("Daten, Backup & System")').click();
    const changeHistoryToggle = page.locator('[data-testid="toggle-change-history"]');
    const aiLogsToggle = page.locator('[data-testid="toggle-ai-logs-viewer"]');
    await expect(changeHistoryToggle).toBeVisible();
    await expect(aiLogsToggle).toBeVisible();
    await expect(changeHistoryToggle).toContainText('An');
    await expect(aiLogsToggle).toContainText('Aus');
    expect((await changeHistoryToggle.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((await aiLogsToggle.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    // Geschlossene Schublade: aiLogs-Karte im Aus-Zustand unsichtbar
    await expect(page.locator('[data-testid="ai-logs-viewer-card"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page, 'Station 24 – Zentrale Toggles initial');

    // aiLogs-Einsicht einschalten -> Reload -> Persistenz & Aufklappen prüfen -> wieder AUS
    await aiLogsToggle.click();
    await expect(aiLogsToggle).toContainText('An');
    await expect(page.locator('[data-testid="ai-logs-viewer-card"]')).toBeVisible();
    await page.waitForTimeout(250);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    await openZentrale();
    await page.locator('button:has-text("Daten, Backup & System")').click();
    await expect(page.locator('[data-testid="toggle-ai-logs-viewer"]')).toContainText('An');
    await expect(page.locator('[data-testid="ai-logs-viewer-card"]')).toBeVisible();
    const aiLogsAccordion = page.locator('[data-testid="toggle-ai-logs-accordion"]');
    expect((await aiLogsAccordion.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await aiLogsAccordion.click();
    await expect(page.locator('[data-testid="ai-logs-viewer-list"]')).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 24 – aiLogs aufgeklappt');

    await page.locator('[data-testid="toggle-ai-logs-viewer"]').click();
    await expect(page.locator('[data-testid="toggle-ai-logs-viewer"]')).toContainText('Aus');
    await expect(page.locator('[data-testid="ai-logs-viewer-card"]')).toHaveCount(0);
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Zurück")').click();

    // 2. Task-Edit (Priorität, Dauer, Tagesblock) + Chronologie End-to-End
    const targetCard = page.locator('#item-card-tsa-bg5-t1');
    await expect(targetCard).toBeVisible();
    await targetCard.getByText('Shelly Plus 2PM').click();
    await targetCard.locator('button:has-text("Bearbeiten")').click();

    const prioHochBtn = targetCard.locator('[data-testid="edit-task-priority-Hoch"]');
    const dur30Btn = targetCard.locator('[data-testid="edit-task-duration-30"]');
    const blockMorningBtn = targetCard.locator('[data-testid="edit-task-dayblock-morning"]');
    for (const btn of [prioHochBtn, dur30Btn, blockMorningBtn]) {
      await expect(btn).toBeVisible();
      expect((await btn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await prioHochBtn.click();
    await dur30Btn.click();
    await blockMorningBtn.click();
    await assertNoHorizontalOverflow(page, 'Station 24 – Task-Edit-Metadaten offen');

    await targetCard.locator('[data-testid="save-edit-task-tsa-bg5-t1"]').click();
    await page.waitForTimeout(250);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    const reloadedCard = page.locator('#item-card-tsa-bg5-t1');
    await reloadedCard.getByText('Shelly Plus 2PM').click();

    const metaSummary = reloadedCard.locator('[data-testid="task-meta-summary-tsa-bg5-t1"]');
    await expect(metaSummary).toBeVisible();
    await expect(metaSummary).toContainText('Hoch');
    await expect(metaSummary).toContainText('30 min');
    await expect(metaSummary).toContainText('Morgens');

    const taskChangelogBtn = reloadedCard.locator('[data-testid="changelog-toggle-tsa-bg5-t1"]');
    await expect(taskChangelogBtn).toBeVisible();
    await expect(taskChangelogBtn).toContainText('Chronologie (1)');
    expect((await taskChangelogBtn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await taskChangelogBtn.click();
    const taskChangelogList = reloadedCard.locator('[data-testid="changelog-list-tsa-bg5-t1"]');
    await expect(taskChangelogList).toBeVisible();
    await expect(taskChangelogList).toContainText('Du');
    await expect(taskChangelogList).toContainText('Bearbeitet: Priorität / Dauer / Block');
    await assertNoHorizontalOverflow(page, 'Station 24 – Task-Chronologie aufgeklappt');

    // 3. Geschlossene Schublade bei taskExtendedMetaEnabled = Aus
    await openZentrale();
    await page.locator('button:has-text("Fokus, Bedienung & Smartphone")').click();
    await page.locator('[data-testid="toggle-task-extended-meta"]').click();
    await expect(page.locator('[data-testid="toggle-task-extended-meta"]')).toContainText('Aus');
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Zurück")').click();

    await reloadedCard.getByText('Shelly Plus 2PM').click();
    await reloadedCard.locator('button:has-text("Bearbeiten")').click();
    await expect(reloadedCard.locator('[data-testid="edit-task-extended-meta"]')).toHaveCount(0);

    await openZentrale();
    await page.locator('button:has-text("Fokus, Bedienung & Smartphone")').click();
    await page.locator('[data-testid="toggle-task-extended-meta"]').click();
    await expect(page.locator('[data-testid="toggle-task-extended-meta"]')).toContainText('An');
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Zurück")').click();

    // 4. Einzelpunkt-Vorlesen in KnowledgeView & Toggle-Schublade
    await page.locator('button[aria-label="Navigation öffnen"]').click();
    await page.locator('button:has-text("Wissen")').first().click();

    const knowledgeCard = page.locator('#item-card-tsa-exp-event');
    await expect(knowledgeCard).toBeVisible();
    await knowledgeCard.getByText('Event-Aufbau Checkliste vor Ort').click();

    const stepReadButtons = knowledgeCard.locator('[data-testid^="knowledge-step-read-tsa-exp-event-"]');
    await expect(stepReadButtons).toHaveCount(4);
    expect((await stepReadButtons.first().boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await assertNoHorizontalOverflow(page, 'Station 24 – Knowledge Einzelpunkt-Vorlesen');

    // toggle-knowledge-step-read auf AUS -> Einzelpunkt-Buttons verschwinden
    await openZentrale();
    await page.locator('button:has-text("KI & Stimme")').click();
    await page.locator('[data-testid="toggle-knowledge-step-read"]').click();
    await expect(page.locator('[data-testid="toggle-knowledge-step-read"]')).toContainText('Aus');
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Zurück")').click();

    await expect(knowledgeCard).toBeVisible();
    if ((await knowledgeCard.locator('button:has-text("Audio-Guide")').count()) === 0) {
      await knowledgeCard.getByText('Event-Aufbau Checkliste vor Ort').click();
    }
    await expect(knowledgeCard.locator('[data-testid^="knowledge-step-read-tsa-exp-event-"]')).toHaveCount(0);

    // Wieder einschalten
    await openZentrale();
    await page.locator('button:has-text("KI & Stimme")').click();
    await page.locator('[data-testid="toggle-knowledge-step-read"]').click();
    await expect(page.locator('[data-testid="toggle-knowledge-step-read"]')).toContainText('An');
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Zurück")').click();
    await assertNoHorizontalOverflow(page, 'Station 24 – Abschluss');
  });

  test('Station 25 – Taktil-Politur & opt-in A+C-„Jetzt-Vorbühne“: Zentrale-Schalter (Default Aus), Reload-Persistenz, Fokus-Blättern, Klapp-Riegel & sauberes Ausblenden (390px-Schutz)', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    const openZentraleFocus = async () => {
      await page.locator('button[aria-label="Navigation öffnen"]').click();
      await page.getByRole('button', { name: 'Zentrale', exact: true }).click();
      await page.locator('button:has-text("Fokus, Bedienung & Smartphone")').click();
    };

    // 1. Standardmäßig geschlossene Schublade prüfen: keine JETZT IM FOKUS Vorbühne sichtbar
    await expect(page.locator('[data-testid="tasks-now-stage"]')).toHaveCount(0);

    await openZentraleFocus();
    const nowStageToggle = page.locator('[data-testid="toggle-now-stage"]');
    await expect(nowStageToggle).toBeVisible();
    await expect(nowStageToggle).toHaveAttribute('aria-checked', 'false');
    await expect(nowStageToggle).toContainText('Aus');
    expect((await nowStageToggle.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    // Einschalten -> Reload -> Persistenz prüfen
    await nowStageToggle.click();
    await expect(nowStageToggle).toHaveAttribute('aria-checked', 'true');
    await expect(nowStageToggle).toContainText('An');
    await page.waitForTimeout(250);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    await openZentraleFocus();
    await expect(page.locator('[data-testid="toggle-now-stage"]')).toHaveAttribute('aria-checked', 'true');
    await page.locator('button:has-text("Zurück")').click();

    // 2. TasksView mit aktiver A+C-Jetzt-Vorbühne prüfen
    const nowStage = page.locator('[data-testid="tasks-now-stage"]');
    await expect(nowStage).toBeVisible();
    await expect(nowStage).toContainText('JETZT IM FOKUS');
    const counter = nowStage.locator('[data-testid="now-stage-counter"]');
    await expect(counter).toContainText('1 / ');

    const nextBtn = nowStage.locator('[data-testid="now-stage-next"]');
    const completeBtn = nowStage.locator('[data-testid="now-stage-complete"]');
    const toggleListBtn = nowStage.locator('[data-testid="now-stage-toggle-list"]');
    for (const btn of [nextBtn, completeBtn, toggleListBtn]) {
      await expect(btn).toBeVisible();
      expect((await btn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    // Vollständige Restliste startet eingeklappt
    await expect(toggleListBtn).toContainText('Alle weiteren Einträge entfalten');
    await expect(page.locator('#item-card-tsa-bg5-t1')).toHaveCount(0);
    await assertNoHorizontalOverflow(page, 'Station 25 – Jetzt-Vorbühne eingeklappt');

    // Weiter blättern -> Zähler wechselt auf 2 / N
    await nextBtn.click();
    await expect(counter).toContainText('2 / ');
    await assertNoHorizontalOverflow(page, 'Station 25 – Nach Weiter blättern');

    // Klapp-Riegel antippen -> Restliste klappt auf
    await toggleListBtn.click();
    await expect(toggleListBtn).toContainText('Liste wieder einklappen');
    await expect(page.locator('#item-card-tsa-bg5-t1')).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 25 – Restliste entfaltet');

    // 3. Sauber wieder auf AUS zurückstellen -> Vorbühne verschwindet komplett
    await openZentraleFocus();
    await page.locator('[data-testid="toggle-now-stage"]').click();
    await expect(page.locator('[data-testid="toggle-now-stage"]')).toHaveAttribute('aria-checked', 'false');
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Zurück")').click();

    await expect(page.locator('[data-testid="tasks-now-stage"]')).toHaveCount(0);
    await expect(page.locator('#item-card-tsa-bg5-t1')).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Station 25 – Abschluss');
  });
});
