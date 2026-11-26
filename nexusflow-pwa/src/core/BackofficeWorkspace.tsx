import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  AiVoiceSettings,
  AmbientLightMode,
  AppStateSnapshot,
  BanditUserPreferences,
  DayBlockId,
  DomainType,
  EventSalesLog,
  Project,
  SelfCheckEntry,
  THEME
} from '../types';
import {
  loadAmbientLightMode,
  loadUserPrefs,
  saveAmbientLightMode,
  saveUserPrefs
} from '../services/storage';
import {
  AiAndVoiceSection,
  AutomationSection,
  FocusAndSmartphoneSection,
  ProjectsSection,
  SystemAndBackupSection,
  ZentraleFooter
} from './backoffice';
import type { BlueprintTemplate } from './backoffice/SystemAndBackupSection';

export type ZentraleSectionId = 'projects' | 'focus' | 'ai' | 'automation' | 'system';

interface BackofficeWorkspaceProps {
  projects: Project[];
  selfChecks: SelfCheckEntry[];
  eventSalesLogs: EventSalesLog[];
  userApiKey: string;
  realityCheckEnabled: boolean;
  haWebhookUrl: string;
  haEmbedUrl: string;
  initialSection?: ZentraleSectionId | null;
  onCloseBackoffice: () => void;
  onToggleArchiveProject: (projectId: string) => void;
  onUpdateProject?: (projectId: string, patch: Partial<Project>) => void;
  onAssignDayBlock: (projectId: string, taskId: string, block: DayBlockId | null) => void;
  onAutoStructureDay: () => void;
  onTogglePluginForProject: (projectId: string, pluginId: string) => void;
  onToggleTabForProject?: (
    projectId: string,
    tab: 'tasks' | 'cart' | 'knowledge' | 'extras'
  ) => void;
  onSaveScratchpadToProject: (projectId: string, title: string, content: string) => void;
  onApplyBlueprint?: (projectId: string, blueprint: BlueprintTemplate) => void;
  onChangeApiKey: (key: string) => void;
  onToggleRealityCheck: () => void;
  onChangeHaWebhook: (url: string) => void;
  onChangeHaEmbed?: (url: string) => void;
  onOpenFlip7Cover: () => void;
  onOpenRealityModal?: () => void;
  onOpenSelfCheckModal?: () => void;
  onCreateProject?: (input: { name: string; subtitle?: string; domain: DomainType }) => void;
  onResetProjectStructure?: () => void;
  onExportFullBackup: () => void;
  onImportFullBackup: (snapshot: AppStateSnapshot) => void;
  onUploadProjectLogo?: (projectId: string, file: File) => void;
  onResetProjectLogo?: (projectId: string) => void;
  thumbHubEnabled?: boolean;
  thumbHubPosition?: 'left' | 'center' | 'right';
  remindersEnabled?: boolean;
  onToggleRemindersEnabled?: (enabled: boolean) => void;
  onToggleThumbHub?: (enabled: boolean) => void;
  onChangeThumbHubPosition?: (pos: 'left' | 'center' | 'right') => void;
  ambientLightMode?: AmbientLightMode;
  onChangeAmbientLightMode?: (mode: AmbientLightMode) => void;
  fullState?: AppStateSnapshot;
  onReplaceFullStateFromCloud?: (snapshot: AppStateSnapshot) => void;
  aiVoiceSettings?: AiVoiceSettings;
  onUpdateAiVoiceSettings?: (patch: Partial<AiVoiceSettings>) => void;
  prefs?: BanditUserPreferences;
  onUpdatePrefs?: (patch: Partial<BanditUserPreferences>) => void;
  onNotify: (msg: string) => void;
}

/**
 * Schlanke Orchestrator-Shell der BANDIT.OS Zentrale (5 standardmäßig zugeklappte Bereiche).
 */
export const BackofficeWorkspace: React.FC<BackofficeWorkspaceProps> = ({
  projects,
  selfChecks,
  eventSalesLogs,
  userApiKey,
  realityCheckEnabled,
  haWebhookUrl,
  haEmbedUrl,
  initialSection,
  onCloseBackoffice,
  onToggleArchiveProject,
  onUpdateProject,
  onAssignDayBlock,
  onAutoStructureDay,
  onTogglePluginForProject,
  onToggleTabForProject,
  onSaveScratchpadToProject,
  onApplyBlueprint,
  onChangeApiKey,
  onToggleRealityCheck,
  onChangeHaWebhook,
  onChangeHaEmbed,
  onOpenFlip7Cover,
  onOpenRealityModal,
  onOpenSelfCheckModal,
  onCreateProject,
  onResetProjectStructure,
  onImportFullBackup,
  onUploadProjectLogo,
  onResetProjectLogo,
  thumbHubEnabled = true,
  thumbHubPosition = 'center',
  remindersEnabled = true,
  onToggleRemindersEnabled,
  onToggleThumbHub,
  onChangeThumbHubPosition,
  ambientLightMode: ambientLightModeProp = 'shimmer',
  onChangeAmbientLightMode,
  fullState,
  onReplaceFullStateFromCloud,
  aiVoiceSettings,
  onUpdateAiVoiceSettings,
  prefs: prefsProp,
  onUpdatePrefs: onUpdatePrefsProp,
  onNotify
}) => {
  const [openSection, setOpenSection] = useState<ZentraleSectionId | null>(
    initialSection || null
  );
  const [localPrefs, setLocalPrefs] = useState<BanditUserPreferences>(loadUserPrefs);
  const prefs = prefsProp || localPrefs;
  const [ambientLightMode, setAmbientLightMode] = useState<AmbientLightMode>(
    () => ambientLightModeProp || loadAmbientLightMode()
  );

  useEffect(() => {
    setOpenSection(initialSection || null);
  }, [initialSection]);

  const toggleSection = (id: ZentraleSectionId) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  const updatePrefs = (patch: Partial<BanditUserPreferences>) => {
    if (onUpdatePrefsProp) {
      onUpdatePrefsProp(patch);
      return;
    }
    const next = { ...prefs, ...patch };
    setLocalPrefs(next);
    void saveUserPrefs(next);
  };

  const handleAmbientModeChange = (mode: AmbientLightMode) => {
    setAmbientLightMode(mode);
    saveAmbientLightMode(mode);
    onChangeAmbientLightMode?.(mode);
    onNotify(
      `Hintergrundbeleuchtung: ${mode === 'off' ? 'Aus' : mode === 'static' ? 'Statisch' : 'Sanftes Schimmern'
      }`
    );
  };

  return (
    <div className="max-w-lg mx-auto space-y-3.5 pb-24">
      {/* ════════ KOPFZEILE: ZENTRALE ════════ */}
      <div
        className="p-4 rounded-3xl border border-white/5 flex items-center justify-between gap-3 shadow-lg"
        style={{ backgroundColor: '#191C22' }}
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
            BANDIT.OS Zentrale
          </h2>
          <p className="text-xs text-[#94A3B8]">
            Projekte, Fokus, KI, Automation &amp; System
          </p>
        </div>
        <button
          type="button"
          onClick={onCloseBackoffice}
          className="min-h-[44px] px-4 py-2 rounded-2xl text-xs font-bold text-white flex items-center gap-2 active:scale-95 transition shadow-sm shrink-0 cursor-pointer"
          style={{ backgroundColor: THEME.accentPrimary }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Zurück</span>
        </button>
      </div>

      {/* 1. Projekte & Werkzeuge */}
      <ProjectsSection
        isOpen={openSection === 'projects'}
        onToggle={() => toggleSection('projects')}
        projects={projects}
        onToggleArchiveProject={onToggleArchiveProject}
        onUpdateProject={onUpdateProject}
        onTogglePluginForProject={onTogglePluginForProject}
        onToggleTabForProject={onToggleTabForProject}
        onUploadProjectLogo={onUploadProjectLogo}
        onResetProjectLogo={onResetProjectLogo}
        onCreateProject={onCreateProject}
        onResetProjectStructure={onResetProjectStructure}
        onNotify={onNotify}
      />

      {/* 2. Fokus, Bedienung & Smartphone */}
      <FocusAndSmartphoneSection
        isOpen={openSection === 'focus'}
        onToggle={() => toggleSection('focus')}
        projects={projects}
        selfChecks={selfChecks}
        prefs={prefs}
        onUpdatePrefs={updatePrefs}
        ambientLightMode={ambientLightMode}
        onChangeAmbientLightMode={handleAmbientModeChange}
        thumbHubEnabled={thumbHubEnabled}
        thumbHubPosition={thumbHubPosition}
        onToggleThumbHub={onToggleThumbHub}
        onChangeThumbHubPosition={onChangeThumbHubPosition}
        realityCheckEnabled={realityCheckEnabled}
        onToggleRealityCheck={onToggleRealityCheck}
        onAssignDayBlock={onAssignDayBlock}
        onAutoStructureDay={onAutoStructureDay}
        onOpenFlip7Cover={onOpenFlip7Cover}
        onOpenRealityModal={onOpenRealityModal}
        onOpenSelfCheckModal={onOpenSelfCheckModal}
      />

      {/* 3. KI & Stimme „Gisela“ */}
      <AiAndVoiceSection
        isOpen={openSection === 'ai'}
        onToggle={() => toggleSection('ai')}
        userApiKey={userApiKey}
        onChangeApiKey={onChangeApiKey}
        aiVoiceSettings={aiVoiceSettings}
        onUpdateAiVoiceSettings={onUpdateAiVoiceSettings}
        prefs={prefs}
        onUpdatePrefs={updatePrefs}
        onNotify={onNotify}
      />

      {/* 4. Erinnerungen, Vorarbeiter & Smart Home */}
      <AutomationSection
        isOpen={openSection === 'automation'}
        onToggle={() => toggleSection('automation')}
        remindersEnabled={remindersEnabled}
        onToggleRemindersEnabled={onToggleRemindersEnabled}
        prefs={prefs}
        onUpdatePrefs={updatePrefs}
        haWebhookUrl={haWebhookUrl}
        haEmbedUrl={haEmbedUrl}
        onChangeHaWebhook={onChangeHaWebhook}
        onChangeHaEmbed={onChangeHaEmbed}
        onNotify={onNotify}
      />

      {/* 5. Daten, Backup & System */}
      <SystemAndBackupSection
        isOpen={openSection === 'system'}
        onToggle={() => toggleSection('system')}
        projects={projects}
        eventSalesLogs={eventSalesLogs}
        fullState={fullState}
        onUpdateProject={onUpdateProject}
        onSaveScratchpadToProject={onSaveScratchpadToProject}
        onApplyBlueprint={onApplyBlueprint}
        onImportFullBackup={onImportFullBackup}
        onReplaceFullStateFromCloud={onReplaceFullStateFromCloud}
        onNotify={onNotify}
      />

      {/* Fußzeile mit Build-Stempel & Neu laden */}
      <ZentraleFooter />
    </div>
  );
};
