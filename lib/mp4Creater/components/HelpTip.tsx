'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface HelpTipProps {
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}

const HelpTip: React.FC<HelpTipProps> = ({ title, children, compact = false }) => {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 320;
      const left = Math.min(window.innerWidth - width - 16, Math.max(16, rect.right - width));
      setPosition({ top: rect.bottom + 10, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm transition-colors hover:border-blue-400 hover:text-blue-600 ${compact ? 'h-6 w-6 text-[11px]' : 'h-7 w-7 text-xs'}`}
        aria-label={`${title} 도움말`}
        title={`${title} 도움말`}
      >
        ?
      </button>

      {mounted && open && createPortal(
        <>
          <button
            type="button"
            aria-label="도움말 닫기"
            className="fixed inset-0 z-[110] cursor-default bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-[111] w-80 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xl"
            style={{ top: position.top, left: position.left }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-900">{title}</div>
                <div className="mt-2 text-xs leading-5 text-slate-600">{children}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                닫기
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default HelpTip;
