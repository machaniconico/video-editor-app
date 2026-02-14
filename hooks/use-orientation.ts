import { useState, useEffect } from "react";
import { Dimensions, Platform } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";

export type OrientationMode = "portrait" | "landscape";

/**
 * Custom hook to detect and manage screen orientation.
 * Returns the current orientation mode and screen dimensions.
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState<OrientationMode>(() => {
    const { width, height } = Dimensions.get("window");
    return width > height ? "landscape" : "portrait";
  });

  const [dimensions, setDimensions] = useState(() => Dimensions.get("window"));

  useEffect(() => {
    // Listen for orientation changes via expo-screen-orientation
    if (Platform.OS !== "web") {
      const subscription = ScreenOrientation.addOrientationChangeListener(
        (evt) => {
          const o = evt.orientationInfo.orientation;
          if (
            o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
            o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
          ) {
            setOrientation("landscape");
          } else {
            setOrientation("portrait");
          }
        }
      );

      // Get initial orientation
      ScreenOrientation.getOrientationAsync().then((o) => {
        if (
          o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
        ) {
          setOrientation("landscape");
        } else {
          setOrientation("portrait");
        }
      });

      return () => {
        ScreenOrientation.removeOrientationChangeListener(subscription);
      };
    }

    // Web fallback: use Dimensions change listener
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions(window);
      setOrientation(window.width > window.height ? "landscape" : "portrait");
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Also listen for dimension changes (for both platforms)
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions(window);
    });
    return () => {
      subscription.remove();
    };
  }, []);

  return { orientation, dimensions };
}

/**
 * Unlock orientation for the current screen (allow rotation).
 * Call this in useFocusEffect to unlock when entering a screen
 * and re-lock when leaving.
 */
export async function unlockOrientation() {
  if (Platform.OS !== "web") {
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.DEFAULT
    );
  }
}

/**
 * Lock orientation to portrait only.
 */
export async function lockToPortrait() {
  if (Platform.OS !== "web") {
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP
    );
  }
}
