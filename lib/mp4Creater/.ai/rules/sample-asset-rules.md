# sample-asset-rules.md

## 샘플 자산을 분리하는 이유
`mp4Creater`에서는 샘플이 세 종류로 섞이기 쉽습니다.

1. UI에서 보여주는 고정 공개 샘플
2. 개발자가 테스트용으로 넣는 로컬 샘플
3. 실제 사용자가 저장한 프로젝트 결과물

이 셋을 분리해야 에이전트와 개발자가 덜 헷갈립니다.

## 경로 규칙

### 공개 샘플
경로: `public/mp4Creater/samples/`

용도:
- 배포에 들어가도 되는 샘플
- 기본 카드/미리보기/문서용 샘플
- 상대 경로로 직접 참조 가능한 자산

하위 폴더:
- `characters/`
- `styles/`
- `images/`
- `videos/`
- `audio/`
- `thumbnails/`

### 로컬 개발 샘플
경로: `local-data/tubegen-studio/sample-library/`

용도:
- 검수용
- 실험용
- 공개 배포에 올리지 않을 샘플

하위 폴더:
- `characters/`
- `styles/`
- `images/`
- `videos/`
- `audio/`

### 실제 저장 결과물
경로: 사용자가 고른 `storageDir`

원칙:
- 샘플 라이브러리로 되돌려 섞지 않는다
- 운영/사용자 결과물은 참조용 샘플과 분리한다
- 실제 프로젝트는 `projects/project-0001-프로젝트명/` 형태의 번호 폴더로 저장한다
- 한 프로젝트의 이미지, 영상, 오디오, 프롬프트, 워크플로우 draft, 썸네일은 모두 같은 프로젝트 폴더 안에 저장한다

## 파일 이름 규칙
가능하면 아래 패턴을 따른다.

- 캐릭터: `char-<slug>-<variant>.png`
- 스타일: `style-<slug>-<variant>.png`
- 이미지: `scene-<slug>-<variant>.jpg`
- 영상: `scene-<slug>-<variant>.mp4`
- 오디오: `bgm-<slug>-<variant>.mp3`
- 썸네일: `thumb-<slug>-<variant>.jpg`

예시:
- `char-anchor-v1.png`
- `style-news-clean-v2.png`
- `scene-cafe-night-v1.jpg`
- `scene-cafe-night-v1.mp4`

## 추가/삭제 절차
1. 올바른 폴더에 파일을 넣거나 제거
2. `node scripts/generate-mp4-sample-manifest.mjs`
3. `node scripts/check-mp4-sample-layout.mjs`
4. 경로/manifest/중복 여부 확인

## 금지
- `public` 샘플과 `local-data` 샘플을 같은 의미로 사용하지 않는다
- 실제 저장 결과물을 `public/mp4Creater/samples`에 넣지 않는다
- 확장자와 폴더 성격이 맞지 않는 파일을 섞지 않는다

## 실제 프로젝트 저장 구조 예시

```
storageDir/
  studio-state.json
  projects/
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
