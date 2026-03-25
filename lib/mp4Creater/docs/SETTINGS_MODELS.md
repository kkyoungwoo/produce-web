# SETTINGS / MODELS

목표: 설정에서 고른 모델이 실제 라우팅에 반영되고, 오래된 값이나 잘못된 값은 안전한 기본값으로 정리되게 유지합니다.

## 먼저 읽을 파일
- `lib/mp4Creater/components/SettingsDrawer.tsx`
- `lib/mp4Creater/services/localFileApi.ts`
- `lib/mp4Creater/config.ts`

## 안전 수정 포인트
- 저장 시 routing 값이 실제 지원 모델 목록으로 정규화되는지 확인합니다.
- 키가 없을 때는 샘플 provider로 부드럽게 내려오게 유지합니다.
- text/image/video/tts 모델은 각각 다른 fallback 규칙을 갖도록 두는 편이 안정적입니다.
- 설정 항목이 추가되면 이 문서와 실제 저장 로직을 함께 갱신합니다.
