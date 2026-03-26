# STEP3

목표: 대본이 바로 씬으로 분해되고 입모양 싱크까지 이어질 수 있는 문단형 원본이 되게 유지합니다.

## 먼저 읽을 파일
- `lib/mp4Creater/services/workflowPromptBuilder.ts`
- `lib/mp4Creater/components/InputSection.tsx`
- `lib/mp4Creater/services/workflowStepContractService.ts`

## 이번 유지 포인트
- 문단은 개별 씬으로 잘릴 수 있어야 하지만 앞뒤 감정선이 이어져야 합니다.
- 발화 문장은 실제 영상 입모양과 맞출 수 있는 길이와 호흡으로 유지합니다.
- Step3 프롬프트를 바꾸면 Step4 캐릭터 추출, Step6 이미지/영상, 썸네일에도 같은 축이 이어지는지 봅니다.
