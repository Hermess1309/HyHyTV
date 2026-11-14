import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Hls from 'hls.js';
import { selectPlayerOverlay } from '../state/selectors';
import { closePlayer, switchPlayerEpisode } from '../state/slices/uiSlice';
import { fetchVsmovEpisodes, type Episode } from '../data/vsmov';
import { theme } from '../styles/theme';

export function extractHlsUrl(embedUrl: string): string | null {
  if (!embedUrl) return null;
  if (embedUrl.includes('.m3u8')) return embedUrl;

  // Format: https://v{X}.streamvsmov.com/video/{videoHash}
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

export function VideoPlayerOverlay() {
  const dispatch = useDispatch();
  const player = useSelector(selectPlayerOverlay);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);

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
  const centerIconTimerRef = useRef<number | null>(null);

  // Subtitle management
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number>(0); // 0 = First track (Vie)

  const [episodesList, setEpisodesList] = useState<{ name: string; linkEmbed: string }[]>(player.episodes || []);

  const hlsUrl = player.embedUrl ? extractHlsUrl(player.embedUrl) : null;

  // Sync or fetch episodes if not already populated
  useEffect(() => {
    if (player.episodes && player.episodes.length > 0) {
      setEpisodesList(player.episodes);
    } else if (player.slug) {
      fetchVsmovEpisodes(player.slug, player.currentSeasonIndex || 0).then((eps: Episode[]) => {
        if (eps && eps.length > 0) {
          setEpisodesList(eps.map((e) => ({ name: e.name, linkEmbed: e.linkEmbed || '' })));
        }
      });
    }
  }, [player.episodes, player.slug, player.currentSeasonIndex]);

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
      if (!drawerOpen && !subtitleModalOpen && isPlaying) {
        setControlsVisible(false);
      }
    }, 4500);
  }, [drawerOpen, subtitleModalOpen, isPlaying]);

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
        // Default to Vietnamese track if available
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
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setIsBuffering(false);

    // Apply active subtitle track
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
  const currentIndex = player.currentEpisodeIndex ?? 0;
  const hasPrev = currentIndex > 0 && episodesList.length > 1;
  const hasNext = currentIndex < episodesList.length - 1 && episodesList.length > 1;

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
        setIsBuffering(true);
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
    resetHideTimer();
  };

  // Keyboard & Remote TV shortcuts
  useEffect(() => {
    if (!player.open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      resetHideTimer();

      // Escape / Back
      if (e.key === 'Escape' || e.key === 'Backspace' || e.keyCode === 27 || e.keyCode === 4) {
        e.preventDefault();
        e.stopPropagation();
        if (subtitleModalOpen) {
          setSubtitleModalOpen(false);
        } else if (drawerOpen) {
          setDrawerOpen(false);
        } else {
          dispatch(closePlayer());
        }
        return;
      }

      // Space / Enter -> Play / Pause
      if (e.key === ' ' || e.key === 'Enter' || e.keyCode === 13) {
        if (!drawerOpen && !subtitleModalOpen) {
          e.preventDefault();
          togglePlay();
          return;
        }
      }

      // Left -> Rewind 10s
      if (e.key === 'ArrowLeft' || e.keyCode === 37) {
        if (!drawerOpen && !subtitleModalOpen) {
          e.preventDefault();
          seekBy(-10);
          return;
        }
      }

      // Right -> Fast forward 10s
      if (e.key === 'ArrowRight' || e.keyCode === 39) {
        if (!drawerOpen && !subtitleModalOpen) {
          e.preventDefault();
          seekBy(10);
          return;
        }
      }

      // Up -> Show Controls
      if (e.key === 'ArrowUp' || e.keyCode === 38) {
        setControlsVisible(true);
        return;
      }

      // Down -> Open Episodes Drawer
      if (e.key === 'ArrowDown' || e.keyCode === 40) {
        if (!drawerOpen && !subtitleModalOpen) {
          e.preventDefault();
          setDrawerOpen(true);
        }
        return;
      }

      // N -> Next episode
      if ((e.key === 'n' || e.key === 'N') && hasNext) {
        e.preventDefault();
        handleNextEpisode();
        return;
      }

      // P -> Prev episode
      if ((e.key === 'p' || e.key === 'P') && hasPrev) {
        e.preventDefault();
        handlePrevEpisode();
        return;
      }

      // E -> Episodes Drawer
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setDrawerOpen((prev) => !prev);
        return;
      }

      // S or C -> Subtitle menu
      if (e.key === 's' || e.key === 'S' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setSubtitleModalOpen((prev) => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    player.open,
    drawerOpen,
    subtitleModalOpen,
    hasNext,
    hasPrev,
    togglePlay,
    seekBy,
    handleNextEpisode,
    handlePrevEpisode,
    dispatch,
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
    height: 80,
    zIndex: 10001,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 36px',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)',
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
    padding: '0 36px 28px',
    background: 'linear-gradient(0deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.75) 50%, transparent 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    transition: 'opacity 0.25s ease, transform 0.25s ease',
    opacity: controlsVisible && !drawerOpen && !subtitleModalOpen ? 1 : 0,
    transform: controlsVisible && !drawerOpen && !subtitleModalOpen ? 'translateY(0)' : 'translateY(20px)',
    pointerEvents: controlsVisible && !drawerOpen && !subtitleModalOpen ? 'auto' : 'none',
  };

  const netflixBtnStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(255, 255, 255, 0.12)',
    border: 'none',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '10px 16px',
    borderRadius: 6,
    fontFamily: theme.typography.fontFamily,
    transition: 'background 0.2s, transform 0.15s',
  };

  const drawerStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 380,
    maxWidth: '85vw',
    zIndex: 10005,
    background: '#141414',
    borderLeft: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '-10px 0 35px rgba(0,0,0,0.9)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
  };

  const modalBackdropStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 10010,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: theme.typography.fontFamily,
  };

  const modalBoxStyle: CSSProperties = {
    background: '#181818',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: '28px 32px',
    width: 360,
    maxWidth: '90vw',
    boxShadow: '0 16px 40px rgba(0,0,0,0.95)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  };

  return (
    <div style={overlayContainerStyle} onClick={() => resetHideTimer()}>
      <style>{`
        video::cue {
          background-color: rgba(0, 0, 0, 0.75);
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 24px;
          font-weight: 600;
          line-height: 1.4;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
          border-radius: 4px;
          padding: 4px 10px;
        }
      `}</style>

      {/* 1. Main Native Video Player */}
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

      {/* 2. Buffering Spinner (Netflix Red) */}
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
            width: 56,
            height: 56,
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
          width: 84,
          height: 84,
          borderRadius: '50%',
          background: 'rgba(18, 18, 18, 0.85)',
          border: '1.5px solid rgba(255,255,255,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 32,
          zIndex: 10000,
          pointerEvents: 'none',
        }}>
          {centerIcon === 'play' && '▶'}
          {centerIcon === 'pause' && '⏸'}
          {centerIcon === 'fwd' && '↻ 10s'}
          {centerIcon === 'rwd' && '↺ 10s'}
        </div>
      )}

      {/* 4. Top Header Bar (Authentic Netflix Style) */}
      <div style={topBarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: 'none',
              color: '#fff',
              fontSize: 22,
              width: 44,
              height: 44,
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            onClick={() => dispatch(closePlayer())}
            title="Quay lại (Esc/Back)"
          >
            ←
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#fff', fontSize: 18, fontWeight: 700, fontFamily: theme.typography.fontFamily }}>
                {player.title}
              </span>
              {player.episodeName && (
                <span style={{
                  color: '#fff',
                  background: '#e50914',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  {player.episodeName}
                </span>
              )}
            </div>
            <div style={{ color: '#aaa', fontSize: 13, marginTop: 3, fontFamily: theme.typography.fontFamily }}>
              Tập {currentIndex + 1} / {episodesList.length || 1} • Vietsub Full HD
            </div>
          </div>
        </div>

        {/* Top Right Quick Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            style={{
              ...netflixBtnStyle,
              background: subtitleModalOpen ? '#e50914' : 'rgba(255,255,255,0.15)',
            }}
            onClick={() => setSubtitleModalOpen(true)}
            title="Âm thanh & Phụ đề"
          >
            <span>💬</span>
            <span>{activeSubtitleIndex >= 0 && subtitles[activeSubtitleIndex] ? subtitles[activeSubtitleIndex].name : 'Phụ đề'}</span>
          </button>
        </div>
      </div>

      {/* 5. Bottom Netflix Hub Controls */}
      <div style={bottomBarStyle}>
        {/* Scrubber Bar Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Current elapsed time */}
          <span style={{ color: '#eee', fontSize: 13, fontWeight: 600, minWidth: 45, textAlign: 'right' }}>
            {formatTime(currentTime)}
          </span>

          {/* Progress Bar (Scrubber) */}
          <div
            ref={progressBarRef}
            style={{
              position: 'relative',
              flex: 1,
              height: 8,
              background: 'rgba(255,255,255,0.2)',
              borderRadius: 4,
              cursor: 'pointer',
              overflow: 'visible',
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
              background: 'rgba(255,255,255,0.4)',
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
              transform: 'translate(-50%, -50%)',
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 0 10px rgba(229,9,20,0.9)',
            }} />
          </div>

          {/* Countdown remaining time */}
          <span style={{ color: '#aaa', fontSize: 13, fontWeight: 600, minWidth: 50 }}>
            -{formatTime(remainingTime)}
          </span>
        </div>

        {/* Controls Bottom Row: Rewind 10s, Prev, Center Play/Pause, Next, Forward 10s, Episodes, Subtitles */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          {/* Left / Center Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Rewind 10s */}
            <button
              style={{ ...netflixBtnStyle, fontSize: 16, padding: '8px 14px' }}
              onClick={() => seekBy(-10)}
              title="Tua lại 10s (Mũi tên Trái)"
            >
              ↺ 10s
            </button>

            {/* Prev Episode */}
            <button
              style={{
                ...netflixBtnStyle,
                opacity: hasPrev ? 1 : 0.4,
                cursor: hasPrev ? 'pointer' : 'not-allowed',
              }}
              disabled={!hasPrev}
              onClick={handlePrevEpisode}
              title="Tập trước (Phím P)"
            >
              ⏮ Tập trước
            </button>

            {/* Center Play / Pause Button (Prominent 52px circle) */}
            <button
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                border: 'none',
                background: isPlaying ? 'rgba(255,255,255,0.9)' : '#e50914',
                color: isPlaying ? '#000' : '#fff',
                fontSize: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                transition: 'transform 0.15s, background 0.15s',
              }}
              onClick={togglePlay}
              title={isPlaying ? 'Tạm dừng (Space/Enter)' : 'Phát (Space/Enter)'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>

            {/* Next Episode */}
            <button
              style={{
                ...netflixBtnStyle,
                background: hasNext ? '#e50914' : 'rgba(255,255,255,0.12)',
                opacity: hasNext ? 1 : 0.4,
                cursor: hasNext ? 'pointer' : 'not-allowed',
              }}
              disabled={!hasNext}
              onClick={handleNextEpisode}
              title="Tập tiếp theo (Phím N)"
            >
              Tập tiếp ⏭
            </button>

            {/* Forward 10s */}
            <button
              style={{ ...netflixBtnStyle, fontSize: 16, padding: '8px 14px' }}
              onClick={() => seekBy(10)}
              title="Tua tới 10s (Mũi tên Phải)"
            >
              ↻ 10s
            </button>
          </div>

          {/* Right Actions: Episodes Drawer & Subtitles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Audio & Subtitles button */}
            <button
              style={{
                ...netflixBtnStyle,
                background: subtitleModalOpen ? '#e50914' : 'rgba(255,255,255,0.12)',
              }}
              onClick={() => setSubtitleModalOpen((prev) => !prev)}
              title="Âm thanh & Phụ đề (Phím S)"
            >
              <span>💬</span>
              <span>Phụ đề</span>
            </button>

            {/* Episodes Drawer Button */}
            <button
              style={{
                ...netflixBtnStyle,
                background: drawerOpen ? 'rgba(229,9,20,0.3)' : 'rgba(255,255,255,0.12)',
                border: drawerOpen ? '1.5px solid #e50914' : '1px solid transparent',
              }}
              onClick={() => setDrawerOpen((prev) => !prev)}
              title="Danh sách tập (Phím E / Mũi tên Xuống)"
            >
              <span>📑</span>
              <span>Danh sách tập</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6. Subtitles & Audio Selection Modal */}
      {subtitleModalOpen && (
        <div style={modalBackdropStyle} onClick={() => setSubtitleModalOpen(false)}>
          <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 700 }}>
                Âm thanh & Phụ đề
              </h3>
              <button
                style={{ background: 'none', border: 'none', color: '#aaa', fontSize: 20, cursor: 'pointer' }}
                onClick={() => setSubtitleModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Option: Subtitles Off */}
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeSubtitleIndex === -1 ? 'rgba(229,9,20,0.2)' : 'rgba(255,255,255,0.08)',
                  color: activeSubtitleIndex === -1 ? '#e50914' : '#fff',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onClick={() => selectSubtitle(-1)}
              >
                <span>Tắt phụ đề</span>
                {activeSubtitleIndex === -1 && <span>✓</span>}
              </button>

              {/* Subtitle track options */}
              {subtitles.map((track, idx) => (
                <button
                  key={track.url}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: activeSubtitleIndex === idx ? 'rgba(229,9,20,0.2)' : 'rgba(255,255,255,0.08)',
                    color: activeSubtitleIndex === idx ? '#e50914' : '#fff',
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onClick={() => selectSubtitle(idx)}
                >
                  <span>{track.name}</span>
                  {activeSubtitleIndex === idx && <span>✓</span>}
                </button>
              ))}

              {subtitles.length === 0 && (
                <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
                  Đang đồng bộ phụ đề từ máy chủ...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. Episodes Drawer (Right Slide-over) */}
      <div style={drawerStyle}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 700, fontFamily: theme.typography.fontFamily }}>
              Danh sách tập
            </h3>
            <span style={{ color: '#888', fontSize: 12, fontFamily: theme.typography.fontFamily }}>
              {episodesList.length} tập phim có sẵn
            </span>
          </div>
          <button
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: 22,
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
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {episodesList.map((ep, idx) => {
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={`${ep.name}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 14px',
                  borderRadius: 6,
                  border: isCurrent ? '1.5px solid #e50914' : '1px solid rgba(255,255,255,0.06)',
                  background: isCurrent ? 'rgba(229,9,20,0.2)' : 'rgba(255,255,255,0.04)',
                  color: isCurrent ? '#fff' : '#ccc',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.2s',
                  fontFamily: theme.typography.fontFamily,
                }}
                onClick={() => playEpisodeAt(idx)}
              >
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: 4,
                  background: isCurrent ? '#e50914' : 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 13,
                  color: '#fff',
                  flexShrink: 0,
                }}>
                  {isCurrent ? '▶' : idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ep.name}
                  </div>
                  <div style={{ color: '#777', fontSize: 11, marginTop: 2 }}>
                    {isCurrent ? 'Đang phát' : 'Full HD • Vietsub'}
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
