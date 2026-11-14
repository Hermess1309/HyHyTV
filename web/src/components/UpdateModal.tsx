import { useState, useEffect, type CSSProperties } from 'react';
import { theme } from '../styles/theme';

export interface UpdateInfo {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  changelog: string;
  forceUpdate?: boolean;
}

interface UpdateModalProps {
  updateInfo: UpdateInfo | null;
  onClose: () => void;
}

export function UpdateModal({ updateInfo, onClose }: UpdateModalProps) {
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [focusedButtonIndex, setFocusedButtonIndex] = useState<number>(0); // 0: Update, 1: Later

  useEffect(() => {
    if (!updateInfo) return;

    window.onUpdateDownloadProgress = (percent: number) => {
      setDownloadProgress(percent);
    };

    window.onUpdateDownloadComplete = () => {
      setDownloadProgress(100);
    };

    window.onUpdateDownloadError = (errMsg: string) => {
      setDownloadError(errMsg || 'Lỗi tải xuống gói cài đặt.');
      setDownloadProgress(null);
    };

    return () => {
      window.onUpdateDownloadProgress = undefined;
      window.onUpdateDownloadComplete = undefined;
      window.onUpdateDownloadError = undefined;
    };
  }, [updateInfo]);

  // TV remote navigation for modal
  useEffect(() => {
    if (!updateInfo) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (downloadProgress !== null && downloadProgress < 100) {
        // While downloading, prevent interaction
        return;
      }

      if (e.key === 'ArrowLeft' || e.keyCode === 37) {
        e.preventDefault();
        setFocusedButtonIndex(0);
      } else if (e.key === 'ArrowRight' || e.keyCode === 39) {
        if (!updateInfo.forceUpdate) {
          e.preventDefault();
          setFocusedButtonIndex(1);
        }
      } else if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        if (focusedButtonIndex === 0) {
          handleStartUpdate();
        } else {
          onClose();
        }
      } else if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 4) {
        if (!updateInfo.forceUpdate) {
          e.preventDefault();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [updateInfo, focusedButtonIndex, downloadProgress, onClose]);

  if (!updateInfo) return null;

  const handleStartUpdate = () => {
    if (window.AndroidBridge && window.AndroidBridge.downloadAndInstallUpdate) {
      setDownloadProgress(0);
      setDownloadError(null);
      window.AndroidBridge.downloadAndInstallUpdate(updateInfo.apkUrl);
    } else {
      // Browser fallback
      window.open(updateInfo.apkUrl, '_blank');
      onClose();
    }
  };

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 99999,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: theme.typography.fontFamily,
    userSelect: 'none',
  };

  const dialogCardStyle: CSSProperties = {
    background: '#181818',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: '36px 40px',
    maxWidth: 520,
    width: '90%',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.95)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  };

  const badgeStyle: CSSProperties = {
    background: '#e50914',
    color: '#fff',
    fontWeight: 800,
    fontSize: 13,
    padding: '4px 12px',
    borderRadius: 20,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  };

  const updateBtnStyle = (isFocused: boolean): CSSProperties => ({
    background: '#e50914',
    color: '#fff',
    border: isFocused ? '3.5px solid #ffffff' : '3.5px solid transparent',
    padding: '12px 28px',
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 16,
    cursor: 'pointer',
    outline: 'none',
    boxShadow: isFocused ? '0 0 20px rgba(229, 9, 20, 0.8)' : 'none',
    transition: 'all 0.2s ease',
  });

  const laterBtnStyle = (isFocused: boolean): CSSProperties => ({
    background: 'rgba(255, 255, 255, 0.12)',
    color: '#ccc',
    border: isFocused ? '3.5px solid #ffffff' : '3.5px solid transparent',
    padding: '12px 24px',
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 16,
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.2s ease',
  });

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label="Cập nhật phiên bản">
      <div style={dialogCardStyle}>
        <div style={badgeStyle}>Bản cập nhật mới</div>
        <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: '0 0 10px 0' }}>
          Đã có phiên bản v{updateInfo.versionName}
        </h2>
        <p style={{ color: '#aaa', fontSize: 14, margin: '0 0 20px 0', lineHeight: 1.5 }}>
          {updateInfo.changelog || 'Bản cập nhật mới tối ưu giao diện Netflix TV, khắc phục lỗi và hỗ trợ phụ đề tiếng Việt.'}
        </p>

        {downloadProgress !== null ? (
          <div style={{ width: '100%', margin: '16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#eee', fontSize: 14, marginBottom: 8 }}>
              <span>Đang tải xuống bản cập nhật...</span>
              <span style={{ fontWeight: 700, color: '#e50914' }}>{downloadProgress}%</span>
            </div>
            <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${downloadProgress}%`,
                  background: '#e50914',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
            {downloadProgress === 100 && (
              <div style={{ color: '#46d369', fontSize: 13, marginTop: 10 }}>
                Đang mở trình cài đặt APK...
              </div>
            )}
          </div>
        ) : (
          <>
            {downloadError && (
              <div style={{ color: '#ff4d4f', fontSize: 13, marginBottom: 16 }}>
                {downloadError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <button
                style={updateBtnStyle(focusedButtonIndex === 0)}
                onClick={handleStartUpdate}
              >
                Cập nhật ngay
              </button>
              {!updateInfo.forceUpdate && (
                <button
                  style={laterBtnStyle(focusedButtonIndex === 1)}
                  onClick={onClose}
                >
                  Để sau
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
