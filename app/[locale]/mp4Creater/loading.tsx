import { StudioPageSkeleton } from '@/lib/mp4Creater/components/LoadingOverlay';

export default function Loading() {
  return (
    <StudioPageSkeleton
      title="프로젝트 화면을 여는 중"
      description="첫 진입이나 새 프로젝트 생성 직후에도 빈 화면 대신 바로 작업 준비 상태를 보여줍니다."
      progressPercent={16}
      progressLabel="mp4Creater 초기 화면 준비 중"
    />
  );
}
