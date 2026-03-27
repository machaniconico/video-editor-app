import React, { createContext, useContext, useReducer, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Types
export type TextAlignment = "left" | "center" | "right";

export type TextAnimationType =
  | "none"
  | "fade-in"
  | "fade-out"
  | "typewriter"
  | "bounce"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "scale-up"
  | "scale-down"
  | "rotate-in"
  | "glitch"
  | "wave";

export interface TextAnimation {
  type: TextAnimationType;
  /** Duration of the animation in seconds */
  duration: number;
}

export interface TextOutline {
  color: string;
  width: number;
}

export interface TextShadow {
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
}

export interface TextBackground {
  color: string;
  opacity: number;
  paddingH: number;
  paddingV: number;
  borderRadius: number;
}

export const TEXT_ANIMATION_PRESETS: { type: TextAnimationType; label: string }[] = [
  { type: "none", label: "なし" },
  { type: "fade-in", label: "フェードイン" },
  { type: "fade-out", label: "フェードアウト" },
  { type: "typewriter", label: "タイプライター" },
  { type: "bounce", label: "バウンス" },
  { type: "slide-up", label: "スライドアップ" },
  { type: "slide-down", label: "スライドダウン" },
  { type: "slide-left", label: "スライド左" },
  { type: "slide-right", label: "スライド右" },
  { type: "scale-up", label: "拡大" },
  { type: "scale-down", label: "縮小" },
  { type: "rotate-in", label: "回転イン" },
  { type: "glitch", label: "グリッチ" },
  { type: "wave", label: "ウェーブ" },
];

export const FONT_FAMILIES = [
  { id: "system", label: "システム", family: undefined },
  { id: "serif", label: "明朝", family: "serif" },
  { id: "monospace", label: "等幅", family: "monospace" },
  { id: "rounded", label: "丸ゴシック", family: "System" },
  { id: "condensed", label: "コンデンス", family: "System" },
];

export interface TextTemplate {
  id: string;
  label: string;
  style: Partial<TextOverlay>;
}

export const TEXT_TEMPLATES: TextTemplate[] = [
  {
    id: "title",
    label: "タイトル",
    style: {
      fontSize: 48,
      bold: true,
      color: "#FFFFFF",
      alignment: "center",
      outline: { color: "#000000", width: 2 },
      shadow: { color: "rgba(0,0,0,0.5)", offsetX: 2, offsetY: 2, blur: 4 },
      animationIn: { type: "scale-up", duration: 0.5 },
    },
  },
  {
    id: "subtitle",
    label: "字幕",
    style: {
      fontSize: 20,
      bold: false,
      color: "#FFFFFF",
      alignment: "center",
      y: 85,
      background: { color: "#000000", opacity: 0.6, paddingH: 12, paddingV: 4, borderRadius: 4 },
    },
  },
  {
    id: "lower-third",
    label: "ローワーサード",
    style: {
      fontSize: 24,
      bold: true,
      color: "#FFFFFF",
      alignment: "left",
      x: 10,
      y: 75,
      background: { color: "#007AFF", opacity: 0.85, paddingH: 16, paddingV: 8, borderRadius: 6 },
      animationIn: { type: "slide-left", duration: 0.4 },
    },
  },
  {
    id: "callout",
    label: "コールアウト",
    style: {
      fontSize: 28,
      bold: true,
      color: "#FFD60A",
      alignment: "center",
      outline: { color: "#000000", width: 3 },
      animationIn: { type: "bounce", duration: 0.5 },
    },
  },
  {
    id: "minimal",
    label: "ミニマル",
    style: {
      fontSize: 18,
      bold: false,
      color: "#FFFFFF",
      alignment: "left",
      letterSpacing: 2,
      animationIn: { type: "fade-in", duration: 0.8 },
    },
  },
  {
    id: "impact",
    label: "インパクト",
    style: {
      fontSize: 56,
      bold: true,
      color: "#FF3B30",
      alignment: "center",
      outline: { color: "#FFFFFF", width: 3 },
      shadow: { color: "rgba(0,0,0,0.8)", offsetX: 4, offsetY: 4, blur: 8 },
      animationIn: { type: "scale-up", duration: 0.3 },
    },
  },
  {
    id: "neon",
    label: "ネオン",
    style: {
      fontSize: 36,
      bold: true,
      color: "#00FF88",
      alignment: "center",
      shadow: { color: "#00FF88", offsetX: 0, offsetY: 0, blur: 16 },
      animationIn: { type: "glitch", duration: 0.6 },
    },
  },
  {
    id: "cinematic",
    label: "シネマ",
    style: {
      fontSize: 32,
      bold: false,
      italic: true,
      color: "#FFFFFF",
      alignment: "center",
      letterSpacing: 4,
      lineHeight: 1.6,
      animationIn: { type: "fade-in", duration: 1.2 },
      animationOut: { type: "fade-out", duration: 1.0 },
    },
  },
];

export interface TextOverlay {
  id: string;
  text: string;
  fontSize: number;
  color: string;
  position: "top" | "center" | "bottom";
  bold: boolean;
  italic: boolean;
  // Free positioning (percentage-based, 0-100)
  x: number;
  y: number;
  rotation: number;
  /** Start time on timeline (seconds). Defaults to 0 */
  startTime: number;
  /** End time on timeline (seconds). Defaults to video duration */
  endTime: number;
  /** Font family identifier */
  fontFamily?: string;
  /** Text alignment */
  alignment?: TextAlignment;
  /** Letter spacing in pixels */
  letterSpacing?: number;
  /** Line height multiplier (1.0 = normal) */
  lineHeight?: number;
  /** Outline/stroke effect */
  outline?: TextOutline;
  /** Drop shadow effect */
  shadow?: TextShadow;
  /** Background highlight */
  background?: TextBackground;
  /** Entrance animation */
  animationIn?: TextAnimation;
  /** Exit animation */
  animationOut?: TextAnimation;
}

export interface FrameSlot {
  id: string;
  videoUri: string;
  thumbnailUri: string | null;
  duration: number;
}

export type FrameLayout = "single" | "split-h" | "split-v" | "grid-4" | "pip";

export interface VideoFilter {
  id: string;
  name: string;
  intensity: number;
}

export interface BGMTrack {
  id: string;
  title: string;
  category: string;
  uri: string;
  duration: number;
  volume: number;
}

// ---- Transition types ----

export type TransitionType =
  | "none"
  | "fade"
  | "dissolve"
  | "slide-left"
  | "slide-right"
  | "slide-up"
  | "slide-down"
  | "zoom-in"
  | "zoom-out"
  | "wipe-left"
  | "wipe-right"
  | "wipe-up"
  | "wipe-down"
  | "blur"
  | "flash"
  | "rotate"
  | "glitch";

export interface ClipTransition {
  type: TransitionType;
  /** Duration of the transition in seconds (0.1 – 2.0) */
  duration: number;
}

export const TRANSITION_PRESETS: { type: TransitionType; label: string; icon: string }[] = [
  { type: "none", label: "なし", icon: "xmark" },
  { type: "fade", label: "フェード", icon: "circle.lefthalf.filled" },
  { type: "dissolve", label: "ディゾルブ", icon: "sparkles" },
  { type: "slide-left", label: "スライド左", icon: "arrow.left.square" },
  { type: "slide-right", label: "スライド右", icon: "arrow.right.square" },
  { type: "slide-up", label: "スライド上", icon: "arrow.up.square" },
  { type: "slide-down", label: "スライド下", icon: "arrow.down.square" },
  { type: "zoom-in", label: "ズームイン", icon: "plus.magnifyingglass" },
  { type: "zoom-out", label: "ズームアウト", icon: "minus.magnifyingglass" },
  { type: "wipe-left", label: "ワイプ左", icon: "rectangle.lefthalf.inset.filled.arrow.left" },
  { type: "wipe-right", label: "ワイプ右", icon: "rectangle.righthalf.inset.filled.arrow.right" },
  { type: "wipe-up", label: "ワイプ上", icon: "rectangle.tophalf.inset.filled" },
  { type: "wipe-down", label: "ワイプ下", icon: "rectangle.bottomhalf.inset.filled" },
  { type: "blur", label: "ブラー", icon: "aqi.medium" },
  { type: "flash", label: "フラッシュ", icon: "bolt.fill" },
  { type: "rotate", label: "回転", icon: "arrow.triangle.2.circlepath" },
  { type: "glitch", label: "グリッチ", icon: "waveform.path.ecg" },
];

// ---- Keyframe types ----

export type KeyframeProperty = "x" | "y" | "scale" | "rotation" | "opacity";

export interface Keyframe {
  id: string;
  /** Time position in seconds (relative to clip start) */
  time: number;
  /** Property being animated */
  property: KeyframeProperty;
  /** Value at this keyframe */
  value: number;
  /** Easing function */
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

export interface KeyframeGroup {
  /** Which clip this keyframe group belongs to */
  clipId: string;
  keyframes: Keyframe[];
}

export const KEYFRAME_PROPERTY_LABELS: Record<KeyframeProperty, { label: string; icon: string; min: number; max: number; step: number; unit: string; defaultValue: number }> = {
  x: { label: "X位置", icon: "arrow.left.and.right", min: -100, max: 100, step: 1, unit: "%", defaultValue: 0 },
  y: { label: "Y位置", icon: "arrow.up.and.down", min: -100, max: 100, step: 1, unit: "%", defaultValue: 0 },
  scale: { label: "スケール", icon: "arrow.up.left.and.arrow.down.right", min: 0, max: 300, step: 1, unit: "%", defaultValue: 100 },
  rotation: { label: "回転", icon: "rotate.right", min: -360, max: 360, step: 1, unit: "°", defaultValue: 0 },
  opacity: { label: "透明度", icon: "circle.lefthalf.filled", min: 0, max: 100, step: 1, unit: "%", defaultValue: 100 },
};

/**
 * Interpolate a keyframe value at a given time.
 * Returns the interpolated value between surrounding keyframes.
 */
export function interpolateKeyframes(
  keyframes: Keyframe[],
  property: KeyframeProperty,
  time: number,
): number {
  const propertyKfs = keyframes
    .filter((kf) => kf.property === property)
    .sort((a, b) => a.time - b.time);

  if (propertyKfs.length === 0) {
    return KEYFRAME_PROPERTY_LABELS[property].defaultValue;
  }

  // Before first keyframe
  if (time <= propertyKfs[0].time) return propertyKfs[0].value;
  // After last keyframe
  if (time >= propertyKfs[propertyKfs.length - 1].time) return propertyKfs[propertyKfs.length - 1].value;

  // Find surrounding keyframes
  for (let i = 0; i < propertyKfs.length - 1; i++) {
    const kfA = propertyKfs[i];
    const kfB = propertyKfs[i + 1];
    if (time >= kfA.time && time <= kfB.time) {
      const t = (time - kfA.time) / (kfB.time - kfA.time);
      const easedT = applyEasing(t, kfB.easing);
      return kfA.value + (kfB.value - kfA.value) * easedT;
    }
  }

  return propertyKfs[0].value;
}

function applyEasing(t: number, easing: Keyframe["easing"]): number {
  switch (easing) {
    case "ease-in":
      return t * t;
    case "ease-out":
      return t * (2 - t);
    case "ease-in-out":
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case "linear":
    default:
      return t;
  }
}

// ---- Speed curve types ----

export interface SpeedCurvePoint {
  /** Normalized position in clip (0-1) */
  position: number;
  /** Speed multiplier at this point */
  speed: number;
}

export interface SpeedCurve {
  /** Name of the curve preset or "custom" */
  name: string;
  /** Control points defining the speed over time */
  points: SpeedCurvePoint[];
}

export const SPEED_CURVE_PRESETS: { name: string; label: string; points: SpeedCurvePoint[] }[] = [
  {
    name: "constant",
    label: "一定",
    points: [
      { position: 0, speed: 1 },
      { position: 1, speed: 1 },
    ],
  },
  {
    name: "montage",
    label: "モンタージュ",
    points: [
      { position: 0, speed: 0.5 },
      { position: 0.2, speed: 2.0 },
      { position: 0.4, speed: 0.5 },
      { position: 0.6, speed: 2.0 },
      { position: 0.8, speed: 0.5 },
      { position: 1, speed: 1.0 },
    ],
  },
  {
    name: "hero",
    label: "ヒーロー",
    points: [
      { position: 0, speed: 1.0 },
      { position: 0.3, speed: 0.2 },
      { position: 0.5, speed: 0.2 },
      { position: 0.7, speed: 3.0 },
      { position: 1, speed: 1.0 },
    ],
  },
  {
    name: "bullet-time",
    label: "バレットタイム",
    points: [
      { position: 0, speed: 1.0 },
      { position: 0.2, speed: 1.0 },
      { position: 0.3, speed: 0.1 },
      { position: 0.7, speed: 0.1 },
      { position: 0.8, speed: 1.0 },
      { position: 1, speed: 1.0 },
    ],
  },
  {
    name: "jump-cut",
    label: "ジャンプカット",
    points: [
      { position: 0, speed: 1.0 },
      { position: 0.24, speed: 1.0 },
      { position: 0.25, speed: 4.0 },
      { position: 0.49, speed: 4.0 },
      { position: 0.5, speed: 1.0 },
      { position: 0.74, speed: 1.0 },
      { position: 0.75, speed: 4.0 },
      { position: 1, speed: 4.0 },
    ],
  },
  {
    name: "ease-in",
    label: "イーズイン",
    points: [
      { position: 0, speed: 0.3 },
      { position: 0.5, speed: 0.8 },
      { position: 1, speed: 2.0 },
    ],
  },
  {
    name: "ease-out",
    label: "イーズアウト",
    points: [
      { position: 0, speed: 2.0 },
      { position: 0.5, speed: 0.8 },
      { position: 1, speed: 0.3 },
    ],
  },
  {
    name: "ramp-up",
    label: "加速",
    points: [
      { position: 0, speed: 0.5 },
      { position: 1, speed: 3.0 },
    ],
  },
  {
    name: "ramp-down",
    label: "減速",
    points: [
      { position: 0, speed: 3.0 },
      { position: 1, speed: 0.5 },
    ],
  },
];

/**
 * Get the speed at a given normalized position (0-1) in a speed curve.
 * Linearly interpolates between control points.
 */
export function getSpeedAtPosition(curve: SpeedCurve, position: number): number {
  const pts = curve.points;
  if (pts.length === 0) return 1;
  if (position <= pts[0].position) return pts[0].speed;
  if (position >= pts[pts.length - 1].position) return pts[pts.length - 1].speed;

  for (let i = 0; i < pts.length - 1; i++) {
    if (position >= pts[i].position && position <= pts[i + 1].position) {
      const t = (position - pts[i].position) / (pts[i + 1].position - pts[i].position);
      return pts[i].speed + (pts[i + 1].speed - pts[i].speed) * t;
    }
  }
  return 1;
}

// ---- Multi-track types ----

export type TrackType = "video" | "audio" | "bgm";

export interface TimelineClip {
  id: string;
  /** Source URI (video file or audio file) */
  sourceUri: string;
  /** Display name */
  name: string;
  /** Duration in seconds */
  duration: number;
  /** Trim start within the clip (seconds) */
  trimStart: number;
  /** Trim end within the clip (seconds) */
  trimEnd: number;
  /** Offset on the timeline (seconds from 0) */
  timelineOffset: number;
  /** Playback speed */
  speed: number;
  /** Volume (0-1) */
  volume: number;
  /** Transition applied at the start of this clip */
  transition?: ClipTransition;
  /** Keyframe animations for this clip */
  keyframes?: Keyframe[];
  /** Speed curve for variable speed playback */
  speedCurve?: SpeedCurve;
}

export interface TimelineTrack {
  id: string;
  type: TrackType;
  label: string;
  /** Clips on this track */
  clips: TimelineClip[];
  /** Is the track muted? (audio/bgm tracks only) */
  isMuted: boolean;
  /** Is the track in solo mode? */
  isSolo: boolean;
  /** Track volume (0-1) */
  volume: number;
  /** Track color for UI */
  color: string;
  /** Is the video track hidden? (video tracks only) */
  isHidden?: boolean;
}

export interface VideoProject {
  id: string;
  title: string;
  videoUri: string;
  thumbnailUri: string | null;
  duration: number;
  createdAt: string;
  updatedAt: string;
  trimStart: number;
  trimEnd: number;
  filter: VideoFilter | null;
  textOverlay: TextOverlay | null;
  textOverlays: TextOverlay[];
  bgmTrack: BGMTrack | null;
  speed: number;
  frameLayout: FrameLayout;
  frameSlots: FrameSlot[];
  /** Multi-track timeline */
  tracks: TimelineTrack[];
}

const MAX_HISTORY = 50;

interface EditorState {
  projects: VideoProject[];
  currentProject: VideoProject | null;
  isLoading: boolean;
  activePanel: "none" | "trim" | "filter" | "text" | "music" | "speed";
  /** Undo stack – past snapshots of currentProject */
  past: VideoProject[];
  /** Redo stack – future snapshots of currentProject */
  future: VideoProject[];
}

type EditorAction =
  | { type: "SET_PROJECTS"; payload: VideoProject[] }
  | { type: "SET_CURRENT_PROJECT"; payload: VideoProject | null }
  | { type: "UPDATE_CURRENT_PROJECT"; payload: Partial<VideoProject> }
  | { type: "ADD_PROJECT"; payload: VideoProject }
  | { type: "DELETE_PROJECT"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ACTIVE_PANEL"; payload: EditorState["activePanel"] }
  | { type: "UNDO" }
  | { type: "REDO" };

const initialState: EditorState = {
  projects: [],
  currentProject: null,
  isLoading: false,
  activePanel: "none",
  past: [],
  future: [],
};

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_PROJECTS":
      return { ...state, projects: action.payload };
    case "SET_CURRENT_PROJECT":
      return { ...state, currentProject: action.payload, past: [], future: [] };
    case "UPDATE_CURRENT_PROJECT": {
      if (!state.currentProject) return state;
      const updated = { ...state.currentProject, ...action.payload, updatedAt: new Date().toISOString() };
      const newPast = [...state.past, state.currentProject].slice(-MAX_HISTORY);
      return {
        ...state,
        currentProject: updated,
        projects: state.projects.map((p) => (p.id === updated.id ? updated : p)),
        past: newPast,
        future: [],
      };
    }
    case "ADD_PROJECT":
      return { ...state, projects: [action.payload, ...state.projects] };
    case "DELETE_PROJECT":
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.payload),
        currentProject: state.currentProject?.id === action.payload ? null : state.currentProject,
      };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_ACTIVE_PANEL":
      return { ...state, activePanel: action.payload };
    case "UNDO": {
      if (state.past.length === 0 || !state.currentProject) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);
      return {
        ...state,
        currentProject: previous,
        projects: state.projects.map((p) => (p.id === previous.id ? previous : p)),
        past: newPast,
        future: [state.currentProject, ...state.future].slice(0, MAX_HISTORY),
      };
    }
    case "REDO": {
      if (state.future.length === 0 || !state.currentProject) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      return {
        ...state,
        currentProject: next,
        projects: state.projects.map((p) => (p.id === next.id ? next : p)),
        past: [...state.past, state.currentProject].slice(-MAX_HISTORY),
        future: newFuture,
      };
    }
    default:
      return state;
  }
}

// Track color palette
const TRACK_COLORS = {
  video: ["#6366F1", "#8B5CF6", "#A78BFA", "#C4B5FD"],
  audio: ["#F59E0B", "#FBBF24", "#FCD34D", "#FDE68A"],
  bgm: ["#10B981", "#34D399", "#6EE7B7", "#A7F3D0"],
};

/** Create a default video track from the main video */
export function createDefaultTracks(videoUri: string, duration: number): TimelineTrack[] {
  return [
    {
      id: `track_v1_${Date.now()}`,
      type: "video",
      label: "ビデオ 1",
      clips: [
        {
          id: `clip_v1_${Date.now()}`,
          sourceUri: videoUri,
          name: "メイン動画",
          duration,
          trimStart: 0,
          trimEnd: duration,
          timelineOffset: 0,
          speed: 1.0,
          volume: 1.0,
        },
      ],
      isMuted: false,
      isSolo: false,
      volume: 1.0,
      color: TRACK_COLORS.video[0],
      isHidden: false,
    },
    {
      id: `track_a1_${Date.now()}`,
      type: "audio",
      label: "音声 1",
      clips: [
        {
          id: `clip_a1_${Date.now()}`,
          sourceUri: videoUri,
          name: "メイン音声",
          duration,
          trimStart: 0,
          trimEnd: duration,
          timelineOffset: 0,
          speed: 1.0,
          volume: 1.0,
        },
      ],
      isMuted: false,
      isSolo: false,
      volume: 1.0,
      color: TRACK_COLORS.audio[0],
    },
  ];
}

/** Get next track color */
export function getNextTrackColor(type: TrackType, existingCount: number): string {
  const palette = TRACK_COLORS[type];
  return palette[existingCount % palette.length];
}

interface EditorContextType {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  loadProjects: () => Promise<void>;
  saveProjects: (projects: VideoProject[]) => Promise<void>;
  createProject: (videoUri: string, duration: number, thumbnailUri: string | null) => VideoProject;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const EditorContext = createContext<EditorContextType | null>(null);

const STORAGE_KEY = "video_editor_projects";

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, initialState);

  const loadProjects = useCallback(async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const projects: VideoProject[] = JSON.parse(stored);
        dispatch({ type: "SET_PROJECTS", payload: projects });
      }
    } catch (e) {
      console.warn("Failed to load projects:", e);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  const saveProjects = useCallback(async (projects: VideoProject[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      console.warn("Failed to save projects:", e);
    }
  }, []);

  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);
  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const createProject = useCallback(
    (videoUri: string, duration: number, thumbnailUri: string | null): VideoProject => {
      const now = new Date().toISOString();
      const project: VideoProject = {
        id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: `プロジェクト ${state.projects.length + 1}`,
        videoUri,
        thumbnailUri,
        duration,
        createdAt: now,
        updatedAt: now,
        trimStart: 0,
        trimEnd: duration,
        filter: null,
        textOverlay: null,
        textOverlays: [],
        bgmTrack: null,
        speed: 1.0,
        frameLayout: "single",
        frameSlots: [],
        tracks: createDefaultTracks(videoUri, duration),
      };
      dispatch({ type: "ADD_PROJECT", payload: project });
      dispatch({ type: "SET_CURRENT_PROJECT", payload: project });
      return project;
    },
    [state.projects.length]
  );

  return (
    <EditorContext.Provider value={{ state, dispatch, loadProjects, saveProjects, createProject, undo, redo, canUndo, canRedo }}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within EditorProvider");
  return ctx;
}
