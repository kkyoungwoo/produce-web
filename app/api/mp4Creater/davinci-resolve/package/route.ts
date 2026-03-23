import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { resolveStorageDir } from '../../../local-storage/_shared';
import type { BackgroundMusicTrack, GeneratedAsset, PreviewMixSettings } from '@/lib/mp4Creater/types';

interface RequestBody { storageDir?: string; projectId?: string | null; projectNumber?: number | null; topic?: string; assets?: GeneratedAsset[]; backgroundTracks?: BackgroundMusicTrack[]; previewMix?: PreviewMixSettings; }

function sanitizeFilename(name: string): string { return `${name || 'mp4Creater'}`.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'mp4Creater'; }
function safeBasename(value: string): string { return sanitizeFilename(value).replace(/\s+/g, '_') || 'mp4Creater'; }
function ensureArray<T>(value: T[] | undefined | null): T[] { return Array.isArray(value) ? value : []; }
function parseDataValue(value: string | null | undefined, fallbackMime: string): { mime: string; bytes: Buffer } | null { if (!value?.trim()) return null; const trimmed = value.trim(); if (trimmed.startsWith('data:')) { const match = trimmed.match(/^data:(.*?);base64,(.*)$/); if (!match) return null; return { mime: match[1] || fallbackMime, bytes: Buffer.from(match[2] || '', 'base64') }; } if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed)) return { mime: fallbackMime, bytes: Buffer.from(trimmed.replace(/\s+/g, ''), 'base64') }; return null; }
function extensionFromMime(mime: string, fallback: string): string { const normalized = mime.toLowerCase(); if (normalized.includes('png')) return 'png'; if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg'; if (normalized.includes('webp')) return 'webp'; if (normalized.includes('wav')) return 'wav'; if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3'; if (normalized.includes('mp4')) return 'mp4'; if (normalized.includes('webm')) return 'webm'; return fallback; }
function guessExtension(value: string | null | undefined, fallbackMime: string, fallbackExt: string): string { const parsed = parseDataValue(value, fallbackMime); return parsed ? extensionFromMime(parsed.mime, fallbackExt) : fallbackExt; }
function formatSrtTime(seconds: number): string { const safe = Math.max(0, seconds || 0); const hours = Math.floor(safe / 3600); const mins = Math.floor((safe % 3600) / 60); const secs = Math.floor(safe % 60); const ms = Math.round((safe % 1) * 1000); return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`; }
function resolveVisualType(asset: GeneratedAsset): 'image' | 'video' | 'none' { if (asset.selectedVisualType === 'video' && asset.videoData) return 'video'; if (asset.selectedVisualType === 'image' && asset.imageData) return 'image'; if (asset.videoData) return 'video'; if (asset.imageData) return 'image'; return 'none'; }
function buildSceneSrt(asset: GeneratedAsset): string { const words = asset.subtitleData?.words || []; if (words.length) return words.map((word, index) => `${index + 1}\n${formatSrtTime(word.start)} --> ${formatSrtTime(Math.max(word.end, word.start + 0.2))}\n${word.word}\n`).join('\n'); const text = `${asset.subtitleData?.fullText || asset.narration || ''}`.trim(); if (!text) return ''; const duration = Math.max(asset.audioDuration || 0, asset.targetDuration || 0, 3); return `1\n${formatSrtTime(0)} --> ${formatSrtTime(duration)}\n${text}\n`; }
function buildMasterSrt(assets: GeneratedAsset[]): string { let pointer = 0; let index = 1; const rows: string[] = []; assets.forEach((asset) => { const text = `${asset.subtitleData?.fullText || asset.narration || ''}`.trim(); const duration = Math.max(asset.audioDuration || 0, asset.targetDuration || 0, 3); if (text) rows.push(`${index++}\n${formatSrtTime(pointer)} --> ${formatSrtTime(pointer + duration)}\n${text}\n`); pointer += duration; }); return rows.join('\n'); }
function csvEscape(value: string): string { return `"${`${value || ''}`.replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`; }
function buildBridgeUri(packagePath: string, packageName: string): string { const params = new URLSearchParams({ packagePath, packageName, source: 'mp4Creater-web' }); return `mp4creater-davinci://import?${params.toString()}`; }
function buildReadme(projectName: string, sceneCount: number, packagePath: string): string { return [`프로젝트: ${projectName}`, `씬 수: ${sceneCount}`, `패키지 위치: ${packagePath}`, '', '자동 Import 우선', '1. open_with_mp4creater_bridge.cmd, .ps1, .url 중 하나로 자동 Import를 먼저 시도합니다.', '2. 브리지가 없으면 media, audio, music, subtitles 폴더를 씬 번호 순서대로 드래그해 사용하세요.', '3. manifest/scenes.csv 와 resolve-import-manifest.json으로 씬 순서와 타임라인 시작/종료 시각을 다시 확인할 수 있습니다.', '4. manifest/drag_order.txt에는 수동 드래그 순서가 정리됩니다.'].join('\n'); }
function buildDragOrder(scenes: Array<{ sceneNumber: number; startTimeSec: number; endTimeSec: number; mediaFile: string | null; audioFile: string | null; subtitleFile: string | null; }>): string { return scenes.map((scene, index) => { const sceneNo = String(scene.sceneNumber).padStart(3, '0'); return [`${index + 1}. scene ${sceneNo}`, `  timeline_start_sec: ${scene.startTimeSec.toFixed(2)}`, `  timeline_end_sec: ${scene.endTimeSec.toFixed(2)}`, `  media: ${scene.mediaFile || '(none)'}`, `  audio: ${scene.audioFile || '(none)'}`, `  subtitle: ${scene.subtitleFile || '(none)'}`].join('\n'); }).join('\n\n'); }

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const requestedStorageDir = body?.storageDir?.trim();
    if (!requestedStorageDir) return NextResponse.json({ error: '저장 위치가 있어야 다빈치 패키지를 로컬 폴더로 만들 수 있습니다.' }, { status: 400 });
    const storageDir = resolveStorageDir(requestedStorageDir);
    const assets = ensureArray(body.assets);
    const backgroundTracks = ensureArray(body.backgroundTracks);
    const previewMix = body.previewMix || { narrationVolume: 1, backgroundMusicVolume: 0.28 };
    const projectName = body.topic?.trim() || 'mp4Creater Project';
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const packageName = safeBasename(body.projectNumber ? `${body.projectNumber}_${projectName}` : projectName);
    const packageRoot = path.join(storageDir, 'exports', 'davinci-resolve', `${packageName}_${stamp}`);
    await fs.mkdir(path.join(packageRoot, 'manifest'), { recursive: true });
    await fs.mkdir(path.join(packageRoot, 'media'), { recursive: true });
    await fs.mkdir(path.join(packageRoot, 'audio'), { recursive: true });
    await fs.mkdir(path.join(packageRoot, 'music'), { recursive: true });
    await fs.mkdir(path.join(packageRoot, 'subtitles'), { recursive: true });
    const primaryBgm = backgroundTracks.find((track) => track.audioData) || null;
    let timelinePointer = 0;
    const manifest = { packageVersion: 1, packageType: 'mp4creater-davinci-import', generatedAt: new Date().toISOString(), projectName, projectId: body.projectId || null, projectNumber: typeof body.projectNumber === 'number' ? body.projectNumber : null, sceneCount: assets.length, aspectRatio: assets[0]?.aspectRatio || '16:9', previewMix, backgroundMusicFile: primaryBgm?.audioData ? `music/000_project_bgm.${guessExtension(primaryBgm.audioData, 'audio/wav', 'wav')}` : null, scenes: assets.map((asset, index) => { const sceneNumber = asset.sceneNumber || index + 1; const sceneNo = String(sceneNumber).padStart(3, '0'); const visualType = resolveVisualType(asset); const duration = Math.max(asset.audioDuration || 0, asset.targetDuration || 0, 3); const startTimeSec = timelinePointer; const endTimeSec = startTimeSec + duration; timelinePointer = endTimeSec; return { sceneNumber, narration: `${asset.narration || ''}`.trim(), duration, startTimeSec, endTimeSec, gapBeforeSec: 0, aspectRatio: asset.aspectRatio || assets[0]?.aspectRatio || '16:9', visualType, mediaFile: visualType === 'video' ? `media/${sceneNo}_scene_${sceneNo}_video.${guessExtension(asset.videoData, 'video/mp4', 'mp4')}` : visualType === 'image' ? `media/${sceneNo}_scene_${sceneNo}_image.${guessExtension(asset.imageData, 'image/png', 'png')}` : null, audioFile: asset.audioData ? `audio/${sceneNo}_scene_${sceneNo}_narration.${guessExtension(asset.audioData, 'audio/mpeg', 'mp3')}` : null, subtitleFile: (asset.subtitleData?.fullText || asset.narration) ? `subtitles/${sceneNo}_scene_${sceneNo}.srt` : null, imagePrompt: `${asset.imagePrompt || asset.visualPrompt || ''}`.trim(), videoPrompt: `${asset.videoPrompt || ''}`.trim() }; }) };
    const sceneCsv = ['scene_number,timeline_start_sec,timeline_end_sec,gap_before_sec,duration_sec,aspect_ratio,visual_type,media_file,audio_file,subtitle_file,narration', ...manifest.scenes.map((scene) => [scene.sceneNumber, Number(scene.startTimeSec || 0).toFixed(2), Number(scene.endTimeSec || 0).toFixed(2), Number(scene.gapBeforeSec || 0).toFixed(2), Number(scene.duration || 0).toFixed(2), scene.aspectRatio, scene.visualType, scene.mediaFile || '', scene.audioFile || '', scene.subtitleFile || '', csvEscape(scene.narration || '')].join(','))].join('\n');
    await fs.writeFile(path.join(packageRoot, 'manifest', 'resolve-import-manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
    await fs.writeFile(path.join(packageRoot, 'manifest', 'scenes.csv'), sceneCsv, 'utf-8');
    await fs.writeFile(path.join(packageRoot, 'manifest', 'drag_order.txt'), buildDragOrder(manifest.scenes), 'utf-8');
    await fs.writeFile(path.join(packageRoot, 'subtitles', 'master_timeline.srt'), buildMasterSrt(assets), 'utf-8');
    for (let index = 0; index < assets.length; index += 1) {
      const asset = assets[index];
      const scene = manifest.scenes[index];
      if (scene.mediaFile) { const parsed = parseDataValue(scene.visualType === 'video' ? asset.videoData : asset.imageData, scene.visualType === 'video' ? 'video/mp4' : 'image/png'); if (parsed) await fs.writeFile(path.join(packageRoot, scene.mediaFile), parsed.bytes); }
      if (scene.audioFile) { const parsed = parseDataValue(asset.audioData, 'audio/mpeg'); if (parsed) await fs.writeFile(path.join(packageRoot, scene.audioFile), parsed.bytes); }
      if (scene.subtitleFile) await fs.writeFile(path.join(packageRoot, scene.subtitleFile), buildSceneSrt(asset), 'utf-8');
    }
    if (primaryBgm?.audioData && manifest.backgroundMusicFile) { const parsed = parseDataValue(primaryBgm.audioData, 'audio/wav'); if (parsed) await fs.writeFile(path.join(packageRoot, manifest.backgroundMusicFile), parsed.bytes); }
    const launchUri = buildBridgeUri(packageRoot, packageName);
    await fs.writeFile(path.join(packageRoot, 'README_IMPORT.txt'), buildReadme(projectName, assets.length, packageRoot), 'utf-8');
    await fs.writeFile(path.join(packageRoot, 'open_with_mp4creater_bridge.bat'), ['@echo off', `start "" "${launchUri}"`, 'exit /b 0'].join('\r\n'), 'utf-8');
    await fs.writeFile(path.join(packageRoot, 'open_with_mp4creater_bridge.cmd'), ['@echo off', `start "" "${launchUri}"`, 'exit /b 0'].join('\r\n'), 'utf-8');
    await fs.writeFile(path.join(packageRoot, 'open_with_mp4creater_bridge.ps1'), [`Start-Process '${launchUri}'`].join('\r\n'), 'utf-8');
    await fs.writeFile(path.join(packageRoot, 'open_with_mp4creater_bridge.vbs'), [`Set shell = CreateObject("WScript.Shell")`, `shell.Run "${launchUri}", 1, false`].join('\r\n'), 'utf-8');
    await fs.writeFile(path.join(packageRoot, 'open_with_mp4creater_bridge.command'), ['#!/bin/zsh', `open "${launchUri}"`].join('\n'), 'utf-8');
    await fs.writeFile(path.join(packageRoot, 'open_with_mp4creater_bridge.url'), ['[InternetShortcut]', `URL=${launchUri}`].join('\r\n'), 'utf-8');
    return NextResponse.json({ ok: true, packageName, packagePath: packageRoot, launchUri, sceneCount: assets.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '다빈치 패키지 생성 실패' }, { status: 500 });
  }
}
