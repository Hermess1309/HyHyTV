import type { UpdateInfo } from '../components/UpdateModal';

export const PRIMARY_VERSION_ENDPOINT = 'https://raw.githubusercontent.com/Hermess1309/HyHyTV/main/version.json';
export const FALLBACK_VERSION_ENDPOINT = 'https://files.catbox.moe/eq1n60.json';

export async function checkForAppUpdate(): Promise<UpdateInfo | null> {
  try {
    const currentCode = window.AndroidBridge?.getAppVersionCode() ?? 1;

    let res: Response | null = null;
    try {
      res = await fetch(`${PRIMARY_VERSION_ENDPOINT}?t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
    } catch {
      // Primary failed, fallback
    }

    if (!res || !res.ok) {
      try {
        res = await fetch(`${FALLBACK_VERSION_ENDPOINT}?t=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache' },
        });
      } catch {
        // Fallback failed
      }
    }

    if (!res || !res.ok) return null;
    const data = await res.json();
    if (data && typeof data.versionCode === 'number' && data.versionCode > currentCode) {
      return {
        versionCode: data.versionCode,
        versionName: data.versionName || `${data.versionCode}.0.0`,
        apkUrl: data.apkUrl,
        changelog: data.changelog || 'Bản cập nhật mới với nhiều cải tiến và hỗ trợ phụ đề tiếng Việt.',
        forceUpdate: Boolean(data.forceUpdate),
      };
    }
  } catch {
    // Continue normal app boot
  }
  return null;
}
