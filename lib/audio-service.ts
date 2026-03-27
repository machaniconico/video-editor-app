import * as FileSystem from "expo-file-system";

/**
 * Extract audio from a video file using FFmpeg.
 * Returns the path to the extracted audio file.
 */
export async function extractAudio(
  videoUri: string,
  outputFormat: "aac" | "mp3" = "aac"
): Promise<string> {
  const timestamp = Date.now();
  const outputDir = FileSystem.cacheDirectory ?? "";
  const ext = outputFormat === "mp3" ? "mp3" : "m4a";
  const outputPath = `${outputDir}extracted_audio_${timestamp}.${ext}`;

  let FFmpegKit: any;
  try {
    const ffmpegModule = require("ffmpeg-kit-react-native");
    FFmpegKit = ffmpegModule.FFmpegKit;
  } catch {
    throw new Error("FFmpegKitが利用できません（Expo Go未対応）");
  }

  const codec = outputFormat === "mp3" ? "libmp3lame" : "aac";
  const command = `-i "${videoUri}" -vn -acodec ${codec} -y "${outputPath}"`;

  const session = await FFmpegKit.execute(command);
  const returnCode = await session.getReturnCode();

  if (!returnCode?.isValueSuccess?.()) {
    throw new Error("音声の抽出に失敗しました");
  }

  return outputPath;
}

/**
 * Record voice over using expo-audio.
 * Returns recording utility functions.
 */
export function createVoiceRecorder() {
  let recording: any = null;

  return {
    async start(): Promise<void> {
      const { Audio } = require("expo-audio");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
    },

    async stop(): Promise<string> {
      if (!recording) throw new Error("録音が開始されていません");
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recording = null;
      if (!uri) throw new Error("録音ファイルの取得に失敗しました");
      return uri;
    },

    isRecording(): boolean {
      return recording !== null;
    },
  };
}

/**
 * Apply noise reduction to an audio file using FFmpeg.
 * Uses the `afftdn` filter for frequency-domain noise reduction.
 */
export async function reduceNoise(
  audioUri: string,
  strength: "light" | "medium" | "heavy" = "medium"
): Promise<string> {
  const timestamp = Date.now();
  const outputDir = FileSystem.cacheDirectory ?? "";
  const outputPath = `${outputDir}denoise_${timestamp}.m4a`;

  let FFmpegKit: any;
  try {
    const ffmpegModule = require("ffmpeg-kit-react-native");
    FFmpegKit = ffmpegModule.FFmpegKit;
  } catch {
    throw new Error("FFmpegKitが利用できません");
  }

  const nrMap = { light: 12, medium: 20, heavy: 35 };
  const nr = nrMap[strength];

  const command = `-i "${audioUri}" -af "afftdn=nr=${nr}:nf=-25" -c:a aac -y "${outputPath}"`;

  const session = await FFmpegKit.execute(command);
  const returnCode = await session.getReturnCode();

  if (!returnCode?.isValueSuccess?.()) {
    throw new Error("ノイズリダクションに失敗しました");
  }

  return outputPath;
}
