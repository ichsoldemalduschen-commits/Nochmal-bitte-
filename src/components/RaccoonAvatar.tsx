import React from 'react';
import {
  Briefcase,
  Croissant,
  FolderKanban,
  Hammer,
  Home,
  Repeat,
  ShoppingCart,
  Sun,
  Utensils,
  Wifi
} from 'lucide-react';
import { Project } from '../types';

export const PizzaBanditRaccoonSvg: React.FC<{ className?: string }> = ({
  className = 'w-8 h-8'
}) => (
  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="60" cy="60" r="56" fill="#1E2327" stroke="#0A9396" strokeWidth="4" />
    <circle
      cx="60"
      cy="60"
      r="50"
      fill="#24292E"
      stroke="#14B8A6"
      strokeWidth="1.2"
      strokeDasharray="4 3"
    />
    <path
      d="M24 44 L18 18 L44 28 Z"
      fill="#6B7280"
      stroke="#181A1B"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path d="M26 39 L22 23 L39 30 Z" fill="#D1D5DB" />
    <path
      d="M96 44 L102 18 L76 28 Z"
      fill="#6B7280"
      stroke="#181A1B"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path d="M94 39 L98 23 L81 30 Z" fill="#D1D5DB" />
    <path
      d="M26 76 Q60 112 94 76 L86 104 L60 114 L34 104 Z"
      fill="#DC2626"
      stroke="#181A1B"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <polygon points="55,92 65,92 60,103" fill="#FBBF24" />
    <circle cx="60" cy="95" r="1.6" fill="#991B1B" />
    <circle cx="44" cy="91" r="2" fill="#FCA5A5" />
    <circle cx="76" cy="91" r="2" fill="#FCA5A5" />
    <path
      d="M22 58 C22 34 38 24 60 24 C82 24 98 34 98 58 C98 76 82 88 60 88 C38 88 22 76 22 58 Z"
      fill="#9CA3AF"
      stroke="#181A1B"
      strokeWidth="3.2"
    />
    <path
      d="M26 64 C28 52 44 52 60 52 C76 52 92 52 94 64 C90 80 76 86 60 86 C44 86 30 80 26 64 Z"
      fill="#E5E7EB"
    />
    <path
      d="M21 52 C28 41 44 42 60 45 C76 42 92 41 99 52 C97 64 82 67 70 63 C64 61 56 61 50 63 C38 67 23 64 21 52 Z"
      fill="#111315"
      stroke="#0A9396"
      strokeWidth="1.5"
    />
    <ellipse cx="42" cy="53" rx="6.5" ry="5.5" fill="#F8F9FA" />
    <ellipse cx="43" cy="53" rx="3.2" ry="3.2" fill="#181A1B" />
    <circle cx="41.5" cy="51.5" r="1.3" fill="#14B8A6" />
    <ellipse cx="78" cy="53" rx="6.5" ry="5.5" fill="#F8F9FA" />
    <ellipse cx="77" cy="53" rx="3.2" ry="3.2" fill="#181A1B" />
    <circle cx="75.5" cy="51.5" r="1.3" fill="#14B8A6" />
    <ellipse cx="60" cy="69" rx="13" ry="10" fill="#F9FAFB" stroke="#374151" strokeWidth="1.5" />
    <ellipse cx="60" cy="66" rx="6" ry="4.2" fill="#181A1B" />
    <path
      d="M60 70 L60 75 M54 75 Q60 79 66 75"
      stroke="#181A1B"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Croissant,
  Utensils,
  Wifi,
  Repeat,
  Sun,
  Hammer,
  ShoppingCart,
  FolderKanban,
  Briefcase,
  Home
};

export const ProjectAvatar: React.FC<{ project?: Project; sizeClass?: string }> = ({
  project,
  sizeClass = 'w-8 h-8'
}) => {
  if (project?.customLogoUrl) {
    return (
      <img
        src={project.customLogoUrl}
        alt={project.name}
        className={`${sizeClass} rounded-lg object-cover border border-[#14B8A6]`}
      />
    );
  }
  if (project?.icon === 'RaccoonBandit') {
    return <PizzaBanditRaccoonSvg className={sizeClass} />;
  }
  const IconComp = (project && ICON_MAP[project.icon]) || FolderKanban;
  return (
    <div
      className={`${sizeClass} rounded-lg bg-[#2F363D] border border-white/10 flex items-center justify-center text-[#14B8A6]`}
    >
      <IconComp className="w-4 h-4" />
    </div>
  );
};