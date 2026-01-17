import React, { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { getStorage, ref as storageRef, getBlob } from 'firebase/storage';

interface PreExamVerificationProps {
  userId: string;
  examTitle: string;
  proctoringPhotos: {
    front: string | null;
    left: string | null;
    right: string | null;
  };
  onSuccess: (deviceId: string) => void;
  onCancel: () => void;
}

const PreExamVerification: React.FC<PreExamVerificationProps> = ({
  userId,
  examTitle,
  proctoringPhotos,
  onSuccess,
  onCancel,
}) => {
  // --- STATE: SYSTEM ---
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  
  // --- STATE: FACE VERIFICATION ---
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'failed'>('idle');
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [baselineDescriptors, setBaselineDescriptors] = useState<Float32Array[]>([]);
  const [baselineLoaded, setBaselineLoaded] = useState(false);
  const [countdown, setCountdown] = useState<number>(10); // Countdown from 10 seconds
  
  // --- STATE: AUDIO VERIFICATION ---
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioVerified, setAudioVerified] = useState(false);
  const [isVirtualMic, setIsVirtualMic] = useState(false);

  // --- REFS ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioInitializedRef = useRef<boolean>(false); // Prevent double initialization
  const audioDetectionStartRef = useRef<number | null>(null); // Track when audio was first detected
  const audioVerifiedRef = useRef<boolean>(false); // Track verification status to avoid closure issues

  // 1. Load face-api models FIRST (Priority)
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('🧠 Loading AI models...');
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        setModelsLoaded(true);
        console.log('✅ Face-api models loaded');
      } catch (error) {
        console.error('❌ Error loading face-api models:', error);
        setErrorMessage('Failed to load face detection models');
      }
    };
    loadModels();
  }, []);

  // 2. Load baseline face descriptors (Runs after models load)
  useEffect(() => {
    const loadBaselineDescriptors = async () => {
      if (!modelsLoaded) return;
      
      const { front, left, right } = proctoringPhotos;
      if (!front || !left || !right) {
        setErrorMessage('Baseline photos not found. Please complete ID verification first.');
        return;
      }

      console.log('👤 Processing baseline photos...');
      try {
        const descriptors: Float32Array[] = [];
        const photos = [{ url: front, name: 'front' }, { url: left, name: 'left' }, { url: right, name: 'right' }];
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        for (const photo of photos) {
          try {
            let detection;
            if (isLocalhost) {
              const urlMatch = photo.url.match(/\/o\/(.+?)\?/);
              if (urlMatch) {
                const storagePath = decodeURIComponent(urlMatch[1]);
                const storage = getStorage();
                const blob = await getBlob(storageRef(storage, storagePath));
                const img = await createImageBitmap(blob);
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0);
                detection = await faceapi.detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })).withFaceLandmarks().withFaceDescriptor();
              }
            } else {
              const img = await faceapi.fetchImage(photo.url);
              detection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })).withFaceLandmarks().withFaceDescriptor();
            }
            if (detection) descriptors.push(detection.descriptor);
          } catch (err) { console.error(err); }
        }

        if (descriptors.length === 0) {
          setErrorMessage('Could not load baseline photos. Please retake ID photos.');
          return;
        }
        setBaselineDescriptors(descriptors);
        setBaselineLoaded(true);
        console.log('✅ Baseline descriptors ready');
      } catch (error) {
        setErrorMessage('Failed to load baseline photos');
      }
    };
    loadBaselineDescriptors();
  }, [modelsLoaded, proctoringPhotos]);

  // 3. Initialize Camera & Microphones IMMEDIATELY (in parallel with AI)
  useEffect(() => {
    const initDevices = async () => {
      if (audioInitializedRef.current) {
        console.log('⚠️ Audio already initialized, skipping...');
        return;
      }
      audioInitializedRef.current = true;
      
      console.log('📷 Initializing camera and audio devices...');
      
      // Initialize Camera (VIDEO ONLY - no audio here)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480, facingMode: 'user' }
          // NO AUDIO - we request it separately in startAudioMonitoring
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
        console.log('✅ Camera initialized');
        setIsCameraLoading(false);
      } catch (cameraError) {
        console.error('❌ Camera access denied:', cameraError);
        setErrorMessage('Camera access denied. Please enable camera permissions.');
        setIsCameraLoading(false);
      }

      // Initialize Microphones (ALWAYS run, even if camera fails)
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        console.log('🎙️ Found audio devices:', audioInputs.length, audioInputs.map(d => d.label));
        setAudioDevices(audioInputs);
        
        // Auto-select first device if available
        if (audioInputs.length > 0) {
          console.log('🎯 About to call startAudioMonitoring with device:', audioInputs[0].deviceId, audioInputs[0].label);
          startAudioMonitoring(audioInputs[0].deviceId);
        } else {
          console.log('⚠️ No audio devices found!');
          setErrorMessage('No microphones detected. Please connect a microphone.');
        }
      } catch (audioError) {
        console.error('❌ Audio enumeration error:', audioError);
        setErrorMessage('Failed to detect microphones.');
      }
    };

    initDevices();

    return () => {
      console.log('🧹 Cleanup called');
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      stopAudioMonitoring();
    };
  }, []);

  // 4. Start Audio Monitoring for selected device
  const startAudioMonitoring = async (deviceId: string) => {
    console.log('🔄 Starting audio monitoring for device:', deviceId);
    stopAudioMonitoring();
    setSelectedAudioDeviceId(deviceId);
    setAudioVerified(false);
    audioVerifiedRef.current = false; // Reset ref
    console.log('⚠️ audioVerified reset to FALSE');

    // Check for Virtual Driver Keywords (ONLY actual virtual drivers, not built-in mics)
    const selectedDevice = audioDevices.find(d => d.deviceId === deviceId);
    if (selectedDevice) {
      const label = selectedDevice.label.toLowerCase();
      console.log('🎙️ Selected device label:', label);
      // 🚨 FIXED: Only flag actual virtual audio drivers, exclude "built-in" and physical devices
      const isVirtual = (
        (label.includes('virtual') && !label.includes('built-in')) ||
        label.includes('cable') ||
        label.includes('stereo mix') ||
        (label.includes('byom') && label.includes('virtual'))
      );
      setIsVirtualMic(isVirtual);
      console.log('🚨 Virtual mic detected:', isVirtual);
    }

    try {
      console.log('📡 Requesting audio stream...');
      
      // Wait a bit to ensure camera stream releases any audio claims
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: false
        } 
      });
      audioStreamRef.current = stream;
      console.log('✅ Audio stream acquired');

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 256;
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      console.log('✅ AudioContext created, starting visualizer...');
      drawAudioVisualizer();
    } catch (error) {
      console.error('❌ Audio monitoring error:', error);
      
      // If audio fails, auto-verify after showing error
      setErrorMessage('Microphone unavailable. Audio verification skipped.');
      setTimeout(() => {
        console.log('⚠️ Auto-verifying audio due to error');
        setAudioVerified(true);
      }, 2000);
    }
  };

  const stopAudioMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    setAudioLevel(0);
  };

  const drawAudioVisualizer = () => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const update = () => {
      if (!analyserRef.current || !audioContextRef.current || audioContextRef.current.state === 'closed') {
        console.log('❌ Audio monitoring stopped - analyser or context closed');
        setAudioLevel(0);
        return;
      }
      
      // Resume AudioContext if suspended
      if (audioContextRef.current.state === 'suspended') {
        console.log('⚠️ AudioContext suspended, resuming...');
        audioContextRef.current.resume();
      }
      
      // ✅ FIX: Use Time Domain Data (Waveform) instead of Frequency
      // This measures actual volume deviation, fixing the "always 100%" bug
      analyserRef.current.getByteTimeDomainData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const x = dataArray[i] - 128; // 128 is silence (midpoint)
        sum += x * x;
      }
      
      // Calculate RMS (Root Mean Square) -> "Loudness"
      const rms = Math.sqrt(sum / dataArray.length);
      
      // Scale RMS to 0-100 range (RMS usually 0-50 for speech)
      const volume = Math.min(100, Math.round(rms * 5));
      
      setAudioLevel(volume);

      // ✅ FIX: Move requestAnimationFrame BEFORE verification check to prevent freezing
      animationFrameRef.current = requestAnimationFrame(update);

      // Check ref instead of state to avoid stale closure
      if (audioVerifiedRef.current) {
        return; // Already verified, skip verification logic but loop continues
      }

      // Track continuous audio detection (threshold raised to 10 for RMS-based volume)
      if (volume > 10) {
        if (!audioDetectionStartRef.current) {
          audioDetectionStartRef.current = Date.now();
          console.log('🎤 Audio detection started');
        }
        
        // Fallback: If audio detected for 2 seconds straight, force verification
        const detectionDuration = Date.now() - audioDetectionStartRef.current;
        if (detectionDuration > 2000) {
          console.log(`✅ Audio verified after ${detectionDuration}ms of continuous detection! Level: ${volume}`);
          audioVerifiedRef.current = true;
          setAudioVerified(true);
          return;
        }
      } else {
        audioDetectionStartRef.current = null;
      }

      // ✅ Immediate verification on audio activity above threshold
      if (volume > 10) {
        console.log(`✅ Audio verified immediately! Level: ${volume}`);
        audioVerifiedRef.current = true;
        setAudioVerified(true);
      }
      
      // Additional logging for debugging
      if (volume > 5) {
        console.log(`🎤 Audio level: ${volume}, verified: ${audioVerifiedRef.current}`);
      }
    };
    update();
  };

  // ✅ Step 1: Verify face only (no fullscreen, no auto-start)
  const verifyFace = async () => {
    if (!videoRef.current || !canvasRef.current || baselineDescriptors.length === 0) return;

    setIsVerifying(true);
    setVerificationStatus('verifying');
    setErrorMessage('');

    try {
      const video = videoRef.current;
      let detection = await faceapi.detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })).withFaceLandmarks().withFaceDescriptor();
      
      if (!detection) {
        detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 })).withFaceLandmarks().withFaceDescriptor();
      }

      if (!detection) {
        setVerificationStatus('failed');
        setErrorMessage('No face detected. Please ensure your face is clearly visible.');
        setIsVerifying(false);
        return;
      }

      const distances = baselineDescriptors.map(d => faceapi.euclideanDistance(d, detection!.descriptor));
      const bestDistance = Math.min(...distances);
      const similarity = Math.max(0, (1 - bestDistance) * 100);
      
      setSimilarityScore(similarity);

      if (similarity >= 60) {
        setVerificationStatus('success');
        console.log('✅ Face verified successfully - ready to start exam');
      } else {
        setVerificationStatus('failed');
        setErrorMessage(`Face match score too low (${similarity.toFixed(1)}%). Please try again.`);
      }
    } catch (error) {
      setVerificationStatus('failed');
      setErrorMessage('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // ✅ Step 2: Start exam - called on "Start Exam" button click AFTER verification
  const startExam = () => {
    // Request fullscreen IMMEDIATELY in direct response to user click
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => console.warn('Fullscreen error:', err));
    } else if ((elem as any).webkitRequestFullscreen) {
      (elem as any).webkitRequestFullscreen();
    } else if ((elem as any).mozRequestFullScreen) {
      (elem as any).mozRequestFullScreen();
    } else if ((elem as any).msRequestFullscreen) {
      (elem as any).msRequestFullscreen();
    }
    console.log('✅ Fullscreen requested on Start Exam click');
    
    // Start exam immediately (don't wait for fullscreen promise)
    onSuccess(selectedAudioDeviceId);
  };

  const handleCancel = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    stopAudioMonitoring();
    onCancel();
  };

  const isSystemReady = modelsLoaded && baselineLoaded;

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in;
        }
        
        .animate-fadeOut {
          animation: fadeOut 0.5s ease-out forwards;
        }
      `}</style>
      
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-90">
        <div className="bg-white rounded-lg shadow-2xl p-6 max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-800 mb-1">Pre-Exam Verification</h2>
        <p className="text-sm text-gray-600 mb-3">
          Verify your identity and audio setup before starting the exam.
        </p>

        <div className="relative mb-3">
          <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-300">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
            
            {isCameraLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white text-sm">
                <div><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2"></div>Loading Camera...</div>
              </div>
            )}

            {!isSystemReady && !isCameraLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-600/95 to-purple-700/95 backdrop-blur-sm animate-fadeIn">
                <div className="text-center px-4 py-6">
                  <div className="relative w-14 h-14 mx-auto mb-3">
                    <div className="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
                    <div className="absolute inset-0 bg-white/30 rounded-full animate-pulse"></div>
                    <div className="relative w-full h-full bg-white rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 text-blue-600 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="4" r="1" fill="currentColor"/>
                    <line x1="12" y1="5" x2="12" y2="7" strokeWidth="2" strokeLinecap="round"/>
                    <rect x="7" y="7" width="10" height="8" rx="1.5" fill="currentColor" stroke="none"/>
                    <circle cx="10" cy="11" r="1.2" fill="white"/>
                    <circle cx="14" cy="11" r="1.2" fill="white"/>
                    <path d="M 9.5 13.5 Q 12 14.5 14.5 13.5" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                    <rect x="8.5" y="15" width="7" height="5" rx="1" fill="currentColor" stroke="none"/>
                    <rect x="5" y="16" width="3" height="1.5" rx="0.5" fill="currentColor" stroke="none"/>
                    <rect x="16" y="16" width="3" height="1.5" rx="0.5" fill="currentColor" stroke="none"/>
                    <rect x="9" y="20" width="2" height="2.5" rx="0.5" fill="currentColor" stroke="none"/>
                    <rect x="13" y="20" width="2" height="2.5" rx="0.5" fill="currentColor" stroke="none"/>
                    </svg>
                    </div>
                  </div>
                  
                  <h3 className="text-base font-bold text-white mb-1">Initializing AI</h3>
                  <p className="text-blue-100 text-sm mb-3">Please wait while we prepare verification...</p>
                  
                  <div className="space-y-1.5 text-left max-w-xs mx-auto">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-500 ${!isCameraLoading ? 'bg-green-400 scale-110' : 'bg-white/20'}`}>
                        {!isCameraLoading ? <span className="text-white text-[10px]">✓</span> : <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>}
                      </div>
                      <span className="text-white text-xs">Initializing Audio/Video Devices</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-500 ${modelsLoaded ? 'bg-green-400 scale-110' : 'bg-white/20'}`}>
                        {modelsLoaded ? <span className="text-white text-[10px]">✓</span> : <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>}
                      </div>
                      <span className="text-white text-xs">Loading AI Models</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-500 ${baselineLoaded ? 'bg-green-400 scale-110' : 'bg-white/20'}`}>
                        {baselineLoaded ? <span className="text-white text-[10px]">✓</span> : <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>}
                      </div>
                      <span className="text-white text-xs">Processing Your Identity</span>
                    </div>
                  </div>
                  
                  <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden mt-3">
                    <div 
                      className="h-full bg-white transition-all duration-500 ease-out rounded-full"
                      style={{ width: `${(!isCameraLoading ? 33.33 : 0) + (modelsLoaded ? 33.33 : 0) + (baselineLoaded ? 33.33 : 0)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            
            {isSystemReady && (
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/95 to-purple-700/95 backdrop-blur-sm animate-fadeOut pointer-events-none"></div>
            )}
          </div>
          
          {verificationStatus !== 'idle' && (
            <div className={`mt-2 p-2 text-center rounded text-sm font-medium ${
              verificationStatus === 'success' ? 'bg-green-100 text-green-700' : 
              verificationStatus === 'failed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {verificationStatus === 'verifying' && '🔍 Analyzing Face...'}
              {verificationStatus === 'success' && (
                `✅ Identity Verified (${similarityScore?.toFixed(0)}% match) - Click "Start Exam" to begin`
              )}
              {verificationStatus === 'failed' && `❌ ${errorMessage || 'Verification Failed'}`}
            </div>
          )}
        </div>

        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center justify-between">
            <span>Microphone Check</span>
            <span className={`text-[10px] px-2 py-0.5 rounded ${audioVerified ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
              {audioVerified ? 'Verified' : 'Action Required'}
            </span>
          </h3>

          {isVirtualMic && (
            <div className="mb-2 p-2 bg-red-100 border border-red-300 rounded text-red-800 text-xs font-medium">
              ⚠️ Virtual Microphone Detected. Please select your physical microphone.
            </div>
          )}

          <div className="flex gap-2 mb-2">
            <select 
              className="flex-1 p-1.5 border rounded text-xs"
              value={selectedAudioDeviceId}
              onChange={(e) => startAudioMonitoring(e.target.value)}
            >
              {audioDevices.length === 0 && <option>Loading microphones...</option>}
              {audioDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-1">
            <p className="text-xs text-gray-600 mb-1">
              Speak <strong>"Hello, I am ready"</strong> to test:
            </p>
            <div className="w-full h-3 bg-gray-300 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-100 ${audioLevel > 10 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${audioLevel}%` }}
              />
            </div>
          </div>
          
          {!audioVerified && (
            <p className="text-[10px] text-red-500 font-medium">
              * Microphone must detect sound to proceed.
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={handleCancel} className="flex-1 px-3 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-medium">
            Cancel
          </button>
          
          {/* Show "Verify" button if not yet verified */}
          {verificationStatus !== 'success' && (
            <button
              onClick={verifyFace}
              disabled={!isSystemReady || isVerifying || !audioVerified}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                !isSystemReady || isVerifying || !audioVerified
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isVerifying ? 'Verifying...' : 
               !isSystemReady ? 'Initializing...' : 'Verify Identity'}
            </button>
          )}
          
          {/* Show "Start Exam" button AFTER verification success */}
          {verificationStatus === 'success' && (
            <button
              onClick={startExam}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition bg-green-600 text-white hover:bg-green-700"
            >
              ▶ Start Exam
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default PreExamVerification;