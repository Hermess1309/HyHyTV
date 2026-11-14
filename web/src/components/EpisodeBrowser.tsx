import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useDispatch } from 'react-redux';
import { theme } from '../styles/theme';
import { fetchUnifiedSeasons, fetchUnifiedEpisodes } from '../data/movieService';
import { fetchTvSeasons, fetchEpisodes, getTmdbStillUrl } from '../data/tmdb';
import type { SeasonSummary, Episode } from '../data/vsmov';
import { openPlayer } from '../state/slices/uiSlice';
import type { CSSProperties } from 'react';

interface EpisodeBrowserProps {
  tvId: number;
  slug?: string;
  movieTitle?: string;
  isTv: boolean;
  focusedZone?: 'seasons' | 'episodes' | null;
  focusedSeason?: number;
  focusedEpisode?: number;
}

export function EpisodeBrowser({
  tvId,
  slug,
  movieTitle = '',
  isTv,
  focusedZone = null,
  focusedSeason = 0,
  focusedEpisode = -1,
}: EpisodeBrowserProps) {
  const dispatch = useDispatch();
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [webActiveSeason, setWebActiveSeason] = useState(0);
  const activeSeason = isTv ? Math.max(0, Math.min(focusedSeason, Math.max(0, seasons.length - 1))) : webActiveSeason;
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const focusedEpisodeRef = useRef<HTMLDivElement>(null);
  const seasonTabsRef = useRef<HTMLDivElement>(null);
  const focusedSeasonTabRef = useRef<HTMLButtonElement>(null);

  // Fetch seasons / servers on mount
  useEffect(() => {
    let cancelled = false;
    const fetchFunc = slug
      ? fetchUnifiedSeasons(slug)
      : fetchTvSeasons(tvId);

    fetchFunc.then((s) => {
      if (!cancelled && s.length > 0) {
        setSeasons(s);
        setWebActiveSeason(0);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tvId, slug]);

  // Fetch episodes when active season changes
  useEffect(() => {
    if (seasons.length === 0) return;
    const season = seasons[activeSeason];
    if (!season) return;
    let cancelled = false;

    const fetchEpFunc = slug
      ? fetchUnifiedEpisodes(slug, activeSeason)
      : fetchEpisodes(tvId, season.seasonNumber);

    fetchEpFunc.then((eps) => {
      if (!cancelled) setEpisodes(eps);
    });
    return () => { cancelled = true; };
  }, [tvId, slug, activeSeason, seasons]);

  // Auto-scroll when navigating in TV mode
  useLayoutEffect(() => {
    if (!isTv) return;
    if (focusedZone === 'episodes' && focusedEpisodeRef.current) {
      focusedEpisodeRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else if (focusedZone === 'seasons') {
      seasonTabsRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      focusedSeasonTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }, [isTv, focusedZone, focusedEpisode, focusedSeason]);

  const handlePlayEpisode = (ep: Episode) => {
    if (ep.linkEmbed) {
      const epIdx = episodes.findIndex((e) => e.name === ep.name);
      dispatch(openPlayer({
        embedUrl: ep.linkEmbed,
        title: movieTitle || ep.name,
        episodeName: ep.name,
        slug,
        currentEpisodeIndex: epIdx >= 0 ? epIdx : 0,
        currentSeasonIndex: activeSeason,
        episodes: episodes.map((e) => ({ name: e.name, linkEmbed: e.linkEmbed || '' })),
      }));
    }
  };

  const container: CSSProperties = {
    padding: isTv ? '16px 48px 32px' : '16px 32px 24px',
    fontFamily: theme.typography.fontFamily,
    animation: 'overlay-item-in 380ms cubic-bezier(0.22, 1, 0.36, 1) both',
  };

  if (loading || seasons.length === 0) return null;

  const seasonTabs: CSSProperties = {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
    overflowX: 'auto',
    scrollbarWidth: 'none',
  };

  return (
    <div style={container}>
      {/* Season / Server tabs */}
      <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
        Danh sách tập & Máy chủ
      </div>
      <div ref={seasonTabsRef} style={seasonTabs as CSSProperties}>
        {seasons.map((s, i) => {
          const isActive = i === activeSeason;
          const isFocusedTab = isTv && focusedZone === 'seasons' && i === focusedSeason;
          const tabStyle: CSSProperties = {
            padding: '6px 16px',
            borderRadius: 6,
            border: isFocusedTab ? '2px solid #ffffff' : '2px solid transparent',
            background: isActive ? 'rgba(229,9,20,0.8)' : 'rgba(255,255,255,0.06)',
            boxShadow: isFocusedTab
              ? '0 0 0 1px rgba(255,255,255,0.4), 0 0 16px rgba(229,9,20,0.5)'
              : 'none',
            color: '#fff',
            fontSize: 13,
            fontWeight: isActive ? 600 : 400,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            fontFamily: theme.typography.fontFamily,
            outline: 'none',
            transition: 'background 60ms ease-out, color 60ms ease-out',
          };
          return (
            <button
              key={s.seasonNumber}
              ref={isFocusedTab ? focusedSeasonTabRef : null}
              style={tabStyle}
              onClick={() => setWebActiveSeason(i)}
            >
              {s.name}
            </button>
          );
        })}
      </div>

      {/* Episode list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {episodes.map((ep, i) => {
          const clampedFocus = Math.max(0, Math.min(focusedEpisode, episodes.length - 1));
          const isFocusedEp = isTv && focusedZone === 'episodes' && i === clampedFocus;
          const epStyle: CSSProperties = {
            display: 'flex',
            gap: 16,
            padding: 12,
            borderRadius: 8,
            position: 'relative',
            background: isFocusedEp ? 'rgba(229,9,20,0.25)' : 'rgba(255,255,255,0.04)',
            border: isFocusedEp ? '3px solid #E50914' : '3px solid transparent',
            boxShadow: isFocusedEp
              ? '0 0 0 1px rgba(255,255,255,0.4), 0 0 20px rgba(229,9,20,0.4), 0 6px 20px rgba(0,0,0,0.5)'
              : 'none',
            outline: 'none',
            transition: 'background 60ms ease-out',
            cursor: 'pointer',
          };

          return (
            <div
              key={ep.episodeNumber}
              ref={isFocusedEp ? focusedEpisodeRef : null}
              style={epStyle}
              onClick={() => handlePlayEpisode(ep)}
            >
              {/* Episode thumbnail */}
              <div style={{
                width: isTv ? 180 : 140,
                height: isTv ? 100 : 80,
                borderRadius: 4,
                overflow: 'hidden',
                flexShrink: 0,
                background: '#222',
                position: 'relative',
              }}>
                {ep.stillPath && (
                  <img
                    src={getTmdbStillUrl(ep.stillPath)}
                    alt={ep.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                )}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.3)',
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'rgba(229,9,20,0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 14,
                    paddingLeft: 2,
                  }}>
                    {'\u25B6'}
                  </div>
                </div>
              </div>

              {/* Episode info */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: theme.typography.fontFamily }}>
                    {ep.name}
                  </div>
                </div>
                <div style={{
                  color: theme.colors.textSecondary,
                  fontSize: 13,
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  fontFamily: theme.typography.fontFamily,
                }}>
                  {ep.overview}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
