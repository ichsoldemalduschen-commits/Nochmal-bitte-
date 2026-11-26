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
    const modalHeader = page.locator('text=KI-Kontext & Dialog');
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

    const section2Btn = page.locator('button:has-text("Fokus, Bedienung & Optik")');
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
    const classicModalHeader = page.locator('text=KI-Kontext & Dialog');
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

    // ── Bereich 4 aufklappen: Daten, Backup & System ──
    await section4Btn.click();
    await assertNoHorizontalOverflow(page, 'Station 7 – Bereich 4 geöffnet');

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
});
