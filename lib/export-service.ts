import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import type { VideoProject, ClipTransition, TransitionType } from "./editor-context";
import { ASPECT_RATIO_PRESETS } from "./editor-context";

// Quality presets
export interface ExportSettings {
  quality: "high" | "medium" | "low";
  fps: 24 | 30 | 60;
  codec: "h264" | "h265";
}

interface QualityConfig {
  width: number;
  height: number;
  videoBitrate: string;
  audioBitrate: string;
}

const QUALITY_MAP: Record<ExportSettings["quality"], QualityConfig> = {
  high: { width: 1920, height: 1080, videoBitrate: "8M", audioBitrate: "192k" },
  medium: { width: 1280, height: 720, videoBitrate: "4M", audioBitrate: "128k" },
  low: { width: 854, height: 480, videoBitrate: "2M", audioBitrate: "96k" },
};

export type ExportProgress = {
  phase: "preparing" | "processing" | "encoding" | "saving";
  progress: number; // 0-1
  message: string;
};

type ProgressCallback = (progress: ExportProgress) => void;

/**
 * Build FFmpeg filter for a transition between two clips.
 */
function getTransitionFilter(
  transition: ClipTransition,
  offset: number,
  streamA: string,
  streamB: string,
  outLabel: string
): string {
  const d = transition.duration;

  // Map transition types to xfade transition names
  const xfadeMap: Partial<Record<TransitionType, string>> = {
    fade: "fade",
    dissolve: "dissolve",
    "slide-left": "slideleft",
    "slide-right": "slideright",
    "slide-up": "slideup",
    "slide-down": "slidedown",
    "zoom-in": "zoomin",
    "zoom-out": "fadeblack",
    "wipe-left": "wipeleft",
    "wipe-right": "wiperight",
    "wipe-up": "wipeup",
    "wipe-down": "wipedown",
    blur: "smoothleft",
    flash: "fadewhite",
    rotate: "circleopen",
    glitch: "pixelize",
  };

  const xfadeName = xfadeMap[transition.type] ?? "fade";
  return `${streamA}${streamB}xfade=transition=${xfadeName}:duration=${d}:offset=${offset}[${outLabel}]`;
}

/**
 * Build FFmpeg command args for the given project and export settings.
 * Returns the full argument list for FFmpegKit.execute().
 */
export function buildFFmpegArgs(
  project: VideoProject,
  settings: ExportSettings,
  outputPath: string
): string[] {
  const baseQc = QUALITY_MAP[settings.quality];
  // Adjust output dimensions based on aspect ratio
  const arPreset = ASPECT_RATIO_PRESETS.find((p) => p.id === project.aspectRatio);
  let qc = { ...baseQc };
  if (arPreset) {
    const ratio = arPreset.width / arPreset.height;
    if (ratio < 1) {
      // Portrait (e.g. 9:16): swap width/height
      qc = { ...baseQc, width: baseQc.height, height: Math.round(baseQc.height / ratio) };
      // Cap to reasonable sizes
      if (qc.height > 1920) { qc.height = 1920; qc.width = Math.round(1920 * ratio); }
    } else if (ratio === 1) {
      // Square
      qc = { ...baseQc, width: baseQc.height, height: baseQc.height };
    }
    // For wider ratios like 21:9, keep width and adjust height
    else if (ratio > 16 / 9) {
      qc = { ...baseQc, height: Math.round(baseQc.width / ratio) };
    }
  }
  const codecFlag = settings.codec === "h265" ? "libx265" : "libx264";

  const args: string[] = [];

  // Get video tracks and their clips
  const videoTrack = project.tracks.find((t) => t.type === "video");
  const audioTracks = project.tracks.filter((t) => t.type === "audio" || t.type === "bgm");

  if (!videoTrack || videoTrack.clips.length === 0) {
    // Fallback: simple trim + speed of the main video
    args.push("-i", project.videoUri);
    args.push("-ss", String(project.trimStart));
    args.push("-to", String(project.trimEnd));

    if (project.speed !== 1.0) {
      const pts = (1 / project.speed).toFixed(4);
      args.push("-filter:v", `setpts=${pts}*PTS,scale=${qc.width}:${qc.height}:force_original_aspect_ratio=decrease,pad=${qc.width}:${qc.height}:(ow-iw)/2:(oh-ih)/2`);
      args.push("-filter:a", `atempo=${project.speed}`);
    } else {
      args.push("-vf", `scale=${qc.width}:${qc.height}:force_original_aspect_ratio=decrease,pad=${qc.width}:${qc.height}:(ow-iw)/2:(oh-ih)/2`);
    }

    args.push("-c:v", codecFlag);
    args.push("-b:v", qc.videoBitrate);
    args.push("-r", String(settings.fps));
    args.push("-c:a", "aac");
    args.push("-b:a", qc.audioBitrate);
    args.push("-y", outputPath);
    return args;
  }

  // Multi-clip export with potential transitions
  const clips = [...videoTrack.clips].sort((a, b) => a.timelineOffset - b.timelineOffset);

  // Input files - each clip is a separate input
  const inputIndices: Map<string, number> = new Map();
  let inputIdx = 0;
  for (const clip of clips) {
    if (!inputIndices.has(clip.sourceUri)) {
      inputIndices.set(clip.sourceUri, inputIdx++);
      args.push("-i", clip.sourceUri);
    }
  }

  // Add audio inputs for BGM tracks
  const bgmTracks = project.tracks.filter((t) => t.type === "bgm" && !t.isMuted);
  for (const bgm of bgmTracks) {
    for (const clip of bgm.clips) {
      if (!inputIndices.has(clip.sourceUri)) {
        inputIndices.set(clip.sourceUri, inputIdx++);
        args.push("-i", clip.sourceUri);
      }
    }
  }

  // Build complex filter graph
  const filterParts: string[] = [];
  const scaleFilter = `scale=${qc.width}:${qc.height}:force_original_aspect_ratio=decrease,pad=${qc.width}:${qc.height}:(ow-iw)/2:(oh-ih)/2`;

  // Process each video clip: trim, speed, scale
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const srcIdx = inputIndices.get(clip.sourceUri) ?? 0;
    const pts = clip.speed !== 1.0 ? `setpts=${(1 / clip.speed).toFixed(4)}*PTS,` : "";
    filterParts.push(
      `[${srcIdx}:v]trim=start=${clip.trimStart}:end=${clip.trimEnd},setpts=PTS-STARTPTS,${pts}${scaleFilter},fps=${settings.fps}[v${i}]`
    );
    // Audio for each clip
    const atempo = clip.speed !== 1.0 ? `,atempo=${clip.speed}` : "";
    const vol = clip.volume !== 1.0 ? `,volume=${clip.volume}` : "";
    filterParts.push(
      `[${srcIdx}:a]atrim=start=${clip.trimStart}:end=${clip.trimEnd},asetpts=PTS-STARTPTS${atempo}${vol}[a${i}]`
    );
  }

  // Apply transitions between clips if any
  if (clips.length === 1) {
    // Single clip, no transitions needed
    filterParts.push(`[v0]null[vout]`);
    filterParts.push(`[a0]anull[aout]`);
  } else {
    // Chain clips with transitions
    let currentVideoLabel = "v0";
    let cumulativeOffset = 0;

    for (let i = 0; i < clips.length - 1; i++) {
      const clipDuration = (clips[i].trimEnd - clips[i].trimStart) / clips[i].speed;
      const nextClip = clips[i + 1];
      const transition = nextClip.transition;

      if (transition && transition.type !== "none") {
        cumulativeOffset += clipDuration - transition.duration;
        const outLabel = i === clips.length - 2 ? "vout" : `vt${i}`;
        filterParts.push(
          getTransitionFilter(transition, cumulativeOffset, `[${currentVideoLabel}]`, `[v${i + 1}]`, outLabel)
        );
        currentVideoLabel = outLabel;
      } else {
        // No transition: just concatenate
        cumulativeOffset += clipDuration;
        if (i === clips.length - 2) {
          filterParts.push(`[${currentVideoLabel}][v${i + 1}]concat=n=2:v=1:a=0[vout]`);
        } else {
          const outLabel = `vc${i}`;
          filterParts.push(`[${currentVideoLabel}][v${i + 1}]concat=n=2:v=1:a=0[${outLabel}]`);
          currentVideoLabel = outLabel;
        }
      }
    }

    // Concatenate audio streams
    const audioLabels = clips.map((_, i) => `[a${i}]`).join("");
    filterParts.push(`${audioLabels}concat=n=${clips.length}:v=0:a=1[aout]`);
  }

  // Mix BGM if present
  if (bgmTracks.length > 0 && bgmTracks.some((t) => t.clips.length > 0)) {
    let bgmIdx = 0;
    for (const bgm of bgmTracks) {
      for (const clip of bgm.clips) {
        const srcIdx = inputIndices.get(clip.sourceUri) ?? 0;
        filterParts.push(
          `[${srcIdx}:a]volume=${clip.volume * bgm.volume}[bgm${bgmIdx}]`
        );
        bgmIdx++;
      }
    }
    // Mix main audio with BGM
    if (bgmIdx > 0) {
      const bgmLabels = Array.from({ length: bgmIdx }, (_, i) => `[bgm${i}]`).join("");
      filterParts.push(`[aout]${bgmLabels}amix=inputs=${bgmIdx + 1}:duration=first:dropout_transition=2[amixed]`);
      // Replace aout with amixed
      args.push("-filter_complex", filterParts.join(";\n"));
      args.push("-map", "[vout]");
      args.push("-map", "[amixed]");
    } else {
      args.push("-filter_complex", filterParts.join(";\n"));
      args.push("-map", "[vout]");
      args.push("-map", "[aout]");
    }
  } else {
    args.push("-filter_complex", filterParts.join(";\n"));
    args.push("-map", "[vout]");
    args.push("-map", "[aout]");
  }

  args.push("-c:v", codecFlag);
  args.push("-b:v", qc.videoBitrate);
  args.push("-r", String(settings.fps));
  args.push("-c:a", "aac");
  args.push("-b:a", qc.audioBitrate);
  args.push("-movflags", "+faststart");
  args.push("-y", outputPath);

  return args;
}

/**
 * Run the export using FFmpegKit.
 * Falls back to a simple file copy if FFmpegKit is not available
 * (e.g. in Expo Go where native modules aren't supported).
 */
export async function runExport(
  project: VideoProject,
  settings: ExportSettings,
  onProgress: ProgressCallback,
): Promise<string> {
  onProgress({ phase: "preparing", progress: 0, message: "準備中..." });

  // Request media library permission
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") {
    throw new Error("メディアライブラリへのアクセス権限が必要です");
  }

  const timestamp = Date.now();
  const outputDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
  const outputPath = `${outputDir}export_${timestamp}.mp4`;

  onProgress({ phase: "processing", progress: 0.1, message: "動画を処理中..." });

  let ffmpegAvailable = false;
  let FFmpegKit: any = null;
  let FFmpegKitConfig: any = null;

  try {
    // Try to import ffmpeg-kit-react-native (only available in dev builds, not Expo Go)
    const ffmpegModule = require("ffmpeg-kit-react-native");
    FFmpegKit = ffmpegModule.FFmpegKit;
    FFmpegKitConfig = ffmpegModule.FFmpegKitConfig;
    ffmpegAvailable = true;
  } catch {
    ffmpegAvailable = false;
  }

  if (ffmpegAvailable && FFmpegKit) {
    // Real FFmpeg export
    const ffmpegArgs = buildFFmpegArgs(project, settings, outputPath);
    const command = ffmpegArgs
      .map((arg) => (arg.includes(" ") || arg.includes(";") || arg.includes("[") ? `"${arg}"` : arg))
      .join(" ");

    onProgress({ phase: "encoding", progress: 0.2, message: "エンコード中..." });

    // Enable statistics for progress tracking
    if (FFmpegKitConfig?.enableStatisticsCallback) {
      const totalDuration = project.trimEnd - project.trimStart;
      FFmpegKitConfig.enableStatisticsCallback((stats: any) => {
        const time = stats.getTime?.() ?? 0;
        const p = Math.min(time / (totalDuration * 1000), 0.95);
        onProgress({
          phase: "encoding",
          progress: 0.2 + p * 0.7,
          message: `エンコード中... ${Math.round((0.2 + p * 0.7) * 100)}%`,
        });
      });
    }

    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();

    if (!returnCode?.isValueSuccess?.()) {
      const logs = await session.getAllLogsAsString();
      console.warn("FFmpeg export failed:", logs);
      throw new Error("動画のエンコードに失敗しました");
    }
  } else {
    // Fallback: copy the source video with basic trimming simulation
    // This path is used in Expo Go where FFmpegKit is not available
    onProgress({ phase: "encoding", progress: 0.3, message: "動画をコピー中（Expo Go: FFmpeg未対応）..." });

    const sourceUri = project.videoUri;

    // For file:// URIs, copy directly
    if (sourceUri.startsWith("file://") || sourceUri.startsWith("/")) {
      await FileSystem.copyAsync({
        from: sourceUri,
        to: outputPath,
      });
    } else {
      // For content:// or ph:// URIs, attempt to download
      const downloadResult = await FileSystem.downloadAsync(sourceUri, outputPath);
      if (downloadResult.status !== 200) {
        throw new Error("動画ファイルの読み込みに失敗しました");
      }
    }

    // Simulate some processing time for UX
    await new Promise((resolve) => setTimeout(resolve, 500));
    onProgress({ phase: "encoding", progress: 0.8, message: "処理中..." });
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  onProgress({ phase: "saving", progress: 0.9, message: "カメラロールに保存中..." });

  // Save to media library
  const asset = await MediaLibrary.createAssetAsync(outputPath);
  await MediaLibrary.createAlbumAsync("VideoEdit Pro", asset, false);

  onProgress({ phase: "saving", progress: 1, message: "完了！" });

  // Clean up temp file
  try {
    await FileSystem.deleteAsync(outputPath, { idempotent: true });
  } catch {
    // ignore cleanup errors
  }

  return asset.uri;
}
