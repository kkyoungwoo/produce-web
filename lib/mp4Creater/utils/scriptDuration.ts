import { ContentType } from '../types';

const SHORT_FORM_DURATION_PRESETS = [15 / 60, 30 / 60, 45 / 60] as const;
const LONG_FORM_DURATION_PRESETS = [1, 3, 5, 10, 15, 20, 30] as const;

export const SCRIPT_DURATION_PRESETS = [
  ...SHORT_FORM_DURATION_PRESETS,
  ...LONG_FORM_DURATION_PRESETS,
] as const;

const DEFAULT_EXPECTED_DURATION_MINUTES = 30 / 60;
const MIN_EXPECTED_DURATION_MINUTES = SHORT_FORM_DURATION_PRESETS[0];
const MAX_EXPECTED_DURATION_MINUTES = LONG_FORM_DURATION_PRESETS[LONG_FORM_DURATION_PRESETS.length - 1];

function getNearestShortFormDuration(value: number) {
  return SHORT_FORM_DURATION_PRESETS.reduce((closest, candidate) => {
    return Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest;
  }, SHORT_FORM_DURATION_PRESETS[0]);
}

export function normalizeExpectedDurationMinutes(value?: number | null) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_EXPECTED_DURATION_MINUTES;

  if (numericValue < 1) {
    const clamped = Math.max(MIN_EXPECTED_DURATION_MINUTES, Math.min(1, numericValue));
    return getNearestShortFormDuration(clamped);
  }

  return Math.max(1, Math.min(MAX_EXPECTED_DURATION_MINUTES, Math.round(numericValue)));
}

export function getExpectedDurationSeconds(value?: number | null) {
  return Math.max(15, Math.round(normalizeExpectedDurationMinutes(value) * 60));
}

export function formatExpectedDurationLabel(value?: number | null) {
  const totalSeconds = getExpectedDurationSeconds(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (!minutes) return `${seconds}초`;
  if (!seconds) return `${minutes}분`;
  return `${minutes}분 ${seconds}초`;
}

export function formatExpectedDurationEnglish(value?: number | null) {
  const totalSeconds = getExpectedDurationSeconds(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (!minutes) {
    return `${seconds} second${seconds === 1 ? '' : 's'}`;
  }

  if (!seconds) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  return `${minutes} minute${minutes === 1 ? '' : 's'} ${seconds} second${seconds === 1 ? '' : 's'}`;
}

export function getRecommendedParagraphCount(contentType: ContentType, expectedDurationMinutes?: number | null) {
  const safeMinutes = normalizeExpectedDurationMinutes(expectedDurationMinutes);
  const totalSeconds = Math.round(safeMinutes * 60);

  if (totalSeconds < 60) {
    const secondsPerParagraph = contentType === 'music_video'
      ? 8
      : contentType === 'info_delivery'
        ? 12
        : 9;
    const maxParagraphs = contentType === 'music_video'
      ? 6
      : contentType === 'info_delivery'
        ? 4
        : 5;
    return Math.max(2, Math.min(maxParagraphs, Math.ceil(totalSeconds / secondsPerParagraph)));
  }

  if (contentType === 'music_video') return Math.max(4, Math.min(24, Math.round(safeMinutes * 4)));
  if (contentType === 'info_delivery') return Math.max(3, Math.min(18, Math.round(safeMinutes * 1.5)));
  if (contentType === 'cinematic') return Math.max(3, Math.min(15, Math.round(safeMinutes * 1.2)));
  return Math.max(3, Math.min(15, Math.round(safeMinutes * 1.3)));
}
