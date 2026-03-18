# mp4Creater 개발 메모

이번 수정은 **mp4Creater가 실제로 끊기지 않고 흐름대로 동작하는 것**을 우선으로 정리했습니다.

## 이번 수정 핵심

### 1) 무한 렌더 오류 수정
파일: `lib/mp4Creater/components/InputSection.tsx`

- `syncedPromptTemplates`를 `setPromptTemplates()`로 계속 되밀던 구조 때문에 `Maximum update depth exceeded`가 발생했습니다.
- `arePromptTemplatesEqual()` 비교 함수를 추가해서 실제 내용이 달라질 때만 상태를 갱신하도록 수정했습니다.
- 이 부분이 이번 오류의 직접 원인입니다.

### 2) 헤더 프로젝트 이동 1회 클릭 정상화
파일: `lib/mp4Creater/App.tsx`

- 기존에는 내부 상태 전환과 `?new=1` 상태가 섞이면서 첫 클릭이 씹히는 경우가 있었습니다.
- 헤더의 `제작`, `프로젝트` 버튼은 URL 기반으로 바로 이동하게 정리했습니다.
- `제작`은 항상 신규 프로젝트, `프로젝트`는 항상 프로젝트 목록으로 이동합니다.

### 3) 프롬프트 수정 가능하게 구조 보강
파일:
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/services/workflowPromptBuilder.ts`
- `lib/mp4Creater/types.ts`

- 기존 built-in 프롬프트는 화면상 수정 버튼이 있어도 다시 동기화되면서 원래 값으로 덮여 수정이 안 됐습니다.
- `WorkflowPromptTemplate`에 `basePrompt`, `isCustomized` 필드를 추가했습니다.
- built-in 프롬프트도 한 번 수정되면 사용자 커스텀 상태로 유지되도록 바꿨습니다.
- `자세히보기 -> 수정` 흐름으로 같은 패널에서 편집 가능합니다.

### 4) 대본 생성 전 모델 선택 가능
파일: `lib/mp4Creater/components/InputSection.tsx`

- Step 3 상단에 `텍스트 모델`, `이미지 모델` 선택 카드 추가
- API 연결 여부에 따라:
  - 연결됨: 실제 생성 가능 안내
  - 미연결: 샘플/폴백 안내
- 사용자가 대본 생성 전에 모델을 먼저 고를 수 있습니다.

### 5) 캐릭터 / 화풍 UI 축소
파일: `lib/mp4Creater/components/InputSection.tsx`

- 기존 큼직한 상세 카드에서, 카드뉴스처럼 빠르게 고를 수 있는 작은 카드형으로 재구성했습니다.
- 캐릭터 박스, 화풍 박스를 각각 세로 섹션으로 분리 유지
- 한눈에 선택 / 대기 상태가 보이도록 배지 추가
- 초보자는 바로 선택만 하고,
- 고급 사용자는 `고급` 버튼을 눌러 프롬프트와 세부 카드를 수정하게 했습니다.

### 6) 추천은 1개씩 추가
파일:
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/services/characterStudioService.ts`

- 캐릭터 / 화풍 추천은 한 번에 여러 개가 아니라 **1개씩** 추가되도록 바꿨습니다.
- `추천 +1` 또는 `추천 1개 추가` 버튼으로 계속 누적 추가됩니다.
- 배경음은 원래도 1트랙씩 추가 구조였고, 그대로 유지했습니다.

### 7) 설정 패널 단순화
파일: `lib/mp4Creater/components/SettingsDrawer.tsx`

요청 반영:
- 제거
  - 캐릭터 관리
  - 기본 에이전트
  - 커스텀 공급자 슬롯
- 유지
  - 저장 폴더
  - API 키 관리
  - 작업별 모델 선택
- 프로젝트/제작 중 빠른 등록으로 넣은 API 키는 설정에서도 보이고,
- 삭제는 설정에서 가능하게 정리했습니다.

### 8) 모델 사용 가능 여부 안내
파일:
- `lib/mp4Creater/components/SettingsDrawer.tsx`
- `lib/mp4Creater/components/InputSection.tsx`

- OpenRouter 없으면 텍스트 계열은 샘플 생성으로 동작
- ElevenLabs 없으면 오디오는 실제 TTS 불가 안내
- FAL 없으면 영상 변환 불가 안내
- 사용자에게 "왜 안 되는지"를 화면에서 바로 알 수 있게 했습니다.

## 주요 수정 지점 빠른 지도

### `InputSection.tsx`
중요 포인트:
- 프롬프트 동기화 무한 루프 방지
- Step 3 모델 선택 카드 추가
- 프롬프트 상세 수정 가능 구조
- Step 4 카드형 선택 UI 축소
- 추천 1개씩 추가

### `SettingsDrawer.tsx`
중요 포인트:
- 설정 패널을 실제 필요한 항목만 남기도록 전면 단순화
- API 키 삭제 가능
- 모델별 연결 상태 안내

### `workflowPromptBuilder.ts`
중요 포인트:
- built-in 프롬프트 수정 유지
- 커스텀 여부 관리

## 검수 포인트

1. 제작 화면 진입 시 콘솔에 `Maximum update depth exceeded`가 더 이상 없어야 함
2. 헤더 `프로젝트` 버튼이 한 번 클릭으로 이동해야 함
3. 프롬프트 `수정` 클릭 후 상세 영역에서 실제 수정 가능해야 함
4. Step 3에서 텍스트 / 이미지 모델을 먼저 선택할 수 있어야 함
5. Step 4 카드가 이전보다 작고 빠르게 선택 가능해야 함
6. 추천 버튼은 한 번 누를 때 1개씩만 추가되어야 함
7. 설정에서 API 키를 지울 수 있어야 함

## 주의

- 이 수정은 **프로세스 끊김 방지와 UI 흐름 안정화**에 우선순위를 두었습니다.
- 외부 실제 모델 호출은 사용자의 API 연결 상태에 따라 달라집니다.
- API가 없어도 샘플/폴백으로 전체 흐름 검수가 가능하도록 유지했습니다.
