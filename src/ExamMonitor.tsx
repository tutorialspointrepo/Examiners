import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import hark from 'hark';
import { violationQueueService } from './services/violation_queue_service';
import { MAX_VIOLATIONS } from './constants';

interface ExamMonitorProps {
  baselineDescriptors: Float32Array[];
  onViolation: (type: string, details?: string, proof?: Blob) => void;
  monitoringEnabled: boolean;
  selectedAudioDeviceId?: string;
  examId: string;
  studentId: string;
  attemptId: string;
  initialViolationCount?: number; // ✅ NEW: Pass existing violation count for restart scenario
}

// 🔧 CONFIGURATION
const CONFIG = {
  // Head Turn Detection
  HEAD_YAW_TOLERANCE: 2.5,          // More forgiving for slight head movements
  HEAD_TURN_DURATION_MS: 5000,      // Must look away for 5 seconds
  HEAD_TURN_RESET_THRESHOLD: 2,     // 2 consecutive normal detections to reset
  EXTREME_YAW_LEFT: 0.15,           // Extreme left turn threshold
  EXTREME_YAW_RIGHT: 6.0,           // Extreme right turn threshold
  
  // Face Detection
  MAX_LOOK_AWAY_DURATION: 10000,    // 20 seconds - very generous, only triggers if user actually left
  NO_FACE_RESET_THRESHOLD: 1,       // Just 1 detection resets timer - instant recovery
  MIN_FACE_CONFIDENCE: 0.5,         // 50% minimum confidence
  
  // Movement Detection - VERY GENEROUS
  // Normal activities: adjusting position (50-100%), leaning (30-60%), stretching (80-150%)
  // Suspicious: constantly moving around, swapping with someone, leaving seat
  MOVEMENT_THRESHOLD: 1.5,          // ✅ 150% of face width - only extreme movement triggers
  MOVEMENT_DURATION_MS: 15000,      // ✅ 15 seconds of continuous extreme movement needed
  MOVEMENT_RESET_FRAMES: 2,         // 2 frames of normal movement to reset
  
  // Face Matching
  MATCH_THRESHOLD: 0.6,             // 60% distance threshold for face mismatch
  MISMATCH_DURATION_MS: 3000,       // 3 seconds of mismatch before violation
  
  // Detection Intervals
  CHECK_INTERVAL_MS: 500,
  VIOLATION_COOLDOWN_MS: 20000,     // 20 seconds between database saves
  OBJECT_DETECTION_INTERVAL_MS: 3000,
  PROHIBITED_OBJECTS: ['cell phone', 'book', 'laptop'],
  
  // Voice Detection
  HARK_THRESHOLD: -50,              // dB threshold
  MIN_SPEECH_DURATION_MS: 1500,     // More forgiving for brief sounds
};

const ExamMonitor: React.FC<ExamMonitorProps> = ({
  baselineDescriptors,
  onViolation,
  monitoringEnabled,
  selectedAudioDeviceId,
  examId,
  studentId,
  attemptId,
  initialViolationCount = 0, // ✅ Default to 0 if not provided
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null); // Needed for video recording
  
  // Hark voice detection refs
  const audioStreamRef = useRef<MediaStream | null>(null);
  const harkInstanceRef = useRef<hark.Harker | null>(null);
  const speechStartTimeRef = useRef<number | null>(null);
  
  // Timers & State
  const monitoringIntervalRef = useRef<number | null>(null);
  const objectDetectionIntervalRef = useRef<number | null>(null);
  
  const lastViolationTime = useRef<{ [key: string]: number }>({});
  const noFaceStartTime = useRef<number | null>(null);
  const headTurnStartTime = useRef<number | null>(null);
  const movementStartTime = useRef<number | null>(null); 
  const mismatchStartTime = useRef<number | null>(null);
  
  const lastFacePosition = useRef<{ x: number, y: number } | null>(null);
  
  // ✅ FIXED: Initialize with existing violation count for restart scenario
  const violationCountRef = useRef<number>(initialViolationCount);
  
  // ✅ NEW: Track if we've already logged the limit reached message
  const limitReachedLoggedRef = useRef<boolean>(initialViolationCount >= MAX_VIOLATIONS);
  
  // Buffers
  const headTurnResetBuffer = useRef<number>(0);
  const noFaceResetBuffer = useRef<number>(0); 
  const movementResetBuffer = useRef<number>(0); // ✅ NEW: Buffer for movement reset 
  
  // ✅ FIX 4: Track mount status to prevent memory leaks
  const isMountedRef = useRef<boolean>(true); 

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  
  // Object detection - DISABLED due to TensorFlow version conflict
  // const cocoModelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  // const [objectModelLoaded, setObjectModelLoaded] = useState(false);

  // ✅ NEW: Update violation count when initialViolationCount prop changes (for restart)
  useEffect(() => {
    if (initialViolationCount > violationCountRef.current) {
      console.log(`🔄 ExamMonitor: Updating violation count from ${violationCountRef.current} to ${initialViolationCount} (restart detected)`);
      violationCountRef.current = initialViolationCount;
      
      // Update limit reached flag
      if (initialViolationCount >= MAX_VIOLATIONS) {
        limitReachedLoggedRef.current = true;
        console.warn(`⚠️ ExamMonitor: Violation limit already reached (${initialViolationCount}/${MAX_VIOLATIONS})`);
      }
    }
  }, [initialViolationCount]);

  // Helper function to handle violations with offline queue
  const handleViolation = useCallback(async (
    type: string,
    details?: string,
    videoProof?: Blob,
    frameProof?: Blob
  ) => {
    // SAFETY: Stop after MAX_VIOLATIONS to prevent abuse/costs
    if (violationCountRef.current >= MAX_VIOLATIONS) {
      // ✅ Only log once when limit is first reached
      if (!limitReachedLoggedRef.current) {
        console.warn(`⚠️ Violation limit (${MAX_VIOLATIONS}) reached. Future violations will be logged but NOT saved to database.`);
        limitReachedLoggedRef.current = true;
      }
      // ✅ Still log to console for debugging, but skip database upload
      console.log(`📝 [LOG ONLY] Violation detected: ${type} (limit reached, not saving to DB)`);
      return;
    }
    
    violationCountRef.current++;
    console.log(`🚨 VIOLATION DETECTED: ${type} (${violationCountRef.current}/${MAX_VIOLATIONS})`);
    
    // Queue the violation (handles offline/online automatically)
    const result = await violationQueueService.queueViolation(
      type,
      details,
      videoProof,
      frameProof,
      examId,
      studentId,
      attemptId
    );
    
    if (result.queued) {
      console.log(`📥 Violation queued: ${type} (will sync when online)`);
    }
    
    // Also call the original onViolation callback for immediate UI feedback
    onViolation(type, details, videoProof);
  }, [examId, studentId, attemptId, onViolation]);

  // --- EVIDENCE CAPTURE ---
  // ✅ FIX 4: Added isMountedRef check to prevent memory leak on unmount
  const captureVideoClip = useCallback(async (durationMs: number): Promise<Blob | undefined> => {
    if (!streamRef.current || !isMountedRef.current) return undefined;
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
        setTimeout(() => { 
          // ✅ Check if still mounted before stopping
          if (recorder.state === 'recording' && isMountedRef.current) {
            recorder.stop();
          } else if (recorder.state === 'recording') {
            // Component unmounted, stop but don't process
            recorder.stop();
            console.log('⚠️ Recording stopped due to unmount');
          }
        }, durationMs);
      } catch (err) { console.error("❌ Recorder Error:", err); resolve(undefined); }
    });
  }, []);

  // ✅ FIX 2: Capture a single frame as JPEG (async with toBlob - prevents UI freeze)
  const captureFrame = useCallback((): Promise<Blob | undefined> => {
    if (!videoRef.current) return Promise.resolve(undefined);
    
    return new Promise((resolve) => {
      try {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || video.videoWidth === 0) {
          resolve(undefined);
          return;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(undefined);
          return;
        }
        
        ctx.drawImage(video, 0, 0);
        
        // ✅ Async blob creation - runs off main thread
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(`📷 Frame captured (${(blob.size / 1024).toFixed(0)}KB)`);
              resolve(blob);
            } else {
              resolve(undefined);
            }
          },
          'image/jpeg',
          0.7
        );
      } catch (err) {
        console.error('❌ Frame capture error:', err);
        resolve(undefined);
      }
    });
  }, []);

  // ✅ FIX 2: Capture both video and frame evidence in parallel
  const captureEvidence = useCallback(async (violationType: string): Promise<{ video?: Blob; frame?: Blob }> => {
    console.log(`📸 Capturing evidence for ${violationType}`);
    
    // ✅ Parallel execution - both run simultaneously
    const [frame, video] = await Promise.all([
      captureFrame(),
      captureVideoClip(10000)
    ]);
    
    return { video, frame };
  }, [captureVideoClip, captureFrame]);

  // ==================== HARK VOICE DETECTION ====================
  const startHarkVoiceDetection = useCallback(async () => {
    try {
      console.log('🎙️ Starting Hark voice detection...');
      
      // Get audio stream
      const audioConstraints: MediaStreamConstraints = {
        audio: selectedAudioDeviceId 
          ? { deviceId: { exact: selectedAudioDeviceId }, echoCancellation: true, noiseSuppression: false }
          : { echoCancellation: true, noiseSuppression: false }
      };
      
      const audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      audioStreamRef.current = audioStream;
      
      // Initialize Hark
      const speechEvents = hark(audioStream, { 
        threshold: CONFIG.HARK_THRESHOLD,
        interval: 100
      });
      
      harkInstanceRef.current = speechEvents;
      
      // Speaking started
      speechEvents.on('speaking', () => {
        console.log('🎤 Hark: Speaking detected');
        if (!speechStartTimeRef.current) {
          speechStartTimeRef.current = Date.now();
        }
      });
      
      // Speaking stopped - check duration and trigger violation if needed
      speechEvents.on('stopped_speaking', async () => {
        console.log('🎤 Hark: Stopped speaking');
        
        if (speechStartTimeRef.current) {
          const speechDuration = Date.now() - speechStartTimeRef.current;
          speechStartTimeRef.current = null;
          
          console.log(`🎤 Speech duration: ${(speechDuration / 1000).toFixed(1)}s`);
          
          // Only trigger violation if speech was long enough (prevents false positives)
          if (speechDuration >= CONFIG.MIN_SPEECH_DURATION_MS) {
            const now = Date.now();
            const timeSinceLastViolation = lastViolationTime.current['HUMAN_VOICE_DETECTED'] 
              ? now - lastViolationTime.current['HUMAN_VOICE_DETECTED']
              : Infinity;
            
            if (timeSinceLastViolation > CONFIG.VIOLATION_COOLDOWN_MS) {
              console.log('🚨 VIOLATION - Human Voice Detected (SAVING TO DB)');
              // Set cooldown FIRST before async operations
              lastViolationTime.current['HUMAN_VOICE_DETECTED'] = now;
              const evidence = await captureEvidence('HUMAN_VOICE_DETECTED');
              await handleViolation(
                'HUMAN_VOICE_DETECTED', 
                `Speech detected (${(speechDuration / 1000).toFixed(1)}s)`, 
                evidence.video, 
                evidence.frame
              );
            } else {
              console.log(`⚠️ VIOLATION - Human Voice (cooldown: ${(CONFIG.VIOLATION_COOLDOWN_MS/1000 - timeSinceLastViolation/1000).toFixed(1)}s remaining)`);
            }
          } else {
            console.log(`🎤 Speech too short (${(speechDuration / 1000).toFixed(1)}s < ${CONFIG.MIN_SPEECH_DURATION_MS / 1000}s), ignoring`);
          }
        }
      });
      
      console.log('✅ Hark voice detection started');
      
    } catch (error) {
      console.error('❌ Failed to start Hark voice detection:', error);
    }
  }, [selectedAudioDeviceId, captureEvidence, handleViolation]);

  const stopHarkVoiceDetection = useCallback(() => {
    if (harkInstanceRef.current) {
      harkInstanceRef.current.stop();
      harkInstanceRef.current = null;
      console.log('🛑 Hark voice detection stopped');
    }
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
  }, []);

  // 1. Load Models (Face-api only - COCO-SSD disabled due to TF.js conflict)
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log("🧠 Loading AI models...");
        
        // Load Face-api models
        if (faceapi.nets.ssdMobilenetv1.isLoaded) {
          console.log("🧠 Face-api models already loaded.");
          setModelsLoaded(true);
        } else {
          await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('/models')
          ]);
          console.log("✅ Face-api models loaded successfully.");
          setModelsLoaded(true);
        }
        
        // COCO-SSD object detection - DISABLED
        // TensorFlow.js version conflict between face-api.js and @tensorflow-models/coco-ssd
        // TODO: Implement object detection with a compatible approach
        
      } catch (err) { 
        console.error('❌ Models failed to load:', err); 
      }
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
      console.log(`🔄 Requesting Camera...`);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        // ✅ FIX 5: Use 'ideal' to prevent OverconstrainedError on some devices
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 }, 
          facingMode: 'user' 
        },
        audio: false // Hark handles audio separately
      });

      console.log("✅ Video Stream Active");

      // Check for virtual camera
      const videoTrack = stream.getVideoTracks()[0];
      const label = videoTrack.label.toLowerCase();
      if (label.includes('obs') || label.includes('virtual') || label.includes('snap') || 
          label.includes('manycam') || label.includes('xsplit') || label.includes('droidcam') ||
          label.includes('iriun') || label.includes('epoccam')) {
        console.log('🚨 VIOLATION - Virtual Camera Detected:', videoTrack.label);
        const evidence = await captureEvidence('VIRTUAL_MACHINE');
        await handleViolation('VIRTUAL_MACHINE', `Virtual camera detected: ${videoTrack.label}`, evidence.video, evidence.frame);
      }
      
      // ✅ Listen for track ended event (camera disconnected/disabled)
      videoTrack.onended = async () => {
        console.log('📷 Camera track ended - camera was disconnected or disabled');
        // Reset NO_FACE timer since this is a hardware issue
        noFaceStartTime.current = null;
        
        // Raise DEVICE_CHANGE violation
        const now = Date.now();
        const timeSinceLastViolation = lastViolationTime.current['DEVICE_CHANGE'] 
          ? now - lastViolationTime.current['DEVICE_CHANGE']
          : Infinity;
        
        if (timeSinceLastViolation > CONFIG.VIOLATION_COOLDOWN_MS) {
          console.log('🚨 VIOLATION - Camera disconnected (SAVING TO DB)');
          lastViolationTime.current['DEVICE_CHANGE'] = now;
          await handleViolation('DEVICE_CHANGE', 'Camera was disconnected or disabled', null, null);
        }
      };
      
      videoTrack.onmute = async () => {
        console.log('📷 Camera track muted - camera may be blocked by another app');
        noFaceStartTime.current = null;
        
        // Raise DEVICE_CHANGE violation for muted camera too
        const now = Date.now();
        const timeSinceLastViolation = lastViolationTime.current['DEVICE_CHANGE'] 
          ? now - lastViolationTime.current['DEVICE_CHANGE']
          : Infinity;
        
        if (timeSinceLastViolation > CONFIG.VIOLATION_COOLDOWN_MS) {
          console.log('🚨 VIOLATION - Camera muted/blocked (SAVING TO DB)');
          lastViolationTime.current['DEVICE_CHANGE'] = now;
          await handleViolation('DEVICE_CHANGE', 'Camera was muted or blocked by another application', null, null);
        }
      };
      
      videoTrack.onunmute = () => {
        console.log('📷 Camera track unmuted - camera is back');
      };

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream; // Store for video recording
      }

      // Start Hark voice detection
      await startHarkVoiceDetection();

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
        // Set cooldown FIRST before async operations
        lastViolationTime.current['DEVICE_CHANGE'] = now;
        const evidence = await captureEvidence('DEVICE_CHANGE');
        await handleViolation('DEVICE_CHANGE', 'Hardware device changed during exam', evidence.video, evidence.frame);
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
  }, [isMonitoring, captureEvidence, handleViolation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("🛑 Component unmounting - Stopping Streams...");
      
      // ✅ FIX 4: Mark as unmounted first
      isMountedRef.current = false;
      
      // ✅ FIX 1: Clear monitoring timeout (not interval anymore)
      if (monitoringIntervalRef.current) {
        window.clearTimeout(monitoringIntervalRef.current);
        monitoringIntervalRef.current = null;
      }
      if (objectDetectionIntervalRef.current) {
        clearInterval(objectDetectionIntervalRef.current);
        objectDetectionIntervalRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Stop Hark voice detection
      stopHarkVoiceDetection();
      
      // ✅ Reset all timers to prevent stale state
      noFaceStartTime.current = null;
      headTurnStartTime.current = null;
      movementStartTime.current = null;
      mismatchStartTime.current = null;
    };
  }, [stopHarkVoiceDetection]);

  // --- FACE MONITORING ---
  const monitorFace = useCallback(async () => {
    // ✅ Early exit if component is unmounting or not properly initialized
    if (!videoRef.current || !isMonitoring || !modelsLoaded) return;
    
    // ✅ FIX 4: Check if component is still mounted
    if (!isMountedRef.current) {
      console.log('⚠️ Component unmounted - stopping face detection');
      return;
    }

    try {
      // ✅ CHECK CAMERA AVAILABILITY FIRST
      // Check if video stream is still active
      const stream = streamRef.current;
      if (!stream) {
        console.log('📷 Camera stream not available - skipping face detection');
        // Reset NO_FACE timer since this is a camera issue, not user behavior
        noFaceStartTime.current = null;
        return;
      }
      
      // Check if video tracks are active
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0 || !videoTracks[0].enabled || videoTracks[0].readyState !== 'live') {
        console.log(`📷 Camera unavailable (tracks: ${videoTracks.length}, enabled: ${videoTracks[0]?.enabled}, state: ${videoTracks[0]?.readyState}) - skipping face detection`);
        // Reset NO_FACE timer since this is a camera issue, not user behavior
        noFaceStartTime.current = null;
        
        // Log DEVICE_CHANGE violation if camera was working before
        const timeSinceLastDeviceChange = lastViolationTime.current['DEVICE_CHANGE'] 
          ? Date.now() - lastViolationTime.current['DEVICE_CHANGE']
          : Infinity;
        
        if (timeSinceLastDeviceChange > CONFIG.VIOLATION_COOLDOWN_MS) {
          console.log('🚨 VIOLATION - Camera disconnected/disabled (SAVING TO DB)');
          lastViolationTime.current['DEVICE_CHANGE'] = Date.now();
          await handleViolation('DEVICE_CHANGE', 'Camera disconnected or disabled', null, null);
        }
        return;
      }

      if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
        console.log('📷 Video not ready - skipping face detection');
        return;
      }
      
      // ✅ Check if video is paused or ended (camera might have been blocked)
      if (videoRef.current.paused || videoRef.current.ended) {
        console.log(`📷 Video ${videoRef.current.paused ? 'paused' : 'ended'} - camera may be blocked`);
        noFaceStartTime.current = null; // Don't count as NO_FACE
        return;
      }

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

      // 1. NO FACE - Check if face is detected with sufficient confidence
      // Filter detections by confidence score
      const confidentDetections = detections.filter(d => d.detection.score >= CONFIG.MIN_FACE_CONFIDENCE);
      
      if (confidentDetections.length === 0) {
        noFaceResetBuffer.current = 0; 
        if (!noFaceStartTime.current) noFaceStartTime.current = now;
        
        const duration = now - noFaceStartTime.current;
        if (showHeartbeat) console.log(`👤 No face visible (${(duration/1000).toFixed(1)}s)${detections.length > 0 ? ` [low confidence: ${(detections[0]?.detection.score * 100).toFixed(0)}%]` : ''}`);

        if (duration > CONFIG.MAX_LOOK_AWAY_DURATION) { 
          const timeSinceLastViolation = lastViolationTime.current['NO_FACE'] 
            ? now - lastViolationTime.current['NO_FACE']
            : Infinity;
          
          if (timeSinceLastViolation > CONFIG.VIOLATION_COOLDOWN_MS) {
            console.log('🚨 VIOLATION - No Face (SAVING TO DB)');
            // Set cooldown FIRST before async operations
            lastViolationTime.current['NO_FACE'] = now;
            noFaceStartTime.current = null;
            const evidence = await captureEvidence('NO_FACE');
            await handleViolation('NO_FACE', `No face detected for ${(duration/1000).toFixed(1)}s`, evidence.video, evidence.frame);
          } else {
            console.log(`⚠️ VIOLATION - No Face (cooldown: ${(CONFIG.VIOLATION_COOLDOWN_MS/1000 - timeSinceLastViolation/1000).toFixed(1)}s remaining)`);
          }
        }
        return;
      }
      
      // Face detected with good confidence - reset NO_FACE timer
      noFaceResetBuffer.current += 1;
      if (noFaceResetBuffer.current >= CONFIG.NO_FACE_RESET_THRESHOLD) {
        noFaceStartTime.current = null;
      }

      // 2. MULTIPLE FACES - Only count confident detections
      if (confidentDetections.length > 1) {
        const timeSinceLastViolation = lastViolationTime.current['MULTIPLE_FACES'] 
          ? now - lastViolationTime.current['MULTIPLE_FACES']
          : Infinity;
        
        if (timeSinceLastViolation > CONFIG.VIOLATION_COOLDOWN_MS) {
          console.log(`🚨 VIOLATION - Multiple Faces (${confidentDetections.length}) (SAVING TO DB)`);
          // Set cooldown FIRST before async operations
          lastViolationTime.current['MULTIPLE_FACES'] = now;
          const evidence = await captureEvidence('MULTIPLE_FACES');
          await handleViolation('MULTIPLE_FACES', `${confidentDetections.length} faces detected`, evidence.video, evidence.frame);
        } else {
          console.log(`⚠️ VIOLATION - Multiple Faces (${confidentDetections.length}) (cooldown: ${(CONFIG.VIOLATION_COOLDOWN_MS/1000 - timeSinceLastViolation/1000).toFixed(1)}s remaining)`);
        }
        return;
      }

      // Use the first confident detection for further checks
      const detection = confidentDetections[0];
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
      
      // Check for head turn - using configurable thresholds
      const isExtremeLeft = yawRatio < CONFIG.EXTREME_YAW_LEFT; 
      const isExtremeRight = yawRatio > CONFIG.EXTREME_YAW_RIGHT;
      const isNormalTurn = yawRatio > CONFIG.HEAD_YAW_TOLERANCE || yawRatio < (1 / CONFIG.HEAD_YAW_TOLERANCE);
      const isHeadTurned = isNormalTurn || isExtremeLeft || isExtremeRight;

      if (isHeadTurned) {
        headTurnResetBuffer.current = 0;
        if (!headTurnStartTime.current) headTurnStartTime.current = now;
        
        const turnDuration = now - headTurnStartTime.current;
        
        // Only log if turned for more than 1 second (reduce spam)
        if (turnDuration > 1000 && showHeartbeat) {
          console.log(`👀 Head turned (${(turnDuration/1000).toFixed(1)}s) | Yaw: ${yawRatio.toFixed(2)}${isExtremeLeft ? ' [EXTREME LEFT]' : ''}${isExtremeRight ? ' [EXTREME RIGHT]' : ''}`);
        }
        
        if (turnDuration > CONFIG.HEAD_TURN_DURATION_MS) {
          const timeSinceLastViolation = lastViolationTime.current['HEAD_TURNED'] 
            ? now - lastViolationTime.current['HEAD_TURNED']
            : Infinity;
          
          if (timeSinceLastViolation > CONFIG.VIOLATION_COOLDOWN_MS) {
            console.log(`🚨 VIOLATION - Head Turn (Yaw: ${yawRatio.toFixed(2)}, Duration: ${(turnDuration/1000).toFixed(1)}s) (SAVING TO DB)`);
            // Set cooldown FIRST before async operations
            lastViolationTime.current['HEAD_TURNED'] = now;
            headTurnStartTime.current = null;
            movementStartTime.current = null;
            const evidence = await captureEvidence('HEAD_TURNED');
            await handleViolation('HEAD_TURNED', `Head turned away for ${(turnDuration/1000).toFixed(1)}s (yaw: ${yawRatio.toFixed(2)})`, evidence.video, evidence.frame);
          } else {
            console.log(`⚠️ VIOLATION - Head Turn (Yaw: ${yawRatio.toFixed(2)}) (cooldown: ${(CONFIG.VIOLATION_COOLDOWN_MS/1000 - timeSinceLastViolation/1000).toFixed(1)}s remaining)`);
          }
        }
      } else {
        // Head is facing forward - increment reset buffer
        headTurnResetBuffer.current += 1;
        if (headTurnResetBuffer.current >= CONFIG.HEAD_TURN_RESET_THRESHOLD) {
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
          movementResetBuffer.current = 0;
          if (!movementStartTime.current) movementStartTime.current = now;
          
          const moveDuration = now - movementStartTime.current;
          
          // Only log if moving for more than 1.5 seconds (reduce spam)
          if (moveDuration > 1500 && showHeartbeat) {
            console.log(`🏃 Excessive movement (${(moveDuration/1000).toFixed(1)}s) | Movement: ${(relativeMovement*100).toFixed(0)}%`);
          }
          
          if (moveDuration > CONFIG.MOVEMENT_DURATION_MS) {
             const timeSinceLastViolation = lastViolationTime.current['SUSPICIOUS_MOVEMENT'] 
               ? now - lastViolationTime.current['SUSPICIOUS_MOVEMENT']
               : Infinity;
             
             if (timeSinceLastViolation > CONFIG.VIOLATION_COOLDOWN_MS) {
                console.log(`🚨 VIOLATION - Suspicious Movement (Duration: ${(moveDuration/1000).toFixed(1)}s, Movement: ${(relativeMovement*100).toFixed(0)}%) (SAVING TO DB)`);
                // Set cooldown FIRST before async operations
                lastViolationTime.current['SUSPICIOUS_MOVEMENT'] = now;
                movementStartTime.current = null;
                headTurnStartTime.current = null;
                const evidence = await captureEvidence('SUSPICIOUS_MOVEMENT');
                await handleViolation('SUSPICIOUS_MOVEMENT', `Excessive movement for ${(moveDuration/1000).toFixed(1)}s`, evidence.video, evidence.frame);
             } else {
                console.log(`⚠️ VIOLATION - Suspicious Movement (cooldown: ${(CONFIG.VIOLATION_COOLDOWN_MS/1000 - timeSinceLastViolation/1000).toFixed(1)}s remaining)`);
                movementStartTime.current = null;
             }
          }
        } else {
          // Normal movement - increment reset buffer
          movementResetBuffer.current += 1;
          if (movementResetBuffer.current >= CONFIG.MOVEMENT_RESET_FRAMES) {
            movementStartTime.current = null;
          }
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
            // Set cooldown FIRST before async operations
            lastViolationTime.current['FACE_MISMATCH'] = now;
            mismatchStartTime.current = null;
            const evidence = await captureEvidence('FACE_MISMATCH');
            await handleViolation('FACE_MISMATCH', `Face mismatch`, evidence.video, evidence.frame);
          } else {
            console.log(`⚠️ VIOLATION - Face Mismatch (cooldown: ${(CONFIG.VIOLATION_COOLDOWN_MS/1000 - timeSinceLastViolation/1000).toFixed(1)}s remaining)`);
          }
        }
      } else {
        mismatchStartTime.current = null;
      }

    } catch (error) { console.error('❌ Monitor Loop Error:', error); }
  }, [isMonitoring, baselineDescriptors, modelsLoaded, captureEvidence, handleViolation]);


  // ✅ FIX 1 & 3: Recursive setTimeout loop (prevents call stacking if face detection is slow)
  // Using a ref to hold the monitoring function to avoid stale closures
  const monitorFaceRef = useRef<(() => Promise<void>) | null>(null);
  monitorFaceRef.current = monitorFace;

  useEffect(() => {
    if (!isMonitoring || !modelsLoaded) return;
    
    let timeoutId: number | null = null;
    let isLoopActive = true;
    
    const loop = async () => {
      // Check if loop should continue
      if (!isLoopActive || !isMountedRef.current || !isMonitoring) {
        console.log('🛑 Monitoring loop stopped');
        return;
      }
      
      // Execute face monitoring
      if (monitorFaceRef.current) {
        await monitorFaceRef.current();
      }
      
      // Schedule next iteration only if still active
      if (isLoopActive && isMountedRef.current && isMonitoring) {
        timeoutId = window.setTimeout(loop, CONFIG.CHECK_INTERVAL_MS);
        monitoringIntervalRef.current = timeoutId; // Store for cleanup
      }
    };
    
    // Start the loop
    console.log('🔄 Starting recursive monitoring loop...');
    loop();
    
    return () => {
      console.log('🧹 Cleaning up monitoring loop...');
      isLoopActive = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (monitoringIntervalRef.current) {
        window.clearTimeout(monitoringIntervalRef.current);
        monitoringIntervalRef.current = null;
      }
      if (objectDetectionIntervalRef.current) {
        clearInterval(objectDetectionIntervalRef.current);
        objectDetectionIntervalRef.current = null;
      }
    };
  }, [isMonitoring, modelsLoaded]);
  
  // ✅ FIX 4: Track mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 w-1 h-1 overflow-hidden opacity-0 pointer-events-none">
      <video ref={videoRef} autoPlay muted playsInline width={640} height={480} />
      <canvas ref={canvasRef} />
    </div>
  );
};

export default ExamMonitor;