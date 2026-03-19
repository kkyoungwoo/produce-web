import { GeneratedAsset } from '../types';
import { blobFromDataValue, extensionFromMime, triggerBlobDownload, triggerSequentialDownloads } from './downloadHelpers';

// UTF-8 BOM for Excel Korean support
const BOM = '\uFEFF';

export const downloadCSV = (data: GeneratedAsset[]) => {
  const headers = ['Scene', 'Narration', 'Visual Prompt'];

  const rows = data.map((item) => [
    item.sceneNumber.toString(),
    `"${(item.narration || '').replace(/"/g, '""')}"`,
    `"${(item.visualPrompt || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  triggerBlobDownload(
    new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' }),
    'youtube_script_data.csv'
  );
};

export const downloadImagesAsZip = async (data: GeneratedAsset[]) => {
  const downloads = data
    .map((item) => {
      const blob = blobFromDataValue(item.imageData, 'image/jpeg');
      if (!blob) return null;
      return {
        blob,
        filename: `scene_${item.sceneNumber.toString().padStart(3, '0')}.${extensionFromMime(blob.type || 'image/jpeg', 'jpg')}`,
      };
    })
    .filter((item): item is { blob: Blob; filename: string } => Boolean(item));

  if (!downloads.length) {
    alert('다운로드할 이미지가 없습니다.');
    return;
  }

  await triggerSequentialDownloads(downloads);
};

/**
 * CSV와 이미지를 함께 다운로드
 * ZIP 라이브러리 의존성 없이 브라우저 기본 다운로드를 사용합니다.
 */
export const downloadProjectZip = async (data: GeneratedAsset[]) => {
  const headers = ['Scene', 'Narration', 'Visual Prompt', 'Image File'];
  const rows = data.map((item) => {
    const imageBlob = blobFromDataValue(item.imageData, 'image/jpeg');
    const imageFileName = imageBlob
      ? `scene_${item.sceneNumber.toString().padStart(3, '0')}.${extensionFromMime(imageBlob.type || 'image/jpeg', 'jpg')}`
      : '';

    return [
      item.sceneNumber.toString(),
      `"${(item.narration || '').replace(/"/g, '""')}"`,
      `"${(item.visualPrompt || '').replace(/"/g, '""')}"`,
      `"${imageFileName}"`,
    ];
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  triggerBlobDownload(new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' }), 'project_script.csv');

  const imageDownloads = data
    .map((item) => {
      const blob = blobFromDataValue(item.imageData, 'image/jpeg');
      if (!blob) return null;
      return {
        blob,
        filename: `scene_${item.sceneNumber.toString().padStart(3, '0')}.${extensionFromMime(blob.type || 'image/jpeg', 'jpg')}`,
      };
    })
    .filter((item): item is { blob: Blob; filename: string } => Boolean(item));

  if (imageDownloads.length) {
    await triggerSequentialDownloads(imageDownloads);
  }
};
