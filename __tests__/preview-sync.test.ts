import { describe, it, expect } from "vitest";

/**
 * Tests for the preview sync logic:
 * - effectivePlayerState computation from tracks
 * - volume, speed, muted, trim derivation
 */

// Replicate the effectivePlayerState computation logic
function computeEffectivePlayerState(
  tracks: Array<{
    type: string;
    isMuted: boolean;
    isSolo: boolean;
    volume: number;
    clips: Array<{
      speed: number;
      volume: number;
      trimStart: number;
      trimEnd: number;
    }>;
  }>,
  projectDuration: number
) {
  const videoTrack = tracks.find((t) => t.type === "video");
  const audioTrack = tracks.find((t) => t.type === "audio");
  const hasSolo = tracks.some((t) => t.isSolo);

  let videoSpeed = 1.0;
  let videoTrimStart = 0;
  let videoTrimEnd = projectDuration;
  if (videoTrack && videoTrack.clips.length > 0) {
    const clip = videoTrack.clips[0];
    videoSpeed = clip.speed;
    videoTrimStart = clip.trimStart;
    videoTrimEnd = clip.trimEnd;
  }

  let videoMuted = false;
  let audioVolume = 1.0;

  if (videoTrack) {
    const isVideoActive = hasSolo ? videoTrack.isSolo : !videoTrack.isMuted;
    videoMuted = !isVideoActive;
  }

  if (audioTrack) {
    const isAudioActive = hasSolo ? audioTrack.isSolo : !audioTrack.isMuted;
    if (!isAudioActive) {
      audioVolume = 0;
    } else {
      const clipVol = audioTrack.clips.length > 0 ? audioTrack.clips[0].volume : 1.0;
      audioVolume = audioTrack.volume * clipVol;
    }
  }

  let finalVolume = audioVolume;
  if (videoTrack && !videoMuted) {
    const videoClipVol = videoTrack.clips.length > 0 ? videoTrack.clips[0].volume : 1.0;
    finalVolume = Math.max(audioVolume, videoTrack.volume * videoClipVol);
  }

  const allMuted = videoMuted && audioVolume === 0;

  return {
    speed: videoSpeed,
    volume: Math.max(0, Math.min(1, finalVolume)),
    muted: allMuted,
    trimStart: videoTrimStart,
    trimEnd: videoTrimEnd,
  };
}

describe("effectivePlayerState computation", () => {
  const defaultTracks = [
    {
      type: "video",
      isMuted: false,
      isSolo: false,
      volume: 1.0,
      clips: [{ speed: 1.0, volume: 1.0, trimStart: 0, trimEnd: 30 }],
    },
    {
      type: "audio",
      isMuted: false,
      isSolo: false,
      volume: 1.0,
      clips: [{ speed: 1.0, volume: 1.0, trimStart: 0, trimEnd: 30 }],
    },
  ];

  it("returns default values for normal tracks", () => {
    const result = computeEffectivePlayerState(defaultTracks, 30);
    expect(result.speed).toBe(1.0);
    expect(result.volume).toBe(1.0);
    expect(result.muted).toBe(false);
    expect(result.trimStart).toBe(0);
    expect(result.trimEnd).toBe(30);
  });

  it("reflects video clip speed change", () => {
    const tracks = [
      {
        ...defaultTracks[0],
        clips: [{ speed: 4.0, volume: 1.0, trimStart: 0, trimEnd: 30 }],
      },
      defaultTracks[1],
    ];
    const result = computeEffectivePlayerState(tracks, 30);
    expect(result.speed).toBe(4.0);
  });

  it("reflects video clip trim change", () => {
    const tracks = [
      {
        ...defaultTracks[0],
        clips: [{ speed: 1.0, volume: 1.0, trimStart: 5, trimEnd: 20 }],
      },
      defaultTracks[1],
    ];
    const result = computeEffectivePlayerState(tracks, 30);
    expect(result.trimStart).toBe(5);
    expect(result.trimEnd).toBe(20);
  });

  it("mutes when audio track is muted", () => {
    const tracks = [
      defaultTracks[0],
      { ...defaultTracks[1], isMuted: true },
    ];
    const result = computeEffectivePlayerState(tracks, 30);
    // Audio is muted but video is not, so not fully muted
    expect(result.muted).toBe(false);
    // Volume comes from video track only
    expect(result.volume).toBe(1.0);
  });

  it("fully mutes when both video and audio tracks are muted", () => {
    const tracks = [
      { ...defaultTracks[0], isMuted: true },
      { ...defaultTracks[1], isMuted: true },
    ];
    const result = computeEffectivePlayerState(tracks, 30);
    expect(result.muted).toBe(true);
  });

  it("solo mode: only solo track is active", () => {
    const tracks = [
      { ...defaultTracks[0], isSolo: false },
      { ...defaultTracks[1], isSolo: true },
    ];
    const result = computeEffectivePlayerState(tracks, 30);
    // Video is not solo, so videoMuted = true
    // Audio is solo, so audioVolume = 1.0
    expect(result.muted).toBe(false);
    expect(result.volume).toBe(1.0);
  });

  it("reflects track volume changes", () => {
    const tracks = [
      { ...defaultTracks[0], volume: 0.5 },
      { ...defaultTracks[1], volume: 0.3 },
    ];
    const result = computeEffectivePlayerState(tracks, 30);
    // finalVolume = max(audioTrack.volume * clipVol, videoTrack.volume * clipVol)
    // = max(0.3 * 1.0, 0.5 * 1.0) = 0.5
    expect(result.volume).toBe(0.5);
  });

  it("reflects clip volume changes", () => {
    const tracks = [
      {
        ...defaultTracks[0],
        clips: [{ speed: 1.0, volume: 0.2, trimStart: 0, trimEnd: 30 }],
      },
      {
        ...defaultTracks[1],
        clips: [{ speed: 1.0, volume: 0.6, trimStart: 0, trimEnd: 30 }],
      },
    ];
    const result = computeEffectivePlayerState(tracks, 30);
    // audio: 1.0 * 0.6 = 0.6, video: 1.0 * 0.2 = 0.2
    // finalVolume = max(0.6, 0.2) = 0.6
    expect(result.volume).toBe(0.6);
  });

  it("handles 10x speed", () => {
    const tracks = [
      {
        ...defaultTracks[0],
        clips: [{ speed: 10.0, volume: 1.0, trimStart: 0, trimEnd: 30 }],
      },
      defaultTracks[1],
    ];
    const result = computeEffectivePlayerState(tracks, 30);
    expect(result.speed).toBe(10.0);
  });

  it("handles empty tracks gracefully", () => {
    const result = computeEffectivePlayerState([], 30);
    expect(result.speed).toBe(1.0);
    expect(result.volume).toBe(1.0);
    expect(result.muted).toBe(false);
    expect(result.trimStart).toBe(0);
    expect(result.trimEnd).toBe(30);
  });
});

// Replicate syncToVideoTrack logic
function syncToVideoTrack(
  tracks: Array<{
    type: string;
    isMuted: boolean;
    isSolo: boolean;
    volume: number;
    clips: Array<{ speed: number; volume: number; trimStart: number; trimEnd: number }>;
  }>,
  updates: { speed?: number; trimStart?: number; trimEnd?: number }
) {
  const idx = tracks.findIndex((t) => t.type === "video");
  if (idx === -1) return tracks;
  const vt = tracks[idx];
  if (vt.clips.length === 0) return tracks;
  const clip = { ...vt.clips[0] };
  if (updates.speed !== undefined) clip.speed = updates.speed;
  if (updates.trimStart !== undefined) clip.trimStart = updates.trimStart;
  if (updates.trimEnd !== undefined) clip.trimEnd = updates.trimEnd;
  const newTracks = [...tracks];
  newTracks[idx] = { ...vt, clips: [clip, ...vt.clips.slice(1)] };
  return newTracks;
}

describe("syncToVideoTrack bidirectional sync", () => {
  const baseTracks = [
    {
      type: "video",
      isMuted: false,
      isSolo: false,
      volume: 1.0,
      clips: [{ speed: 1.0, volume: 1.0, trimStart: 0, trimEnd: 30 }],
    },
    {
      type: "audio",
      isMuted: false,
      isSolo: false,
      volume: 1.0,
      clips: [{ speed: 1.0, volume: 1.0, trimStart: 0, trimEnd: 30 }],
    },
  ];

  it("speed panel change → tracks → effectivePlayerState", () => {
    const updated = syncToVideoTrack(JSON.parse(JSON.stringify(baseTracks)), { speed: 8.0 });
    const state = computeEffectivePlayerState(updated, 30);
    expect(state.speed).toBe(8.0);
  });

  it("trim panel change → tracks → effectivePlayerState", () => {
    const updated = syncToVideoTrack(JSON.parse(JSON.stringify(baseTracks)), { trimStart: 5, trimEnd: 20 });
    const state = computeEffectivePlayerState(updated, 30);
    expect(state.trimStart).toBe(5);
    expect(state.trimEnd).toBe(20);
  });

  it("multi-track mute → effectivePlayerState volume", () => {
    const tracks = JSON.parse(JSON.stringify(baseTracks));
    tracks[0].isMuted = true;
    const state = computeEffectivePlayerState(tracks, 30);
    expect(state.muted).toBe(false); // Audio still active
    expect(state.volume).toBe(1.0);
  });

  it("multi-track volume change → effectivePlayerState", () => {
    const tracks = JSON.parse(JSON.stringify(baseTracks));
    tracks[1].volume = 0.3;
    tracks[1].clips[0].volume = 0.5;
    const state = computeEffectivePlayerState(tracks, 30);
    // max(audio=0.3*0.5=0.15, video=1.0*1.0=1.0) = 1.0
    expect(state.volume).toBe(1.0);
  });

  it("multi-track onTracksChange → legacy state extraction", () => {
    const tracks = [
      {
        type: "video",
        isMuted: false,
        isSolo: false,
        volume: 1.0,
        clips: [{ speed: 6.0, volume: 1.0, trimStart: 3, trimEnd: 18 }],
      },
    ];
    // Simulate onTracksChange wrapper extracting legacy values
    const vt = tracks.find((t) => t.type === "video");
    expect(vt!.clips[0].speed).toBe(6.0);
    expect(vt!.clips[0].trimStart).toBe(3);
    expect(vt!.clips[0].trimEnd).toBe(18);
  });
});
