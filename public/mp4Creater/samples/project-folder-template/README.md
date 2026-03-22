# Project Folder Template

이 문서는 **예전 폴더형 예시가 남아 있던 자리**를 현재 기준으로 정리한 메모입니다.
현재 런타임의 실제 저장 구조는 이 템플릿을 사용하지 않습니다.

## 현재 실제 저장 구조

```text
<storageDir>/
  studio-state.json
  projects/
    <projectId>.json
```

- `studio-state.json` : 전역 설정, workflow draft, project index summary
- `projects/<projectId>.json` : 프로젝트 전체 상세 상태

## 주의
- 예전 `project-0001-your-project/project.json/metadata/prompts/...` 폴더형 구조를 현재 코드 기준으로 가정하지 않습니다.
- 이 문서는 레거시 혼동을 막기 위한 안내용이며, 실제 저장 규칙은 `MP4CREATER_PROJECT_STORAGE_RULES.md`를 따릅니다.
