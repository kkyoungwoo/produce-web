import { StudioPageSkeleton } from '@/lib/mp4Creater/components/LoadingOverlay';

export default function Loading() {
  return <StudioPageSkeleton title="워크플로우 화면을 여는 중" description="최근 저장 상태와 Step 진행도를 먼저 붙이고 있습니다." progressPercent={22} progressLabel="워크플로우 준비 중" />;
}
