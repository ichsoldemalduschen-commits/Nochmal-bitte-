import React, { useState } from 'react';
import { Bell, Cloud, Receipt, Scale, X } from 'lucide-react';
import { AppStateSnapshot, KnowledgeKind, PriorityType, Project } from '../types';
import { DESIGN_TOKENS } from '../config/designTokens';
import { DeepResearchView } from '../core/front/DeepResearchView';
import { ReceiptScanView } from '../core/front/ReceiptScanView';
import { ThemeColors } from '../core/front/FrontHeader';
import { ZentraleSectionId } from '../core/BackofficeWorkspace';
import { CloudSyncPanel } from '../core/backoffice/CloudSyncPanel';
import { requestPushNotificationPermission } from '../services/cloudSyncAndPush';

interface DeepResearchAndAuditModalProps {
  open: boolean;
  projects: Project[];
  activeProject?: Project;
  userApiKey: string;
  fullState: AppStateSnapshot;
  themeColors?: ThemeColors;
  onClose: () => void;
  onSaveDossierToProject: (
    projectId: string,
    title: string,
    markdownContent: string,
    followUpTasks: string[]
  ) => void;
  onReconcileReceiptWithCart: (
    projectId: string,
    storeName: string,
    purchaseDate: string,
    totalAmount: string,
    items: Array<{ title: string; quantity: string; price: string }>
  ) => void;
  onAddTask?: (projectId: string, title: string, priority?: PriorityType, estimatedMinutes?: number) => void;
  onAddKnowledge?: (projectId: string, kind: KnowledgeKind, title: string, content: string) => void;
  onOpenSettings?: (section?: ZentraleSectionId) => void;
  onReplaceFullStateFromCloud: (newState: AppStateSnapshot) => void;
  onNotify: (msg: string) => void;
}

export const DeepResearchAndAuditModal: React.FC<DeepResearchAndAuditModalProps> = ({
  open,
  projects,
  activeProject,
  userApiKey,
  fullState,
  themeColors = {
    primary: DESIGN_TOKENS.projectPresets.pizzaBandit,
    highlight: '#14B8A6',
    label: 'ARBEIT'
  },
  onClose,
  onSaveDossierToProject,
  onReconcileReceiptWithCart,
  onAddTask,
  onAddKnowledge,
  onOpenSettings,
  onReplaceFullStateFromCloud,
  onNotify
}) => {
  const [activeSection, setActiveSection] = useState<'research' | 'receipt' | 'cloud_push'>('research');
  const [pushGranted, setPushGranted] = useState<boolean>(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );

  if (!open) return null;

  const resolvedProject = activeProject || projects.find((p) => !p.archived) || projects[0];
  const tabs = [
    { id: 'research' as const, label: 'Deep Research', icon: Scale },
    { id: 'receipt' as const, label: 'Beleg-Scanner', icon: Receipt },
    { id: 'cloud_push' as const, label: 'Cloud & Push', icon: Cloud }
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Deep Research, Beleg-Scanner & Cloud"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
        style={{ backgroundColor: DESIGN_TOKENS.canvas }}
      >
        <div
          className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between gap-2"
          style={{ backgroundColor: DESIGN_TOKENS.surface }}
        >
          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#F1F5F9] truncate">
              BANDIT.OS Deep Research, Scanner &amp; Cloud
            </div>
            <div className="text-xs text-[#94A3B8] truncate">
              Rechts-Dossiers, Kassenbon-Scanner &amp; Echtzeit-Sync
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] w-11 h-11 flex items-center justify-center rounded-xl bg-[#111317] text-[#94A3B8] hover:text-white shrink-0 active:scale-95 transition cursor-pointer"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 p-1.5 border-b border-white/10 gap-1 bg-[#111317]">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={`min-h-[44px] min-w-0 py-2 px-1 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeSection === id ? 'text-white' : 'text-[#94A3B8] hover:text-white'
              }`}
              style={activeSection === id ? { backgroundColor: themeColors.primary } : {}}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
          {activeSection === 'research' && resolvedProject && (
            <DeepResearchView
              activeProject={resolvedProject}
              allProjects={projects}
              themeColors={themeColors}
              userApiKey={userApiKey}
              onSaveDossierToProject={onSaveDossierToProject}
              onAddTask={onAddTask || (() => {})}
              onAddKnowledge={onAddKnowledge}
              onOpenSettings={(sec) => {
                onClose();
                onOpenSettings?.(sec);
              }}
              onNotify={onNotify}
            />
          )}

          {activeSection === 'receipt' && resolvedProject && (
            <ReceiptScanView
              activeProject={resolvedProject}
              allProjects={projects}
              themeColors={themeColors}
              userApiKey={userApiKey}
              onReconcileReceiptWithCart={onReconcileReceiptWithCart}
              onOpenSettings={(sec) => {
                onClose();
                onOpenSettings?.(sec);
              }}
              onNotify={onNotify}
            />
          )}

          {activeSection === 'cloud_push' && (
            <div className="space-y-3">
              <CloudSyncPanel
                fullState={fullState}
                onReplaceFullStateFromCloud={onReplaceFullStateFromCloud}
                onNotify={onNotify}
                accentColor={themeColors.primary}
              />

              <div className="p-3.5 rounded-2xl border border-white/10 flex items-center justify-between gap-2 bg-[#191C22]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Bell className="w-4 h-4 text-[#14B8A6] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#F1F5F9]">
                      Native Smartphone Push-Erinnerungen
                    </div>
                    <div className="text-xs text-[#94A3B8]">
                      Meldet fällige Aufgaben-Zeiten direkt auf dem Sperrbildschirm
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await requestPushNotificationPermission();
                    setPushGranted(ok);
                    onNotify(
                      ok
                        ? 'Push-Benachrichtigungen sind aktiviert!'
                        : 'Bitte Benachrichtigungen in den Browser-Einstellungen erlauben.'
                    );
                  }}
                  className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: pushGranted ? themeColors.primary : '#374151' }}
                >
                  {pushGranted ? 'Aktiv' : 'Freigeben'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
