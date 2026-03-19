# Workflow Agent Prompts

이 폴더는 단계별 전문 에이전트 프롬프트를 분리 관리합니다.

- `step1-intake.md`: 콘텐츠 타입/주제/비율 확정
- `step2-script.md`: 대본 구조화 및 문단 씬 기준 정리
- `step3-cast.md`: 출연자 카드 구성/선택
- `step4-style.md`: 화풍 샘플 기반 선택
- `step5-handoff.md`: 프로젝트 저장 및 씬 제작 진입
- `final-scene-production.md`: 씬 생성부터 최종 영상 제작

최신 라우팅 기준:
- Step5 handoff 이후 최종 제작 화면은 `step-6`으로 진입합니다.
- `scene-studio` 경로는 레거시 호환용 redirect입니다.

운영 규칙
1. 한 파일은 한 단계 책임만 갖습니다.
2. 단계 간 공통 정책은 상위 `AGENTS.md` 또는 `stepAgentRegistry.ts`에서 관리합니다.
3. 토큰 절약 정책(짧은 컨텍스트, 제한된 출력)은 모든 프롬프트에 공통 반영합니다.
4. 한국어 문구는 짧고 버튼 중심으로 유지합니다.
