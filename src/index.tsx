import { h, Fragment, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

interface DeviceGroup {
  groupId: string;
  video?: MediaDeviceInfo;
  audio?: MediaDeviceInfo;
  label: string;
}

const App = () => {
  const [devices, setDevices] = useState<DeviceGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const initDevices = async () => {
      try {
        let allDevices = await navigator.mediaDevices.enumerateDevices();
        if (!allDevices.some((d) => d.label)) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
          stream.getTracks().forEach((track) => track.stop());
          allDevices = await navigator.mediaDevices.enumerateDevices();
        }

        const groups: Record<string, MediaDeviceInfo[]> = {};
        for (const device of allDevices) {
          if (!device.groupId) continue;
          const group = groups[device.groupId] || [];
          groups[device.groupId] = group;
          group.push(device);
        }

        const validGroups: DeviceGroup[] = [];

        Object.values(groups).forEach((group) => {
          const video = group.find((d) => d.kind === 'videoinput');
          const audio = group.find((d) => d.kind === 'audioinput');

          if (video && audio) {
            validGroups.push({
              groupId: video.groupId,
              video,
              audio,
              label: video.label || 'Unknown Capture Device',
            });
          }
        });

        setDevices(validGroups);
        if (validGroups[0]) {
          setSelectedGroupId(validGroups[0].groupId);
        }
      } catch (err: unknown) {
        const e = err as Error;
        setError(
          `Error: ${e.message}. Ensure HTTPS/localhost and grant permissions.`,
        );
      }
    };

    initDevices();
  }, []);

  const startStream = async () => {
    const group = devices.find((d) => d.groupId === selectedGroupId);
    if (!group || !group.video || !group.audio) return;

    const constraints: MediaStreamConstraints = {
      video: {
        deviceId: { exact: group.video.deviceId },
        width: { ideal: window.screen.width },
        height: { ideal: window.screen.height },
      },
      audio: {
        deviceId: { exact: group.audio.deviceId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);

        // Request fullscreen after state update and render
        setTimeout(async () => {
          try {
            if (videoRef.current?.requestFullscreen) {
              await videoRef.current.requestFullscreen({
                navigationUI: 'hide',
              });
            }
          } catch (e) {
            console.error('Fullscreen failed', e);
          }
        }, 100);
      }
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Failed to start stream: ${e.message}`);
    }
  };

  const handleFullscreenChange = () => {
    if (!document.fullscreenElement) {
      // Exit streaming mode
      setIsStreaming(false);
      if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream | null;
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        videoRef.current.srcObject = null;
      }
    }
  };

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <>
      {!isStreaming && (
        <div id="ui">
          {error ? (
            <p dangerouslySetInnerHTML={{ __html: error }} />
          ) : (
            <>
              <h2>Select Input</h2>
              <select
                id="device-select"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.currentTarget.value)}
              >
                {devices.map((device) => (
                  <option key={device.groupId} value={device.groupId}>
                    {device.label}
                  </option>
                ))}
              </select>
              <button
                id="start-btn"
                onClick={startStream}
                disabled={devices.length === 0}
              >
                Start TV (Fullscreen)
              </button>
            </>
          )}
        </div>
      )}

      <video
        id="tv"
        ref={videoRef}
        autoPlay
        playsInline
        style={{ display: isStreaming ? 'block' : 'none' }}
        onClick={(e) => e.preventDefault()}
        onPause={() => document.exitFullscreen()}
        disablePictureInPicture={true}
        disableRemotePlayback={true}
      />
    </>
  );
};

render(<App />, document.body);
