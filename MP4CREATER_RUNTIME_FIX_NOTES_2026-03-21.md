# MP4CREATER runtime fix notes (2026-03-21)

수정 파일
- `lib/mp4Creater/App.tsx`
- `lib/mp4Creater/components/ProjectGallery.tsx`

핵심 수정
- `App.tsx`
  - 부트스트랩 `useEffect` 1회 실행 보장
  - `ensureRuntimeStorageReady` 의존성 루프 제거
  - 새 프로젝트 생성 시 불필요한 검증 조회/강제 동기화 제거
  - 프로젝트 로드 직후 불필요한 자동저장 방지
  - 기존 프로젝트 로드 시 즉시 다시 저장하던 타이머 제거
  - 프로젝트 목록 갱신 시 stale closure 대신 ref 사용
- `ProjectGallery.tsx`
  - 선택 상태 정리 effect가 동일 값이면 state 재설정하지 않도록 수정
  - 체크박스/복사/제작하기/이름 버튼 클릭 충돌 방지
  - 선택 클릭 안정성 보강

검증
- 수정된 두 파일은 TypeScript transpile parse 기준 문법 오류 없음 확인
- 전체 Next.js build는 업로드된 프로젝트에 의존성 파일(`package.json`)이 없어 컨테이너에서 실행하지 못함
