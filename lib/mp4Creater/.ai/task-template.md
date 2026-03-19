# task-template.md

## 작업명

## 목표

## 현재 증상

## 기대 동작

## 반드시 읽을 파일
- 루트 `AGENTS.md`
- `lib/mp4Creater/AGENTS.md`
- `lib/mp4Creater/.ai/rules/edit-rules.md`
- `lib/mp4Creater/.ai/rules/testing-rules.md`
- 관련 서비스/컴포넌트

## 수정 대상 파일

## 수정 금지 파일/영역

## 영향 범위 체크
- 상태 저장
- API 연동
- prompt workflow
- sample fallback
- project autosave
- step 라우팅(`projectId` 유지)
- `step-6` 이동/복귀
- `?view=main` 리다이렉트 영향

## 검증 명령
- `npm run lint`
- `npm run build`

## 수동 검증 시나리오
1. 제작하기 → 프로젝트 1개 생성 → `/step-1?projectId=...` 진입
2. step 이동/새로고침 후 데이터 유지 및 마지막 단계 복원
3. Step5 완료 후 `step-6` 진입 및 씬 제작 흐름 확인

## 결과 보고에 포함할 것
- 수정 파일
- 핵심 변경
- 테스트 결과
- 수동 확인 결과
- 남은 리스크
- PR 설명 초안
