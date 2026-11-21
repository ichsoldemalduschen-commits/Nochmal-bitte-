import React from 'react';
import {
  Image as ImageIcon,
  LayoutGrid,
  Menu,
  Search,
  X
} from 'lucide-react';
import { Project } from '../../types';
import { ProjectAvatar } from '../../components/RaccoonAvatar';

export interface ThemeColors {
  primary: string;
  highlight: string;
  label: string;
}

interface FrontHeaderProps {
  activeProject: Project;
  themeColors: ThemeColors;
  viewAllSections: boolean;
  showSearch: boolean;
  searchQuery: string;
  onToggleViewAll: () => void;
  onToggleSearch: () => void;
  onSetSearchQuery: (q: string) => void;
  onOpenDrawer: () => void;
  onUploadProjectLogo: (projectId: string, file: File) => void;
}

export const FrontHeader: React.FC<FrontHeaderProps> = ({
  activeProject,
  themeColors,
  viewAllSections,
  showSearch,
  searchQuery,
  onToggleViewAll,
  onToggleSearch,
  onSetSearchQuery,
  onOpenDrawer,
  onUploadProjectLogo
}) => {
  return (
    <>
      {/* RUHIGE PROJEKT-KOPFZEILE */}
      <div
        className="p-4 rounded-3xl border flex items-center justify-between gap-3 shadow-lg transition-colors duration-500"
        style={{
          backgroundColor: '#1C2026',
          borderColor: `${themeColors.primary}55`
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenDrawer}
            className="w-11 h-11 rounded-2xl text-white shrink-0 flex items-center justify-center active:scale-95 transition shadow-sm"
            style={{ backgroundColor: themeColors.primary }}
            aria-label="Navigation öffnen"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="relative shrink-0">
            <ProjectAvatar project={activeProject} sizeClass="w-9 h-9" />
            <label
              title="Projekt-Logo ändern"
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full text-white flex items-center justify-center cursor-pointer border border-[#1C2026] shadow-sm"
              style={{ backgroundColor: themeColors.primary }}
            >
              <ImageIcon className="w-2.5 h-2.5" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadProjectLogo(activeProject.id, f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          <div className="min-w-0 cursor-pointer" onClick={onOpenDrawer}>
            <h1 className="text-lg font-extrabold text-white truncate leading-tight">
              {activeProject.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleViewAll}
            className="min-h-[44px] px-3.5 rounded-xl text-xs font-bold border border-white/5 text-white transition active:scale-95 shadow-sm"
            style={{
              backgroundColor: viewAllSections ? themeColors.primary : '#242930'
            }}
          >
            {viewAllSections ? 'Gesamt' : 'Einzeln'}
          </button>

          <button
            type="button"
            onClick={onToggleSearch}
            className="w-11 h-11 rounded-xl bg-[#242930] text-[#9CA3AF] hover:text-white border border-white/5 flex items-center justify-center active:scale-95 transition"
            aria-label="Suche umschalten"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SUCHE */}
      {showSearch && (
        <div className="px-4 py-3 rounded-2xl border border-white/10 bg-[#1C2026] flex items-center gap-2.5 shadow-md">
          <Search className="w-4 h-4 text-[#9CA3AF] shrink-0" />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => onSetSearchQuery(e.target.value)}
            placeholder={`In ${activeProject.name} filtern...`}
            className="flex-1 bg-transparent text-sm text-white focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSetSearchQuery('')}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#9CA3AF] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </>
  );
};
