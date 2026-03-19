import { AspectRatio } from '../types';

export const ASPECT_RATIO_OPTIONS: Array<{
  id: AspectRatio;
  title: string;
  description: string;
}> = [
  { id: '16:9', title: '16:9', description: '가로형 영상 / 유튜브 기본' },
  { id: '1:1', title: '1:1', description: '정사각형 카드 / 썸네일형' },
  { id: '9:16', title: '9:16', description: '세로형 숏폼 / 릴스형' },
];

export function getAspectRatioClass(aspectRatio: AspectRatio = '16:9') {
  if (aspectRatio === '1:1') return 'aspect-square';
  if (aspectRatio === '9:16') return 'aspect-[9/16]';
  return 'aspect-[16/9]';
}

export function getAspectRatioLabel(aspectRatio: AspectRatio = '16:9') {
  return ASPECT_RATIO_OPTIONS.find((item) => item.id === aspectRatio)?.title || aspectRatio;
}

export function getAspectRatioDescription(aspectRatio: AspectRatio = '16:9') {
  return ASPECT_RATIO_OPTIONS.find((item) => item.id === aspectRatio)?.description || '';
}

export function getAspectRatioPrompt(aspectRatio: AspectRatio = '16:9') {
  if (aspectRatio === '1:1') return '1:1 square composition';
  if (aspectRatio === '9:16') return '9:16 vertical composition';
  return '16:9 wide composition';
}

export function getAspectRatioDimensions(aspectRatio: AspectRatio = '16:9') {
  if (aspectRatio === '1:1') return { width: 1080, height: 1080 };
  if (aspectRatio === '9:16') return { width: 1080, height: 1920 };
  return { width: 1280, height: 720 };
}
