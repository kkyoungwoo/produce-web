# MP4Creater Local Sample Library

이 폴더는 **개발/검수 전용 로컬 샘플** 자리입니다.
공개 배포용 샘플은 `public/mp4Creater/samples/`에 두고,
실제 생성 결과물은 사용자의 `storageDir`에 저장합니다.

## 하위 폴더
- `characters/`
- `styles/`
- `images/`
- `videos/`
- `audio/`

## 사용 절차
1. 해당 폴더에 파일 추가 또는 삭제
2. 필요하면 공개 샘플 쪽도 같이 정리
3. `node scripts/check-mp4-sample-layout.mjs` 실행

## 실제 프로젝트 결과물과의 구분
실제 제작 결과물은 이 폴더가 아니라 사용자가 지정한 아래 구조에 저장됩니다.

```text
<storageDir>/
  studio-state.json
  projects/
    <projectId>.json
```

예전 `projects/project-0001-.../` 폴더형 저장 설명은 현재 런타임 기준이 아닙니다.
