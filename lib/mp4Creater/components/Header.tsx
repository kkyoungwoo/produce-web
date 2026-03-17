import React from 'react';

interface HeaderProps {
  projectCount?: number;
  selectedCharacterName?: string;
  storageDir?: string;
  onOpenSettings?: () => void;
  onGoMain?: () => void;
  onGoGallery?: () => void;
  viewMode?: 'main' | 'gallery';
}

const Header: React.FC<HeaderProps> = ({
  projectCount = 0,
  selectedCharacterName,
  storageDir,
  onOpenSettings,
  onGoMain,
  onGoGallery,
  viewMode = 'main',
}) => {
  return (
    <header
      suppressHydrationWarning
      className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <div>
              <div className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                TubeGen <span className="text-brand-500">Studio</span>
              </div>
              <div className="text-xs text-slate-500">
                {selectedCharacterName ? `캐릭터: ${selectedCharacterName}` : '캐릭터 미선택'}
                {storageDir ? ` · 저장경로: ${storageDir}` : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onGoMain}
              className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${viewMode === 'main' ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              생성
            </button>
            <button
              onClick={onGoGallery}
              className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${viewMode === 'gallery' ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              프로젝트 {projectCount > 0 ? `(${projectCount})` : ''}
            </button>
            <button
              onClick={onOpenSettings}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-950 text-sm font-black hover:bg-white transition-colors"
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
