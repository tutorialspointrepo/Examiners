import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { violationQueueService } from './services/violation_queue_service';

interface ExamMonitorProps {
  baselineDescriptors: Float32Array[];
  onViolation: (type: string, details?: string, proof?: Blob) => void;
  monitoringEnabled: boolean;
  selectedAudioDeviceId?: string;
  examId: string;
  studentId: string;
  attemptId: string;
}

// 🔧 CONFIGURATION
const CONFIG = {
  HEAD_YAW_TOLERANCE: 2.0, 
  MAX_LOOK_AWAY_DURATION: 3000, 
  MOVEMENT_THRESHOLD: 0.30,
  MATCH_THRESHOLD: 0.6, 
  CHECK_INTERVAL_MS: 500,
  VIOLATION_COOLDOWN_MS: 20000, // 20 seconds between database saves
};

const ExamMonitor: React.FC<ExamMonitorProps> = ({
  baselineDescriptors,
  onViolation,
  monitoringEnabled,
  selectedAudioDeviceId,
  examId,
  studentId,
  attemptId,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Timers & State
  const monitoringIntervalRef = useRef<number | null>(null);
  const audioIntervalRef = useRef<number | null>(null);
  
  const lastViolationTime = useRef<{ [key: string]: number }>({});
  const noFaceStartTime = useRef<number | null>(null);
  const headTurnStartTime = useRef<number | null>(null);
  const movementStartTime = useRef<number | null>(null); 
  const mismatchStartTime = useRef<number | null>(null);
  
  const lastFacePosition = useRef<{ x: number, y: number } | null>(null);
  
  // Buffers
  const headTurnResetBuffer = useRef<number>(0);
  const noFaceResetBuffer = useRef<number>(0); 

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Helper function to handle violations with offline queue
  const handleViolation = useCallback(async (
    type: string,
    details?: string,
    proof?: Blob
  ) => {
    console.log(`🚨 VIOLATION DETECTED: ${type}`);
    
    // Queue the violation (handles offline/online automatically)
    const result = await violationQueueService.queueViolation(
      type,
      details,
      proof,
      examId,
      studentId,
      attemptId
    );
    
    if (result.queued) {
      console.log(`📥 Violation queued: ${type} (will sync when online)`);
    }
    
    // Also call the original onViolation callback for immediate UI feedback
    onViolation(type, details, proof);
  }, [examId, studentId, attemptId, onViolation]);

  // --- EVIDENCE CAPTURE ---
  const captureVideoClip = useCallback(async (durationMs: number): Promise<Blob | undefined> => {
    if (!streamRef.current) return undefined;
    console.log(`🎥 Starting video clip recording (${durationMs}ms)...`);
    return new Promise((resolve) => {
      try {
        const recorder = new MediaRecorder(streamRef.current!, { mimeType: 'video/webm;codecs=vp8,opus' });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
            console.log("🎥 Video clip recording finished.");
            resolve(new Blob(chunks, { type: 'video/webm' }));
        };
        recorder.start();
        setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, durationMs);
      } catch (err) { console.error("❌ Recorder Error:", err); resolve(undefined); }
    });
  }, []);

  const captureEvidence = useCallback(async (violationType: string) => {
    console.log(`📸 Capturing evidence for ${violationType}`);
    return await captureVideoClip(10000);
  }, [captureVideoClip]);

  // 1. Load Models
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log("🧠 Loading FaceAPI models...");
        if (faceapi.nets.ssdMobilenetv1.isLoaded) {
          console.log("🧠 Models already loaded.");
          setModelsLoaded(true);
          return;
        }
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        console.log("✅ FaceAPI models loaded successfully.");
        setModelsLoaded(true);
      } catch (err) { console.error('❌ Models failed to load:', err); }
    };
    loadModels();
  }, []);

  // 2. Start Monitoring
  const startMonitoring = async () => {
    if (isMonitoring) {
      console.log('⚠️ Already monitoring, skipping start');
      return;
    }

    try {
      console.log(`🔄 Requesting Camera/Mic (Audio Source: ${selectedAudioDeviceId || 'Default'})...`);
      
      const audioConstraints = selectedAudioDeviceId 
        ? { 
            deviceId: { exact: selectedAudioDeviceId }, 
            echoCancellation: true, 
            noiseSuppression: false, 
            autoGainControl: false 
          }
        : { 
            echoCancellation: true, 
            noiseSuppression: false, 
            autoGainControl: false 
          };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: audioConstraints
      });

      console.log("✅ Stream Active. Tracks:", stream.getTracks().map(t => t.kind).join(', '));

      // Check for virtual camera
      const videoTrack = stream.getVideoTracks()[0];
      const label = videoTrack.label.toLowerCase();
      if (label.includes('obs') || label.includes('virtual') || label.includes('snap') || 
          label.includes('manycam') || label.includes('xsplit') || label.includes('droidcam') ||
          label.includes('iriun') || label.includes('epoccam')) {
        console.log('🚨 VIOLATION - Virtual Camera Detected:', videoTrack.label);
        const proof = await captureVideoClip(10000);
        await handleViolation('VIRTUAL_MACHINE', `Virtual camera detected: ${videoTrack.label}`, proof);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }

      // Setup audio analysis for voice detection
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      analyser.smoothingTimeConstant = 0.3;
      analyser.fftSize = 256; 
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      // Calibrate ambient noise baseline (3 second sampling)
      console.log('🎙️ Calibrating ambient noise baseline (3 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      let baselineSamples: number[] = [];
      const calibrationDuration = 3000;
      const sampleInterval = 100;
      const samplesNeeded = calibrationDuration / sampleInterval;
      
      for (let i = 0; i < samplesNeeded; i++) {
        await new Promise(resolve => setTimeout(resolve, sampleInterval));
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        
        let voiceEnergy = 0;
        for (let j = 1; j <= 18; j++) {
          voiceEnergy += dataArray[j];
        }
        const avgVoiceEnergy = voiceEnergy / 18;
        baselineSamples.push(avgVoiceEnergy);
      }
      
      const ambientBaseline = baselineSamples.reduce((a, b) => a + b, 0) / baselineSamples.length;
      lastViolationTime.current['AMBIENT_BASELINE'] = ambientBaseline;
      
      console.log(`✅ Ambient baseline calibrated: ${ambientBaseline.toFixed(1)}`);
      
      setIsMonitoring(true);
      console.log('✅ Monitoring State set to TRUE');
    } catch (error) {
      console.error('❌ AV Init Failed:', error);
    }
  };

  useEffect(() => {
    if (monitoringEnabled && !isMonitoring) {
      startMonitoring();
    }
  }, [monitoringEnabled, selectedAudioDeviceId]);

  // Device change detection
  useEffect(() => {
    if (!isMonitoring) return;

    const handleDeviceChange = async () => {
      console.log('🔄 Device change detected');
      const now = Date.now();
      const timeSinceLastViolation = lastViolationTime.current['DEVICE_CHANGE'] 
        ? now - lastViolationTime.current['DEVICE_CHANGE']
        : Infinity;
      
      if (timeSinceLastViolation > CONFIG.VIOLATION_COOLDOWN_MS) {
        console.log('🚨 VIOLATION - Device Change (SAVING TO DB)');
        const proof = await captureVideoClip(10000);
        await handleViolation('DEVICE_CHANGE', 'Hardware device changed during exam', proof);
        lastViolationTime.current['DEVICE_CHANGE'] = now;
      } else {
        console.log(`⚠️ VIOLATION - Device Change (cooldown: ${(CONFIG.VIOLATION_COOLDOWN_MS/1000 - timeSinceLastViolation/1000).toFixed(1)}s remaining)`);
      }
    };

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }

    return () => {
      if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
    };
  }, [isMonitoring, onViolation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("🛑 Component unmounting - Stopping Streams & Context...");
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(err => console.log('AudioContext already closed'));
        audioContextRef.current = null;
      }
    };
  }, []);

  // --- VOICE DETECTION ---
  const monitorAudio = useCallback(async () => {
    if (!analyserRef.current || !isMonitoring || !audioContextRef.current) return;

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    analyserRef.current.getByteFrequencyData(dataArray);

    const voiceRangeStart = 1;
    const voiceRangeEnd = 18;
    
    let voiceEnergy = 0;
    let totalEnergy = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      totalEnergy += dataArray[i];
      if (i >= voiceRangeStart && i <= voiceRangeEnd) {
        voiceEnergy += dataArray[i];
      }
    }
    
    const avgEnergy = totalEnergy / bufferLength;
    const voiceRatio = voiceEnergy / (voiceRangeEnd - voiceRangeStart + 1);
    
    const now = Date.now();
    const ambientBaseline = lastViolationTime.current['AMBIENT_BASELINE'] || 100;
    
    const thresholdAboveBaseline = Math.max(ambientBaseline * 1.5, ambientBaseline + 30);
    const isVoice = voiceRatio > thresholdAboveBaseline && voiceRatio > avgEnergy * 0.6 && avgEnergy > 25;
    
    if (isVoice) {
      const timeSinceLastViolation = lastViolationTime.current['HUMAN_VOICE_DETECTED'] 
        ? now - lastViolationTime.current['HUMAN_VOICE_DETECTED']
        : Infinity;
        
      if (timeSinceLastViolation > CONFIG.VIOLATION_COOLDOWN_MS) {
        console.log(`🚨 VIOLATION - Voice Detected (SAVING TO DB) | Voice: ${voiceRatio.toFixed(1)}, Baseline: ${ambientBaseline.toFixed(1)}`);
        const proof = await captureEvidence('HUMAN_VOICE_DETECTED');
        await handleViolation('HUMAN_VOICE_DETECTED', `Human speech detected (Energy: ${voiceRatio.toFixed(1)})`, proof);
        lastViolationTime.current['HUMAN_VOICE_DETECTED'] = now;
      } else {
        console.log(`⚠️ VIOLATION - Voice Detected (cooldown: ${(CONFIG.VIOLATION_COOLDOWN_MS/1000 - timeSinceLastViolation/1000).toFixed(1)}s remaining)`);
      }
    }
  }, [isMonitoring, onViolation, captureEvidence]);

  // --- FACE MONITORING ---
  const monitorFace = useCallback(async () => {
    if (!videoRef.current || !isMonitoring || !modelsLoaded) return;

    try {
      if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      if (canvas) {
          faceapi.matchDimensions(canvas, displaySize);
      }

      const detections = await faceapi
        .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      const now = Date.now();
      const showHeartbeat = !lastViolationTime.current['HEARTBEAT'] || now - lastViolationTime.current['HEARTBEAT'] > 5000;

      if (canvas) {
          const resizedDetections = faceapi.resizeResults(detections, displaySize);
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
          faceapi.draw.drawDetections(canvas, resizedDetections);
      }

      // 1. NO FACE
      if (detections.length === 0) {
        noFaceResetBuffer.current = 0; 
        if (!noFaceStartTime.current) noFaceStartTime.current = now;
        
        const duration = now - noFaceStartTime.current;
        if (showHeartbeat) console.log(`👤 No face visible (${(duration/1000).toFixed(1)}s)`);

        if (duration > CONFIG.MAX_LOOK_AWAY_DURATION) { 
          const timeSinceLastViolation = lastViolationTime.current['NO_FACE'] 
            ? now - lastViolationTime.current['NO_FACE']
            : Infinity;
          
          if (timeSinceLastViolation > CONFIG.VIOLATION_COOLDOWN_MS) {
            console.log('🚨 VIOLATION - No Face (SAVING TO DB)');
            const proof = await captureEvidence('NO_FACE');
            await handleViolation('NO_FACE', `No face detected`, proof);
            lastViolationTime.current['NO_FACE'] = now;
          } else {
            console.log(`⚠️ VIOLATION - No Face (cooldown: ${(CONFIG.VIOLATION_COOLDOWN_MS/1000 - timeSinceLastViolation/1000).toFixed(1)}s remaining)`);
          }
        }
        return;
      }
      
      // Face Buffer
      noFaceResetBuffer.current += 1;
      if (noFaceResetBuffer.current > 3) {
        noFaceStartTime.current = null;
      }

      // 2. MULTIPLE FACES
      if (detections.length > 1) {
        const timeSinceLastViolation = lastViolationTime.current['MULTIPLE_FACES'] 
          ? now - lastViolationTime.current['MULTIPLE_FACES']
          : Infinity;
        
        if (timeSinceLastViolation > CONFIG.VIOLATION_COOLDOWN_MS) {
          console.log(`🚨 VIOLATION - Multiple Faces (${detections.length}) (SAVING TO DB)`);
          const proof = await captureEvidence('MULTIPLE_FACES');
          await handleViolation('MULTIPLE_FACES', `${detections.length} faces detected`, proof);
          lastViolationTime.current['MULTIPLE_FACES'] = now;
        } else {
          console.log(`⚠️ VIOLATION - Multiple Faces (${detections.length}) (cooldown: ${(CONFIG.VIOLATION_COOLDOWN_MS/1000 - timeSinceLastViolation/1000).toFixed(1)}s remaining)`);
        }
        return;
      }

      const detection = detections[0];
      const distances = baselineDescriptors.map(d => faceapi.euclideanDistance(d, detection.descriptor));
      const bestDistance = Math.min(...distances);

      // --- HEAD TURN ---
      const landmarks = detection.landmarks;
      const nose = landmarks.positions[30];
      const leftCheek = landmarks.positions[0];
      const rightCheek = landmarks.positions[16];
      
      const leftDist = Math.abs(nose.x - leftCheek.x);
      const rightDist = Math.abs(rightCheek.x - nose.x);
      const yawRatio = leftDist / rightDist;

      if (showHeartbeat) {
        console.log(`✅ Face OK. Match: ${((1-bestDistance)*100).toFixed(0)}% | Yaw: ${yawRatio.toFixed(2)}`);
        lastViolationTime.current['HEARTBEAT'] = now;
      }
      
      const isExtremeLeft = yawRatio < 0.2; 
      const isExtremeRight = yawRatio > 5.0;
      const isNormalTurn = yawRatio > CONFIG.HEAD_YAW_TOLERANCE || yawRatio < (1 / CONFIG.HEAD_YAW_TOLERANCE);

      if (isNormalTurn || isExtremeLeft || isExtremeRight) {
        if (!headTurnStartTime.current) headTurnStartTime.current = now;
        
        if (now - headTurnStartTime.current > CONFIG.MAX_LOOK_AWAY_DURATION) {
          const timeSinceLastViolation = lastViolationTime.current['HEAD_TURNED'] 
            ? now - lastViolationTime.current['HEAD_TURNED']
            : Infinity;
          
          if (timeSinceLastViolation > CONFIG.VIOLATION_COOLDOWN_MS) {
            console.log(`🚨 VIOLATION - Head Turn (Yaw: ${yawRatio.toFixed(2)}) (SAVING TO DB)`);
            const proof = await captureEvidence('HEAD_TURNED');
            await handleViolation('HEAD_TURNED', `Head turned (${yawRatio.toFixed(2)})`, proof);
            lastViolationTime.current['HEAD_TURNED'] = now;
            headTurnStartTime.current = null;
            movementStartTime.current = null;
          } else {
            console.log(`⚠️ VIOLATION - Head Turn (Yaw: ${yawRatio.toFixed(2)}) (cooldown: ${(CONFIG.VIOLATION_COOLDOWN_MS/1000 - timeSinceLastViolation/1000).toFixed(1)}s remaining)`);
          }
        }
        headTurnResetBuffer.current = 0; 
      } else {
        headTurnResetBuffer.current += 1;
        if (headTurnResetBuffer.current > 3) {
          headTurnStartTime.current = null;
        }
      }

      // --- MOVEMENT CHECK ---
      if (lastFacePosition.current) {
        const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
        const deltaX = Math.abs(nose.x - lastFacePosition.current.x);
        const deltaY = Math.abs(nose.y - lastFacePosition.current.y);
        const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const relativeMovement = movement / faceWidth;
        
        if (relativeMovement > CONFIG.MOVEMENT_THRESHOLD) {
          if (!movementStartTime.current) movementStartTime.current = now;
          if ((now - movementStartTime.current) > 3000) {
             const timeSinceLastViolation = lastViolationTime.current['SUSPICIOUS_MOVEMENT'] 
               ? now - lastViolationTime.current['SUSPICIOUS_MOVEMENT']
               : Infinity;
             
             if (timeSinceLastViolation > CONFIG.VIOLATION_COOLDOWN_MS) {
                console.log('🚨 VIOLATION - Suspicious Movement (SAVING TO DB)');
                const proof = await captureEvidence('SUSPICIOUS_MOVEMENT');
                await handleViolation('SUSPICIOUS_MOVEMENT', 'Excessive movement', proof);
                lastViolationTime.current['SUSPICIOUS_MOVEMENT'] = now;
                movementStartTime.current = null;
                headTurnStartTime.current = null;
             } else {
                console.log(`⚠️ VIOLATION - Suspicious Movement (cooldown: ${(CONFIG.VIOLATION_COOLDOWN_MS/1000 - timeSinceLastViolation/1000).toFixed(1)}s remaining)`);
                movementStartTime.current = null;
             }
          }
        } else {
          movementStartTime.current = null;
        }
      }
      lastFacePosition.current = { x: nose.x, y: nose.y };

      // Identity Mismatch
      if (bestDistance > CONFIG.MATCH_THRESHOLD) {
        if (!mismatchStartTime.current) mismatchStartTime.current = now;
        if (now - mismatchStartTime.current > 2000) { 
          const timeSinceLastViolation = lastViolationTime.current['FACE_MISMATCH'] 
            ? now - lastViolationTime.current['FACE_MISMATCH']
            : Infinity;
          
          if (timeSinceLastViolation > CONFIG.VIOLATION_COOLDOWN_MS) {
            console.log('🚨 VIOLATION - Face Mismatch (SAVING TO DB)');
            const proof = await captureEvidence('FACE_MISMATCH');
            await handleViolation('FACE_MISMATCH', `Face mismatch`, proof);
            lastViolationTime.current['FACE_MISMATCH'] = now;
          } else {
            console.log(`⚠️ VIOLATION - Face Mismatch (cooldown: ${(CONFIG.VIOLATION_COOLDOWN_MS/1000 - timeSinceLastViolation/1000).toFixed(1)}s remaining)`);
          }
        }
      } else {
        mismatchStartTime.current = null;
      }

    } catch (error) { console.error('❌ Monitor Loop Error:', error); }
  }, [isMonitoring, baselineDescriptors, onViolation, modelsLoaded, captureEvidence]);

  useEffect(() => {
    if (!isMonitoring) return;
    monitoringIntervalRef.current = window.setInterval(monitorFace, CONFIG.CHECK_INTERVAL_MS);
    audioIntervalRef.current = window.setInterval(monitorAudio, 200); 
    return () => {
      if (monitoringIntervalRef.current) clearInterval(monitoringIntervalRef.current);
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };
  }, [isMonitoring, monitorFace, monitorAudio]);

  return (
    <div className="fixed top-0 left-0 w-1 h-1 overflow-hidden opacity-0 pointer-events-none">
      <video ref={videoRef} autoPlay muted playsInline width={640} height={480} />
      <canvas ref={canvasRef} />
    </div>
  );
};

export default ExamMonitor;