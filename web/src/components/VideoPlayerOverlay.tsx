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
  // Zones: 'controls' (bottom action buttons), 'scrubber' (progress bar), 'back' (top-left exit), 'drawer' (episodes), 'subtitle' (tracks)
  const [focusZone, setFocusZone] = useState<PlayerFocusZone>('controls');
  // 0: Rewind 10s, 1: Prev Ep, 2: Play/Pause, 3: Next Ep (Chuyển tập), 4: Fwd 10s, 5: Episodes Drawer, 6: Subtitles
  const [focusedControlIndex, setFocusedControlIndex] = useState<number>(3); // Default to "Tập tiếp ⏭" or Play
  const [focusedDrawerIndex, setFocusedDrawerIndex] = useState<number>(0);
  const [focusedSubIndex, setFocusedSubIndex] = useState<number>(0);

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

  // Sync or fetch episodes if not already populated
  useEffect(() => {
    if (player.episodes && player.episodes.length > 0) {
      setEpisodesList(player.episodes);
    } else if (player.slug) {
      fetchUnifiedEpisodes(player.slug, player.currentSeasonIndex || 0).then((eps: Episode[]) => {
        if (eps && eps.length > 0) {
          setEpisodesList(eps.map((e) => ({ name: e.name, linkEmbed: e.linkEmbed || '' })));
        }
      });
    }
  }, [player.episodes, player.slug, player.currentSeasonIndex]);

  // Sync drawer focus with current playing episode
  useEffect(() => {
    setFocusedDrawerIndex(currentIndex);
    // If series has next episode, focus "Tập tiếp ⏭" (index 3) or Play (index 2)
    setFocusedControlIndex(hasNext ? 3 : 2);
  }, [currentIndex, hasNext]);

  // Flash center action icon (Play, Pause, Forward 10s, Rewind 10s)
  const triggerCenterIcon = useCallback((icon: 'play' | 'pause' | 'fwd' | 'rwd') => {
    setCenterIcon(icon);
    if (centerIconTimerRef.current) clearTimeout(centerIconTimerRef.current);
    centerIconTimerRef.current = window.setTimeout(() => {
      setCenterIcon(null);
    }, 600);
  }, []);

  // Auto-hide controls timer
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (!drawerOpen && !subtitleModalOpen && isPlaying && autoNextCountdown === null) {
        setControlsVisible(false);
      }
    }, 5000);
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

  // Video event handlers
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    if (video.buffered.length > 0) {
      setBuffered(video.buffered.end(video.buffered.length - 1));
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

  const seekBy = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
    triggerCenterIcon(seconds > 0 ? 'fwd' : 'rwd');
    resetHideTimer();
  }, [resetHideTimer, triggerCenterIcon]);

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || !duration) return;

    const rect = bar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    video.currentTime = Math.max(0, Math.min(duration, pos * duration));
    resetHideTimer();
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
        setFocusZone('controls');
        if (e.key === 'ArrowLeft' || e.keyCode === 37) {
          e.preventDefault();
          seekBy(-10);
          return;
        }
        if (e.key === 'ArrowRight' || e.keyCode === 39) {
          e.preventDefault();
          seekBy(10);
          return;
        }
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

      // 6. MAIN CONTROLS SPATIAL NAVIGATION (Netflix TV Remote)
      if (focusZone === 'controls') {
        // Left / Right moves focus across bottom buttons
        if (e.key === 'ArrowLeft' || e.keyCode === 37) {
          e.preventDefault();
          setFocusedControlIndex((prev) => {
            let next = prev - 1;
            // Skip disabled buttons
            if (next === 1 && !hasPrev) next = 0;
            return Math.max(0, next);
          });
          return;
        }
        if (e.key === 'ArrowRight' || e.keyCode === 39) {
          e.preventDefault();
          setFocusedControlIndex((prev) => {
            let next = prev + 1;
            // Skip disabled next button if no next episode
            if (next === 3 && !hasNext) next = 4;
            return Math.min(6, next);
          });
          return;
        }
        // Up moves focus to scrubber progress bar
        if (e.key === 'ArrowUp' || e.keyCode === 38) {
          e.preventDefault();
          setFocusZone('scrubber');
          return;
        }
        // Down opens episodes drawer (Netflix TV standard)
        if (e.key === 'ArrowDown' || e.keyCode === 40) {
          e.preventDefault();
          if (episodesList.length > 0) {
            setDrawerOpen(true);
            setFocusZone('drawer');
          }
          return;
        }
        // Enter / OK executes focused button
        if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13) {
          e.preventDefault();
          switch (focusedControlIndex) {
            case 0:
              seekBy(-10);
              break;
            case 1:
              handlePrevEpisode();
              break;
            case 2:
              togglePlay();
              break;
            case 3:
              handleNextEpisode();
              break;
            case 4:
              seekBy(10);
              break;
            case 5:
              setDrawerOpen(true);
              setFocusZone('drawer');
              break;
            case 6:
              setSubtitleModalOpen(true);
              setFocusZone('subtitle');
              break;
          }
          return;
        }
      }

      // 7. SCRUBBER (PROGRESS BAR) FOCUS ZONE
      if (focusZone === 'scrubber') {
        if (e.key === 'ArrowLeft' || e.keyCode === 37) {
          e.preventDefault();
          seekBy(-10);
          return;
        }
        if (e.key === 'ArrowRight' || e.keyCode === 39) {
          e.preventDefault();
          seekBy(10);
          return;
        }
        if (e.key === 'ArrowDown' || e.keyCode === 40) {
          e.preventDefault();
          setFocusZone('controls');
          return;
        }
        if (e.key === 'ArrowUp' || e.keyCode === 38) {
          e.preventDefault();
          setFocusZone('back');
          return;
        }
        if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13) {
          e.preventDefault();
          togglePlay();
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
    handleNextEpisode,
    handlePrevEpisode,
    playEpisodeAt,
    handleClosePlayer,
    resetHideTimer,
  ]);

  if (!player.open || !player.embedUrl) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;
  const remainingTime = duration > currentTime ? duration - currentTime : 0;

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
    height: 88,
    zIndex: 10001,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 40px',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 65%, transparent 100%)',
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
    padding: '0 40px 32px',
    background: 'linear-gradient(0deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.75) 55%, transparent 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    transition: 'opacity 0.25s ease, transform 0.25s ease',
    opacity: controlsVisible && !drawerOpen && !subtitleModalOpen ? 1 : 0,
    transform: controlsVisible && !drawerOpen && !subtitleModalOpen ? 'translateY(0)' : 'translateY(20px)',
    pointerEvents: controlsVisible && !drawerOpen && !subtitleModalOpen ? 'auto' : 'none',
  };

  // Dynamic helper for Netflix control buttons with remote focus glow
  const getBtnStyle = (index: number, isAccent = false, isDisabled = false): CSSProperties => {
    const isFocused = focusZone === 'controls' && focusedControlIndex === index;
    return {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: isFocused
        ? '#ffffff'
        : isAccent
        ? '#e50914'
        : 'rgba(255, 255, 255, 0.14)',
      border: isFocused ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.08)',
      color: isFocused ? '#000000' : '#ffffff',
      fontSize: 14,
      fontWeight: 700,
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      padding: '10px 18px',
      borderRadius: 8,
      fontFamily: theme.typography.fontFamily,
      opacity: isDisabled ? 0.35 : 1,
      transform: isFocused ? 'scale(1.08)' : 'scale(1)',
      boxShadow: isFocused
        ? '0 0 20px rgba(255, 255, 255, 0.8), 0 4px 16px rgba(0,0,0,0.8)'
        : 'none',
      transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
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

      {/* 3. Center Flash Indicator (Play / Pause / Rewind / Forward) */}
      {centerIcon && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) scale(1.1)',
          width: 90,
          height: 90,
          borderRadius: '50%',
          background: 'rgba(18, 18, 18, 0.9)',
          border: '2px solid rgba(255,255,255,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 34,
          zIndex: 10000,
          pointerEvents: 'none',
          boxShadow: '0 8px 30px rgba(0,0,0,0.8)',
        }}>
          {centerIcon === 'play' && '▶'}
          {centerIcon === 'pause' && '⏸'}
          {centerIcon === 'fwd' && '↻ 10s'}
          {centerIcon === 'rwd' && '↺ 10s'}
        </div>
      )}

      {/* 4. Top Header Bar (Authentic Netflix Header) */}
      <div style={topBarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <button
            style={{
              background: focusZone === 'back' ? '#ffffff' : 'rgba(255,255,255,0.18)',
              border: focusZone === 'back' ? '2px solid #ffffff' : 'none',
              color: focusZone === 'back' ? '#000000' : '#ffffff',
              fontSize: 22,
              width: 46,
              height: 46,
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: focusZone === 'back' ? 'scale(1.15)' : 'scale(1)',
              boxShadow: focusZone === 'back' ? '0 0 16px rgba(255,255,255,0.8)' : 'none',
              transition: 'all 0.15s ease',
            }}
            onClick={handleClosePlayer}
            title="Quay lại (Esc/Back)"
          >
            ←
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: '#fff', fontSize: 20, fontWeight: 700, fontFamily: theme.typography.fontFamily }}>
                {player.title}
              </span>
              {player.episodeName && (
                <span style={{
                  color: '#fff',
                  background: '#e50914',
                  borderRadius: 4,
                  padding: '3px 10px',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: theme.typography.fontFamily,
                  letterSpacing: '0.3px',
                }}>
                  {player.episodeName}
                </span>
              )}
            </div>
            <div style={{ color: '#aaa', fontSize: 13, marginTop: 4, fontFamily: theme.typography.fontFamily }}>
              Tập {currentIndex + 1} / {episodesList.length || 1} • Vietsub Full HD • HyHyTV
            </div>
          </div>
        </div>

        {/* Top Right Quick Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255,255,255,0.18)',
            padding: '6px 12px',
            borderRadius: 6,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: theme.typography.fontFamily,
          }}>
            💬 {activeSubtitleIndex >= 0 && subtitles[activeSubtitleIndex] ? subtitles[activeSubtitleIndex].name : 'Vietsub'}
          </div>
        </div>
      </div>

      {/* 5. Bottom Netflix Hub Controls */}
      <div style={bottomBarStyle}>
        {/* Scrubber Bar Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Current elapsed time */}
          <span style={{ color: '#eee', fontSize: 14, fontWeight: 700, minWidth: 48, textAlign: 'right', fontFamily: theme.typography.fontFamily }}>
            {formatTime(currentTime)}
          </span>

          {/* Progress Bar (Scrubber) */}
          <div
            ref={progressBarRef}
            style={{
              position: 'relative',
              flex: 1,
              height: focusZone === 'scrubber' ? 10 : 7,
              background: 'rgba(255,255,255,0.25)',
              borderRadius: 5,
              cursor: 'pointer',
              overflow: 'visible',
              transition: 'height 0.15s ease',
              boxShadow: focusZone === 'scrubber' ? '0 0 12px rgba(229,9,20,0.8)' : 'none',
            }}
            onClick={handleProgressBarClick}
          >
            {/* Buffered bar */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${bufferedPercent}%`,
              background: 'rgba(255,255,255,0.45)',
              borderRadius: 5,
            }} />
            {/* Played progress bar (Netflix Red) */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${progressPercent}%`,
              background: '#e50914',
              borderRadius: 5,
            }} />
            {/* Scrubber thumb */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: `${progressPercent}%`,
              transform: 'translate(-50%, -50%)',
              width: focusZone === 'scrubber' ? 20 : 16,
              height: focusZone === 'scrubber' ? 20 : 16,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 0 12px rgba(229,9,20,0.95)',
              transition: 'width 0.15s, height 0.15s',
            }} />
          </div>

          {/* Countdown remaining time */}
          <span style={{ color: '#aaa', fontSize: 14, fontWeight: 700, minWidth: 54, fontFamily: theme.typography.fontFamily }}>
            -{formatTime(remainingTime)}
          </span>
        </div>

        {/* Controls Bottom Row: Rewind 10s, Prev, Center Play/Pause, Next (Chuyển tập), Forward 10s, Episodes, Subtitles */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          {/* Left / Center Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* 0: Rewind 10s */}
            <button
              style={getBtnStyle(0)}
              onClick={() => seekBy(-10)}
              title="Tua lại 10s (Mũi tên Trái)"
            >
              ↺ 10s
            </button>

            {/* 1: Prev Episode */}
            <button
              style={getBtnStyle(1, false, !hasPrev)}
              disabled={!hasPrev}
              onClick={handlePrevEpisode}
              title="Tập trước (Phím P)"
            >
              ⏮ Tập trước
            </button>

            {/* 2: Center Play / Pause Button (Prominent 54px circle) */}
            <button
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                border: focusZone === 'controls' && focusedControlIndex === 2 ? '3px solid #ffffff' : 'none',
                background: focusZone === 'controls' && focusedControlIndex === 2
                  ? '#ffffff'
                  : isPlaying
                  ? 'rgba(255,255,255,0.9)'
                  : '#e50914',
                color: focusZone === 'controls' && focusedControlIndex === 2
                  ? '#000000'
                  : isPlaying
                  ? '#000000'
                  : '#ffffff',
                fontSize: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transform: focusZone === 'controls' && focusedControlIndex === 2 ? 'scale(1.15)' : 'scale(1)',
                boxShadow: focusZone === 'controls' && focusedControlIndex === 2
                  ? '0 0 24px rgba(255, 255, 255, 0.9), 0 4px 16px rgba(0,0,0,0.8)'
                  : '0 4px 16px rgba(0,0,0,0.6)',
                transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onClick={togglePlay}
              title={isPlaying ? 'Tạm dừng (Space/Enter)' : 'Phát (Space/Enter)'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>

            {/* 3: NEXT EPISODE BUTTON (Nút Chuyển Tập - Prominent Netflix Button) */}
            <button
              style={{
                ...getBtnStyle(3, true, !hasNext),
                padding: '10px 20px',
              }}
              disabled={!hasNext}
              onClick={handleNextEpisode}
              title="Tập tiếp theo (Phím N)"
            >
              <span>{hasNext ? `Tập tiếp (${episodesList[currentIndex + 1]?.name || `Tập ${currentIndex + 2}`})` : 'Tập tiếp theo'}</span>
              <span>⏭</span>
            </button>

            {/* 4: Forward 10s */}
            <button
              style={getBtnStyle(4)}
              onClick={() => seekBy(10)}
              title="Tua tới 10s (Mũi tên Phải)"
            >
              ↻ 10s
            </button>
          </div>

          {/* Right Actions: Episodes Drawer & Subtitles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* 5: Episodes Drawer Button */}
            <button
              style={getBtnStyle(5)}
              onClick={() => {
                setDrawerOpen((prev) => !prev);
                setFocusZone('drawer');
              }}
              title="Danh sách tập (Phím E / Mũi tên Xuống)"
            >
              <span>📑</span>
              <span>Tập phim</span>
            </button>

            {/* 6: Audio & Subtitles button */}
            <button
              style={getBtnStyle(6)}
              onClick={() => {
                setSubtitleModalOpen((prev) => !prev);
                setFocusZone('subtitle');
              }}
              title="Âm thanh & Phụ đề (Phím S)"
            >
              <span>💬</span>
              <span>Phụ đề</span>
            </button>
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
