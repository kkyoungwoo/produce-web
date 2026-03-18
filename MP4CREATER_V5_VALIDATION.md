# MP4CREATER v5 Validation

## 이번 버전 목표
- 프로젝트를 **프로젝트별 폴더 구조**로 저장
- 프로젝트 번호를 UI와 폴더명에 동일하게 반영
- 저장 폴더 미설정 시 사용자에게 폴더 선택 유도
- 기존 Step / Scene Studio 흐름과 AI 버튼 기반 생성 동작 유지

## 구현 요약
- `app/api/local-storage/_shared.ts`
  - v5 저장 구조 추가
  - `projects/project-0001-.../` 폴더 자동 생성
  - 프로젝트별 `project.json`, `metadata`, `prompts`, `images`, `videos`, `audio`, `thumbnails`, `characters`, `styles` 저장
  - 저장 시 프로젝트 번호 자동 부여
  - 폴더 스캔 기반 프로젝트 복원 지원
- `lib/mp4Creater/services/localFileApi.ts`
  - `isStorageConfigured` 상태 반영
  - 저장 폴더 미설정 상태 캐시 처리 보강
- `lib/mp4Creater/services/projectService.ts`
  - 서버가 배정한 프로젝트 번호 / 폴더명까지 다시 IndexedDB에 동기화
- `lib/mp4Creater/App.tsx`
  - 저장 폴더 미설정 시 시작/저장/Scene Studio 이동 흐름 가드 추가
  - 상단 안내 배너 추가
- `lib/mp4Creater/components/ProjectGallery.tsx`
  - 프로젝트 번호 / 폴더명 노출
- `lib/mp4Creater/pages/SceneStudioPage.tsx`
  - 프로젝트 번호 / 폴더명 배지 노출
- 문서 / 규칙 갱신
  - `MP4CREATER_PROJECT_STORAGE_RULES.md`
  - `.ai/rules/*.md`
  - 샘플 README들

## 실행 검증
### 1) TS / TSX 구문 검사
실행 방식:
- TypeScript `transpileModule` 기반 전체 mp4Creater 관련 TS/TSX 파일 검사

결과:
- 검사 파일 수: 48
- 결과: 통과

### 2) 샘플 자산 manifest / layout 검사
실행 명령:
```bash
node scripts/generate-mp4-sample-manifest.mjs
node scripts/check-mp4-sample-layout.mjs
```

결과:
- manifest 생성 통과
- layout check 통과

### 3) 프로젝트 폴더 저장 시뮬레이션
실행 방식:
- `_shared.ts`의 `writeState`, `ensureState`를 임시 디렉터리에서 호출
- 샘플 프로젝트 1개 저장 후 재로드 확인

확인 결과:
- `project-0001-테스트-프로젝트` 폴더 생성 확인
- `project.json` 생성 확인
- `images/scene-001-main.png` 생성 확인
- 폴더 스캔 후 프로젝트 재로드 확인

## 확인한 동작 포인트
- 저장 폴더가 없을 때 시작 화면에서 폴더 선택 유도
- 메인 화면에서 저장 폴더 미설정 경고 배너 표시
- Step 4 이후 Scene Studio 이동 전에 저장 폴더 검사
- 프로젝트 보관함에서 번호 / 폴더명 표시
- Scene Studio 상단에서 현재 프로젝트 번호 / 폴더명 표시
- 프로젝트 데이터가 프로젝트별 폴더 단위로 저장되도록 구조 반영

## 남은 리스크
- 원본 업로드에 `package.json`이 없어서 이 환경에서 `npm run build` 전체 런타임 빌드는 수행하지 못함
- 따라서 실제 런타임에서 연결된 외부 AI API 호출까지 포함한 통합 테스트는 여기서 직접 실행하지 못함
- 다만 저장 구조, TS/TSX 구문, 샘플 자산 스크립트, 프로젝트 폴더 생성 시뮬레이션은 확인 완료
