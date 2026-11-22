import React from 'react';
import {
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
  viewAllSections?: boolean;
  showSearch?: boolean;
  searchQuery?: string;
  onToggleViewAll?: () => void;
  onToggleSearch?: () => void;
  onSetSearchQuery?: (q: string) => void;
  onOpenDrawer: () => void;
  onUploadProjectLogo?: (projectId: string, file: File) => void;
}

export const FrontHeader: React.FC<FrontHeaderProps> = ({
  activeProject,
  themeColors,
  viewAllSections: _viewAllSections,
  showSearch = false,
  searchQuery = '',
  onToggleViewAll: _onToggleViewAll,
  onToggleSearch: _onToggleSearch,
  onSetSearchQuery,
  onOpenDrawer,
  onUploadProjectLogo: _onUploadProjectLogo
}) => {
  return (
    <>
      {/* RUHIGE PROJEKT-KOPFZEILE */}
      <div
        className="p-4 rounded-3xl border flex items-center justify-between gap-3 shadow-lg transition-colors duration-500"
        style={{
          backgroundColor: '#191C22',
          borderColor: 'rgba(255,255,255,0.04)'
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpenDrawer}
            className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-2xl text-white shrink-0 flex items-center justify-center active:scale-95 transition shadow-sm cursor-pointer"
            style={{ backgroundColor: themeColors.primary }}
            aria-label="Navigation öffnen"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="shrink-0 cursor-pointer" onClick={onOpenDrawer}>
            <ProjectAvatar project={activeProject} sizeClass="w-9 h-9" />
          </div>

          <div className="min-w-0 flex-1 cursor-pointer" onClick={onOpenDrawer}>
            <h1 className="text-base sm:text-lg font-bold text-[#F1F5F9] leading-snug break-words">
              {activeProject.name}
            </h1>
          </div>
        </div>
      </div>

      {/* SUCHE (falls aktiv) */}
      {showSearch && onSetSearchQuery && (
        <div className="px-4 py-3 rounded-2xl border border-white/5 bg-[#191C22] flex items-center gap-2.5 shadow-md">
          <Search className="w-4 h-4 text-[#94A3B8] shrink-0" />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => onSetSearchQuery(e.target.value)}
            placeholder={`In ${activeProject.name} filtern...`}
            className="flex-1 bg-transparent text-sm text-[#F1F5F9] placeholder-[#94A3B8] focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSetSearchQuery('')}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#94A3B8] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </>
  );
};
