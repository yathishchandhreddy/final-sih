import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRouter } from '../../router/RouterContext.tsx';
import { demoFaceStore } from '../../data/demoFaceData.ts';
import {
  FaceVerificationService,
  CameraState,
  FaceDetectionState,
  CameraDeviceInfo,
  DetectionResult,
  FaceBoundingBox,
} from '../../services/faceVerificationService.ts';
import { StaffFaceTemplate } from '../../types.ts';
import {
  Camera,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const TesterEnrollPage: React.FC = () => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Camera States
  const [cameraState, setCameraState] = useState<CameraState>('IDLE');
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string | null>(null);
  const [isIframeBlocked, setIsIframeBlocked] = useState(false);

  // Available Devices
  const [availableCameras, setAvailableCameras] = useState<CameraDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Face Detection & Enrollment Pipeline
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [detectionState, setDetectionState] = useState<FaceDetectionState>('NO_FACE');
  const [isCapturing, setIsCapturing] = useState(false);
  const [enrolledTemplate, setEnrolledTemplate] = useState<StaffFaceTemplate | null>(null);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(false);

  // Diagnostics Box
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const effectiveUserId = user?.id || 'usr-tester-001';
  const effectiveUserName = user?.full_name || 'Amit Patel';
  const effectiveRole = user?.role || 'SUB_INSPECTOR';

  // Load existing template if present
  useEffect(() => {
    const existing = demoFaceStore.getStaffTemplate(effectiveUserId);
    if (existing) {
      setEnrolledTemplate(existing);
    }
  }, [effectiveUserId]);

  // Clean up camera tracks on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const stopCameraStream = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    FaceVerificationService.stopCamera(streamRef.current, videoRef.current);
    streamRef.current = null;
    setCameraState('IDLE');
    setDetection(null);
    setDetectionState('NO_FACE');
  };

  /**
   * Explicit user action: Start Live Camera
   */
  const handleStartLiveCamera = async (deviceIdToUse?: string) => {
    setCameraErrorMessage(null);
    setIsIframeBlocked(false);
    setEnrollmentSuccess(false);
    setCameraState('REQUESTING');

    if (!videoRef.current) {
      setCameraState('ERROR');
      setCameraErrorMessage('Video display element not initialized.');
      return;
    }

    try {
      const targetDevice = deviceIdToUse || selectedDeviceId || undefined;
      const stream = await FaceVerificationService.startCamera(videoRef.current, {
        deviceId: targetDevice,
      });

      streamRef.current = stream;
      setCameraState('READY');

      const devices = await FaceVerificationService.getAvailableCameras();
      setAvailableCameras(devices);
      if (devices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(devices[0].deviceId);
      }

      startDetectionLoop();
    } catch (err: any) {
      const classified = FaceVerificationService.classifyCameraError(err);
      setCameraState(classified.state);
      setCameraErrorMessage(classified.message);
      setIsIframeBlocked(classified.isIframe);
    }
  };

  const handleSwitchCamera = async (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    stopCameraStream();
    await handleStartLiveCamera(newDeviceId);
  };

  /**
   * Continuous detection loop
   */
  const startDetectionLoop = () => {
    const loop = () => {
      if (videoRef.current && canvasRef.current && streamRef.current && cameraState !== 'IDLE') {
        const result = FaceVerificationService.detectFace(videoRef.current, canvasRef.current);
        setDetection(result);
        setDetectionState(result.detectionState);
      }

      if (streamRef.current) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  /**
   * Capture live frame and generate biometric spatial embedding template
   */
  const handleCaptureAndEnroll = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (detectionState !== 'ONE_FACE') {
      return;
    }

    setIsCapturing(true);

    try {
      const vidW = video.videoWidth || 640;
      const vidH = video.videoHeight || 480;
      canvas.width = vidW;
      canvas.height = vidH;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, vidW, vidH);
      }

      const targetBox: FaceBoundingBox = detection?.box || {
        x: Math.round(vidW * 0.2),
        y: Math.round(vidH * 0.15),
        width: Math.round(vidW * 0.6),
        height: Math.round(vidH * 0.7),
      };

      // Extract 64-dimensional biometric spatial embedding vector
      const embedding = FaceVerificationService.extractEmbedding(canvas, targetBox);

      // Save to demo biometric store (local development storage, no raw photo stored)
      const template: StaffFaceTemplate = {
        id: `tmpl-${effectiveUserId}-${Date.now()}`,
        user_id: effectiveUserId,
        user_name: effectiveUserName,
        role: effectiveRole,
        embedding,
        enrolled_at: new Date().toISOString(),
        demo_mode: true,
        device_info: `${navigator.userAgent.slice(0, 45)}... (Live Camera)`,
      };

      demoFaceStore.saveStaffTemplate(template);
      setEnrolledTemplate(template);
      setEnrollmentSuccess(true);
      stopCameraStream();
    } catch (err: any) {
      console.error('Enrollment error:', err);
      setCameraErrorMessage(err.message || 'Failed to generate facial embedding template.');
    } finally {
      setIsCapturing(false);
    }
  };

  const diagnostics = FaceVerificationService.getDiagnostics();
  const directAppUrl = FaceVerificationService.getDirectAppUrl();

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-100 text-blue-800 border border-blue-200">
              OFFICER ENROLLMENT
            </span>
            <span className="text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-mono">/tester/identity/enroll</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Live Face Biometric Enrollment
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Register authorized Legal Metrology staff facial biometric template using your real webcam.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/tester/identity')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
          >
            <span>Proceed to Verification</span>
            <ArrowRight className="w-4 h-4 text-emerald-600" />
          </button>
        </div>
      </div>

      {/* Staff Identity Summary Banner */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-[11px] text-slate-400 uppercase font-semibold">Staff Identity Registration</div>
          <div className="font-bold text-slate-900 text-base">{effectiveUserName}</div>
          <div className="text-slate-500 font-mono text-xs">{effectiveRole} &bull; ID: {effectiveUserId}</div>
        </div>

        <div className="text-right">
          <div className="text-[11px] text-slate-400 uppercase font-semibold">Current Registration</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${enrolledTemplate ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <span className="text-xs font-semibold text-slate-700">
              {enrolledTemplate ? 'Template Active' : 'Not Registered'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Viewport & Enrollment Workspace */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        {/* Camera Viewport Area */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-4/3 max-w-xl mx-auto flex items-center justify-center border-2 border-slate-800 shadow-inner">
          <canvas ref={canvasRef} className="hidden" />

          {/* Real Live Video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover -scale-x-100 ${
              cameraState === 'READY' ? 'block' : 'hidden'
            }`}
          />

          {/* Idle State */}
          {cameraState === 'IDLE' && (
            <div className="text-center p-8 space-y-4 max-w-md mx-auto text-slate-300">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-blue-400 shadow-lg">
                <Camera className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Camera Inactive
                </h3>
                <p className="text-xs text-slate-400">
                  Click below to activate your camera and register your facial template.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleStartLiveCamera()}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 inline-flex items-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Start Live Camera</span>
              </button>
            </div>
          )}

          {/* Requesting State */}
          {cameraState === 'REQUESTING' && (
            <div className="text-center p-8 space-y-3 text-slate-300 max-w-sm mx-auto">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-400" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">Requesting camera permission...</p>
                <p className="text-xs text-slate-400">
                  Click &quot;Allow&quot; in the browser prompt to start enrollment.
                </p>
              </div>
            </div>
          )}

          {/* Blocked State */}
          {cameraState === 'BLOCKED' && (
            <div className="text-center p-6 space-y-4 max-w-md mx-auto text-slate-300">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-amber-300">
                  Camera access is unavailable
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Please verify that camera permissions are allowed in your browser settings.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleStartLiveCamera()}
                  className="px-3.5 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Retry Camera
                </button>
              </div>
            </div>
          )}

          {/* Permission Denied */}
          {cameraState === 'NO_PERMISSION' && (
            <div className="text-center p-6 space-y-3 max-w-md mx-auto text-slate-300">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-rose-400">Camera permission was denied.</h3>
                <p className="text-xs text-slate-400">
                  Please allow camera access in your browser site permissions to register your face.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleStartLiveCamera()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                Retry
              </button>
            </div>
          )}

          {/* No Camera Device */}
          {cameraState === 'NO_CAMERA' && (
            <div className="text-center p-6 space-y-3 max-w-md mx-auto text-slate-300">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-amber-400">No camera device was found.</h3>
                <p className="text-xs text-slate-400">Attach a camera to complete live face enrollment.</p>
              </div>
            </div>
          )}

          {/* Generic Error */}
          {cameraState === 'ERROR' && (
            <div className="text-center p-6 space-y-3 max-w-md mx-auto text-slate-300">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-rose-400">Unable to access the camera.</h3>
                <p className="text-xs text-slate-400">{cameraErrorMessage || 'Hardware error'}</p>
              </div>
            </div>
          )}

          {/* Active Live Video Stream Overlays */}
          {cameraState === 'READY' && (
            <>
              {/* LIVE CAMERA Indicator */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 text-white text-[10px] font-mono border border-slate-700 backdrop-blur-md shadow-xs">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="font-bold">LIVE CAMERA</span>
              </div>

              {/* Face Guide Oval */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className={`w-52 h-64 rounded-[50%] border-2 transition-all duration-300 shadow-2xl ${
                    detectionState === 'ONE_FACE'
                      ? 'border-emerald-400 bg-emerald-500/10 shadow-emerald-500/20'
                      : detectionState === 'MULTIPLE_FACES'
                      ? 'border-rose-500 bg-rose-500/10'
                      : 'border-white/40 border-dashed'
                  }`}
                />
              </div>

              {/* Dynamic Bounding Box Reticle */}
              {detection?.box && detectionState === 'ONE_FACE' && (
                <div
                  className="absolute border-2 border-emerald-400 bg-emerald-400/10 rounded-2xl pointer-events-none transition-all duration-75 shadow-sm"
                  style={{
                    right: `${(((videoRef.current?.videoWidth || 640) - detection.box.x - detection.box.width) / (videoRef.current?.videoWidth || 640)) * 100}%`,
                    top: `${(detection.box.y / (videoRef.current?.videoHeight || 480)) * 100}%`,
                    width: `${(detection.box.width / (videoRef.current?.videoWidth || 640)) * 100}%`,
                    height: `${(detection.box.height / (videoRef.current?.videoHeight || 480)) * 100}%`,
                  }}
                >
                  <div className="absolute -top-5 left-1 bg-emerald-700/90 text-white text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs">
                    <span>1 FACE DETECTED</span>
                    <span className="text-emerald-200">{detection.qualityScore}%</span>
                  </div>
                </div>
              )}

              {/* Status Bar Overlay */}
              <div className="absolute bottom-3 inset-x-3 px-3.5 py-2.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {detectionState === 'ONE_FACE' ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  ) : detectionState === 'MULTIPLE_FACES' ? (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  )}
                  <span className="font-semibold text-[11px]">
                    {detection?.statusMessage || 'Initializing detection...'}
                  </span>
                </div>

                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  detectionState === 'ONE_FACE'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : detectionState === 'MULTIPLE_FACES'
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {detectionState}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Camera Selector and Controls */}
        {cameraState === 'READY' && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Video Input:</span>
              {availableCameras.length > 1 ? (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => handleSwitchCamera(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                >
                  {availableCameras.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-mono text-slate-600">
                  {availableCameras[0]?.label || 'Front Camera (Webcam)'}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={stopCameraStream}
              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
            >
              Stop Camera
            </button>
          </div>
        )}

        {/* Action Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {cameraState === 'IDLE' ? (
            <button
              type="button"
              onClick={() => handleStartLiveCamera()}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md inline-flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>Start Live Camera</span>
            </button>
          ) : cameraState === 'READY' ? (
            <button
              type="button"
              disabled={detectionState !== 'ONE_FACE' || isCapturing}
              onClick={handleCaptureAndEnroll}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>{isCapturing ? 'Generating Face Template...' : 'Capture & Enroll Face'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleStartLiveCamera()}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
            >
              Restart Camera
            </button>
          )}

          {enrollmentSuccess ? (
            <div className="px-4 py-2 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>Face enrollment completed.</span>
            </div>
          ) : null}
        </div>

        {/* Enrollment Completed Card */}
        {enrollmentSuccess && enrolledTemplate && (
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">Face Enrollment Completed</h3>
                  <p className="text-xs text-emerald-800">Biometric template successfully registered for {effectiveUserName}.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/tester/identity')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm"
              >
                <span>Go to Verification</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-white/90 rounded-xl border border-emerald-200 text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Template ID:</span>
                <span className="font-bold text-slate-800">{enrolledTemplate.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Vector Dimensions:</span>
                <span className="font-bold text-slate-800">64-d Normalized Spatial Histogram</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Enrolled At:</span>
                <span className="text-slate-700">{new Date(enrolledTemplate.enrolled_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Raw Photo Stored:</span>
                <span className="font-bold text-emerald-700">NO (Zero Raw Biometric Storage)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Diagnostics Section */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-left font-semibold text-slate-700 hover:bg-slate-200/60 transition-colors"
        >
          <span>Development & Testing Diagnostics</span>
          {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showDiagnostics && (
          <div className="p-4 border-t border-slate-200 space-y-3 bg-white font-mono text-[11px]">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Camera API:</span>
                <strong className={diagnostics.cameraApiAvailable ? 'text-emerald-700' : 'text-rose-700'}>
                  {diagnostics.cameraApiAvailable ? 'Available' : 'Unavailable'}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Secure Context (HTTPS):</span>
                <strong className={diagnostics.isSecureContext ? 'text-emerald-700' : 'text-amber-700'}>
                  {diagnostics.isSecureContext ? 'Yes (Secure)' : 'No (Insecure HTTP)'}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Top-Level Window:</span>
                <strong className={diagnostics.isTopLevel ? 'text-emerald-700' : 'text-amber-700'}>
                  {diagnostics.isTopLevel ? 'Yes (Direct Tab)' : 'No (Inside Iframe)'}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Embedded Frame:</span>
                <strong className={diagnostics.isIframe ? 'text-slate-700' : 'text-slate-700'}>
                  {diagnostics.isIframe ? 'Active' : 'Standard'}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Camera State:</span>
                <strong className="text-blue-700">{cameraState}</strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Camera Devices:</span>
                <strong className={availableCameras.length > 0 ? 'text-emerald-700' : 'text-slate-500'}>
                  {availableCameras.length > 0 ? `${availableCameras.length} Found` : 'Not Enumerated'}
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
