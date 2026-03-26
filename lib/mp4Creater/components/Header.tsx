'use client';

import Link from 'next/link';
import React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

interface HeaderProps {
  projectCount?: number;
  selectedCharacterName?: string;
  storageDir?: string;
  liveApiCostTotal?: number | null;
  onOpenSettings?: () => void;
  onGoGallery?: () => void;
  viewMode?: 'main' | 'gallery';
  basePath?: string;
  currentSection?: 'main' | 'gallery' | 'characters' | 'scene';
  progressPercent?: number;
  progressText?: string;
}

function formatApiCost(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  if (value === 0) return '$0.00';
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
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
  const className = `${
    active ? '' : 'mp4-glass-pill '
  }inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-black transition-all duration-200 ${
    active
      ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-100'
      : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
  }`;

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={className} style={active ? { color: '#ffffff' } : undefined}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} style={active ? { color: '#ffffff' } : undefined}>
      {children}
    </button>
  );
}

const Header: React.FC<HeaderProps> = ({
  projectCount = 0,
  liveApiCostTotal,
  onOpenSettings,
  onGoGallery,
  viewMode = 'main',
  basePath = '/mp4Creater',
  currentSection,
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const normalizedBasePath =
    basePath.length > 1 && basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

  const currentView = searchParams.get('view');
  const formattedLiveApiCost = formatApiCost(liveApiCostTotal);

  // URL이 gallery면 props보다 우선해서 무조건 gallery 활성화
  const isGalleryByUrl =
    pathname === normalizedBasePath && currentView === 'gallery';

  // URL 우선 -> 그다음 currentSection -> 마지막 viewMode
  const isGalleryActive = isGalleryByUrl
    ? true
    : currentSection
      ? currentSection === 'gallery'
      : viewMode === 'gallery';

  return (
    <header className="sticky top-0 z-50 border-b border-white/40 bg-white/45 backdrop-blur-xl">
      <div className="mp4-glass-panel mx-auto flex max-w-[1520px] flex-col gap-3 rounded-b-[28px] px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link
            href={`${basePath}?view=gallery`}
            onClick={onGoGallery}
            className="flex min-w-0 items-center gap-3 rounded-3xl px-1 py-1 transition-all duration-300 hover:bg-white/35"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-sky-400 to-indigo-500 text-sm font-black text-white shadow-lg shadow-blue-100">
              MP4
            </div>

            <div className="min-w-0">
              <div className="text-xl font-black text-slate-900 sm:text-2xl">
                mp4Creater <span className="text-blue-600">스튜디오</span>
              </div>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <NavAction
              active={isGalleryActive}
              onClick={onGoGallery}
              href={`${basePath}?view=gallery`}
            >
              프로젝트 {projectCount > 0 ? `(${projectCount})` : ''}
            </NavAction>

            {formattedLiveApiCost ? (
              <div className="mp4-glass-pill inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                <span>실시간 API 예상요금</span>
                <span className="text-sm text-emerald-900">{formattedLiveApiCost}</span>
              </div>
            ) : null}

            <button
              type="button"
              onClick={onOpenSettings}
              className="mp4-glass-pill rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-900 shadow-sm transition-colors hover:bg-white"
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
