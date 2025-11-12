import { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export default function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const checkForUpdate = async () => {
    try {
      setError(null);
      const update = await check();

      if (update?.available) {
        setUpdateInfo(update);
        setUpdateAvailable(true);
        setShowModal(true);
      }

      return update;
    } catch (err) {
      console.error('Update check failed:', err);
      setError(err.message);
      return null;
    }
  };

  const downloadAndInstall = async () => {
    if (!updateInfo) return;

    try {
      setDownloading(true);
      setError(null);

      await updateInfo.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            setDownloadProgress(0);
            break;
          case 'Progress':
            if (event.data.contentLength) {
              const progress = (event.data.chunkLength / event.data.contentLength) * 100;
              setDownloadProgress(Math.round(progress));
            }
            break;
          case 'Finished':
            setDownloadProgress(100);
            break;
        }
      });

      await relaunch();
    } catch (err) {
      console.error('Update installation failed:', err);
      setError(err.message);
      setDownloading(false);
    }
  };

  useEffect(() => {
    const handleCheckUpdate = () => {
      checkForUpdate();
    };

    window.addEventListener('check-for-update', handleCheckUpdate);
    return () => window.removeEventListener('check-for-update', handleCheckUpdate);
  }, []);

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          {downloading ? 'Downloading Update...' : 'Update Available'}
        </h2>

        {error ? (
          <div className="mb-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : (
          <div className="mb-4">
            {downloading ? (
              <div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-2">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {downloadProgress}% complete
                </p>
              </div>
            ) : (
              <div>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  Version {updateInfo?.version} is now available
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Would you like to download and install it now?
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          {!downloading && (
            <>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                Later
              </button>
              <button
                onClick={downloadAndInstall}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors"
              >
                Update Now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
