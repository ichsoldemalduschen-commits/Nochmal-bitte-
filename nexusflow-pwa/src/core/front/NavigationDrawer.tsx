import React from 'react';
import {
  ChevronRight,
  FolderPlus,
  LayoutGrid,
  Puzzle,
  Scale,
  Settings,
  ShoppingCart,
  X
} from 'lucide-react';
import { DomainType, Project, ProjectTabId } from '../../types';
import { BRAND_CONFIG } from '../../config/brandConfig';
import { ProjectAvatar } from '../../components/RaccoonAvatar';
import { ThemeColors } from './FrontHeader';

interface NavigationDrawerProps {
  drawerOpen: boolean;
  drawerDragX: number;
  themeColors: ThemeColors;
  workProjects: Project[];
  privateProjects: Project[];
  activeProject?: Project;
  viewAllSections: boolean;
  activeTab: ProjectTabId;
  onSelectProjectAndSection: (proj: Project, tab: ProjectTabId | 'ALL') => void;
  onClose: () => void;
  onOpenNewProjectModal: () => void;
  onOpenDeepResearchModal?: () => void;
  onOpenAddonsBackoffice: () => void;
  isTabEnabled: (proj: Project | undefined, tab: 'tasks' | 'cart' | 'knowledge' | 'extras') => boolean;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  drawerOpen,
  drawerDragX,
  themeColors,
  workProjects,
  privateProjects,
  activeProject,
  viewAllSections,
  activeTab,
  onSelectProjectAndSection,
  onClose,
  onOpenNewProjectModal,
  onOpenDeepResearchModal,
  onOpenAddonsBackoffice,
  isTabEnabled
}) => {
  const renderProjectList = (projects: Project[], domainColorKey: 'arbeit' | 'privat') => {
    return projects.map((proj) => {
      const isActive = activeProject?.id === proj.id;
      const pColor =
        (proj.customMeta?.customAccentColor as string) ||
        proj.accentColor ||
        BRAND_CONFIG.projects[proj.id]?.accentColor ||
        BRAND_CONFIG.domainColors[domainColorKey].primary;
      return (
        <div
          key={proj.id}
          className="rounded-2xl border overflow-hidden transition-all shadow-sm"
          style={{
            backgroundColor: '#191C22',
            borderColor: isActive ? `${pColor}88` : 'rgba(255,255,255,0.04)'
          }}
        >
          <button
            type="button"
            onClick={() => onSelectProjectAndSection(proj, 'ALL')}
            className="w-full min-h-[50px] p-3.5 flex items-center justify-between text-left active:bg-white/5 transition"
            style={isActive ? { backgroundColor: `${pColor}22` } : {}}
          >
            <div className="flex items-center gap-3 min-w-0">
              <ProjectAvatar project={proj} sizeClass="w-7 h-7" />
              <span className="text-sm font-bold text-white truncate">
                {proj.name}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF] shrink-0" />
          </button>

          {isActive && (
            <div className="p-2.5 pt-1.5 grid grid-cols-2 gap-2 border-t border-white/5 bg-[#111317]/80">
              <button
                type="button"
                onClick={() => onSelectProjectAndSection(proj, 'ALL')}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-left flex items-center justify-between ${
                  viewAllSections
                    ? 'text-white'
                    : 'bg-[#242930] text-[#9CA3AF] hover:text-white'
                }`}
                style={viewAllSections ? { backgroundColor: pColor } : {}}
              >
                <span>Gesamt</span>
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              {isTabEnabled(proj, 'tasks') && (
                <button
                  type="button"
                  onClick={() => onSelectProjectAndSection(proj, 'tasks')}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-left flex items-center justify-between ${
                    !viewAllSections && activeTab === 'tasks'
                      ? 'text-white'
                      : 'bg-[#242930] text-[#9CA3AF] hover:text-white'
                  }`}
                  style={
                    !viewAllSections && activeTab === 'tasks'
                      ? { backgroundColor: pColor }
                      : {}
                  }
                >
                  <span>Tasks</span>
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-black/30">
                    {proj.tasks.filter((t) => !t.completed).length}
                  </span>
                </button>
              )}
              {isTabEnabled(proj, 'knowledge') && (
                <button
                  type="button"
                  onClick={() => onSelectProjectAndSection(proj, 'knowledge')}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-left flex items-center justify-between ${
                    !viewAllSections &&
                    (activeTab === 'knowledge' ||
                      activeTab === 'explanations' ||
                      activeTab === 'infos')
                      ? 'text-white'
                      : 'bg-[#242930] text-[#9CA3AF] hover:text-white'
                  }`}
                  style={
                    !viewAllSections &&
                    (activeTab === 'knowledge' ||
                      activeTab === 'explanations' ||
                      activeTab === 'infos')
                      ? { backgroundColor: pColor }
                      : {}
                  }
                >
                  <span>Wissen</span>
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-black/30">
                    {(proj.knowledge || []).length}
                  </span>
                </button>
              )}
              {isTabEnabled(proj, 'extras') && (
                <button
                  type="button"
                  onClick={() => onSelectProjectAndSection(proj, 'extras')}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
                    !viewAllSections && activeTab === 'extras'
                      ? 'text-white'
                      : 'bg-[#242930] text-[#9CA3AF] hover:text-white'
                  }`}
                  style={
                    !viewAllSections && activeTab === 'extras'
                      ? { backgroundColor: pColor }
                      : {}
                  }
                >
                  <span>Werkzeuge</span>
                  <Puzzle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  const totalOpenCartCount = [...workProjects, ...privateProjects]
    .flatMap((p) => p.cart || [])
    .filter((c) => !c.completed).length;

  return (
    <div
      className={`fixed inset-0 z-[55] flex transition-opacity duration-300 ${
        drawerOpen ? 'opacity-100 pointer-events-auto' : drawerDragX > 0 ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      style={drawerDragX > 0 ? { opacity: drawerDragX / (window.innerWidth * 0.85) } : undefined}
    >
      <div
        className={`w-[85vw] max-w-sm h-full border-r border-white/10 flex flex-col justify-between overflow-y-auto shadow-2xl ${
          drawerDragX === 0 ? 'transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''
        }`}
        style={{
          backgroundColor: '#111317',
          transform: drawerOpen
            ? drawerDragX < 0
              ? `translateX(${drawerDragX}px)`
              : 'translateX(0)'
            : drawerDragX > 0
            ? `translateX(calc(-100% + ${drawerDragX}px))`
            : 'translateX(-100%)'
        }}
      >
        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <div className="text-sm font-extrabold uppercase tracking-wider text-white">
                BANDIT.OS Navigation
              </div>
              <div className="text-xs text-[#9CA3AF]">
                Projekt &amp; Arbeitsbereich wählen
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 rounded-2xl text-[#9CA3AF] hover:text-white bg-[#242930] flex items-center justify-center border border-white/5 active:scale-95 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ZENTRALER GLOBALER EINKAUFSWAGEN */}
          <button
            type="button"
            onClick={() => {
              const target = activeProject || workProjects[0] || privateProjects[0];
              if (target) {
                onSelectProjectAndSection(target, 'cart');
              }
              onClose();
            }}
            className={`w-full min-h-[48px] p-3.5 rounded-2xl border flex items-center justify-between transition-all shadow-sm active:scale-95 cursor-pointer ${
              !viewAllSections && activeTab === 'cart'
                ? 'bg-[#0D9488]/20 border-[#0D9488] text-white'
                : 'bg-[#191C22] hover:bg-[#22262F] text-white border-white/5'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/20 border border-[#14B8A6]/40 flex items-center justify-center text-[#14B8A6] shrink-0">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-sm font-bold text-white leading-tight">
                  Zentraler Einkaufswagen
                </div>
                <div className="text-xs text-[#9CA3AF] truncate">
                  Projektübergreifender Materialpool
                </div>
              </div>
            </div>
            <span className="font-mono text-xs px-2 py-1 rounded-lg bg-black/40 text-[#14B8A6] font-bold shrink-0 ml-2">
              {totalOpenCartCount} offen
            </span>
          </button>

          {/* ARBEIT */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] px-1">
              ARBEIT
            </div>
            {renderProjectList(workProjects, 'arbeit')}
          </div>

          {/* PRIVAT */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] px-1">
              PRIVAT
            </div>
            {renderProjectList(privateProjects, 'privat')}
          </div>
        </div>

        <div className="p-5 border-t border-white/10 space-y-2.5 bg-[#181A1E]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNewProjectModal();
            }}
            className="w-full min-h-[48px] py-2.5 px-4 rounded-2xl text-xs font-semibold bg-[#242930] text-white border border-white/10 flex items-center gap-2.5 hover:bg-[#2A3038] active:scale-95 transition"
          >
            <FolderPlus className="w-4 h-4 text-[#14B8A6]" />
            <span>Neues Projekt anlegen</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenDeepResearchModal?.();
            }}
            className="w-full min-h-[48px] py-2.5 px-4 rounded-2xl text-xs font-semibold bg-[#242930] text-white border border-white/10 flex items-center gap-2.5 hover:bg-[#2A3038] active:scale-95 transition"
          >
            <Scale className="w-4 h-4 text-[#14B8A6]" />
            <span>Deep Research, Scanner &amp; Cloud</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAddonsBackoffice();
            }}
            className="w-full min-h-[48px] py-2.5 px-4 rounded-2xl text-xs font-bold text-white flex items-center gap-2.5 shadow-lg active:scale-95 transition"
            style={{ backgroundColor: themeColors.primary }}
          >
            <Settings className="w-4 h-4" />
            <span>Einstellungen, ADHS &amp; System</span>
          </button>
        </div>
      </div>

      <div
        className="flex-1 bg-black/60 backdrop-blur-xs"
        onClick={onClose}
      />
    </div>
  );
};
