import React from 'react';

interface HeaderProps {
  projectCount?: number;
  selectedCharacterName?: string;
  storageDir?: string;
  onOpenSettings?: () => void;
  onGoGallery?: () => void;
  viewMode?: 'main' | 'gallery';
  basePath?: string;
  currentSection?: 'main' | 'gallery' | 'characters' | 'scene';
  progressPercent?: number;
  progressText?: string;
}

function NavAction({
  active,
  children,
  onClick,
  href,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const className = `rounded-xl px-4 py-2 text-sm font-bold transition-colors ${active ? 'bg-blue-600 text-white shadow-sm shadow-blue-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {children}
      </button>
    );
  }

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

const Header: React.FC<HeaderProps> = ({
  projectCount = 0,
  selectedCharacterName,
  storageDir,
  onOpenSettings,
  onGoGallery,
  viewMode = 'main',
  basePath = '/mp4Creater',
  currentSection,
}) => {
  const activeSection = currentSection || viewMode;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1520px] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-100">
              <svg suppressHydrationWarning className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path suppressHydrationWarning strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path suppressHydrationWarning strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <div className="min-w-0">
              <div className="text-xl font-black text-slate-900 sm:text-2xl">
                mp4Creater <span className="text-blue-600">스튜디오</span>
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">
                {selectedCharacterName ? `캐릭터: ${selectedCharacterName}` : '캐릭터 미선택'}
                {storageDir ? ` · 저장 위치: ${storageDir}` : ' · 저장 위치 미설정'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NavAction active={activeSection === 'gallery'} onClick={onGoGallery} href={`${basePath}?view=gallery`}>
              프로젝트 {projectCount > 0 ? `(${projectCount})` : ''}
            </NavAction>
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
            >
              설정
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
