import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { theme } from '../styles/theme';
import { getHeroImageUrl } from '../data/mockContent';
import { getTmdbBackdropUrl, getTmdbLogoUrl, fetchTrailerKey } from '../data/tmdb';
import { heroStyles } from '../styles/componentStyles/heroStyles';
import {
  selectFocus, selectRows, selectTrailerMuted, selectTrailerPaused,
  selectHeroFocused, selectHeroButtonIndex, selectTileTrailerPlaying, selectNavFocused,
} from '../state/selectors';
import { setActiveTrailer } from '../state/slices/trailerSlice';
import { openDetail, openPlayer } from '../state/slices/uiSlice';
import { fetchUnifiedEpisodes, fetchUnifiedDetail } from '../data/movieService';
import { toggleWatchlist } from '../state/slices/watchlistSlice';
import { setTrailerPaused } from '../state/slices/trailerSlice';
import { selectCurrentProfileId } from '../state/selectors';
import { YouTubePlayer } from './YouTubePlayer';
import { useIsTvMode } from '../hooks/useMode';
import { useSettings } from '../hooks/useSettings';

const HERO_BUTTONS = ['▶  Xem Phim', '+ Danh Sách'];

export const HeroBanner = memo(function HeroBanner() {
  const dispatch = useDispatch();
  const isTv = useIsTvMode();
  const currentProfileId = useSelector(selectCurrentProfileId);
  const settings = useSettings();
  const focus = useSelector(selectFocus);
  const rows = useSelector(selectRows);
  const trailerMuted = useSelector(selectTrailerMuted);
  const trailerPaused = useSelector(selectTrailerPaused);
  const heroFocused = useSelector(selectHeroFocused);
  const heroButtonIndex = useSelector(selectHeroButtonIndex);
  const tileTrailerPlaying = useSelector(selectTileTrailerPlaying);
  const navFocused = useSelector(selectNavFocused);
  const firstTile = rows[0]?.tiles[0];

  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [heroSynopsis, setHeroSynopsis] = useState<string>('');
  const delayTimerRef = useRef<number | null>(null);
  const tileIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!firstTile?.slug) {
      setHeroSynopsis('');
      return;
    }
    let cancelled = false;
    fetchUnifiedDetail(firstTile.slug).then((res) => {
      if (!cancelled && res?.synopsis) {
        setHeroSynopsis(res.synopsis);
      }
    });
    return () => { cancelled = true; };
  }, [firstTile?.slug]);

  // Should the hero trailer be active?
  // TV: when hero is focused. Web: autoplay after delay.
  // Disabled entirely if user opted out of autoplay in settings.
  const autoplayAllowed = !settings.disableAutoplay;
  const shouldPlayTrailer = autoplayAllowed && (isTv
    ? (heroFocused && !tileTrailerPlaying && !trailerPaused)
    : !trailerPaused);

  // Fetch trailer key when hero becomes focused (with delay)
  useEffect(() => {
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }

    if (!shouldPlayTrailer) {
      // Stop playing — fade back to static
      setShowVideo(false);
      setVideoPlaying(false);
      dispatch(setActiveTrailer(null));
      return;
    }

    if (!firstTile?.tmdbId || !firstTile?.mediaType) return;

    const currentTileId = firstTile.id;
    tileIdRef.current = currentTileId;

    delayTimerRef.current = window.setTimeout(async () => {
      const key = await fetchTrailerKey(firstTile.tmdbId!, firstTile.mediaType!);
      if (tileIdRef.current === currentTileId && key) {
        setTrailerKey(key);
        setShowVideo(true);
      }
    }, theme.animation.trailerDwellMs);

    return () => {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
    };
  }, [shouldPlayTrailer, firstTile?.id, firstTile?.tmdbId, firstTile?.mediaType, dispatch]);

  // Reset trailer key when tile changes
  useEffect(() => {
    setTrailerKey(null);
    setVideoPlaying(false);
    setShowVideo(false);
  }, [firstTile?.id]);

  const handlePlaying = useCallback(() => {
    setVideoPlaying(true);
    dispatch(setActiveTrailer('hero'));
  }, [dispatch]);

  const handleError = useCallback(() => {
    setShowVideo(false);
    setVideoPlaying(false);
  }, []);

  // Hide player when video ends so YouTube replay UI never shows
  const handleEnded = useCallback(() => {
    setShowVideo(false);
    setVideoPlaying(false);
    dispatch(setActiveTrailer(null));
  }, [dispatch]);

  // In TV mode, smoothly dim the banner when browsing lower content rows
  const isLowerRow = isTv && !heroFocused && !navFocused && focus.rowIndex > 0;
  const bannerHeightVh = 56;
  const bannerOpacity = isLowerRow ? 0.35 : 1;

  // Video trailer visible only when hero is focused
  const videoVisible = showVideo && Boolean(trailerKey) && !isLowerRow;

  const trailerIsLive = !!(videoPlaying && videoVisible);

  if (!firstTile) return null;

  return (
    <div style={heroStyles.container(bannerHeightVh, bannerOpacity)}>
      <img
        src={firstTile.backdropPath ? getTmdbBackdropUrl(firstTile.backdropPath, 'w1280') : getHeroImageUrl()}
        alt="Featured content"
        style={heroStyles.backdrop(videoPlaying && videoVisible ? 0 : 1)}
      />

      {videoVisible && (
        <YouTubePlayer
          videoKey={trailerKey!}
          muted={trailerMuted}
          autoplay={true}
          onPlaying={handlePlaying}
          onEnded={handleEnded}
          onError={handleError}
          style={heroStyles.videoLayer(videoPlaying)}
        />
      )}

      <div style={heroStyles.gradientLeft} />
      <div style={heroStyles.gradientBottom} />

      <div style={heroStyles.textContainer(trailerIsLive)}>
        {firstTile.logoPath ? (
          <img
            src={getTmdbLogoUrl(firstTile.logoPath)}
            alt={firstTile.title}
            style={heroStyles.logoImage}
          />
        ) : (
          <div style={heroStyles.title}>{firstTile.title}</div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, fontFamily: theme.typography.fontFamily }}>
          <span style={{ color: '#46d369', fontWeight: 700, fontSize: 14 }}>98% Phù hợp</span>
          <span style={{ color: '#ddd', fontSize: 13, fontWeight: 500 }}>{firstTile.year}</span>
          <span style={{ border: '1px solid rgba(255,255,255,0.5)', borderRadius: 3, padding: '1px 5px', color: '#eee', fontSize: 11, fontWeight: 700 }}>HD</span>
          <span style={{ border: '1px solid rgba(255,255,255,0.5)', borderRadius: 3, padding: '1px 5px', color: '#eee', fontSize: 11, fontWeight: 700 }}>16+</span>
          <span style={{ color: '#ccc', fontSize: 13 }}>{firstTile.genre}</span>
        </div>

        <div style={heroStyles.synopsis}>{heroSynopsis || firstTile.synopsis}</div>

        <div style={heroStyles.buttonsRow(isTv ? heroFocused : true)}>
          {HERO_BUTTONS.map((label, i) => {
            const isButtonFocused = isTv ? (heroFocused && i === heroButtonIndex) : false;
            const isPlayBtn = i === 0;

            const buttonStyle: React.CSSProperties = {
              padding: '12px 28px',
              borderRadius: 6,
              border: 'none',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: theme.typography.fontFamily,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.18s ease-out',
              transform: isButtonFocused ? 'scale(1.08)' : 'scale(1)',
              outline: isButtonFocused ? '3px solid #ffffff' : 'none',
              outlineOffset: '2px',
              boxShadow: isButtonFocused ? '0 8px 24px rgba(0,0,0,0.85), 0 0 16px rgba(255,255,255,0.4)' : 'none',
              background: isPlayBtn
                ? (isButtonFocused ? '#ffffff' : 'rgba(255,255,255,0.92)')
                : (isButtonFocused ? 'rgba(255,255,255,0.4)' : 'rgba(109,109,110,0.7)'),
              color: isPlayBtn ? '#000000' : '#ffffff',
            };

            return (
              <button
                key={label}
                style={buttonStyle}
                tabIndex={isTv ? -1 : 0}
                onClick={() => {
                  if (firstTile) {
                    if (i === 0) {
                      if (firstTile.slug) {
                        fetchUnifiedEpisodes(firstTile.slug, 0).then((eps) => {
                          if (eps.length > 0 && eps[0].linkEmbed) {
                            dispatch(openPlayer({
                              embedUrl: eps[0].linkEmbed,
                              title: firstTile.title,
                              episodeName: eps[0].name,
                              slug: firstTile.slug,
                              currentEpisodeIndex: 0,
                              currentSeasonIndex: 0,
                              episodes: eps.map((e) => ({ name: e.name, linkEmbed: e.linkEmbed || '' })),
                              posterPath: firstTile.posterPath || firstTile.backdropPath,
                              backdropPath: firstTile.backdropPath || firstTile.posterPath,
                            }));
                          } else {
                            dispatch(openDetail(firstTile));
                          }
                        }).catch(() => {
                          dispatch(openDetail(firstTile));
                        });
                      } else {
                        dispatch(openDetail(firstTile));
                      }
                      dispatch(setTrailerPaused(true));
                    } else if (currentProfileId) {
                      dispatch(toggleWatchlist({ profileId: currentProfileId, tile: firstTile }));
                    }
                  }
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* P-to-pause is wired via TV input navigation only — don't advertise
          it on web where the hotkey isn't actually bound. */}
      {isTv && (
        <div style={heroStyles.pauseHint(!!videoVisible && videoPlaying)}>
          <span style={heroStyles.pauseKbd}>P</span>
          <span>to pause</span>
        </div>
      )}
    </div>
  );
});
