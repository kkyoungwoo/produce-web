# mp4Creater 메인 가이드

이 문서는 mp4Creater를 수정할 때 가장 먼저 읽는 안내서입니다.

## 기본 원칙
- 수정은 항상 **최신 반영본** 기준으로 이어서 진행합니다.
- 기능을 추가하거나 흐름을 바꾸면 **해당 md와 실제 파일을 함께 수정**해야 합니다.
- 저장, 불러오기, export, import, Step 간 전달은 한 세트로 보고 확인합니다.
- 후보 데이터는 보존하고, 실제 생성에는 선택한 데이터만 반영하는 원칙을 유지합니다.
- mp4Creater 외 경로는 꼭 필요한 경우가 아니면 건드리지 않습니다.

## 먼저 읽을 문서
- `lib/mp4Creater/docs/PROMPT_MANAGEMENT.md`
- `lib/mp4Creater/docs/SETTINGS_MODELS.md`
- `lib/mp4Creater/docs/step-guides/README.md`

## 작업 순서 추천
1. 메인 가이드 확인
2. 관련 Step md 확인
3. 실제 컴포넌트, 서비스, 저장 경로 수정
4. 수정한 내용과 연결된 md도 함께 갱신
5. 저장/복원/선택 반영까지 점검

## 꼭 같이 확인할 파일
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/App.tsx`
- `lib/mp4Creater/services/projectService.ts`
- `app/api/local-storage/_shared.ts`

이 문서는 짧고 명확하게 유지합니다. 새 기능이 붙으면 관련 Step 문서와 함께 바로 갱신해 주세요.
