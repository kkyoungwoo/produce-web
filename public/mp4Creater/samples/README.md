# MP4Creater Public Samples

이 폴더는 **배포해도 되는 공개 샘플 자산**만 넣는 자리입니다.

## 폴더 구조
- `characters/` : 캐릭터 카드/대표 이미지
- `styles/` : 화풍/스타일 카드 이미지
- `images/` : 장면 이미지 샘플
- `videos/` : 장면 영상 샘플
- `audio/` : 배경음/오디오 샘플
- `thumbnails/` : 썸네일 샘플

## 빠른 추가 / 제거 규칙
1. 맞는 하위 폴더에 파일을 넣거나 삭제합니다.
2. 파일명은 가능하면 아래 규칙을 따릅니다.
3. `node scripts/generate-mp4-sample-manifest.mjs`
4. `node scripts/check-mp4-sample-layout.mjs`

## 네이밍 규칙
- 캐릭터: `char-<slug>-<variant>.png|svg`
- 스타일: `style-<slug>-<variant>.png|svg`
- 이미지: `scene-<slug>-<variant>.jpg|png`
- 영상: `scene-<slug>-<variant>.mp4`
- 오디오: `bgm-<slug>-<variant>.mp3`
- 썸네일: `thumb-<slug>-<variant>.jpg|png`

## 공개 샘플과 로컬 샘플의 차이
- 공개 샘플: `public/mp4Creater/samples/`
- 로컬 개발 전용 샘플: `local-data/tubegen-studio/sample-library/`
- 실제 사용자 결과물: 사용자가 고른 `storageDir` 아래 `studio-state.json` + `projects/<projectId>.json`

셋은 서로 섞지 않습니다.

## manifest
- 수동 예시: `manifest.template.json`
- 자동 생성: `manifest.generated.json`

## 포함된 기본 예시
- 캐릭터: `characters/char-heroine-v1.svg`, `characters/char-host-v1.svg`
- 화풍: `styles/style-animation-pop-v1.svg`, `styles/style-beauty-soft-v1.svg`, `styles/style-cinematic-night-v1.svg`, `styles/style-news-clean-v1.svg`

## 실제 프로젝트 저장 구조 참고
```text
<storageDir>/
  studio-state.json
  projects/
    <projectId>.json
```

> 예전 프로젝트 폴더 템플릿 설명은 더 이상 현재 런타임 저장 구조 기준이 아닙니다.
