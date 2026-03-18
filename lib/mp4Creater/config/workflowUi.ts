import { AspectRatio } from '../types';

export const MAX_UPLOAD_FILE_COUNT = 4;
export const MAX_UPLOAD_FILE_SIZE_MB = 8;
export const MAX_CHARACTER_VARIANT_COUNT = 6;
export const MAX_STYLE_CARD_COUNT = 12;
export const HORIZONTAL_SCROLL_AMOUNT = 360;

export const ASPECT_RATIO_OPTIONS: Array<{ id: AspectRatio; title: string; caption: string; previewClass: string }> = [
  { id: '16:9', title: '16:9', caption: '가로형 영상', previewClass: 'aspect-[16/9] w-full max-w-[170px]' },
  { id: '1:1', title: '1:1', caption: '정사각형', previewClass: 'aspect-square w-full max-w-[132px]' },
  { id: '9:16', title: '9:16', caption: '세로형 숏폼', previewClass: 'aspect-[9/16] w-full max-w-[106px]' },
];

export function getAspectRatioPreviewClass(ratio?: AspectRatio | null, compact = false) {
  if (ratio === '1:1') return compact ? 'aspect-square w-full max-w-[150px]' : 'aspect-square w-full';
  if (ratio === '9:16') return compact ? 'aspect-[9/16] w-full max-w-[120px]' : 'aspect-[9/16] w-full';
  return compact ? 'aspect-[16/9] w-full max-w-[220px]' : 'aspect-[16/9] w-full';
}
