import React, { createContext, useContext, useReducer, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Types
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

interface EditorState {
  projects: VideoProject[];
  currentProject: VideoProject | null;
  isLoading: boolean;
  activePanel: "none" | "trim" | "filter" | "text" | "music" | "speed";
}

type EditorAction =
  | { type: "SET_PROJECTS"; payload: VideoProject[] }
  | { type: "SET_CURRENT_PROJECT"; payload: VideoProject | null }
  | { type: "UPDATE_CURRENT_PROJECT"; payload: Partial<VideoProject> }
  | { type: "ADD_PROJECT"; payload: VideoProject }
  | { type: "DELETE_PROJECT"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ACTIVE_PANEL"; payload: EditorState["activePanel"] };

const initialState: EditorState = {
  projects: [],
  currentProject: null,
  isLoading: false,
  activePanel: "none",
};

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_PROJECTS":
      return { ...state, projects: action.payload };
    case "SET_CURRENT_PROJECT":
      return { ...state, currentProject: action.payload };
    case "UPDATE_CURRENT_PROJECT":
      if (!state.currentProject) return state;
      const updated = { ...state.currentProject, ...action.payload, updatedAt: new Date().toISOString() };
      return {
        ...state,
        currentProject: updated,
        projects: state.projects.map((p) => (p.id === updated.id ? updated : p)),
      };
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
    <EditorContext.Provider value={{ state, dispatch, loadProjects, saveProjects, createProject }}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within EditorProvider");
  return ctx;
}
