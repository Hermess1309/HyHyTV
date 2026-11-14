import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Shell } from './components/Shell';
import { GlobalStyles } from './components/GlobalStyles';
import { TvHintToast } from './components/TvHintToast';
import { AuthScreen } from './components/auth/AuthScreen';
import { ProfileSelectScreen } from './components/profile/ProfileSelectScreen';
import { VariantPickerScreen } from './components/variant/VariantPickerScreen';
import { UpdateModal, type UpdateInfo } from './components/UpdateModal';
import { checkForAppUpdate } from './data/versionCheck';
import { useInputNavigation } from './hooks/useInputNavigation';
import { useIsTvMode } from './hooks/useMode';
import { useCursorHide } from './hooks/useCursorHide';
import { useIsAuthenticated } from './hooks/useAuth';
import { useCurrentProfile } from './hooks/useProfile';
import { setContent, setPageContent } from './state/slices/contentSlice';
import { fetchUnifiedHomeContentProgressive } from './data/movieService';
import { VideoPlayerOverlay } from './components/VideoPlayerOverlay';
import type { RootState } from './state/store';

function TvNavigation() {
  useInputNavigation();
  return null;
}

export default function App() {
  const dispatch = useDispatch();
  const isTv = useIsTvMode();
  const isAuthed = useIsAuthenticated();
  const currentProfile = useCurrentProfile();
  const variantPickerOpen = useSelector((s: RootState) => s.ui.variantPickerOpen);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  useCursorHide();

  // Check for new version on app launch
  useEffect(() => {
    checkForAppUpdate().then((info) => {
      if (info) setUpdateInfo(info);
    });
  }, []);

  // Progressive fetch with immediate cache-first display
  useEffect(() => {
    if (!isAuthed || !currentProfile) return;

    fetchUnifiedHomeContentProgressive((rows) => {
      if (rows && rows.length > 0) {
        dispatch(setContent(rows));
        dispatch(setPageContent({ page: 'home', rows }));
      }
    });
  }, [dispatch, isAuthed, currentProfile?.id]);

  // Show the variant picker when:
  //   - profile has no variant yet (first entry), OR
  //   - the user re-opened it from Settings → "Switch experience".
  const needsVariantPicker = !!currentProfile && (!currentProfile.variant || variantPickerOpen);

  // Decide which screen to render
  let screen;
  if (!isAuthed) {
    screen = <AuthScreen />;
  } else if (!currentProfile) {
    screen = <ProfileSelectScreen />;
  } else if (needsVariantPicker) {
    screen = <VariantPickerScreen />;
  } else {
    screen = <Shell />;
  }

  // Shell-driven inputs (and the TV hint toast) should only run when the
  // actual Shell is rendering — auth, profile select, and the variant picker
  // each have their own keyboard handling.
  const shellActive = isAuthed && !!currentProfile && !needsVariantPicker;

  return (
    <>
      <GlobalStyles />
      {isTv && shellActive && <TvNavigation />}
      {screen}
      {isTv && shellActive && <TvHintToast />}
      <VideoPlayerOverlay />
      <UpdateModal updateInfo={updateInfo} onClose={() => setUpdateInfo(null)} />
    </>
  );
}
