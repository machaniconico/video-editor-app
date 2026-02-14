import React, { createContext, useContext, useReducer, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Types
export interface TextOverlay {
  text: string;
  fontSize: number;
  color: string;
  position: "top" | "center" | "bottom";
  bold: boolean;
  italic: boolean;
}

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
  bgmTrack: BGMTrack | null;
  speed: number;
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
        bgmTrack: null,
        speed: 1.0,
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
