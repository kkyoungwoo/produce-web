
'use client';

import dynamic from 'next/dynamic';
import { StudioPageSkeleton } from '@/lib/mp4Creater/components/LoadingOverlay';

const Step6Page = dynamic(() => import('@/lib/mp4Creater/components/inputSection/steps/Step6Page'), {
  ssr: false,
  loading: () => <StudioPageSkeleton title="씬 제작 페이지를 여는 중" description="프로젝트 데이터를 먼저 붙이고 씬 작업판을 빠르게 여는 중입니다." progressPercent={24} progressLabel="step6 작업판 준비 중" />,
});

export default function Mp4CreaterStep6Page() {
  return <Step6Page />;
}
