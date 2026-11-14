import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Hls from 'hls.js';
import { selectPlayerOverlay } from '../state/selectors';
import { closePlayer, switchPlayerEpisode } from '../state/slices/uiSlice';
import { type Episode } from '../data/vsmov';
import { fetchUnifiedEpisodes } from '../data/movieService';
import { saveContinueWatching } from '../data/continueWatching';
import { theme } from '../styles/theme';

export function extractHlsUrl(embedUrl: string): string | null {
  if (!embedUrl) return null;

  // 1. If it contains query param url=http...m3u8 (e.g. player.phimapi.com/player/?url=...)
  if (embedUrl.includes('url=')) {
    const match = embedUrl.match(/url=([^&]+)/);
    if (match) {
      const decoded = decodeURIComponent(match[1]);
      if (decoded.includes('.m3u8')) return decoded;
    }
  }

  // 2. Direct m3u8 link or query string
  if (embedUrl.includes('.m3u8')) {
    const urlMatch = embedUrl.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
    if (urlMatch) return urlMatch[0];
    return embedUrl;
  }

  // 3. Format: https://v{X}.streamvsmov.com/video/{videoHash}
  const match = embedUrl.match(/^(https?:\/\/[^/]+)\/video\/([a-zA-Z0-9_-]+)/);
  if (match) {
    const baseUrl = match[1];
    const videoHash = match[2];
    return `${baseUrl}/stream/${videoHash}/master.m3u8`;
  }
  return null;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

// Vector SVG icons for 100% authentic Netflix TV 4K UI
const SvgBack = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const SvgPlay = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const SvgPause = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

const SvgNext = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 4 15 12 5 20 5 4" />
    <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const SvgEpisodes = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="3.5" rx="1.5" fill="currentColor" fillOpacity="0.2" />
    <rect x="3" y="10.2" width="18" height="3.5" rx="1.5" fill="currentColor" fillOpacity="0.2" />
    <rect x="3" y="16.5" width="18" height="3.5" rx="1.5" fill="currentColor" fillOpacity="0.2" />
  </svg>
);

const SvgSubtitles = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <line x1="8" y1="9" x2="16" y2="9" />
    <line x1="8" y1="13" x2="13" y2="13" />
  </svg>
);

const SvgRestart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

export interface SubtitleTrack {
  name: string;
  url: string;
  code: string;
  blobUrl?: string;
}

export async function fetchSubtitlesForEmbed(embedUrl: string): Promise<SubtitleTrack[]> {
  try {
    let jsonStr = '';
    if (window.AndroidBridge && window.AndroidBridge.extractSubtitles) {
      jsonStr = window.AndroidBridge.extractSubtitles(embedUrl);
    } else {
      const res = await fetch(embedUrl);
      if (res.ok) {
        const html = await res.text();
        const match = html.match(/subtitles\s*:\s*(\[[^\]]+\])/);
        if (match) {
          const baseUrl = embedUrl.match(/^(https?:\/\/[^/]+)/)?.[1] || '';
          jsonStr = match[1].replace(/"url":"\//g, `"url":"${baseUrl}/`);
        }
      }
    }

    if (jsonStr) {
      const rawTracks = JSON.parse(jsonStr);
      if (Array.isArray(rawTracks)) {
        const parsed: SubtitleTrack[] = [];
        for (const item of rawTracks) {
          if (item.url) {
            let label = item.name || (item.code === 'vie' ? 'Tiếng Việt (Vietsub)' : item.code);
            if (item.code === 'vie' || label.toLowerCase().includes('vie')) {
              label = 'Tiếng Việt (Vietsub)';
            } else if (item.code === 'eng' || label.toLowerCase().includes('eng')) {
              label = 'English';
            }
            parsed.push({
              name: label,
              url: item.url,
              code: item.code || 'vie',
            });
          }
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error extracting subtitles', err);
  }
  return [];
}

type PlayerFocusZone = 'controls' | 'scrubber' | 'back' | 'drawer' | 'subtitle' | 'autoNext';

export function VideoPlayerOverlay() {
  const dispatch = useDispatch();
  const player = useSelector(selectPlayerOverlay);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const centerIconTimerRef = useRef<number | null>(null);
  const drawerItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Video playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [subtitleModalOpen, setSubtitleModalOpen] = useState(false);
  const [centerIcon, setCenterIcon] = useState<'play' | 'pause' | 'fwd' | 'rwd' | null>(null);

  // TV Remote Focus Management
  // Zones: 'scrubber' (progress bar / seeking), 'controls' (bottom action buttons), 'back' (top-left exit), 'drawer' (episodes), 'subtitle' (tracks)
  const [focusZone, setFocusZone] = useState<PlayerFocusZone>('scrubber');
  // 0: Next Episode (or Play/Pause), 1: Episodes Drawer, 2: Subtitles, 3: Restart
  const [focusedControlIndex, setFocusedControlIndex] = useState<number>(0);
  const [focusedDrawerIndex, setFocusedDrawerIndex] = useState<number>(0);
  const [focusedSubIndex, setFocusedSubIndex] = useState<number>(0);

  // Seek thumbnail preview state (YouTube/Netflix style)
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const scrubCommitTimerRef = useRef<number | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameCacheRef = useRef<Map<number, string>>(new Map());
  const [previewFrameUrl, setPreviewFrameUrl] = useState<string | null>(null);

  // Auto-next episode countdown state (Netflix style)
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const autoNextTimerRef = useRef<number | null>(null);

  // Subtitle management
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number>(0); // 0 = Vietsub

  const [episodesList, setEpisodesList] = useState<{ name: string; linkEmbed: string }[]>(player.episodes || []);
  const currentIndex = player.currentEpisodeIndex ?? 0;

  const hlsUrl = player.embedUrl ? extractHlsUrl(player.embedUrl) : null;
  const hasPrev = currentIndex > 0 && episodesList.length > 1;
  const hasNext = currentIndex < episodesList.length - 1 && episodesList.length > 1;

  // Ultra-lightweight frame capture from the active hardware-accelerated video
  const captureCurrentFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return;

    try {
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
        offscreenCanvasRef.current.width = 240;
        offscreenCanvasRef.current.height = 135;
      }
      const canvas = offscreenCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
        const bucket = Math.floor(video.currentTime / 5) * 5;
        frameCacheRef.current.set(bucket, dataUrl);
        setPreviewFrameUrl(dataUrl);
      }
    } catch {
      // Gracefully ignore if cross-origin canvas security restriction
    }
  }, []);

  // Sync or fetch episodes if not already populated
  useEffect(() => {
    if (player.episodes && player.episodes.length > 0) {
      setEpisodesList(player.episodes);
    } else if (player.slug && episodesList.length === 0) {
      fetchUnifiedEpisodes(player.slug, player.currentSeasonIndex || 0).then((eps: Episode[]) => {
        if (eps && eps.length > 0) {
          setEpisodesList(eps.map((e) => ({ name: e.name, linkEmbed: e.linkEmbed || '' })));
        }
      });
    }
  }, [player.episodes, player.slug, player.currentSeasonIndex, episodesList.length]);

  // Sync drawer focus with current playing episode
  useEffect(() => {
    setFocusedDrawerIndex(currentIndex);
    setFocusedControlIndex(0);
  }, [currentIndex]);

  // Flash center action icon (Play, Pause, Forward 10s, Rewind 10s)
  const triggerCenterIcon = useCallback((icon: 'play' | 'pause' | 'fwd' | 'rwd') => {
    setCenterIcon(icon);
    if (centerIconTimerRef.current) clearTimeout(centerIconTimerRef.current);
    centerIconTimerRef.current = window.setTimeout(() => {
      setCenterIcon(null);
    }, 400);
  }, []);

  // Auto-hide controls timer
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      const isActuallyPlaying = videoRef.current ? !videoRef.current.paused : isPlaying;
      if (!drawerOpen && !subtitleModalOpen && isActuallyPlaying && autoNextCountdown === null) {
        setControlsVisible(false);
      }
    }, 4000);
  }, [drawerOpen, subtitleModalOpen, isPlaying, autoNextCountdown]);

  useEffect(() => {
    if (!player.open) return;
    resetHideTimer();

    const onActivity = () => resetHideTimer();
    window.addEventListener('mousemove', onActivity);
    return () => {
      window.removeEventListener('mousemove', onActivity);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [player.open, resetHideTimer]);

  // Extract subtitles and convert to Blob URLs for guaranteed CORS-free rendering
  useEffect(() => {
    if (!player.open || !player.embedUrl) return;

    let isMounted = true;
    fetchSubtitlesForEmbed(player.embedUrl).then(async (tracks) => {
      if (!isMounted || tracks.length === 0) return;

      const preparedTracks: SubtitleTrack[] = [];
      for (const t of tracks) {
        try {
          const res = await fetch(t.url);
          if (res.ok) {
            const vtt = await res.text();
            const blob = new Blob([vtt], { type: 'text/vtt' });
            preparedTracks.push({
              ...t,
              blobUrl: URL.createObjectURL(blob),
            });
          } else {
            preparedTracks.push(t);
          }
        } catch {
          preparedTracks.push(t);
        }
      }

      if (isMounted) {
        setSubtitles(preparedTracks);
        const vieIdx = preparedTracks.findIndex((t) => t.code === 'vie' || t.name.includes('Việt'));
        setActiveSubtitleIndex(vieIdx >= 0 ? vieIdx : 0);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [player.open, player.embedUrl]);

  // Setup HLS Video playback
  useEffect(() => {
    if (!player.open) return;

    const video = videoRef.current;
    if (!video) return;

    setIsBuffering(true);
    setAutoNextCountdown(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (hlsUrl && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        video.play().catch(() => {
          setIsPlaying(false);
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              console.warn('HLS unrecoverable error:', data);
              break;
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (hlsUrl && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.play().catch(() => {});
    }
  }, [hlsUrl, player.open]);

  // Video event handlers with 60 FPS TV performance throttling
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    // Periodically capture frames during playback (every 10s) to build up seek cache!
    const curSec = Math.floor(video.currentTime);
    if (curSec > 0 && curSec % 10 === 0) {
      captureCurrentFrame();
    }

    // Only update React currentTime state if controls are visible and seconds changed!
    if (controlsVisible) {
      setCurrentTime((prev) => (Math.floor(prev) !== curSec ? video.currentTime : prev));
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    }

    if (player.slug && video.duration > 0 && Math.abs(video.currentTime - lastSavedTimeRef.current) >= 5) {
      lastSavedTimeRef.current = video.currentTime;
      saveContinueWatching({
        id: `cw-${player.slug}`,
        slug: player.slug,
        title: player.title,
        posterPath: player.posterPath || player.backdropPath || '',
        backdropPath: player.backdropPath || player.posterPath,
        mediaType: episodesList.length > 1 ? 'tv' : 'movie',
        episodeName: player.episodeName,
        episodeIndex: currentIndex,
        currentTime: video.currentTime,
        duration: video.duration,
      });
    }
  };

  const handleClosePlayer = useCallback(() => {
    const video = videoRef.current;
    if (video && player.slug && video.duration > 0 && video.currentTime > 5) {
      saveContinueWatching({
        id: `cw-${player.slug}`,
        slug: player.slug,
        title: player.title,
        posterPath: player.posterPath || player.backdropPath || '',
        backdropPath: player.backdropPath || player.posterPath,
        mediaType: episodesList.length > 1 ? 'tv' : 'movie',
        episodeName: player.episodeName,
        episodeIndex: currentIndex,
        currentTime: video.currentTime,
        duration: video.duration,
      });
    }
    dispatch(closePlayer());
  }, [dispatch, player, currentIndex, episodesList.length]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setIsBuffering(false);

    if (video.textTracks && video.textTracks.length > 0) {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = i === activeSubtitleIndex ? 'showing' : 'disabled';
      }
    }
  };

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        triggerCenterIcon('play');
      }).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
      triggerCenterIcon('pause');
    }
    resetHideTimer();
  }, [resetHideTimer, triggerCenterIcon]);

  const commitScrub = useCallback(() => {
    if (scrubCommitTimerRef.current) {
      clearTimeout(scrubCommitTimerRef.current);
      scrubCommitTimerRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.currentTime = scrubTime;
      setCurrentTime(scrubTime);
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    }
    setIsScrubbing(false);
    resetHideTimer();
  }, [scrubTime, resetHideTimer]);

  const cancelScrub = useCallback(() => {
    if (scrubCommitTimerRef.current) {
      clearTimeout(scrubCommitTimerRef.current);
      scrubCommitTimerRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    }
    setIsScrubbing(false);
    resetHideTimer();
  }, [resetHideTimer]);

  const updateScrub = useCallback((targetTime: number) => {
    const video = videoRef.current;
    const dur = duration || video?.duration || 0;
    const clamped = Math.max(0, Math.min(dur, targetTime));
    setScrubTime(clamped);
    setIsScrubbing(true);
    setControlsVisible(true);

    // Pause video while scrubbing so playback doesn't run away in background,
    // but DO NOT seek main video currentTime during scrubbing!
    // The main background video stays paused on its current scene with zero decoder lag.
    // Only the mini preview card moves and updates its time.
    if (video && !video.paused) {
      try {
        video.pause();
      } catch {}
    }

    // 1. Immediately display cached frame if available
    const bucket = Math.floor(clamped / 5) * 5;
    const cached = frameCacheRef.current.get(bucket);
    if (cached) {
      setPreviewFrameUrl(cached);
    }

    if (scrubCommitTimerRef.current) clearTimeout(scrubCommitTimerRef.current);
    scrubCommitTimerRef.current = window.setTimeout(() => {
      commitScrub();
    }, 3500);
  }, [duration, commitScrub]);

  const handleScrubStep = useCallback((deltaSeconds: number) => {
    const video = videoRef.current;
    const baseTime = isScrubbing ? scrubTime : (video?.currentTime || 0);
    setFocusZone('scrubber');
    updateScrub(baseTime + deltaSeconds);
    triggerCenterIcon(deltaSeconds > 0 ? 'fwd' : 'rwd');
  }, [isScrubbing, scrubTime, updateScrub, triggerCenterIcon]);

  const seekBy = useCallback((seconds: number) => {
    handleScrubStep(seconds);
  }, [handleScrubStep]);

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || !duration) return;

    const rect = bar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const target = Math.max(0, Math.min(duration, pos * duration));
    updateScrub(target);
    resetHideTimer();
  };

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const target = Math.max(0, Math.min(duration, pos * duration));
    updateScrub(target);
  };

  // Episode Navigation
  const playEpisodeAt = useCallback((index: number) => {
    if (index >= 0 && index < episodesList.length) {
      const target = episodesList[index];
      if (target && target.linkEmbed) {
        dispatch(switchPlayerEpisode({
          episodeIndex: index,
          embedUrl: target.linkEmbed,
          episodeName: target.name,
        }));
        setDrawerOpen(false);
        setFocusZone('controls');
        setIsBuffering(true);
        setAutoNextCountdown(null);
        resetHideTimer();
      }
    }
  }, [episodesList, dispatch, resetHideTimer]);

  const handlePrevEpisode = useCallback(() => {
    if (hasPrev) playEpisodeAt(currentIndex - 1);
  }, [hasPrev, currentIndex, playEpisodeAt]);

  const handleNextEpisode = useCallback(() => {
    if (hasNext) playEpisodeAt(currentIndex + 1);
  }, [hasNext, currentIndex, playEpisodeAt]);

  // Handle Video Ended -> Show Netflix Auto-Next Episode prompt
  const handleVideoEnded = useCallback(() => {
    if (hasNext) {
      setAutoNextCountdown(5);
      setControlsVisible(true);
      setFocusZone('autoNext');
    }
  }, [hasNext]);

  // Auto-next countdown timer effect
  useEffect(() => {
    if (autoNextCountdown === null) return;
    if (autoNextCountdown <= 0) {
      handleNextEpisode();
      return;
    }
    autoNextTimerRef.current = window.setTimeout(() => {
      setAutoNextCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => {
      if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    };
  }, [autoNextCountdown, handleNextEpisode]);

  // Subtitle Selection
  const selectSubtitle = (index: number) => {
    setActiveSubtitleIndex(index);
    const video = videoRef.current;
    if (video && video.textTracks) {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = i === index ? 'showing' : 'disabled';
      }
    }
    setSubtitleModalOpen(false);
    setFocusZone('controls');
    resetHideTimer();
  };

  // Smooth scroll drawer item into view when navigating with remote
  useEffect(() => {
    if (drawerOpen && drawerItemRefs.current[focusedDrawerIndex]) {
      drawerItemRefs.current[focusedDrawerIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [drawerOpen, focusedDrawerIndex]);

  // Keyboard & TV Remote Navigation Engine
  useEffect(() => {
    if (!player.open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      resetHideTimer();

      // 1. BACK / ESCAPE
      if (e.key === 'Escape' || e.key === 'Backspace' || e.keyCode === 27 || e.keyCode === 4) {
        e.preventDefault();
        e.stopPropagation();

        if (isScrubbing) {
          cancelScrub();
          return;
        }

        if (autoNextCountdown !== null) {
          setAutoNextCountdown(null);
          setFocusZone('controls');
          return;
        }
        if (subtitleModalOpen) {
          setSubtitleModalOpen(false);
          setFocusZone('controls');
          return;
        }
        if (drawerOpen) {
          setDrawerOpen(false);
          setFocusZone('controls');
          return;
        }
        if (controlsVisible) {
          setControlsVisible(false);
          return;
        }
        handleClosePlayer();
        return;
      }

      // If controls are hidden, any arrow or enter wakes them up
      if (!controlsVisible && !drawerOpen && !subtitleModalOpen && autoNextCountdown === null) {
        setControlsVisible(true);
        if (e.key === 'ArrowLeft' || e.keyCode === 37) {
          e.preventDefault();
          setFocusZone('scrubber');
          handleScrubStep(-10);
          return;
        }
        if (e.key === 'ArrowRight' || e.keyCode === 39) {
          e.preventDefault();
          setFocusZone('scrubber');
          handleScrubStep(10);
          return;
        }
        setFocusZone('controls');
        if (e.key === ' ' || e.key === 'Enter' || e.keyCode === 13) {
          e.preventDefault();
          togglePlay();
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.keyCode === 38 || e.keyCode === 40) {
          e.preventDefault();
          return;
        }
      }

      // 2. AUTO-NEXT PROMPT NAVIGATION
      if (autoNextCountdown !== null) {
        if (e.key === 'Enter' || e.keyCode === 13 || e.key === ' ') {
          e.preventDefault();
          handleNextEpisode();
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.keyCode === 37 || e.keyCode === 39) {
          e.preventDefault();
          return;
        }
      }

      // 3. EPISODES DRAWER NAVIGATION
      if (drawerOpen) {
        if (e.key === 'ArrowUp' || e.keyCode === 38) {
          e.preventDefault();
          setFocusedDrawerIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (e.key === 'ArrowDown' || e.keyCode === 40) {
          e.preventDefault();
          setFocusedDrawerIndex((prev) => Math.min(episodesList.length - 1, prev + 1));
          return;
        }
        if (e.key === 'Enter' || e.keyCode === 13 || e.key === ' ') {
          e.preventDefault();
          playEpisodeAt(focusedDrawerIndex);
          return;
        }
        if (e.key === 'ArrowLeft' || e.keyCode === 37) {
          e.preventDefault();
          setDrawerOpen(false);
          setFocusZone('controls');
          return;
        }
        return;
      }

      // 4. SUBTITLE MODAL NAVIGATION
      if (subtitleModalOpen) {
        const totalSubOptions = subtitles.length + 1; // +1 for "Tắt phụ đề"
        if (e.key === 'ArrowUp' || e.keyCode === 38) {
          e.preventDefault();
          setFocusedSubIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (e.key === 'ArrowDown' || e.keyCode === 40) {
          e.preventDefault();
          setFocusedSubIndex((prev) => Math.min(totalSubOptions - 1, prev + 1));
          return;
        }
        if (e.key === 'Enter' || e.keyCode === 13 || e.key === ' ') {
          e.preventDefault();
          // index 0 is "Tắt", index 1..N are subtitles[0..N-1]
          if (focusedSubIndex === 0) {
            selectSubtitle(-1);
          } else {
            selectSubtitle(focusedSubIndex - 1);
          }
          return;
        }
        return;
      }

      // 5. DIRECT REMOTE SHORTCUT KEYS
      if ((e.key === 'n' || e.key === 'N') && hasNext) {
        e.preventDefault();
        handleNextEpisode();
        return;
      }
      if ((e.key === 'p' || e.key === 'P') && hasPrev) {
        e.preventDefault();
        handlePrevEpisode();
        return;
      }
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setDrawerOpen((prev) => !prev);
        setFocusZone('drawer');
        return;
      }
      if (e.key === 's' || e.key === 'S' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setSubtitleModalOpen((prev) => !prev);
        setFocusZone('subtitle');
        return;
      }

      // 6. MAIN CONTROLS SPATIAL NAVIGATION (Authentic Netflix TV)
      if (focusZone === 'controls') {
        // Left / Right moves focus across bottom action buttons (0..3 with wrap-around)
        if (e.key === 'ArrowLeft' || e.keyCode === 37) {
          e.preventDefault();
          setFocusedControlIndex((prev) => (prev > 0 ? prev - 1 : 3));
          return;
        }
        if (e.key === 'ArrowRight' || e.keyCode === 39) {
          e.preventDefault();
          setFocusedControlIndex((prev) => (prev < 3 ? prev + 1 : 0));
          return;
        }
        // Up moves focus back up to scrubber progress bar
        if (e.key === 'ArrowUp' || e.keyCode === 38) {
          e.preventDefault();
          setFocusZone('scrubber');
          return;
        }
        // Down dismisses controls (Authentic Netflix TV standard)
        if (e.key === 'ArrowDown' || e.keyCode === 40) {
          e.preventDefault();
          setControlsVisible(false);
          return;
        }
        // Enter / OK executes focused action
        if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13) {
          e.preventDefault();
          switch (focusedControlIndex) {
            case 0:
              if (hasNext) {
                handleNextEpisode();
              } else {
                togglePlay();
              }
              break;
            case 1:
              setDrawerOpen(true);
              setFocusZone('drawer');
              break;
            case 2:
              setSubtitleModalOpen(true);
              setFocusZone('subtitle');
              break;
            case 3:
              updateScrub(0);
              commitScrub();
              break;
          }
          return;
        }
      }

      // 7. SCRUBBER (PROGRESS BAR) FOCUS ZONE
      if (focusZone === 'scrubber') {
        if (e.key === 'ArrowLeft' || e.keyCode === 37) {
          e.preventDefault();
          handleScrubStep(-10);
          return;
        }
        if (e.key === 'ArrowRight' || e.keyCode === 39) {
          e.preventDefault();
          handleScrubStep(10);
          return;
        }
        if (e.key === 'ArrowDown' || e.keyCode === 40) {
          e.preventDefault();
          if (isScrubbing) commitScrub();
          setFocusZone('controls');
          return;
        }
        if (e.key === 'ArrowUp' || e.keyCode === 38) {
          e.preventDefault();
          if (isScrubbing) commitScrub();
          setFocusZone('back');
          return;
        }
        if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13) {
          e.preventDefault();
          if (isScrubbing) {
            commitScrub();
          } else {
            togglePlay();
          }
          return;
        }
      }

      // 8. BACK BUTTON FOCUS ZONE
      if (focusZone === 'back') {
        if (e.key === 'ArrowDown' || e.keyCode === 40) {
          e.preventDefault();
          setFocusZone('scrubber');
          return;
        }
        if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13) {
          e.preventDefault();
          handleClosePlayer();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    player.open,
    controlsVisible,
    drawerOpen,
    subtitleModalOpen,
    autoNextCountdown,
    focusZone,
    focusedControlIndex,
    focusedDrawerIndex,
    focusedSubIndex,
    hasNext,
    hasPrev,
    episodesList,
    togglePlay,
    seekBy,
    handleScrubStep,
    commitScrub,
    cancelScrub,
    isScrubbing,
    handleNextEpisode,
    handlePrevEpisode,
    playEpisodeAt,
    handleClosePlayer,
    resetHideTimer,
  ]);

  if (!player.open || !player.embedUrl) return null;

  const displayTime = isScrubbing ? scrubTime : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;
  const remainingTime = duration > displayTime ? duration - displayTime : 0;

  const overlayContainerStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: '#000',
    overflow: 'hidden',
    userSelect: 'none',
    cursor: controlsVisible ? 'default' : 'none',
  };

  const topBarStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
    zIndex: 10001,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 48px',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.6) 55%, transparent 100%)',
    transition: 'opacity 0.25s ease, transform 0.25s ease',
    opacity: controlsVisible || drawerOpen || subtitleModalOpen ? 1 : 0,
    transform: controlsVisible || drawerOpen || subtitleModalOpen ? 'translateY(0)' : 'translateY(-20px)',
    pointerEvents: controlsVisible || drawerOpen || subtitleModalOpen ? 'auto' : 'none',
  };

  const bottomBarStyle: CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10001,
    padding: '0 48px 36px',
    background: 'linear-gradient(0deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.78) 45%, rgba(0,0,0,0.2) 80%, transparent 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    transition: 'opacity 0.25s ease, transform 0.25s ease',
    opacity: controlsVisible && !drawerOpen && !subtitleModalOpen ? 1 : 0,
    transform: controlsVisible && !drawerOpen && !subtitleModalOpen ? 'translateY(0)' : 'translateY(20px)',
    pointerEvents: controlsVisible && !drawerOpen && !subtitleModalOpen ? 'auto' : 'none',
  };

  // Dynamic helper for authentic Netflix TV pill buttons with glowing remote focus
  const getBtnStyle = (index: number, isAccent = false, isDisabled = false): CSSProperties => {
    const isFocused = focusZone === 'controls' && focusedControlIndex === index;
    return {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: isFocused
        ? '#ffffff'
        : isAccent
        ? 'rgba(229, 9, 20, 0.88)'
        : 'rgba(255, 255, 255, 0.12)',
      border: isFocused
        ? '2px solid #ffffff'
        : isAccent
        ? '1.5px solid rgba(255, 255, 255, 0.25)'
        : '1.5px solid rgba(255, 255, 255, 0.15)',
      color: isFocused ? '#000000' : '#ffffff',
      fontSize: 14,
      fontWeight: 700,
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      padding: '10px 22px',
      borderRadius: 24,
      fontFamily: theme.typography.fontFamily,
      opacity: isDisabled ? 0.35 : 1,
      transform: isFocused ? 'scale(1.08)' : 'scale(1)',
      boxShadow: isFocused
        ? '0 0 24px rgba(255, 255, 255, 0.85), 0 6px 20px rgba(0,0,0,0.95)'
        : 'none',
      transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
      willChange: 'transform, box-shadow',
      backdropFilter: 'blur(10px)',
    };
  };

  const drawerStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 420,
    maxWidth: '85vw',
    zIndex: 10005,
    background: '#161616',
    borderLeft: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '-12px 0 40px rgba(0,0,0,0.95)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
  };

  const modalBackdropStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 10010,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: theme.typography.fontFamily,
  };

  const modalBoxStyle: CSSProperties = {
    background: '#181818',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 14,
    padding: '30px 36px',
    width: 400,
    maxWidth: '90vw',
    boxShadow: '0 20px 50px rgba(0,0,0,0.98)',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  };

  return (
    <div style={overlayContainerStyle} onClick={() => resetHideTimer()}>
      <style>{`
        video::cue {
          background-color: rgba(0, 0, 0, 0.8);
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 26px;
          font-weight: 700;
          line-height: 1.4;
          text-shadow: 0 2px 6px rgba(0, 0, 0, 0.95);
          border-radius: 4px;
          padding: 6px 14px;
        }
      `}</style>

      {/* 1. Main Native Video Player (Direct HLS Stream with Hardware Acceleration) */}
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#000',
        }}
        playsInline
        autoPlay
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleVideoEnded}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
      >
        {subtitles.map((sub, idx) => (
          <track
            key={sub.url}
            kind="subtitles"
            src={sub.blobUrl || sub.url}
            srcLang={sub.code}
            label={sub.name}
            default={idx === activeSubtitleIndex}
          />
        ))}
      </video>

      {/* 2. Buffering Spinner (Authentic Netflix Red) */}
      {isBuffering && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10000,
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 60,
            height: 60,
            border: '4px solid rgba(255,255,255,0.2)',
            borderTopColor: '#e50914',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      )}

      {/* 3. Sleek Netflix Center Flash Indicator */}
      {centerIcon && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 84,
          height: 84,
          borderRadius: '50%',
          background: 'rgba(12, 12, 12, 0.8)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(255, 255, 255, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          zIndex: 10000,
          pointerEvents: 'none',
          boxShadow: '0 12px 40px rgba(0,0,0,0.9), 0 0 24px rgba(229,9,20,0.3)',
        }}>
          {centerIcon === 'play' && <SvgPlay />}
          {centerIcon === 'pause' && <SvgPause />}
          {centerIcon === 'fwd' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 20 }}>↻</span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px' }}>+10s</span>
            </div>
          )}
          {centerIcon === 'rwd' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 20 }}>↺</span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px' }}>-10s</span>
            </div>
          )}
        </div>
      )}

      {/* 4. Top Header Bar (Authentic Netflix Header) */}
      <div style={topBarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, maxWidth: '75vw' }}>
          <button
            tabIndex={-1}
            onFocus={(e) => e.currentTarget.blur()}
            style={{
              background: focusZone === 'back' ? '#ffffff' : 'rgba(255,255,255,0.14)',
              border: focusZone === 'back' ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.18)',
              color: focusZone === 'back' ? '#000000' : '#ffffff',
              width: 48,
              height: 48,
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: focusZone === 'back' ? 'scale(1.12)' : 'scale(1)',
              boxShadow: focusZone === 'back' ? '0 0 20px rgba(255,255,255,0.85), 0 4px 16px rgba(0,0,0,0.8)' : 'none',
              transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              backdropFilter: 'blur(10px)',
              flexShrink: 0,
            }}
            onClick={handleClosePlayer}
            title="Quay lại (Esc/Back)"
          >
            <SvgBack />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{
              color: '#ffffff',
              fontSize: 22,
              fontWeight: 800,
              fontFamily: theme.typography.fontFamily,
              letterSpacing: '-0.3px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            }}>
              {player.title}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 4,
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: theme.typography.fontFamily,
            }}>
              {player.episodeName && (
                <span style={{
                  color: '#e50914',
                  fontWeight: 800,
                }}>
                  {player.episodeName}
                </span>
              )}
              {player.episodeName && <span>•</span>}
              <span>Tập {currentIndex + 1} / {episodesList.length || 1}</span>
              <span>•</span>
              <span>Full HD 1080p</span>
              <span>•</span>
              <span style={{ color: '#ffffff', background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: 3, fontSize: 11, fontWeight: 700 }}>
                VIETSUB
              </span>
            </div>
          </div>
        </div>

        {/* Top Right Quick Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: 'rgba(229, 9, 20, 0.88)',
            padding: '5px 12px',
            borderRadius: 4,
            color: '#fff',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '1px',
            boxShadow: '0 2px 8px rgba(229, 9, 20, 0.4)',
          }}>
            NETFLIX
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255,255,255,0.18)',
            padding: '5px 12px',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.9)',
            fontSize: 12,
            fontWeight: 700,
            backdropFilter: 'blur(8px)',
          }}>
            1080p FHD
          </div>
        </div>
      </div>

      {/* 5. Bottom Netflix Hub Controls */}
      <div style={bottomBarStyle}>
        {/* Scrubber Bar Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative' }}>
          {/* Current elapsed time */}
          <span style={{
            color: '#ffffff',
            fontSize: 15,
            fontWeight: 700,
            minWidth: 54,
            textAlign: 'right',
            fontFamily: theme.typography.fontFamily,
            fontVariantNumeric: 'tabular-nums',
            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
          }}>
            {formatTime(displayTime)}
          </span>

          {/* Progress Bar (Scrubber) */}
          <div
            ref={progressBarRef}
            style={{
              position: 'relative',
              flex: 1,
              height: focusZone === 'scrubber' ? 8 : 5,
              background: 'rgba(255,255,255,0.28)',
              borderRadius: 4,
              cursor: 'pointer',
              overflow: 'visible',
              transition: 'height 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={handleProgressBarClick}
            onMouseMove={handleProgressBarMouseMove}
          >
            {/* Floating Seek Thumbnail Preview (Matches authentic Netflix TV) */}
            {isScrubbing && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 26,
                  left: `${Math.max(6, Math.min(94, progressPercent))}%`,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  pointerEvents: 'none',
                  zIndex: 200,
                  transition: 'left 0.1s linear',
                }}
              >
                {/* Mini Video Screen (Màn hình nhỏ xem trước khi tua 16:9) */}
                <div
                  style={{
                    width: 216,
                    height: 122,
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: '#0a0a0a',
                    border: '2.5px solid #ffffff',
                    boxShadow: '0 12px 35px rgba(0,0,0,0.95), 0 0 20px rgba(229,9,20,0.5)',
                    position: 'relative',
                  }}
                >
                  <img
                    src={previewFrameUrl || player.backdropPath || player.posterPath}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />

                  {/* Gradient vignette on bottom */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, transparent 40%, rgba(0,0,0,0.85) 100%)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Top-left episode tag */}
                  {player.episodeName && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        left: 8,
                        background: '#e50914',
                        color: '#fff',
                        padding: '2px 7px',
                        borderRadius: 3,
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: 0.3,
                      }}
                    >
                      {player.episodeName}
                    </div>
                  )}

                  {/* Bottom time badge */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(0, 0, 0, 0.88)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#ffffff',
                      padding: '2px 10px',
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: 0.5,
                      fontFamily: theme.typography.fontFamily,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.8)',
                    }}
                  >
                    {formatTime(scrubTime)}
                  </div>
                </div>

                {/* Hint pill matching YouTube/Netflix TV */}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#ffffff',
                    background: 'rgba(15, 15, 15, 0.92)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    padding: '4px 14px',
                    borderRadius: 16,
                    whiteSpace: 'nowrap',
                    fontFamily: theme.typography.fontFamily,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.8)',
                  }}
                >
                  Bấm [OK] để phát từ đây
                </div>
              </div>
            )}

            {/* Buffered bar */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${bufferedPercent}%`,
              background: 'rgba(255,255,255,0.45)',
              borderRadius: 4,
            }} />
            {/* Played progress bar (Netflix Red) */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${progressPercent}%`,
              background: '#e50914',
              borderRadius: 4,
            }} />
            {/* Scrubber thumb */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: `${progressPercent}%`,
              transform: focusZone === 'scrubber' ? 'translate(-50%, -50%) scale(1.15)' : 'translate(-50%, -50%)',
              width: focusZone === 'scrubber' ? 20 : 14,
              height: focusZone === 'scrubber' ? 20 : 14,
              borderRadius: '50%',
              background: focusZone === 'scrubber' ? '#ffffff' : '#e50914',
              boxShadow: focusZone === 'scrubber'
                ? '0 0 16px rgba(229,9,20,1), 0 0 8px #ffffff'
                : '0 0 8px rgba(229,9,20,0.8)',
              transition: 'transform 0.15s ease, width 0.15s ease, height 0.15s ease, background 0.15s ease',
            }} />
          </div>

          {/* Countdown remaining time */}
          <span style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: 15,
            fontWeight: 700,
            minWidth: 58,
            fontFamily: theme.typography.fontFamily,
            fontVariantNumeric: 'tabular-nums',
            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
          }}>
            -{formatTime(remainingTime)}
          </span>
        </div>

        {/* Netflix TV Action Controls Row: Primary Action, Episodes, Subtitles, Restart */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          {/* Left Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* 0: Primary Action - Next Episode (if series) or Play/Pause */}
            <button
              tabIndex={-1}
              onFocus={(e) => e.currentTarget.blur()}
              style={getBtnStyle(0, hasNext)}
              onClick={() => {
                if (hasNext) {
                  handleNextEpisode();
                } else {
                  togglePlay();
                }
              }}
              title={hasNext ? 'Tập tiếp theo (Phím N)' : (isPlaying ? 'Tạm dừng' : 'Tiếp tục phát')}
            >
              {hasNext ? (
                <>
                  <SvgNext />
                  <span>Tập tiếp theo ({episodesList[currentIndex + 1]?.name || `Tập ${currentIndex + 2}`})</span>
                </>
              ) : (
                <>
                  {isPlaying ? <SvgPause /> : <SvgPlay />}
                  <span>{isPlaying ? 'Tạm dừng' : 'Tiếp tục phát'}</span>
                </>
              )}
            </button>

            {/* 1: Episodes Drawer (Danh sách tập) */}
            <button
              tabIndex={-1}
              onFocus={(e) => e.currentTarget.blur()}
              style={getBtnStyle(1)}
              onClick={() => {
                setDrawerOpen(true);
                setFocusZone('drawer');
              }}
              title="Danh sách tập (Phím E / Mũi tên Xuống)"
            >
              <SvgEpisodes />
              <span>Tập phim</span>
            </button>

            {/* 2: Audio & Subtitles button */}
            <button
              tabIndex={-1}
              onFocus={(e) => e.currentTarget.blur()}
              style={getBtnStyle(2)}
              onClick={() => {
                setSubtitleModalOpen(true);
                setFocusZone('subtitle');
              }}
              title="Âm thanh & Phụ đề (Phím S)"
            >
              <SvgSubtitles />
              <span>Âm thanh & Phụ đề</span>
            </button>

            {/* 3: Restart (Xem từ đầu) */}
            <button
              tabIndex={-1}
              onFocus={(e) => e.currentTarget.blur()}
              style={getBtnStyle(3)}
              onClick={() => {
                updateScrub(0);
                commitScrub();
              }}
              title="Xem lại từ đầu"
            >
              <SvgRestart />
              <span>Xem từ đầu</span>
            </button>
          </div>

          {/* Right Info: TV Remote quick navigation guide */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255, 255, 255, 0.55)', fontSize: 13, fontWeight: 600 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '5px 12px',
              borderRadius: 20,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(8px)',
            }}>
              <span style={{ color: '#ffffff', fontWeight: 800 }}>◄ / ►</span> Tua
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '5px 12px',
              borderRadius: 20,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(8px)',
            }}>
              <span style={{ color: '#ffffff', fontWeight: 800 }}>▲</span> Lên thanh tua
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '5px 12px',
              borderRadius: 20,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(8px)',
            }}>
              <span style={{ color: '#ffffff', fontWeight: 800 }}>▼</span> Ẩn
            </span>
          </div>
        </div>
      </div>

      {/* 6. Netflix Auto-Next Episode Overlay Prompt */}
      {autoNextCountdown !== null && hasNext && (
        <div style={{
          position: 'absolute',
          bottom: 120,
          right: 40,
          zIndex: 10006,
          background: 'rgba(20, 20, 20, 0.95)',
          border: '1.5px solid #e50914',
          borderRadius: 12,
          padding: '20px 24px',
          boxShadow: '0 12px 35px rgba(0,0,0,0.95)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          minWidth: 320,
          fontFamily: theme.typography.fontFamily,
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#aaa', fontSize: 13, fontWeight: 600 }}>Tập tiếp theo tự động phát sau:</span>
            <span style={{
              background: '#e50914',
              color: '#fff',
              fontWeight: 800,
              fontSize: 16,
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {autoNextCountdown}s
            </span>
          </div>

          <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
            {episodesList[currentIndex + 1]?.name || `Tập ${currentIndex + 2}`}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              style={{
                flex: 1,
                background: '#e50914',
                color: '#fff',
                border: 'none',
                padding: '10px 16px',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              onClick={handleNextEpisode}
            >
              ▶ Phát ngay
            </button>
            <button
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                border: 'none',
                padding: '10px 16px',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => setAutoNextCountdown(null)}
            >
              ✕ Hủy
            </button>
          </div>
        </div>
      )}

      {/* 7. Subtitles & Audio Selection Modal */}
      {subtitleModalOpen && (
        <div style={modalBackdropStyle} onClick={() => setSubtitleModalOpen(false)}>
          <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 700 }}>
                Âm thanh & Phụ đề
              </h3>
              <button
                style={{ background: 'none', border: 'none', color: '#aaa', fontSize: 22, cursor: 'pointer' }}
                onClick={() => setSubtitleModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Option 0: Subtitles Off */}
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: focusedSubIndex === 0 ? '2px solid #ffffff' : 'none',
                  background: activeSubtitleIndex === -1
                    ? 'rgba(229,9,20,0.3)'
                    : focusedSubIndex === 0
                    ? 'rgba(255,255,255,0.2)'
                    : 'rgba(255,255,255,0.08)',
                  color: activeSubtitleIndex === -1 ? '#e50914' : '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transform: focusedSubIndex === 0 ? 'scale(1.02)' : 'scale(1)',
                }}
                onClick={() => selectSubtitle(-1)}
              >
                <span>Tắt phụ đề</span>
                {activeSubtitleIndex === -1 && <span>✓</span>}
              </button>

              {/* Subtitle track options */}
              {subtitles.map((track, idx) => {
                const isSelected = activeSubtitleIndex === idx;
                const isFocused = focusedSubIndex === idx + 1;
                return (
                  <button
                    key={track.url}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 8,
                      border: isFocused ? '2px solid #ffffff' : 'none',
                      background: isSelected
                        ? 'rgba(229,9,20,0.3)'
                        : isFocused
                        ? 'rgba(255,255,255,0.2)'
                        : 'rgba(255,255,255,0.08)',
                      color: isSelected ? '#e50914' : '#fff',
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transform: isFocused ? 'scale(1.02)' : 'scale(1)',
                    }}
                    onClick={() => selectSubtitle(idx)}
                  >
                    <span>{track.name}</span>
                    {isSelected && <span>✓</span>}
                  </button>
                );
              })}

              {subtitles.length === 0 && (
                <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
                  Đang đồng bộ phụ đề từ máy chủ...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. Episodes Drawer (Right Slide-over with TV Remote Support) */}
      <div style={drawerStyle}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 24px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
        }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700, fontFamily: theme.typography.fontFamily }}>
              Danh sách tập
            </h3>
            <span style={{ color: '#888', fontSize: 13, fontFamily: theme.typography.fontFamily }}>
              {episodesList.length} tập phim có sẵn
            </span>
          </div>
          <button
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: 24,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
            onClick={() => setDrawerOpen(false)}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Episodes List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {episodesList.map((ep, idx) => {
            const isCurrent = idx === currentIndex;
            const isFocused = drawerOpen && idx === focusedDrawerIndex;

            return (
              <button
                key={`${ep.name}-${idx}`}
                ref={(el) => { drawerItemRefs.current[idx] = el; }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: isFocused
                    ? '2px solid #ffffff'
                    : isCurrent
                    ? '1.5px solid #e50914'
                    : '1px solid rgba(255,255,255,0.08)',
                  background: isFocused
                    ? 'rgba(255, 255, 255, 0.22)'
                    : isCurrent
                    ? 'rgba(229,9,20,0.22)'
                    : 'rgba(255,255,255,0.05)',
                  color: isFocused ? '#ffffff' : isCurrent ? '#fff' : '#ccc',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transform: isFocused ? 'scale(1.02)' : 'scale(1)',
                  boxShadow: isFocused ? '0 0 16px rgba(255,255,255,0.5)' : 'none',
                  transition: 'all 0.15s ease',
                  fontFamily: theme.typography.fontFamily,
                }}
                onClick={() => playEpisodeAt(idx)}
              >
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 6,
                  background: isCurrent ? '#e50914' : 'rgba(255,255,255,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                  color: '#fff',
                  flexShrink: 0,
                }}>
                  {isCurrent ? '▶' : idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700,
                    fontSize: 15,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: isCurrent ? '#e50914' : '#fff',
                  }}>
                    {ep.name}
                  </div>
                  <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                    {isCurrent ? '● Đang phát' : 'Full HD • Vietsub'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
