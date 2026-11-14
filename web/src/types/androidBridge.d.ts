interface AndroidBridgeInterface {
  getAppVersion(): string;
  getAppVersionCode(): number;
  extractSubtitles(embedUrl: string): string;
  downloadAndInstallUpdate(apkUrl: string): void;
}

interface Window {
  AndroidBridge?: AndroidBridgeInterface;
  onUpdateDownloadProgress?: (percent: number) => void;
  onUpdateDownloadComplete?: () => void;
  onUpdateDownloadError?: (errorMsg: string) => void;
}
