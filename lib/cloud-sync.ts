import AsyncStorage from "@react-native-async-storage/async-storage";
import type { VideoProject } from "./editor-context";

const SYNC_KEY = "cloud_sync_state";
const SYNC_PROJECTS_KEY = "cloud_synced_projects";

export interface CloudSyncConfig {
  enabled: boolean;
  lastSyncedAt: string | null;
  deviceId: string;
}

const DEFAULT_CONFIG: CloudSyncConfig = {
  enabled: false,
  lastSyncedAt: null,
  deviceId: `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
};

/**
 * Get the current cloud sync configuration.
 */
export async function getSyncConfig(): Promise<CloudSyncConfig> {
  try {
    const stored = await AsyncStorage.getItem(SYNC_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Update cloud sync configuration.
 */
export async function updateSyncConfig(updates: Partial<CloudSyncConfig>): Promise<CloudSyncConfig> {
  const current = await getSyncConfig();
  const updated = { ...current, ...updates };
  await AsyncStorage.setItem(SYNC_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * Sync projects to cloud storage.
 * In a real implementation, this would use a backend API (e.g., tRPC endpoint)
 * or a cloud storage service (e.g., S3, Supabase).
 *
 * For now, this provides the interface and local backup functionality.
 */
export async function syncProjects(projects: VideoProject[]): Promise<{
  success: boolean;
  syncedCount: number;
  timestamp: string;
}> {
  const config = await getSyncConfig();
  if (!config.enabled) {
    return { success: false, syncedCount: 0, timestamp: new Date().toISOString() };
  }

  try {
    // Store a backup copy of project metadata (without large binary data)
    const syncData = projects.map((p) => ({
      id: p.id,
      title: p.title,
      duration: p.duration,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      aspectRatio: p.aspectRatio,
      // Store settings but not video URIs (those are device-local)
      filter: p.filter,
      speed: p.speed,
      frameLayout: p.frameLayout,
      textOverlays: p.textOverlays,
      effects: p.effects,
      colorAdjustments: p.colorAdjustments,
    }));

    await AsyncStorage.setItem(SYNC_PROJECTS_KEY, JSON.stringify(syncData));

    const timestamp = new Date().toISOString();
    await updateSyncConfig({ lastSyncedAt: timestamp });

    // In production, this would POST to your backend:
    // await fetch(`${API_URL}/api/sync`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ deviceId: config.deviceId, projects: syncData }),
    // });

    return { success: true, syncedCount: projects.length, timestamp };
  } catch (e) {
    console.warn("Cloud sync failed:", e);
    return { success: false, syncedCount: 0, timestamp: new Date().toISOString() };
  }
}

/**
 * Restore project settings from cloud sync.
 * Returns synced project metadata that can be merged with local projects.
 */
export async function restoreFromCloud(): Promise<any[]> {
  try {
    const stored = await AsyncStorage.getItem(SYNC_PROJECTS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return [];
}
