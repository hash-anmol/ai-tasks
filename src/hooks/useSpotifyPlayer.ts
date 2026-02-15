"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Spotify Embed Player Hook
 *
 * Uses the Spotify Embed (oEmbed iframe) with the IFrame API for programmatic
 * play/pause control. No Premium account or OAuth required — just an embedded
 * playlist that auto-plays in the background.
 *
 * The Spotify IFrame API is loaded from:
 *   https://open.spotify.com/embed/iframe-api/v1
 *
 * It exposes window.SpotifyIframeApi which lets us create a controller
 * that can toggle playback, listen for state changes, etc.
 */

const PLAYLIST_ID = "5MxCQ5Ci3w6RZiyOEzRiAA";

export type SpotifyPlayerState =
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "error";

export function useSpotifyPlayer() {
  const [playerState, setPlayerState] = useState<SpotifyPlayerState>("loading");
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<any>(null);
  const iframeContainerRef = useRef<HTMLDivElement | null>(null);
  const readyRef = useRef(false);
  // Track whether we've ever started playback
  const hasStartedRef = useRef(false);

  /**
   * Initialize the Spotify IFrame API and create the embed controller.
   * Call this once with a container div ref.
   */
  const init = useCallback((container: HTMLDivElement | null) => {
    if (!container || readyRef.current) return;
    iframeContainerRef.current = container;

    // Load the IFrame API script if not already present
    if (!document.getElementById("spotify-iframe-api")) {
      const script = document.createElement("script");
      script.id = "spotify-iframe-api";
      script.src = "https://open.spotify.com/embed/iframe-api/v1";
      script.async = true;
      document.body.appendChild(script);
    }

    const createEmbed = () => {
      if (readyRef.current || !iframeContainerRef.current) return;

      const IFrameAPI = (window as any).SpotifyIframeApi;
      if (!IFrameAPI) return;

      readyRef.current = true;

      const options = {
        uri: `spotify:playlist:${PLAYLIST_ID}`,
        width: "100%",
        height: 80,
        // Start with it loaded but not playing (we'll auto-play when voice mode is idle)
      };

      IFrameAPI.createController(
        iframeContainerRef.current,
        options,
        (controller: any) => {
          controllerRef.current = controller;
          setPlayerState("ready");

          controller.addListener("playback_update", (e: any) => {
            if (e.data.isPaused) {
              setPlayerState("paused");
            } else {
              setPlayerState("playing");
            }
          });

          controller.addListener("ready", () => {
            setPlayerState("ready");
          });
        }
      );
    };

    // If the API is already loaded, create immediately
    if ((window as any).SpotifyIframeApi) {
      createEmbed();
    } else {
      // Wait for the API to load
      (window as any).onSpotifyIframeApiReady = (IFrameAPI: any) => {
        (window as any).SpotifyIframeApi = IFrameAPI;
        createEmbed();
      };
    }
  }, []);

  // Play / resume
  const play = useCallback(() => {
    if (!controllerRef.current) return;
    try {
      controllerRef.current.togglePlay();
      hasStartedRef.current = true;
    } catch (err: any) {
      setError(`Spotify play error: ${err.message}`);
    }
  }, []);

  // Pause
  const pause = useCallback(() => {
    if (!controllerRef.current) return;
    try {
      // togglePlay() will pause if currently playing
      controllerRef.current.togglePlay();
    } catch (err: any) {
      setError(`Spotify pause error: ${err.message}`);
    }
  }, []);

  /**
   * Resume playback. If never started, starts fresh.
   * Uses togglePlay which acts as play/pause toggle.
   */
  const resume = useCallback(() => {
    if (!controllerRef.current) return;
    try {
      controllerRef.current.togglePlay();
    } catch (err: any) {
      setError(`Spotify resume error: ${err.message}`);
    }
  }, []);

  // Destroy the embed
  const destroy = useCallback(() => {
    controllerRef.current = null;
    readyRef.current = false;
    hasStartedRef.current = false;
    if (iframeContainerRef.current) {
      iframeContainerRef.current.innerHTML = "";
    }
    setPlayerState("loading");
  }, []);

  return {
    playerState,
    error,
    hasStarted: hasStartedRef.current,
    init,
    play,
    pause,
    resume,
    destroy,
    clearError: () => setError(null),
  };
}
