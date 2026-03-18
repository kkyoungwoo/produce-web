# MP4CREATER Project Storage Rules (v5)

## 핵심 원칙
- 프로젝트는 **프로젝트별 폴더**로 저장한다.
- 각 프로젝트 폴더는 **고유 번호**를 가진다.
- UI에 보이는 프로젝트 번호와 실제 폴더 번호는 동일해야 한다.
- 프로젝트 데이터는 한 파일에 몰아넣지 않고, 프로젝트 폴더 안에 역할별 하위 폴더로 정리한다.

## 저장 루트
사용자가 선택한 `storageDir` 아래에 저장한다.

예시:
```text
<storageDir>/
  studio-state.json
  projects/
    project-0001-my-first-project/
    project-0002-news-briefing/
```

## 프로젝트 폴더 규칙
폴더명 패턴:
```text
project-<4자리번호>-<slug>
```

예시:
```text
project-0001-my-first-project
project-0002-뉴스-브리핑
```

## 프로젝트 폴더 내부 구조
```text
project-0001-my-first-project/
  project.json
  metadata/
  prompts/
  images/
  videos/
  audio/
  thumbnails/
  characters/
  styles/
```

### 파일 역할
- `project.json`
  - 프로젝트 전체 상태
  - UI 복원용 데이터
  - 프로젝트 번호 / 폴더명 / draft / assets / thumbnail 정보 포함
- `metadata/`
  - 씬별 JSON
  - workflow draft JSON
  - summary JSON
- `prompts/`
  - topic
  - story / scene / action / character / thumbnail prompt
  - 씬별 narration / visual prompt
- `images/`
  - 씬 이미지
  - 씬 이미지 history
- `videos/`
  - 씬 영상
  - 씬 영상 history
- `audio/`
  - 씬 TTS
  - 배경음
- `thumbnails/`
  - 대표 썸네일
  - 썸네일 history
- `characters/`
  - 캐릭터 대표 이미지
  - 캐릭터 variant 이미지
- `styles/`
  - 스타일 이미지

## 저장 폴더 미설정 처리
- 저장 폴더가 비어 있거나 아직 확정되지 않았으면 프로젝트 저장을 진행하지 않는다.
- 사용자에게 **저장 폴더를 먼저 선택하라**는 안내를 보여준다.
- Scene Studio 이동 전에도 동일하게 검사한다.

## 불러오기 규칙
- 앱은 `studio-state.json`과 `projects/*/project.json`을 기준으로 프로젝트 목록을 복원한다.
- 프로젝트 폴더가 존재하면 폴더 쪽 데이터를 우선해서 읽는다.

## 샘플 자산과 실제 프로젝트 분리
- 공개 샘플: `public/mp4Creater/samples/`
- 로컬 검수 샘플: `local-data/tubegen-studio/sample-library/`
- 실제 사용자 결과물: `<storageDir>/projects/`

이 셋은 서로 섞지 않는다.
