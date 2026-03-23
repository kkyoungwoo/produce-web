import { StudioPageSkeleton } from '@/lib/mp4Creater/components/LoadingOverlay';

export default function Loading() { return <StudioPageSkeleton title="씬 제작 페이지를 여는 중" description="프로젝트 카드와 결과 미리보기 도구를 먼저 정리하고 있습니다." progressPercent={18} progressLabel="씬 카드 준비 중" />; }
