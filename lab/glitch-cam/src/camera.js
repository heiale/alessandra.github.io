// Accesso alla webcam. Il flusso video resta nel browser: non viene mai inviato o salvato.

/** Errore con un codice leggibile dalla UI per mostrare il messaggio giusto. */
export class CameraError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'CameraError';
    this.code = code; // 'unsupported' | 'insecure' | 'denied' | 'not-found' | 'busy' | 'unknown'
    this.cause = cause;
  }
}

/**
 * Chiede il permesso e avvia la webcam frontale.
 * @returns {Promise<{ video: HTMLVideoElement, stream: MediaStream, stop: () => void }>}
 */
export async function startCamera() {
  if (!window.isSecureContext) {
    // getUserMedia esiste solo su https o localhost.
    throw new CameraError('insecure', 'The webcam only works on an https page or locally.');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('unsupported', 'This browser can’t use the webcam.');
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        // 720p basta: il tracking lavora comunque su un'immagine ridotta e lo shader resta leggero.
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
    });
  } catch (err) {
    throw mapGetUserMediaError(err);
  }

  const video = document.createElement('video');
  // muted + playsInline sono necessari perché l'autoplay funzioni su Safari/iOS.
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.srcObject = stream;

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = () => reject(new CameraError('unknown', 'Unable to read the webcam video.'));
  });
  await video.play();

  const stop = () => {
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };

  return { video, stream, stop };
}

function mapGetUserMediaError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return new CameraError('denied', 'Webcam permission denied.', err);
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return new CameraError('not-found', 'No webcam found.', err);
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new CameraError('busy', 'The webcam is already in use or not responding.', err);
    default:
      return new CameraError('unknown', 'Unexpected error while starting the webcam.', err);
  }
}
