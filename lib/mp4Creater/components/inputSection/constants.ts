import { ContentType, StorySelectionState } from '../../types';
import { StepId } from './types';

export const CONTENT_TYPE_CARDS: Array<{ id: ContentType; title: string; desc: string; badge: string }> = [
  { id: 'music_video', title: '뮤직비디오', desc: '음악 중심 장면 구성', badge: 'MV' },
  { id: 'story', title: '이야기', desc: '서사 중심 스토리 구성', badge: 'STORY' },
  { id: 'news', title: '뉴스', desc: '브리핑 중심 정보 전달', badge: 'NEWS' },
  { id: 'info_delivery', title: '정보 전달', desc: '설명형 콘텐츠 전달', badge: 'INFO' },
];

export const FIELD_OPTIONS_BY_TYPE: Record<ContentType, Record<keyof StorySelectionState, string[]>> = {
  music_video: {
    genre: ['감성 발라드', '로맨틱', '몽환', '시네마틱'],
    mood: ['몽환적', '서정적', '강렬함', '여운형'],
    endingTone: ['여운 있는 결말', '서정적인 결말', '열린 결말', '반전 결말'],
    setting: ['도시 야경', '비 내리는 거리', '해변', '무대'],
    protagonist: ['신인 가수', '추억을 떠올리는 주인공', '청춘 커플', '솔로 아티스트'],
    conflict: ['멀어진 연인', '꿈과 현실의 간격', '미완의 약속', '반복되는 후회'],
  },
  story: {
    genre: ['드라마', '스릴러', '로맨틱', '코미디', '미스터리', 'SF'],
    mood: ['차분함', '몰입감', '긴장감', '감성적'],
    endingTone: ['해피엔딩', '열린 결말', '반전 결말', '교훈형 결말'],
    setting: ['골목길', '학교', '오피스', '카페', '야외'],
    protagonist: ['신입 직장인', '학생', '기획자', '관찰자'],
    conflict: ['선택의 딜레마', '세대 갈등', '시간 부족', '비밀 노출'],
  },
  news: {
    genre: ['뉴스 브리핑', '해설 리포트', '요약 전달', '현장 리포트'],
    mood: ['정확함', '차분함', '명확함', '신속함'],
    endingTone: ['핵심 요약', '다음 이슈 안내', '중립적 마무리'],
    setting: ['스튜디오', '현장 배경', '데이터 보드', '회의실'],
    protagonist: ['앵커', '기자', '해설자', '진행자'],
    conflict: ['상반된 해석', '정보 경쟁', '검증 이슈', '정책결정 지연'],
  },
  info_delivery: {
    genre: ['정보 전달', '가이드 설명', '핵심 요약', '스텝별 설명'],
    mood: ['정돈된', '명확한', '구조적인', '친절한'],
    endingTone: ['요약 정리', '실행 체크리스트', '다음 단계 안내'],
    setting: ['설명형 보드', '인포그래픽 화면', '비주얼 가이드'],
    protagonist: ['설명자', '안내 진행자', '정보 전달자', '가이드 호스트'],
    conflict: ['복잡도 축약', '오해 방지', '핵심 우선순위', '시간 내 명료 전달'],
  },
};

export const STEP_META: Array<{ id: StepId; title: string; subtitle: string }> = [
  { id: 1, title: '콘셉트 선택', subtitle: '유형과 화면비율 선택' },
  { id: 2, title: '스토리 입력', subtitle: '주제와 방향 정리' },
  { id: 3, title: '대본 구성', subtitle: '프롬프트와 대본 확정' },
  { id: 4, title: '캐릭터 연출', subtitle: '출연과 장면 구성' },
  { id: 5, title: '화풍 선택', subtitle: '스타일 확정 후 이동' },
];

export const MAX_UPLOAD_FILE_COUNT = 4;
export const MAX_UPLOAD_FILE_SIZE_MB = 8;
export const MAX_CHARACTER_VARIANT_COUNT = 6;
export const MAX_STYLE_CARD_COUNT = 12;

export function normalizeStage(value?: number | null): StepId {
  if (value === 2 || value === 3 || value === 4 || value === 5) return value;
  return 1;
}
