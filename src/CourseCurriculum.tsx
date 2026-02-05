import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCirclePlay,
  faFileText,
  faFilePdf,
  faDumbbell,
  faClipboardCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faLayerGroup,
  faBookBookmark,
  faBullseye,
  faTriangleExclamation,
  faListCheck,
  faCode,
  faAddressCard,
  faRobot,
  faNoteSticky,
  faPaperclip,
  faCommentDots,
  faFolderOpen,
  faFileWord,
  faFileExcel,
  faFilePowerpoint,
  faFileImage,
  faFileZipper,
  faFile,
  faDownload,
  faThumbsUp,
  faLightbulb,
  faStar,
  faCircleCheck,
  faCircleXmark,
  faRotateRight,
  faArrowRight,
  faArrowLeft,
  faEye,
  faClock,
  faTrophy,
  faCalendarDays,
  faPlay,
  faTerminal,
  faXmark,
  faCheck,
  faSpinner,
  faMemory,
  faChevronUp,
  faSun,
  faMoon,
  faDatabase,
  faTrash,
  faCircleQuestion,
  faPaperPlane,
  faClipboardList,
  faCheckCircle,
  faTimesCircle,
} from '@fortawesome/sharp-light-svg-icons';
import videojs from 'video.js';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
// PGlite is imported dynamically in handleRunExerciseCode
import { useBrand } from './BrandContext';
import ProfileDropdown from './ProfileDropdown';
import AILearningAssistant from './AILearningAssistant';
import SQLHelpModal from './SQLHelpModal';
import { firebaseService } from './services/firebase_service';
import { judge0Service } from './services/judge0_service';

// Configure Monaco Environment for Vite
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker();
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  }
};

// Configure Monaco Editor loader
import('@monaco-editor/react').then((module) => {
  if (module.loader) {
    module.loader.config({ monaco });
  }
});

interface LectureItem {
  id: number;
  type: string;
  title: string;
  duration: string;
  videoUrl?: string;
  // Heavy data - loaded on demand from lectures subcollection
  textContent?: string;
  quizQuestions?: any[];
  exerciseQuestions?: any[];
  assessmentQuestions?: any[];
  attachments?: Attachment[];
  isContentLoaded?: boolean; // Flag to track if heavy data is loaded
}

interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size?: string;
}

interface Feedback {
  id: string;
  userId: string;
  userName: string;
  userInitials: string;
  rating: 'helpful' | 'needs-improvement' | 'excellent';
  comment: string;
  createdAt: any;
  updatedAt?: any;
}

interface CourseCurriculumProps {
  courseName: string;
  courseSlug: string;
  curriculumData: any[];
  isLoading?: boolean;
  onBack: () => void;
  currentUser?: any;
  collegeName?: string;
  brandTheme?: any;
  enrollmentId?: string; // Only for enrolled students
  // ProfileDropdown callbacks
  onEditProfile?: () => void;
  onDownloadBrowser?: () => void;
  onViewLoginDetails?: () => void;
  onAddUniversity?: () => void;
  onSignOut?: () => void;
  isSecureBrowser?: boolean;
  // Tool callbacks
  onOpenCodingLab?: () => void;
  onOpenResumeBuilder?: () => void;
}

// Nuevo Plugin License Key
const NUEVO_LICENSE_KEY = "1012455c160e505f17175e5a0a131f500b0a";

// Logo Component
function Logo({ size = 'medium', showText = true, brand, collegeName }: { size?: 'small' | 'medium' | 'large', showText?: boolean, brand: any, collegeName?: string }) {
  const sizeClasses = {
    small: 'w-10 h-10',
    medium: 'w-12 h-12',
    large: 'w-14 h-14'
  };
  
  const mainTextSizes = {
    small: 'text-base',
    medium: 'text-xl',
    large: 'text-2xl'
  };
  
  const subTextSizes = {
    small: 'text-[10px]',
    medium: 'text-xs',
    large: 'text-sm'
  };
  
  return (
    <div className="flex items-center space-x-3">
      <div 
        className={`${sizeClasses[size]} rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden group`}
        style={{ background: brand.gradients.primary }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent animate-pulse"></div>
        <div className="relative z-10">
          <div className="relative">
            <div className={`bg-white rounded shadow-md relative transform group-hover:scale-110 transition-transform duration-300 ${
              size === 'small' ? 'p-1.5' : size === 'medium' ? 'p-2' : 'p-2.5'
            }`}>
              <div className="space-y-0.5">
                <div className={`bg-gradient-to-r from-blue-400 to-purple-400 rounded-full ${
                  size === 'small' ? 'h-0.5 w-3' : size === 'medium' ? 'h-0.5 w-4' : 'h-1 w-5'
                }`}></div>
                <div className={`bg-gradient-to-r from-purple-400 to-pink-400 rounded-full ${
                  size === 'small' ? 'h-0.5 w-2' : size === 'medium' ? 'h-0.5 w-3' : 'h-1 w-4'
                }`}></div>
                <div className={`bg-gradient-to-r from-pink-400 to-orange-400 rounded-full ${
                  size === 'small' ? 'h-0.5 w-2.5' : size === 'medium' ? 'h-0.5 w-3.5' : 'h-1 w-4.5'
                }`}></div>
              </div>
              <div className={`absolute bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-md ${
                size === 'small' ? '-top-1 -right-1 w-3 h-3' : size === 'medium' ? '-top-1 -right-1 w-3.5 h-3.5' : '-top-1.5 -right-1.5 w-4 h-4'
              }`}>
                <svg 
                  width={size === 'small' ? '8' : size === 'medium' ? '9' : '10'} 
                  height={size === 'small' ? '8' : size === 'medium' ? '9' : '10'} 
                  viewBox="0 0 12 12" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <div className={`absolute bg-blue-400 rounded-full animate-pulse ${
              size === 'small' ? '-top-0.5 -left-0.5 w-1 h-1' : size === 'medium' ? '-top-1 -left-1 w-1.5 h-1.5' : '-top-1 -left-1 w-2 h-2'
            }`}></div>
            <div className={`absolute bg-purple-400 rounded-full animate-pulse ${
              size === 'small' ? '-bottom-0.5 -right-0.5 w-1 h-1' : size === 'medium' ? '-bottom-1 -right-1 w-1.5 h-1.5' : '-bottom-1 -right-1 w-2 h-2'
            }`} style={{animationDelay: '0.3s'}}></div>
          </div>
        </div>
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={`${mainTextSizes[size]} font-bold text-gray-900 leading-tight`}>
            EXAMINERS
          </span>
          {collegeName && (
            <span className={`${subTextSizes[size]} text-gray-500 leading-tight`}>
              {collegeName}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const CourseCurriculum: React.FC<CourseCurriculumProps> = ({
  courseName,
  courseSlug,
  curriculumData,
  isLoading = false,
  onBack,
  currentUser,
  collegeName,
  brandTheme,
  enrollmentId,
  onEditProfile,
  onDownloadBrowser,
  onViewLoginDetails,
  onAddUniversity,
  onSignOut,
  isSecureBrowser = false,
}) => {
  const brand = useBrand();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
  const [selectedLecture, setSelectedLecture] = useState<LectureItem | null>(null);
  const [currentChapterName, setCurrentChapterName] = useState<string>('');
  const [pluginsLoaded, setPluginsLoaded] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [playerActive, setPlayerActive] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false); // Video buffering state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showCurriculumInExercise, setShowCurriculumInExercise] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false); // Loading heavy content
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'notes' | 'attachments' | 'feedback'>('notes');
  const [isTabsOpen, setIsTabsOpen] = useState(false); // Collapsed by default
  const [feedbackRating, setFeedbackRating] = useState<'helpful' | 'needs-improvement' | 'excellent' | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [userFeedback, setUserFeedback] = useState<Feedback | null>(null); // User's existing feedback
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [isEditingFeedback, setIsEditingFeedback] = useState(false);
  
  // Use ref for feedback text to prevent re-renders while typing
  const feedbackTextRef = useRef<string>('');
  const feedbackTextareaRef = useRef<HTMLTextAreaElement>(null);
  // Track if submit button should be enabled (only updates on blur/rating change)
  const [canSubmitFeedback, setCanSubmitFeedback] = useState(false);
  
  // Quiz state
  const [quizStage, setQuizStage] = useState<'start' | 'quiz' | 'results'>('start');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [previousQuizResult, setPreviousQuizResult] = useState<any>(null);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [quizElapsedTime, setQuizElapsedTime] = useState<number>(0);
  const [isSavingQuiz, setIsSavingQuiz] = useState(false);
  const [showRetakeConfirm, setShowRetakeConfirm] = useState(false);
  const [showQuizExitWarning, setShowQuizExitWarning] = useState(false);
  const [pendingLectureSwitch, setPendingLectureSwitch] = useState<{ item: any; chapterTitle?: string } | null>(null);
  const [isNavigatingQuestion, setIsNavigatingQuestion] = useState<'prev' | 'next' | null>(null);
  
  // Exercise state
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [exerciseCode, setExerciseCode] = useState<string>('');
  const [exerciseOutput, setExerciseOutput] = useState<string>('');
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [executionTime, setExecutionTime] = useState<string>('--');
  const [executionMemory, setExecutionMemory] = useState<string>('--');
  const exerciseEditorRef = useRef<any>(null);
  
  // Exercise panel resizer state
  const [exerciseLeftPanelWidth, setExerciseLeftPanelWidth] = useState(40); // percentage
  const [exerciseTerminalHeight, setExerciseTerminalHeight] = useState(150); // pixels
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('light');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  
  // PGlite (PostgreSQL in browser) for SQL exercises
  const pgliteRef = useRef<any>(null);
  const [pgliteReady, setPgliteReady] = useState(false);
  const [pgliteLoading, setPgliteLoading] = useState(false);
  const [showSQLHelpModal, setShowSQLHelpModal] = useState(false);

  // Exercise submission state
  const [isSubmittingExercise, setIsSubmittingExercise] = useState(false);
  const [exerciseSubmission, setExerciseSubmission] = useState<{
    submittedCode: string;
    submittedAt: any;
    status: 'pending' | 'evaluated';
    attempts: number;
    evaluation?: {
      isCorrect: boolean;
      score: number;
      feedback: string;
      isOptimized: boolean;
      suggestions: string;
      evaluatedAt: any;
    };
  } | null>(null);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [isLoadingSubmission, setIsLoadingSubmission] = useState(false);
  // Map of all submissions for current lecture: { visibilityId: submission }
  const [allExerciseSubmissions, setAllExerciseSubmissions] = useState<Record<string, any>>({});

  // Close language dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setShowLanguageDropdown(false);
      }
    };

    if (showLanguageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLanguageDropdown]);
  
  // Feedback data from Firebase
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  
  // Helper to check if feedback can be edited (within 1 hour of creation)
  const canEditFeedback = useCallback((feedback: Feedback): boolean => {
    if (!feedback.createdAt) return false;
    const createdTime = feedback.createdAt?.toDate ? feedback.createdAt.toDate() : new Date(feedback.createdAt);
    const now = new Date();
    const hourInMs = 60 * 60 * 1000; // 1 hour in milliseconds
    return (now.getTime() - createdTime.getTime()) < hourInMs;
  }, []);
  
  // Format date for display
  const formatFeedbackDate = useCallback((timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }, []);
  
  // Track if feedback has been loaded
  const feedbackLoadedRef = useRef(false);
  
  // Fetch feedback for the course (only once)
  useEffect(() => {
    const fetchFeedback = async () => {
      if (!courseSlug || feedbackLoadedRef.current) return;
      
      feedbackLoadedRef.current = true;
      setIsLoadingFeedback(true);
      try {
        // Fetch all course feedback
        const allFeedback = await firebaseService.getCourseFeedback(courseSlug);
        setFeedbacks(allFeedback.map(f => ({
          id: f.feedbackId,
          userId: f.userId,
          userName: f.userName,
          userInitials: f.userInitials,
          rating: f.rating,
          comment: f.comment,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt
        })));
        
        // Find user's own feedback if logged in
        if (currentUser?.userId || currentUser?.uid) {
          const oderId = currentUser.userId || currentUser.uid;
          const myFeedback = allFeedback.find(f => f.userId === oderId);
          if (myFeedback) {
            setUserFeedback({
              id: myFeedback.feedbackId,
              userId: myFeedback.userId,
              userName: myFeedback.userName,
              userInitials: myFeedback.userInitials,
              rating: myFeedback.rating,
              comment: myFeedback.comment,
              createdAt: myFeedback.createdAt,
              updatedAt: myFeedback.updatedAt
            });
          }
        }
      } catch (error) {
        console.error('Error fetching feedback:', error);
      } finally {
        setIsLoadingFeedback(false);
      }
    };
    
    fetchFeedback();
  }, [courseSlug, currentUser?.userId, currentUser?.uid]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Get chapter name for a given lecture
  const getChapterNameForLecture = (lectureId: string): string => {
    for (const section of curriculumData) {
      for (const chapter of (section.chapters || [])) {
        const found = (chapter.items || []).find((item: any) => item.id === lectureId);
        if (found) return chapter.title;
      }
    }
    return '';
  };

  // State for loading previous quiz result
  const [isLoadingPreviousResult, setIsLoadingPreviousResult] = useState(false);

  // Fetch previous quiz result when selecting a quiz lecture (only for enrolled students)
  // This runs in background - doesn't block UI
  useEffect(() => {
    // Reset previous result immediately when lecture changes
    setPreviousQuizResult(null);
    
    const lectureType = selectedLecture?.type?.toLowerCase();
    if (!enrollmentId || (lectureType !== 'quiz' && lectureType !== 'mcq')) {
      setIsLoadingPreviousResult(false);
      return;
    }
    
    setIsLoadingPreviousResult(true);
    
    // Fetch in background - don't block
    firebaseService.getQuizResult(enrollmentId, selectedLecture!.id.toString())
      .then(result => {
        // Only update if we're still on the same lecture
        setPreviousQuizResult(result);
      })
      .catch(error => {
        console.error('Error fetching quiz result:', error);
      })
      .finally(() => {
        setIsLoadingPreviousResult(false);
      });
  }, [enrollmentId, selectedLecture?.id, selectedLecture?.type]);

  // Quiz timer - runs when quiz is active
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (quizStage === 'quiz' && quizStartTime > 0) {
      interval = setInterval(() => {
        setQuizElapsedTime(Math.floor((Date.now() - quizStartTime) / 1000));
      }, 1000);
    } else {
      setQuizElapsedTime(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [quizStage, quizStartTime]);

  // Watch for logout - if currentUser becomes null, go back
  useEffect(() => {
    if (!currentUser) {
      onBack();
    }
  }, [currentUser, onBack]);

  // Expand all sections and chapters on load
  useEffect(() => {
    if (curriculumData.length > 0) {
      setExpandedSections(curriculumData.map((section: any) => section.id));
      setExpandedChapters(curriculumData.flatMap((section: any) => 
        (section.chapters || []).map((chapter: any) => chapter.id)
      ));
      
      // Auto-select first lecture (light data only)
      const firstSection = curriculumData[0];
      if (firstSection?.chapters?.[0]?.items?.[0]) {
        const firstItem = firstSection.chapters[0].items[0];
        const firstChapterName = firstSection.chapters[0].title || '';
        setSelectedLecture({
          id: firstItem.id,
          type: firstItem.type,
          title: firstItem.title,
          duration: firstItem.duration,
          videoUrl: firstItem.videoUrl,
          isContentLoaded: false, // Heavy content loaded on demand
        });
        setCurrentChapterName(firstChapterName);
      }
    }
  }, [curriculumData]);

  // Load Nuevo plugin scripts
  useEffect(() => {
    // Load Nuevo Skin CSS
    if (!document.getElementById('nuevo-skin-css')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/videojs/skins/gold1/videojs.min.css';
      link.id = 'nuevo-skin-css';
      document.head.appendChild(link);
    }

    // Make videojs globally available
    (window as any).videojs = videojs;

    // Check if script already loaded
    if (document.getElementById('nuevo-plugin-script')) {
      setPluginsLoaded(true);
      return;
    }

    // Load Nuevo Plugin Script
    const script = document.createElement('script');
    script.src = '/videojs/nuevo.min.js';
    script.async = false;
    script.id = 'nuevo-plugin-script';

    script.onload = () => {
      setTimeout(() => setPluginsLoaded(true), 100);
    };

    script.onerror = () => {
      console.error('Failed to load nuevo.min.js');
      setPluginsLoaded(true);
    };

    document.body.appendChild(script);
  }, []);

  // Initialize video player
  useEffect(() => {
    if (!videoRef.current || !pluginsLoaded || !selectedLecture || selectedLecture.type.toLowerCase() !== 'video') {
      setPlayerActive(false);
      return;
    }

    setVideoError(null);
    setPlayerActive(false);

    // Check if video URL exists
    if (!selectedLecture.videoUrl) {
      setVideoError('No video URL available for this lecture.');
      return;
    }

    const initTimeout = setTimeout(() => {
      if (!videoRef.current) return;

      // Dispose existing player
      if (playerRef.current) {
        try {
          if (!playerRef.current.isDisposed()) {
            playerRef.current.dispose();
          }
        } catch (e) {
          // Ignore dispose errors
        }
        playerRef.current = null;
      }

      const videoUrl = selectedLecture.videoUrl;
      
      // Determine video type based on URL
      let videoType = 'video/mp4';
      if (videoUrl.includes('.m3u8')) {
        videoType = 'application/x-mpegURL';
      } else if (videoUrl.includes('.webm')) {
        videoType = 'video/webm';
      } else if (videoUrl.includes('.ogg')) {
        videoType = 'video/ogg';
      }

      try {
        setIsVideoLoading(true); // Start loading
        
        const player = videojs(videoRef.current, {
          license: NUEVO_LICENSE_KEY,
          controls: true,
          autoplay: false,
          preload: 'auto',
          fluid: true,
          responsive: true,
          bigPlayButton: true,
          html5: {
            vhs: {
              withCredentials: false
            }
          },
          sources: [{
            src: videoUrl,
            type: videoType,
            withCredentials: false
          }]
        });

        playerRef.current = player;
        setPlayerActive(true);

        player.ready(() => {
          const playerInstance = player as any;
          if (playerInstance.nuevo) {
            try {
              playerInstance.nuevo({
                license: NUEVO_LICENSE_KEY,
                skin: 'gold1',
                title: selectedLecture.title,
                shareTitle: selectedLecture.title,
                buttonRewind: true,
                buttonForward: true,
                settingsButton: false,
                contextMenu: false
              });
            } catch (err) {
              // Nuevo initialization failed silently
            }
          }
        });

        // Video can play - stop loading indicator
        player.on('canplay', () => {
          setIsVideoLoading(false);
        });
        
        // Also stop on loadeddata
        player.on('loadeddata', () => {
          setIsVideoLoading(false);
        });
        
        // Show loading when waiting/buffering
        player.on('waiting', () => {
          setIsVideoLoading(true);
        });
        
        // Hide loading when playing
        player.on('playing', () => {
          setIsVideoLoading(false);
        });

        player.on('error', () => {
          setIsVideoLoading(false);
          const error = player.error();
          setPlayerActive(false);
          if (error) {
            if (error.code === 2) {
              setVideoError('Network Error. Video is not accessible.');
            } else if (error.code === 4) {
              setVideoError('Video format not supported or stream unavailable.');
            } else {
              setVideoError('An error occurred while playing the video.');
            }
          } else {
            setVideoError('Failed to load video. Please try again later.');
          }
        });
      } catch (err) {
        setVideoError('Failed to initialize video player.');
        setPlayerActive(false);
      }
    }, 50);

    return () => {
      clearTimeout(initTimeout);
    };
  }, [selectedLecture?.id, pluginsLoaded]);

  // Cleanup player on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  // Load all exercise submissions when lecture changes (for enrolled students)
  useEffect(() => {
    const loadAllExerciseSubmissions = async () => {
      if (!enrollmentId || !selectedLecture || selectedLecture.type !== 'exercise') {
        setExerciseSubmission(null);
        setAllExerciseSubmissions({});
        return;
      }

      // Wait for content to be loaded
      if (!selectedLecture.isContentLoaded) {
        return;
      }

      setIsLoadingSubmission(true);
      try {
        // Fetch ALL submissions for this enrollment in ONE call
        const submissions = await firebaseService.getAllExerciseSubmissions(enrollmentId);
        
        // Convert array to map using visibilityId as key
        const submissionsMap: Record<string, any> = {};
        submissions.forEach((submission: any) => {
          // Use document id or visibilityId as key
          const key = submission.visibilityId || submission.id;
          submissionsMap[key] = submission;
        });
        
        console.log('📚 Loaded exercise submissions:', Object.keys(submissionsMap));
        setAllExerciseSubmissions(submissionsMap);
        
        // Get exercise questions
        let exerciseQuestions: any[] = [];
        try {
          exerciseQuestions = selectedLecture.exerciseQuestions 
            ? (typeof selectedLecture.exerciseQuestions === 'string' 
                ? JSON.parse(selectedLecture.exerciseQuestions) 
                : selectedLecture.exerciseQuestions)
            : [];
        } catch (e) {
          exerciseQuestions = [];
        }
        
        // Set current exercise submission
        const currentExercise = exerciseQuestions[currentExerciseIndex];
        if (currentExercise) {
          const currentSubmissionId = `${selectedLecture.id}_${currentExercise.exercise_id}`;
          const currentSubmission = submissionsMap[currentSubmissionId];
          if (currentSubmission) {
            console.log('📝 Found current submission:', currentSubmissionId);
            setExerciseSubmission(currentSubmission);
            if (currentSubmission.submittedCode) {
              setExerciseCode(currentSubmission.submittedCode);
            }
          } else {
            setExerciseSubmission(null);
          }
        }
      } catch (error) {
        console.error('Error loading exercise submissions:', error);
        setExerciseSubmission(null);
        setAllExerciseSubmissions({});
      } finally {
        setIsLoadingSubmission(false);
      }
    };

    loadAllExerciseSubmissions();
  }, [enrollmentId, selectedLecture?.id, selectedLecture?.type, selectedLecture?.isContentLoaded]);

  // Real-time listener for current exercise submission (to update when evaluation completes)
  useEffect(() => {
    if (!enrollmentId || !selectedLecture || selectedLecture.type !== 'exercise' || !selectedLecture.isContentLoaded) {
      return;
    }

    // Get current exercise
    let exerciseQuestions: any[] = [];
    try {
      exerciseQuestions = selectedLecture.exerciseQuestions 
        ? (typeof selectedLecture.exerciseQuestions === 'string' 
            ? JSON.parse(selectedLecture.exerciseQuestions) 
            : selectedLecture.exerciseQuestions)
        : [];
    } catch (e) {
      return;
    }

    const currentExercise = exerciseQuestions[currentExerciseIndex];
    if (!currentExercise) return;

    const submissionId = `${selectedLecture.id}_${currentExercise.exercise_id}`;
    
    // Set up real-time listener
    const unsubscribe = firebaseService.onExerciseSubmissionUpdate(
      enrollmentId,
      submissionId,
      (submission) => {
        if (submission) {
          console.log('🔄 Real-time update for submission:', submissionId, submission.status);
          setExerciseSubmission(submission);
          // Update in allExerciseSubmissions map too
          setAllExerciseSubmissions(prev => ({
            ...prev,
            [submissionId]: submission
          }));
        }
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [enrollmentId, selectedLecture?.id, selectedLecture?.type, selectedLecture?.isContentLoaded, currentExerciseIndex]);

  // Update current submission when exercise index changes
  useEffect(() => {
    if (!selectedLecture || selectedLecture.type !== 'exercise') return;
    
    let exerciseQuestions: any[] = [];
    try {
      exerciseQuestions = selectedLecture.exerciseQuestions 
        ? (typeof selectedLecture.exerciseQuestions === 'string' 
            ? JSON.parse(selectedLecture.exerciseQuestions) 
            : selectedLecture.exerciseQuestions)
        : [];
    } catch (e) {
      exerciseQuestions = [];
    }

    const currentExercise = exerciseQuestions[currentExerciseIndex];
    if (currentExercise) {
      const submissionId = `${selectedLecture.id}_${currentExercise.exercise_id}`;
      const submission = allExerciseSubmissions[submissionId];
      console.log(`📝 Exercise ${currentExerciseIndex + 1}: submissionId=${submissionId}, hasSubmission=${!!submission}`);
      if (submission) {
        console.log(`📝 Loading submitted code (${submission.submittedCode?.length || 0} chars)`);
        setExerciseSubmission(submission);
        if (submission.submittedCode) {
          setExerciseCode(submission.submittedCode);
        }
      } else {
        setExerciseSubmission(null);
        // Set default code for new exercise
        const lang = (currentExercise.prog_language || 'javascript').toLowerCase();
        let defaultCode = '';
        if (lang === 'sql') {
          defaultCode = `-- ${currentExercise.title}\n-- Write your SQL queries here\n\n`;
        } else if (lang === 'html') {
          defaultCode = `<!-- ${currentExercise.title} -->\n<!-- Write your HTML here -->\n\n`;
        } else if (lang === 'css') {
          defaultCode = `/* ${currentExercise.title} */\n/* Write your CSS here */\n\n`;
        } else if (lang === 'python') {
          defaultCode = `# ${currentExercise.title}\n# Write your Python code here\n\n`;
        } else {
          defaultCode = `// ${currentExercise.title}\n// Write your ${lang} code here\n\n`;
        }
        setExerciseCode(defaultCode);
      }
    }
  }, [currentExerciseIndex, allExerciseSubmissions, selectedLecture]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId) ? prev.filter(id => id !== sectionId) : [...prev, sectionId]
    );
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev =>
      prev.includes(chapterId) ? prev.filter(id => id !== chapterId) : [...prev, chapterId]
    );
  };

  // Load heavy content (quiz, notes, attachments) from lectures subcollection
  const loadLectureContent = async (lectureId: number) => {
    if (!courseSlug) return null;
    
    setIsLoadingContent(true);
    try {
      const content = await firebaseService.getLectureContent(courseSlug, lectureId);
      return content;
    } catch (error) {
      console.error('Error loading lecture content:', error);
      return null;
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleLectureClick = async (item: any, chapterTitle?: string) => {
    // Check if quiz is in progress (not submitted)
    if (quizStage === 'quiz' && !quizSubmitted) {
      // Store pending lecture switch and show warning
      setPendingLectureSwitch({ item, chapterTitle });
      setShowQuizExitWarning(true);
      return;
    }
    
    // Proceed with lecture switch
    performLectureSwitch(item, chapterTitle);
  };

  // Actual lecture switch logic (called after confirmation or directly)
  const performLectureSwitch = async (item: any, chapterTitle?: string) => {
    // Reset states first
    setVideoError(null);
    setPlayerActive(false);
    setIsVideoLoading(false); // Reset video loading state
    
    // Reset quiz state
    setQuizStage('start');
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setShowResults(false);
    setQuizSubmitted(false);
    setPreviousQuizResult(null);
    
    // Dispose existing player before switching
    if (playerRef.current) {
      try {
        if (!playerRef.current.isDisposed()) {
          playerRef.current.dispose();
        }
      } catch (e) {
        // Player already disposed or error during dispose
      }
      playerRef.current = null;
    }
    
    // Set light data immediately (for fast UI response)
    const lectureData: LectureItem = {
      id: item.id,
      type: item.type,
      title: item.title,
      duration: item.duration,
      videoUrl: item.videoUrl,
      isContentLoaded: false,
    };
    
    setSelectedLecture(lectureData);
    
    // Update chapter name
    if (chapterTitle) {
      setCurrentChapterName(chapterTitle);
    } else {
      setCurrentChapterName(getChapterNameForLecture(item.id));
    }
    
    // Reset tabs state when switching lectures
    setActiveTab('notes');
    setIsTabsOpen(false); // Collapse tabs on lecture switch
    
    // For non-video content (quiz, exercise, assessment, text), load heavy data in background
    // Don't await - let UI switch immediately
    const lectureType = (item.type || 'video').toLowerCase();
    if (lectureType !== 'video') {
      loadLectureContent(item.id).then(content => {
        if (content) {
          setSelectedLecture(prev => prev && prev.id === item.id ? {
            ...prev,
            textContent: content.textContent,
            quizQuestions: content.quizQuestions,
            exerciseQuestions: content.exerciseQuestions,
            assessmentQuestions: content.assessmentQuestions,
            attachments: content.attachments,
            isContentLoaded: true,
          } : prev);
        }
      });
    }
  };

  // Load content when Notes/Attachments tab is clicked (for video lectures)
  const handleTabClick = async (tab: 'notes' | 'attachments' | 'feedback') => {
    setActiveTab(tab);
    
    // If clicking notes/attachments and content not loaded, fetch it
    if ((tab === 'notes' || tab === 'attachments') && selectedLecture && !selectedLecture.isContentLoaded) {
      const content = await loadLectureContent(selectedLecture.id);
      if (content) {
        setSelectedLecture(prev => prev ? {
          ...prev,
          textContent: content.textContent,
          attachments: content.attachments,
          isContentLoaded: true,
        } : null);
      }
    }
  };

  const getItemIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'video': return faCirclePlay;
      case 'text': return faFileText;
      case 'pdf': return faFilePdf;
      case 'exercise': return faDumbbell;
      case 'quiz':
      case 'mcq':
      case 'assessment': return faClipboardCheck;
      default: return faCirclePlay;
    }
  };

  const getItemColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'video': return '#8B5CF6';
      case 'text': return '#3B82F6';
      case 'pdf': return '#EF4444';
      case 'exercise': return '#10B981';
      case 'quiz':
      case 'mcq':
      case 'assessment': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'video': return 'Video';
      case 'text': return 'Reading';
      case 'pdf': return 'PDF Document';
      case 'exercise': return 'Exercise';
      case 'quiz':
      case 'mcq': return 'Quiz';
      case 'assessment': return 'Assessment';
      default: return type;
    }
  };

  // Calculate total duration
  const getTotalDuration = () => {
    const totalSeconds = curriculumData.reduce((acc: number, sec: any) =>
      acc + (sec.chapters || []).reduce((a: number, ch: any) =>
        a + (ch.items || []).reduce((i: number, item: any) => {
          if (item.duration && item.duration.includes(':')) {
            const [mins, secs] = item.duration.split(':').map(Number);
            return i + (mins * 60) + (secs || 0);
          }
          return i;
        }, 0), 0), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const renderContent = () => {
    if (!selectedLecture) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <FontAwesomeIcon icon={faCirclePlay} className="text-6xl text-gray-300 mb-4" />
            <p className="text-gray-400 font-medium">Select a lecture to begin</p>
          </div>
        </div>
      );
    }

    const type = selectedLecture.type?.toLowerCase();

    switch (type) {
      case 'video':
        return (
          <div className="flex flex-col">
            <div
              className="relative bg-black rounded-xl overflow-hidden"
              style={{
                aspectRatio: '16/9',
                border: '2px solid #E3D4B5'
              }}
            >
              {/* Always render video element for video type with URL */}
              {selectedLecture.videoUrl && pluginsLoaded && (
                <div data-vjs-player className="w-full h-full">
                  <video
                    ref={videoRef}
                    className="video-js vjs-fluid vjs-big-play-centered vjs-show-big-play-button-on-pause"
                    playsInline
                  />
                </div>
              )}
              
              {/* Overlay states on top */}
              {!pluginsLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
                  <div className="text-center">
                    <div className="w-10 h-10 border-4 border-[#E3D4B5]/30 border-t-[#E3D4B5] rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">Loading Player...</p>
                  </div>
                </div>
              )}
              
              {/* Video buffering/loading overlay */}
              {pluginsLoaded && isVideoLoading && !videoError && selectedLecture.videoUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-white text-sm">Loading video...</p>
                  </div>
                </div>
              )}
              
              {pluginsLoaded && videoError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
                  <div className="text-center p-6">
                    <FontAwesomeIcon icon={faTriangleExclamation} className="text-4xl text-red-500 mb-3" />
                    <p className="text-white mb-2">Playback Error</p>
                    <p className="text-gray-400 text-sm">{videoError}</p>
                  </div>
                </div>
              )}
              
              {pluginsLoaded && !videoError && !selectedLecture.videoUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
                  <div className="text-center">
                    <FontAwesomeIcon icon={faCirclePlay} className="text-5xl text-gray-600 mb-3" />
                    <p className="text-gray-500">Video not available</p>
                  </div>
                </div>
              )}
            </div>
            {/* Video Title */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900">{selectedLecture.title}</h3>
              <p className="text-sm text-gray-500 mt-1">Duration: {selectedLecture.duration}</p>
            </div>
          </div>
        );

      case 'text':
        // Show loading state if content not loaded yet - full panel
        if (isLoadingContent || !selectedLecture.isContentLoaded) {
          return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600 font-medium">Loading content...</p>
            </div>
          );
        }
        
        return (
          <div>
            <div className="p-4 bg-gray-50 rounded-lg mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{selectedLecture.title}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full mt-2 inline-block" style={{ backgroundColor: `${getItemColor(type)}15`, color: getItemColor(type) }}>
                {getTypeLabel(type)}
              </span>
            </div>
            <div className="prose prose-sm max-w-none p-4 bg-white rounded-lg border border-gray-200">
              {selectedLecture.textContent ? (
                <div dangerouslySetInnerHTML={{ __html: selectedLecture.textContent }} />
              ) : (
                <p className="text-gray-500 italic">No content available</p>
              )}
            </div>
          </div>
        );

      case 'pdf':
        return (
          <div className="flex items-center justify-center bg-gray-50 rounded-lg py-12">
            <div className="text-center p-8">
              <FontAwesomeIcon icon={faFilePdf} className="text-6xl text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedLecture.title}</h3>
              <p className="text-gray-600 mb-4">PDF Document</p>
              <button
                className="px-6 py-2 rounded-lg text-white text-sm font-medium"
                style={{ background: brand.gradients.primary }}
              >
                Download PDF
              </button>
            </div>
          </div>
        );

      case 'quiz':
      case 'mcq':
        // Show loading state if content not loaded yet OR checking previous result (for enrolled students)
        if (isLoadingContent || !selectedLecture.isContentLoaded || (enrollmentId && isLoadingPreviousResult)) {
          return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <div className="w-16 h-16 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600 font-medium">Loading quiz...</p>
            </div>
          );
        }
        
        // Parse quiz questions
        let quizQuestions: any[] = [];
        try {
          if (selectedLecture.quizQuestions) {
            quizQuestions = typeof selectedLecture.quizQuestions === 'string' 
              ? JSON.parse(selectedLecture.quizQuestions) 
              : selectedLecture.quizQuestions;
          }
        } catch (e) {
          quizQuestions = [];
        }

        if (!quizQuestions || quizQuestions.length === 0) {
          return (
            <div>
              <div className="p-4 bg-gray-50 rounded-lg mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{selectedLecture.title}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full mt-2 inline-block" style={{ backgroundColor: `${getItemColor(type)}15`, color: getItemColor(type) }}>
                  {getTypeLabel(type)}
                </span>
              </div>
              <div className="flex items-center justify-center bg-gray-50 rounded-lg p-12">
                <div className="text-center">
                  <FontAwesomeIcon icon={faClipboardCheck} className="text-5xl text-purple-500 mb-4" />
                  <p className="text-gray-600">No quiz questions available</p>
                </div>
              </div>
            </div>
          );
        }

        const currentQuestion = quizQuestions[currentQuestionIndex];
        const totalQuestions = quizQuestions.length;
        const answeredCount = Object.keys(selectedAnswers).length;
        
        // Calculate score
        const calculateScore = () => {
          let correct = 0;
          quizQuestions.forEach((q: any, idx: number) => {
            if (selectedAnswers[idx] === q.option_correct) {
              correct++;
            }
          });
          return correct;
        };

        // Save quiz result to Firebase
        const handleSubmitQuiz = async () => {
          setIsSavingQuiz(true);
          const score = calculateScore();
          const timeTaken = Math.floor((Date.now() - quizStartTime) / 1000);
          const percentage = Math.round((score / totalQuestions) * 100);
          
          console.log('📝 Submitting Quiz...');
          console.log('  👤 User Type:', currentUser?.userType);
          console.log('  🎫 Enrollment ID (prop):', enrollmentId);
          
          // For students, save the quiz result
          if (currentUser?.userType === 'student' && enrollmentId) {
            try {
              const quizData = {
                lectureId: selectedLecture.id.toString(),
                lectureName: selectedLecture.title,
                score,
                totalQuestions,
                percentage,
                answers: selectedAnswers,
                timeTaken,
              };
              
              await firebaseService.saveQuizResult(enrollmentId, quizData);
              console.log('✅ Quiz result saved successfully');
              
              // Update previousQuizResult so it shows on retake
              setPreviousQuizResult({
                ...quizData,
                attemptedAt: new Date().toISOString(),
              });
            } catch (error) {
              console.error('❌ Error saving quiz result:', error);
            }
          } else if (currentUser?.userType === 'student') {
            console.warn('⚠️ No enrollmentId, quiz result not saved');
          } else {
            console.log('ℹ️ Preview mode, quiz result not saved');
          }
          
          setIsSavingQuiz(false);
          setQuizSubmitted(true);
          setQuizStage('results');
        };

        // Start Quiz handler
        const handleStartQuiz = (isRetake: boolean = false) => {
          if (isRetake && previousQuizResult) {
            setShowRetakeConfirm(true);
            return;
          }
          startQuiz();
        };
        
        const startQuiz = () => {
          setShowRetakeConfirm(false);
          setCurrentQuestionIndex(0);
          setSelectedAnswers({});
          setQuizStartTime(Date.now());
          setQuizStage('quiz');
        };

        // Retake Confirmation Modal
        const RetakeConfirmModal = () => (
          showRetakeConfirm ? (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <FontAwesomeIcon icon={faTriangleExclamation} className="text-white text-lg" />
                    </div>
                    <h3 className="text-white font-semibold text-lg">Retake Quiz?</h3>
                  </div>
                </div>
                
                {/* Content */}
                <div className="px-6 py-5">
                  <p className="text-gray-600 mb-4">
                    Your previous score of <span className="font-bold text-violet-600">{previousQuizResult?.percentage}%</span> will be overwritten with your new attempt.
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                    <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" />
                    This action cannot be undone.
                  </div>
                </div>
                
                {/* Actions */}
                <div className="px-6 py-4 bg-gray-50 flex gap-3 justify-end">
                  <button
                    onClick={() => setShowRetakeConfirm(false)}
                    className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startQuiz}
                    className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-pink-500 text-white font-medium hover:opacity-90 transition-opacity"
                  >
                    Yes, Retake Quiz
                  </button>
                </div>
              </div>
            </div>
          ) : null
        );

        // Quiz Exit Warning Modal
        const QuizExitWarningModal = () => (
          showQuizExitWarning ? (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-red-500 to-orange-500">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <FontAwesomeIcon icon={faTriangleExclamation} className="text-white text-lg" />
                    </div>
                    <h3 className="text-white font-semibold text-lg">Leave Quiz?</h3>
                  </div>
                </div>
                
                {/* Content */}
                <div className="px-6 py-5">
                  <p className="text-gray-600 mb-4">
                    You have an <span className="font-bold text-red-600">unsubmitted quiz</span> in progress. If you leave now, your answers will be lost.
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-700 text-sm font-medium mb-1">
                      <FontAwesomeIcon icon={faTriangleExclamation} />
                      Progress will not be saved
                    </div>
                    <p className="text-xs text-red-600">
                      You have answered {Object.keys(selectedAnswers).length} of {quizQuestions.length} questions.
                    </p>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="px-6 py-4 bg-gray-50 flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowQuizExitWarning(false);
                      setPendingLectureSwitch(null);
                    }}
                    className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                  >
                    Continue Quiz
                  </button>
                  <button
                    onClick={() => {
                      setShowQuizExitWarning(false);
                      if (pendingLectureSwitch) {
                        performLectureSwitch(pendingLectureSwitch.item, pendingLectureSwitch.chapterTitle);
                        setPendingLectureSwitch(null);
                      }
                    }}
                    className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white font-medium hover:opacity-90 transition-opacity"
                  >
                    Leave Quiz
                  </button>
                </div>
              </div>
            </div>
          ) : null
        );

        // START PAGE
        if (quizStage === 'start') {
          return (
            <>
              <RetakeConfirmModal />
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-violet-600 to-pink-500">
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={faClipboardCheck} className="text-white/80 text-xl" />
                    <div>
                      <h2 className="text-white font-semibold text-lg">{selectedLecture.title}</h2>
                      <p className="text-white/70 text-sm">Test your knowledge</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* Quiz Info */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-violet-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-violet-600">{totalQuestions}</div>
                    <div className="text-sm text-gray-600">Questions</div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">~{Math.ceil(totalQuestions * 0.5)}</div>
                    <div className="text-sm text-gray-600">Minutes</div>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">MCQ</div>
                    <div className="text-sm text-gray-600">Type</div>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FontAwesomeIcon icon={faLightbulb} className="text-amber-500" />
                    Instructions
                  </h3>
                  <ul className="space-y-3 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0"></span>
                      <span>Read each question carefully before selecting your answer.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0"></span>
                      <span>You can navigate between questions using the number buttons.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0"></span>
                      <span>Submit the quiz when you have answered all questions.</span>
                    </li>
                    {!enrollmentId && currentUser?.userType !== 'student' && (
                      <li className="flex items-center gap-2 text-orange-600">
                        <FontAwesomeIcon icon={faTriangleExclamation} className="text-orange-500 flex-shrink-0" />
                        <span>Progress will not be saved in preview mode.</span>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Previous Result - Only show for enrolled students */}
                {enrollmentId && previousQuizResult && (
                  <div className="mb-6 border-l-4 border-violet-500 pl-5 py-3">
                    <div className="flex items-start gap-5">
                      {/* Percentage with ring */}
                      <div className="relative w-16 h-16 flex-shrink-0">
                        <svg className="w-16 h-16 transform -rotate-90">
                          <circle cx="32" cy="32" r="28" stroke="#E5E7EB" strokeWidth="4" fill="none" />
                          <circle 
                            cx="32" cy="32" r="28" 
                            stroke="url(#gradient)" 
                            strokeWidth="4" 
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={`${(previousQuizResult.percentage / 100) * 175.9} 175.9`}
                          />
                          <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#8B5CF6" />
                              <stop offset="100%" stopColor="#EC4899" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-base font-bold text-gray-800">{previousQuizResult.percentage}%</span>
                        </div>
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1">
                        <div className="text-base font-semibold text-gray-900 mb-2">Previous Attempt</div>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <FontAwesomeIcon icon={faCircleCheck} className="text-green-500" />
                            <span><span className="font-semibold text-gray-800">{previousQuizResult.score}/{previousQuizResult.totalQuestions}</span> correct</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <FontAwesomeIcon icon={faClock} className="text-blue-500" />
                            <span className="font-semibold text-gray-800">
                              {previousQuizResult.timeTaken 
                                ? `${Math.floor(previousQuizResult.timeTaken / 60)}:${String(previousQuizResult.timeTaken % 60).padStart(2, '0')}`
                                : '--:--'
                              }
                            </span> mins
                          </div>
                          <div className="flex items-center gap-1.5">
                            <FontAwesomeIcon icon={faCalendarDays} className="text-violet-500" />
                            <span>{new Date(previousQuizResult.attemptedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </div>
                        </div>
                        {/* Warning below */}
                        <div className="text-sm text-amber-600 flex items-center gap-1.5 mt-3">
                          <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500" />
                          <span>Retake will overwrite your previous score.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview Mode Notice - For non-enrolled users (admin/teacher/dean/principal) - Not for students */}
                {!enrollmentId && currentUser?.userType !== 'student' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-2 text-blue-700">
                      <FontAwesomeIcon icon={faEye} />
                      <span className="font-medium">Preview Mode</span>
                    </div>
                    <p className="text-sm text-blue-600 mt-1">
                      As {currentUser?.userType === 'teacher' ? 'a teacher' : 
                          currentUser?.userType === 'dean' ? 'a dean' : 
                          currentUser?.userType === 'principal' ? 'a principal' : 
                          'an admin'}, you are viewing this quiz as a preview. Your progress will not be saved.
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {enrollmentId && previousQuizResult ? (
                    <>
                      <button
                        onClick={() => {
                          // Load previous answers and show results
                          setSelectedAnswers(previousQuizResult.answers || {});
                          setQuizStage('results');
                        }}
                        className="flex-1 px-6 py-3 rounded-xl border border-violet-500 text-violet-600 font-medium hover:bg-violet-50 transition-colors"
                      >
                        View Results
                      </button>
                      <button
                        onClick={() => handleStartQuiz(true)}
                        className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      >
                        <FontAwesomeIcon icon={faRotateRight} /> Retake Quiz
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleStartQuiz(false)}
                      className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      <FontAwesomeIcon icon={faArrowRight} /> {currentUser?.userType === 'student' ? 'Start Quiz' : 'Preview Quiz'}
                    </button>
                  )}
                </div>
              </div>
            </div>
            </>
          );
        }

        // RESULTS PAGE
        if (quizStage === 'results') {
          const score = calculateScore();
          const percentage = Math.round((score / totalQuestions) * 100);
          
          return (
            <>
              <RetakeConfirmModal />
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Header */}
                <div className="px-6 py-3 bg-gradient-to-r from-violet-600 to-pink-500 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={faClipboardCheck} className="text-white/80" />
                    <span className="text-white font-medium">Quiz Results</span>
                  </div>
                  <span className="text-white/80 text-sm">{selectedLecture.title}</span>
                </div>

                <div className="p-6">
                  {/* Score Circle */}
                  <div className="text-center mb-6">
                    <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-r from-violet-600 to-pink-500 flex items-center justify-center mb-4">
                    <span className="text-3xl font-bold text-white">{percentage}%</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {percentage >= 80 ? '🎉 Excellent!' : percentage >= 60 ? '👍 Good Job!' : percentage >= 40 ? '📚 Keep Learning!' : '💪 Try Again!'}
                  </h3>
                  <p className="text-gray-500 mt-1">You got {score} out of {totalQuestions} questions correct</p>
                </div>

                {/* Questions Review */}
                <div className="space-y-4">
                  {quizQuestions.map((q: any, idx: number) => {
                    const userAnswerId = selectedAnswers[idx];
                    const correctAnswerId = q.option_correct;
                    const isCorrect = userAnswerId === correctAnswerId;
                    const userAnswer = q.question_options?.find((opt: any) => opt.option_id === userAnswerId);
                    const correctAnswer = q.question_options?.find((opt: any) => opt.option_id === correctAnswerId);
                    
                    console.log(`Q${idx + 1}: userAnswer=${userAnswerId}, correct=${correctAnswerId}, isCorrect=${isCorrect}`);
                    
                    return (
                      <div key={idx} className={`p-4 rounded-lg border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-start gap-3">
                          <FontAwesomeIcon 
                            icon={isCorrect ? faCircleCheck : faCircleXmark} 
                            className={`mt-1 ${isCorrect ? 'text-green-500' : 'text-red-500'}`}
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">Q{idx + 1}. {q.question}</p>
                            <p className="text-sm mt-2">
                              <span className="text-gray-500">Your answer: </span>
                              <span className={isCorrect ? 'text-green-600' : 'text-red-600'}>{userAnswer?.option || 'Not answered'}</span>
                            </p>
                            {!isCorrect && (
                              <p className="text-sm">
                                <span className="text-gray-500">Correct answer: </span>
                                <span className="text-green-600">{correctAnswer?.option}</span>
                              </p>
                            )}
                            {q.explanation && (
                              <p className="text-xs text-gray-500 mt-2 italic bg-white/50 p-2 rounded">{q.explanation}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Retry Button */}
                <button
                  onClick={() => handleStartQuiz(true)}
                  className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <FontAwesomeIcon icon={faRotateRight} />
                  Retake Quiz
                </button>
              </div>
            </div>
            </>
          );
        }

        // QUIZ PAGE
        // Format elapsed time as MM:SS
        const formatTime = (seconds: number) => {
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };

        return (
          <>
          <QuizExitWarningModal />
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Compact Header */}
            <div className="px-6 py-3 bg-gradient-to-r from-violet-600 to-pink-500 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faClipboardCheck} className="text-white/80" />
                <span className="text-white font-medium">Quiz</span>
                <span className="text-white/70 text-sm">• {totalQuestions} Questions</span>
              </div>
              <div className="flex items-center gap-4">
                {/* Timer */}
                <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full">
                  <FontAwesomeIcon icon={faClock} className="text-white/80 text-sm" />
                  <span className="text-white text-sm font-medium">{formatTime(quizElapsedTime)}</span>
                </div>
                {/* Progress */}
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-white/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white rounded-full transition-all duration-300"
                      style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
                    />
                  </div>
                  <span className="text-white text-sm font-medium">{answeredCount}/{totalQuestions}</span>
                </div>
              </div>
            </div>
            
            {/* Question Pills - Horizontal Scroll */}
            <div className="px-6 py-3 border-b border-gray-100 overflow-x-auto">
              <div className="flex gap-2">
                {quizQuestions.map((_: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`w-8 h-8 rounded-full text-sm font-medium flex-shrink-0 transition-all ${
                      idx === currentQuestionIndex
                        ? 'bg-violet-600 text-white ring-2 ring-violet-300'
                        : selectedAnswers[idx] !== undefined
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Question */}
            <div key={`question-${currentQuestionIndex}`} className="p-6 transition-opacity duration-150">
              <div className="text-sm text-violet-600 font-medium mb-2">Question {currentQuestionIndex + 1} of {totalQuestions}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">{currentQuestion?.question}</h3>
              
              <div className="space-y-3">
                {currentQuestion?.question_options?.map((option: any, optIdx: number) => {
                  const isSelected = selectedAnswers[currentQuestionIndex] === option.option_id;
                  return (
                    <button
                      key={option.option_id}
                      onClick={() => {
                        setSelectedAnswers(prev => ({
                          ...prev,
                          [currentQuestionIndex]: option.option_id
                        }));
                      }}
                      className={`w-full p-4 rounded-xl border text-left flex items-center gap-4 transition-all active:scale-[0.98] cursor-pointer ${
                        isSelected
                          ? 'border-violet-500 bg-violet-50 shadow-sm'
                          : 'border-gray-200 hover:border-violet-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors ${
                        isSelected ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span className={`flex-1 ${isSelected ? 'text-violet-900 font-medium' : 'text-gray-700'}`}>
                        {option.option}
                      </span>
                      {isSelected && (
                        <FontAwesomeIcon icon={faCircleCheck} className="text-violet-500 text-lg" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-between">
              <button
                onClick={() => {
                  setIsNavigatingQuestion('prev');
                  setTimeout(() => {
                    setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
                    setIsNavigatingQuestion(null);
                  }, 100);
                }}
                disabled={currentQuestionIndex === 0 || isNavigatingQuestion !== null}
                className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-600 font-medium hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 min-w-[120px] justify-center"
              >
                {isNavigatingQuestion === 'prev' ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-gray-600 rounded-full animate-spin" />
                ) : (
                  <>
                    <FontAwesomeIcon icon={faArrowLeft} className="text-sm" /> Previous
                  </>
                )}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleSubmitQuiz}
                  disabled={answeredCount === 0 || isSavingQuiz}
                  className="px-5 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  {isSavingQuiz ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faCircleCheck} className="text-sm" /> Submit Quiz
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsNavigatingQuestion('next');
                    setTimeout(() => {
                      setCurrentQuestionIndex(prev => Math.min(totalQuestions - 1, prev + 1));
                      setIsNavigatingQuestion(null);
                    }, 100);
                  }}
                  disabled={currentQuestionIndex === totalQuestions - 1 || isNavigatingQuestion !== null}
                  className="px-5 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 min-w-[100px] justify-center"
                >
                  {isNavigatingQuestion === 'next' ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Next <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          </>
        );

      case 'exercise':
        // Show loading state if content not loaded yet
        if (isLoadingContent || !selectedLecture.isContentLoaded) {
          return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <div className="w-16 h-16 border-4 border-gray-200 border-t-amber-500 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600 font-medium">Loading exercise...</p>
            </div>
          );
        }

        // Parse exercise questions
        let exerciseQuestions: any[] = [];
        try {
          if (selectedLecture.exerciseQuestions) {
            exerciseQuestions = typeof selectedLecture.exerciseQuestions === 'string'
              ? JSON.parse(selectedLecture.exerciseQuestions)
              : selectedLecture.exerciseQuestions;
          }
        } catch (e) {
          exerciseQuestions = [];
        }

        if (!exerciseQuestions || exerciseQuestions.length === 0) {
          return (
            <div>
              <div className="p-4 bg-gray-50 rounded-lg mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{selectedLecture.title}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full mt-2 inline-block" style={{ backgroundColor: `${getItemColor(type)}15`, color: getItemColor(type) }}>
                  {getTypeLabel(type)}
                </span>
              </div>
              <div className="flex items-center justify-center bg-gray-50 rounded-lg p-12">
                <div className="text-center">
                  <FontAwesomeIcon icon={faDumbbell} className="text-5xl text-amber-500 mb-4" />
                  <p className="text-gray-600">No exercises available for this lecture</p>
                </div>
              </div>
            </div>
          );
        }

        const currentExercise = exerciseQuestions[currentExerciseIndex];
        const totalExercises = exerciseQuestions.length;

        // Get language for syntax highlighting
        const getLanguageForMonaco = (lang: string) => {
          const langMap: Record<string, string> = {
            'javascript': 'javascript',
            'python': 'python',
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'c++': 'cpp',
            'csharp': 'csharp',
            'c#': 'csharp',
            'php': 'php',
            'ruby': 'ruby',
            'go': 'go',
            'rust': 'rust',
            'typescript': 'typescript',
            'html': 'html',
            'css': 'css',
            'sql': 'sql',
          };
          return langMap[lang?.toLowerCase()] || 'javascript';
        };

        // Decode HTML entities in correct answer
        const decodeHtml = (html: string) => {
          const txt = document.createElement('textarea');
          txt.innerHTML = html;
          return txt.value
            .replace(/<\/p>\s*<p>/gi, '\n')  // Replace </p><p> with newline
            .replace(/<p>/gi, '')             // Remove opening <p>
            .replace(/<\/p>/gi, '\n')         // Replace closing </p> with newline
            .replace(/<br\s*\/?>/gi, '\n')    // Replace <br> with newline
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .trim();
        };

        // Handle Run Code (Judge0 integration or iframe for HTML/CSS)
        const handleRunExerciseCode = async () => {
          setIsRunningCode(true);
          setExecutionTime('--');
          setExecutionMemory('--');
          
          const code = exerciseEditorRef.current?.getValue() || exerciseCode;
          const language = (selectedLanguage || currentExercise.prog_language || 'javascript').toLowerCase();
          
          // For HTML/CSS, render in iframe instead of using Judge0
          if (language === 'html' || language === 'css') {
            let htmlContent = code;
            
            // If it's CSS only, wrap it in HTML
            if (language === 'css') {
              htmlContent = `<!DOCTYPE html>
<html>
<head>
  <style>${code}</style>
</head>
<body>
  <div class="preview">
    <h1>CSS Preview</h1>
    <p>This is a paragraph to preview your CSS styles.</p>
    <button>Button</button>
    <a href="#">Link</a>
    <ul>
      <li>List item 1</li>
      <li>List item 2</li>
    </ul>
  </div>
</body>
</html>`;
            }
            
            // Set output as HTML to be rendered in iframe
            setExerciseOutput(`__HTML_PREVIEW__${htmlContent}`);
            setExecutionTime('0.01s');
            setExecutionMemory('N/A');
            setIsRunningCode(false);
            return;
          }
          
          // For SQL, use PGlite (PostgreSQL in browser)
          if (language === 'sql') {
            const startTime = performance.now();
            
            try {
              // Initialize PGlite if not already done
              if (!pgliteRef.current) {
                setPgliteLoading(true);
                setExerciseOutput('🐘 Initializing PostgreSQL database...\n⏳ Please wait (first time may take a few seconds)...');
                
                try {
                  // Load PGlite from CDN (handles WASM loading properly)
                  const { PGlite } = await import('https://cdn.jsdelivr.net/npm/@electric-sql/pglite/dist/index.js');
                  pgliteRef.current = new PGlite();
                  await pgliteRef.current.waitReady;
                  setPgliteReady(true);
                } catch (initError: any) {
                  console.error('PGlite initialization error:', initError);
                  setExerciseOutput(
                    `❌ Failed to initialize PostgreSQL database.\n\n` +
                    `Error: ${initError.message}\n\n` +
                    `💡 Please check your internet connection and try again.`
                  );
                  setIsRunningCode(false);
                  setPgliteLoading(false);
                  return;
                }
                setPgliteLoading(false);
              }
              
              setExerciseOutput('🔄 Executing SQL...');
              
              // Remove all comment lines first, then split by semicolon
              const codeWithoutComments = code
                .split('\n')
                .map((line: string) => {
                  // Remove inline comments but keep the rest of the line
                  const commentIndex = line.indexOf('--');
                  if (commentIndex !== -1) {
                    return line.substring(0, commentIndex).trim();
                  }
                  return line;
                })
                .join('\n');
              
              // Split by semicolon and filter empty statements
              const statements = codeWithoutComments
                .split(';')
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0);
              
              console.log('Statements to execute:', statements);
              
              let output = '';
              
              for (const statement of statements) {
                if (!statement) continue;
                
                try {
                  const result = await pgliteRef.current.query(statement);
                  
                  // Debug: log result structure
                  console.log('SQL Result:', result);
                  
                  // Format output based on statement type
                  const upperStatement = statement.toUpperCase().trim();
                  
                  if (upperStatement.startsWith('SELECT') || upperStatement.startsWith('TABLE') || upperStatement.startsWith('WITH')) {
                    if (result && result.rows && result.rows.length > 0) {
                      // Format as table
                      const columns = result.fields?.map((f: any) => f.name) || Object.keys(result.rows[0]);
                      const colWidths = columns.map((col: string) => {
                        const maxDataWidth = Math.max(...result.rows.map((row: any) => String(row[col] ?? 'NULL').length));
                        return Math.max(col.length, maxDataWidth, 4);
                      });
                      
                      // Header
                      const header = columns.map((col: string, i: number) => col.padEnd(colWidths[i])).join(' │ ');
                      const separator = colWidths.map((w: number) => '─'.repeat(w)).join('─┼─');
                      
                      // Rows
                      const rows = result.rows.map((row: any) => 
                        columns.map((col: string, i: number) => String(row[col] ?? 'NULL').padEnd(colWidths[i])).join(' │ ')
                      ).join('\n');
                      
                      output += `\n${header}\n${separator}\n${rows}\n\n(${result.rows.length} row${result.rows.length !== 1 ? 's' : ''})\n`;
                    } else {
                      output += `\n(0 rows)\n`;
                    }
                  } else if (upperStatement.startsWith('INSERT')) {
                    const count = result?.affectedRows ?? result?.rowCount ?? 1;
                    output += `\n✅ INSERT ${count} row${count !== 1 ? 's' : ''}\n`;
                  } else if (upperStatement.startsWith('UPDATE')) {
                    const count = result?.affectedRows ?? result?.rowCount ?? 0;
                    output += `\n✅ UPDATE ${count} row${count !== 1 ? 's' : ''}\n`;
                  } else if (upperStatement.startsWith('DELETE')) {
                    const count = result?.affectedRows ?? result?.rowCount ?? 0;
                    output += `\n✅ DELETE ${count} row${count !== 1 ? 's' : ''}\n`;
                  } else if (upperStatement.startsWith('CREATE TABLE')) {
                    const tableName = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i)?.[1] || 'table';
                    output += `\n✅ Table "${tableName}" created successfully\n`;
                  } else if (upperStatement.startsWith('DROP TABLE')) {
                    const tableName = statement.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i)?.[1] || 'table';
                    output += `\n✅ Table "${tableName}" dropped successfully\n`;
                  } else if (upperStatement.startsWith('CREATE')) {
                    output += `\n✅ CREATE executed successfully\n`;
                  } else if (upperStatement.startsWith('DROP')) {
                    output += `\n✅ DROP executed successfully\n`;
                  } else if (upperStatement.startsWith('ALTER')) {
                    output += `\n✅ ALTER executed successfully\n`;
                  } else if (upperStatement.startsWith('TRUNCATE')) {
                    output += `\n✅ TRUNCATE executed successfully\n`;
                  } else {
                    output += `\n✅ Query executed successfully\n`;
                  }
                } catch (stmtError: any) {
                  output += `\n❌ Error: ${stmtError.message}\n`;
                }
              }
              
              const endTime = performance.now();
              const execTime = ((endTime - startTime) / 1000).toFixed(3);
              
              setExerciseOutput(
                `🐘 PostgreSQL (PGLite)\n` +
                `════════════════════════════════\n` +
                output +
                `\n════════════════════════════════`
              );
              setExecutionTime(`${execTime}s`);
              setExecutionMemory('In-Browser');
              
            } catch (error: any) {
              setExerciseOutput(
                `❌ PostgreSQL Error:\n\n${error.message}\n\n` +
                `💡 Tip: Make sure your SQL syntax is correct.`
              );
              setExecutionTime('--');
              setExecutionMemory('--');
            } finally {
              setIsRunningCode(false);
            }
            return;
          }
          
          setExerciseOutput('⏳ Compiling and running code...\n⏳ Please wait...');
          
          try {
            // Use Judge0 service for other languages
            const result = await judge0Service.executeCode(code, language, '');
            
            if (result.success) {
              setExerciseOutput(
                `✅ Execution successful!\n\n` +
                `Output:\n` +
                `──────────────────────────\n` +
                `${result.output || '(no output)'}\n` +
                `──────────────────────────`
              );
              setExecutionTime(`${result.time}s`);
              setExecutionMemory(result.memory);
            } else {
              setExerciseOutput(
                `❌ Execution failed!\n\n` +
                `Status: ${result.status}\n\n` +
                `Error:\n` +
                `──────────────────────────\n` +
                `${result.error || 'Unknown error'}\n` +
                `──────────────────────────`
              );
              setExecutionTime('--');
              setExecutionMemory('--');
            }
          } catch (error: any) {
            setExerciseOutput(
              `❌ Error: ${error.message}\n\n` +
              `Please check your code and try again.`
            );
            setExecutionTime('--');
            setExecutionMemory('--');
          } finally {
            setIsRunningCode(false);
          }
        };

        // Navigate to next/prev exercise
        const goToExercise = (index: number) => {
          if (index >= 0 && index < totalExercises) {
            setCurrentExerciseIndex(index);
            // Don't reset exerciseCode here - the useEffect will load it from submission if exists
            setExerciseOutput('');
            setShowSolution(false);
            setExecutionTime('--');
            setExecutionMemory('--');
            setSelectedLanguage(''); // Reset to use exercise's default language
            setShowLanguageDropdown(false);
          }
        };

        // Handle exercise submission
        const handleSubmitExercise = async () => {
          if (!enrollmentId || !selectedLecture || !currentUser) {
            console.warn('Cannot submit: missing enrollmentId, selectedLecture, or currentUser');
            return;
          }

          // Get current code from editor
          const code = exerciseEditorRef.current?.getValue() || exerciseCode;
          if (!code.trim()) {
            setExerciseOutput('❌ Please write some code before submitting.');
            return;
          }

          // Document ID: lectureId_exerciseId
          const submissionId = `${selectedLecture.id}_${currentExercise.exercise_id}`;

          setIsSubmittingExercise(true);
          try {
            // Prepare submission data
            const submissionData = {
              visibilityId: submissionId,
              lectureId: selectedLecture.id.toString(),
              exerciseId: currentExercise.exercise_id,
              submittedCode: code,
              submittedAt: new Date(),
              status: 'pending' as const,
              attempts: (exerciseSubmission?.attempts || 0) + 1,
            };

            // Save to Firebase
            await firebaseService.submitExercise(
              enrollmentId,
              submissionId,
              submissionData
            );

            // Update local state immediately
            setExerciseSubmission({
              submittedCode: code,
              submittedAt: submissionData.submittedAt,
              status: 'pending',
              attempts: submissionData.attempts,
            });

            // Update allExerciseSubmissions map
            setAllExerciseSubmissions(prev => ({
              ...prev,
              [submissionId]: {
                submittedCode: code,
                submittedAt: submissionData.submittedAt,
                status: 'pending',
                attempts: submissionData.attempts,
              }
            }));

            setExerciseOutput('✅ Exercise submitted successfully!\n\n⏳ Your solution is being evaluated by AI...\nYou will see the "Evaluation" button once ready.');

            // Call Cloud Function to evaluate (fire and forget - don't wait)
            firebaseService.evaluateExercise({
              enrollmentId,
              visibilityId: submissionId,
              submittedCode: code,
              exerciseTitle: currentExercise.title,
              questionDescription: currentExercise.question_description,
              correctAnswer: currentExercise.correct_answer,
              progLanguage: selectedLanguage || currentExercise.prog_language,
            }).then(async (result) => {
              console.log('✅ Evaluation completed:', result);
              // Reload submission to get evaluation
              try {
                const submission = await firebaseService.getExerciseSubmission(
                  enrollmentId,
                  submissionId
                );
                if (submission) {
                  setExerciseSubmission(submission);
                  // Update allExerciseSubmissions map
                  setAllExerciseSubmissions(prev => ({
                    ...prev,
                    [submissionId]: submission
                  }));
                }
              } catch (e) {
                console.error('Error reloading submission:', e);
              }
            }).catch((error) => {
              console.error('❌ Evaluation failed:', error);
              // Still mark as submitted, evaluation can be retried
            });
            
          } catch (error: any) {
            console.error('Error submitting exercise:', error);
            setExerciseOutput(`❌ Failed to submit exercise: ${error.message}`);
          } finally {
            setIsSubmittingExercise(false);
          }
        };

        return (
          <div className="flex h-full overflow-hidden -m-[5px]">
            {/* Left Sidebar - Question Numbers (Vertical Navigation) */}
            <div className="w-14 flex flex-col bg-gray-100 border-r border-gray-200 flex-shrink-0">
              {/* Curriculum Button */}
              <button 
                className={`h-12 flex items-center justify-center border-b border-gray-200 transition-colors group ${showCurriculumInExercise ? 'bg-emerald-100' : 'hover:bg-emerald-50'}`}
                onClick={() => setShowCurriculumInExercise(!showCurriculumInExercise)}
                title={showCurriculumInExercise ? "Hide Curriculum" : "Show Curriculum"}
              >
                <FontAwesomeIcon icon={faListCheck} className={`${showCurriculumInExercise ? 'text-emerald-700' : 'text-emerald-600'} group-hover:scale-110 transition-transform`} />
              </button>

              {/* Up Arrow */}
              <button 
                className="h-10 flex items-center justify-center border-b border-gray-200 hover:bg-gray-200 transition-colors"
                onClick={() => {
                  const container = document.getElementById('exercise-numbers-container');
                  if (container) container.scrollBy({ top: -150, behavior: 'smooth' });
                }}
              >
                <FontAwesomeIcon icon={faChevronUp} className="text-gray-500" />
              </button>

              {/* Exercise Numbers Container */}
              <div 
                id="exercise-numbers-container"
                className="flex-1 overflow-y-auto py-3 space-y-2 flex flex-col items-center"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {exerciseQuestions.map((exercise: any, idx: number) => {
                  const submissionId = `${selectedLecture.id}_${exercise.exercise_id}`;
                  const submission = allExerciseSubmissions[submissionId];
                  const isSubmitted = !!submission;
                  const isEvaluated = submission?.status === 'evaluated';
                  const isCorrect = submission?.evaluation?.isCorrect;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => goToExercise(idx)}
                      className={`w-9 h-9 rounded-lg font-bold text-sm transition-all hover:scale-105 relative ${
                        idx === currentExerciseIndex
                          ? 'bg-emerald-600 text-white shadow-md'
                          : isEvaluated
                            ? isCorrect
                              ? 'bg-green-100 text-green-700 border-2 border-green-500'
                              : 'bg-orange-100 text-orange-700 border-2 border-orange-500'
                            : isSubmitted
                              ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-500'
                              : 'bg-white text-gray-600 border border-gray-300 hover:border-emerald-400'
                      }`}
                      title={
                        isEvaluated
                          ? isCorrect
                            ? `Exercise ${idx + 1} - Correct (${submission.evaluation?.score}%)`
                            : `Exercise ${idx + 1} - Needs Improvement (${submission.evaluation?.score}%)`
                          : isSubmitted
                            ? `Exercise ${idx + 1} - Evaluating...`
                            : `Exercise ${idx + 1}`
                      }
                    >
                      {idx + 1}
                      {/* Status indicator */}
                      {isSubmitted && (
                        <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] ${
                          isEvaluated
                            ? isCorrect
                              ? 'bg-green-500 text-white'
                              : 'bg-orange-500 text-white'
                            : 'bg-yellow-500 text-white'
                        }`}>
                          {isEvaluated ? (isCorrect ? '✓' : '!') : '⏳'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Down Arrow */}
              <button 
                className="h-10 flex items-center justify-center border-t border-gray-200 hover:bg-gray-200 transition-colors"
                onClick={() => {
                  const container = document.getElementById('exercise-numbers-container');
                  if (container) container.scrollBy({ top: 150, behavior: 'smooth' });
                }}
              >
                <FontAwesomeIcon icon={faChevronDown} className="text-gray-500" />
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Two Panel Layout with Resizer */}
              <div id="exercise-panels-container" className="flex-1 flex overflow-hidden min-h-0">
                {/* Left Panel - Description */}
                <div 
                  ref={leftPanelRef}
                  className={`flex flex-col overflow-hidden bg-white ${isResizingPanel ? '' : 'transition-[width] duration-150'}`}
                  style={{ width: `${exerciseLeftPanelWidth}%` }}
                >
                  {/* Header with Navigation - ONLY FOR LEFT PANEL */}
                  <div className="px-4 py-2 bg-transparent flex items-center justify-between flex-shrink-0 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <FontAwesomeIcon icon={faDumbbell} className="text-emerald-600" />
                      <div>
                        <h2 className="text-gray-800 font-semibold text-sm">{selectedLecture.title}</h2>
                        <p className="text-gray-500 text-xs">Exercise {currentExerciseIndex + 1} of {totalExercises}</p>
                      </div>
                    </div>
                    {/* Navigation Buttons in Header */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => goToExercise(currentExerciseIndex - 1)}
                        disabled={currentExerciseIndex === 0}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs"
                      >
                        <FontAwesomeIcon icon={faArrowLeft} /> Prev
                      </button>
                      <button
                        onClick={() => goToExercise(currentExerciseIndex + 1)}
                        disabled={currentExerciseIndex === totalExercises - 1}
                        className="px-3 py-1.5 rounded-lg bg-white border border-emerald-600 text-emerald-600 font-medium hover:bg-emerald-50 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs"
                      >
                        Next <FontAwesomeIcon icon={faArrowRight} />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 flex-1 overflow-y-auto min-h-0">
                    {/* Exercise Title */}
                    <div className="mb-3">
                      <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
                        {currentExercise.prog_language?.toUpperCase() || 'CODE'}
                      </span>
                      <h3 className="text-base font-bold text-gray-900 mt-1.5">{currentExercise.title}</h3>
                    </div>

                    {/* Description */}
                    <div className="prose prose-sm max-w-none">
                      <h4 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-wide">
                        <FontAwesomeIcon icon={faFileText} className="text-gray-400" />
                        Problem Description
                      </h4>
                      {/* Parse markdown in description */}
                      {(() => {
                        const description = currentExercise.question_description || '';
                        
                        // Function to render text with inline markdown (bold, inline code)
                        const renderInlineMarkdown = (text: string, keyPrefix: string = '') => {
                          const parts: JSX.Element[] = [];
                          let remaining = text;
                          let partIndex = 0;
                          
                          while (remaining.length > 0) {
                            // Match inline code: `code` (single backtick on each side)
                            const inlineCodeMatch = remaining.match(/^(.*?)(`+)(.+?)\2(.*)$/s);
                            const boldMatch = remaining.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/s);
                            
                            const inlineCodePos = inlineCodeMatch ? inlineCodeMatch[1].length : Infinity;
                            const boldPos = boldMatch ? boldMatch[1].length : Infinity;
                            
                            if (inlineCodePos === Infinity && boldPos === Infinity) {
                              if (remaining) {
                                parts.push(<span key={`${keyPrefix}-${partIndex}`}>{remaining}</span>);
                              }
                              break;
                            }
                            
                            if (inlineCodePos <= boldPos && inlineCodeMatch) {
                              if (inlineCodeMatch[1]) {
                                parts.push(<span key={`${keyPrefix}-${partIndex++}`}>{inlineCodeMatch[1]}</span>);
                              }
                              // Strip any remaining backticks from the code content
                              const codeContent = inlineCodeMatch[3].replace(/`/g, '');
                              parts.push(
                                <code 
                                  key={`${keyPrefix}-${partIndex++}`} 
                                  className="px-1.5 py-0.5 bg-gray-800 text-emerald-400 rounded text-xs font-mono not-prose before:content-none after:content-none"
                                >
                                  {codeContent}
                                </code>
                              );
                              remaining = inlineCodeMatch[4];
                            } else if (boldMatch) {
                              if (boldMatch[1]) {
                                parts.push(<span key={`${keyPrefix}-${partIndex++}`}>{boldMatch[1]}</span>);
                              }
                              parts.push(
                                <strong key={`${keyPrefix}-${partIndex++}`} className="font-semibold text-gray-800">
                                  {boldMatch[2]}
                                </strong>
                              );
                              remaining = boldMatch[3];
                            }
                          }
                          
                          return parts.length > 0 ? parts : text;
                        };
                        
                        // Check if description contains code block markers
                        const hasCodeBlock = description.includes('```');
                        
                        if (hasCodeBlock) {
                          // Try to split by code blocks (with or without closing ```)
                          const codeBlockRegex = /```(\w*)\n?([\s\S]*?)(?:```|$)/g;
                          const elements: JSX.Element[] = [];
                          let lastIndex = 0;
                          let match;
                          let elementIdx = 0;
                          
                          while ((match = codeBlockRegex.exec(description)) !== null) {
                            // Add text before code block
                            if (match.index > lastIndex) {
                              const textBefore = description.slice(lastIndex, match.index);
                              if (textBefore.trim()) {
                                const lines = textBefore.split('\n');
                                let prevEmpty = false;
                                elements.push(
                                  <div key={`text-${elementIdx++}`} className="text-gray-600 text-sm leading-relaxed mb-2">
                                    {lines.map((line, lineIdx) => {
                                      if (!line.trim()) {
                                        if (prevEmpty) return null;
                                        prevEmpty = true;
                                        return <br key={lineIdx} />;
                                      }
                                      prevEmpty = false;
                                      const listMatch = line.match(/^(\s*)-\s+(.*)$/);
                                      if (listMatch) {
                                        return (
                                          <div key={lineIdx} className="flex items-start gap-2 ml-2 my-1">
                                            <span className="text-emerald-500 mt-0.5">•</span>
                                            <span>{renderInlineMarkdown(listMatch[2], `t-${elementIdx}-${lineIdx}`)}</span>
                                          </div>
                                        );
                                      }
                                      return <p key={lineIdx} className={lineIdx > 0 ? 'mt-1' : ''}>{renderInlineMarkdown(line, `t-${elementIdx}-${lineIdx}`)}</p>;
                                    })}
                                  </div>
                                );
                              }
                            }
                            
                            // Add code block
                            const lang = match[1] || 'code';
                            const code = match[2].trim();
                            if (code) {
                              elements.push(
                                <div key={`code-${elementIdx++}`} className="my-2 shadow-sm not-prose">
                                  <div className="px-3 py-1.5 bg-gray-800 flex items-center gap-2 rounded-t-lg">
                                    <div className="flex gap-1">
                                      <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                                      <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                                    </div>
                                    <span className="text-gray-400 text-[10px] font-medium uppercase">{lang}</span>
                                  </div>
                                  <pre className="p-3 bg-gray-900 text-gray-100 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre rounded-b-lg !m-0 !mt-0">
                                    <code>{code}</code>
                                  </pre>
                                </div>
                              );
                            }
                            
                            lastIndex = codeBlockRegex.lastIndex;
                          }
                          
                          // Add any remaining text after last code block
                          if (lastIndex < description.length) {
                            const textAfter = description.slice(lastIndex);
                            if (textAfter.trim()) {
                              const lines = textAfter.split('\n');
                              let prevEmpty = false;
                              elements.push(
                                <div key={`text-${elementIdx++}`} className="text-gray-600 text-sm leading-relaxed mb-2">
                                  {lines.map((line, lineIdx) => {
                                    if (!line.trim()) {
                                      if (prevEmpty) return null;
                                      prevEmpty = true;
                                      return <br key={lineIdx} />;
                                    }
                                    prevEmpty = false;
                                    return <p key={lineIdx}>{renderInlineMarkdown(line, `e-${elementIdx}-${lineIdx}`)}</p>;
                                  })}
                                </div>
                              );
                            }
                          }
                          
                          return elements.length > 0 ? elements : <p className="text-gray-600 text-sm">{description}</p>;
                        }
                        
                        // No code blocks - render as regular text
                        const lines = description.split('\n');
                        let prevWasEmpty = false;
                        return (
                          <div className="text-gray-600 text-sm leading-relaxed">
                            {lines.map((line, lineIdx) => {
                              if (!line.trim()) {
                                if (prevWasEmpty) return null; // Skip consecutive empty lines
                                prevWasEmpty = true;
                                return <br key={lineIdx} />;
                              }
                              prevWasEmpty = false;
                              const listMatch = line.match(/^(\s*)-\s+(.*)$/);
                              if (listMatch) {
                                return (
                                  <div key={lineIdx} className="flex items-start gap-2 ml-2 my-1">
                                    <span className="text-emerald-500 mt-0.5">•</span>
                                    <span>{renderInlineMarkdown(listMatch[2], `l-${lineIdx}`)}</span>
                                  </div>
                                );
                              }
                              return <p key={lineIdx} className={lineIdx > 0 ? 'mt-1' : ''}>{renderInlineMarkdown(line, `l-${lineIdx}`)}</p>;
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Solution Toggle */}
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => setShowSolution(!showSolution)}
                        className="flex items-center gap-2 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
                      >
                        <FontAwesomeIcon icon={showSolution ? faEye : faLightbulb} />
                        {showSolution ? 'Hide Solution' : 'Show Solution'}
                      </button>
                      
                      {showSolution && currentExercise.correct_answer && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-amber-300">
                          <div className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 flex items-center gap-2">
                            <FontAwesomeIcon icon={faCheck} className="text-white text-xs" />
                            <span className="text-white text-xs font-semibold">Expected Solution</span>
                          </div>
                          <pre className="p-3 bg-gray-900 text-green-400 text-xs font-mono overflow-x-auto leading-relaxed">
                            <code>{decodeHtml(currentExercise.correct_answer)}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Panel Resizer */}
                <div 
                  className="w-1.5 bg-gray-200 hover:bg-emerald-400 cursor-col-resize flex-shrink-0 transition-colors flex items-center justify-center group"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsResizingPanel(true);
                    const startX = e.clientX;
                    const container = document.getElementById('exercise-panels-container');
                    if (!container || !leftPanelRef.current) return;
                    const containerWidth = container.offsetWidth;
                    const startWidth = leftPanelRef.current.offsetWidth;
                    
                    const handleMouseMove = (e: MouseEvent) => {
                      if (!leftPanelRef.current) return;
                      const delta = e.clientX - startX;
                      const newWidthPx = startWidth + delta;
                      const newWidthPercent = Math.min(60, Math.max(25, (newWidthPx / containerWidth) * 100));
                      leftPanelRef.current.style.width = `${newWidthPercent}%`;
                    };
                    
                    const handleMouseUp = (e: MouseEvent) => {
                      if (leftPanelRef.current) {
                        const delta = e.clientX - startX;
                        const newWidthPx = startWidth + delta;
                        const newWidthPercent = Math.min(60, Math.max(25, (newWidthPx / containerWidth) * 100));
                        setExerciseLeftPanelWidth(newWidthPercent);
                      }
                      setIsResizingPanel(false);
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                >
                  <div className="w-0.5 h-8 bg-gray-400 group-hover:bg-white rounded-full"></div>
                </div>

                {/* Right Panel - Code Editor & Terminal */}
                <div 
                  id="exercise-main-content"
                  className={`flex-1 flex flex-col min-w-0 ${editorTheme === 'vs-dark' ? 'bg-gray-900' : 'bg-white'}`}
                >
                  {/* Editor Header */}
                  <div className={`px-3 py-1.5 flex items-center justify-between border-b flex-shrink-0 ${editorTheme === 'vs-dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'}`}>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                      </div>
                      <span className={`text-xs font-medium flex items-center gap-1.5 ml-1 ${editorTheme === 'vs-dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        <FontAwesomeIcon icon={(selectedLanguage || currentExercise.prog_language || '').toLowerCase() === 'sql' ? faDatabase : faCode} />
                        {(() => {
                          const lang = (selectedLanguage || currentExercise.prog_language || 'javascript').toLowerCase();
                          const extMap: Record<string, string> = {
                            'javascript': 'script.js',
                            'typescript': 'script.ts',
                            'python': 'script.py',
                            'java': 'Main.java',
                            'c': 'main.c',
                            'cpp': 'main.cpp',
                            'csharp': 'Program.cs',
                            'html': 'index.html',
                            'css': 'styles.css',
                            'php': 'index.php',
                            'ruby': 'script.rb',
                            'go': 'main.go',
                            'rust': 'main.rs',
                            'sql': 'query.sql',
                          };
                          return extMap[lang] || 'code.txt';
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Theme Toggle Button */}
                      <button
                        onClick={() => setEditorTheme(editorTheme === 'vs-dark' ? 'light' : 'vs-dark')}
                        className={`p-2 rounded transition-colors ${editorTheme === 'vs-dark' ? 'hover:bg-gray-700 text-gray-400 hover:text-yellow-400' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'}`}
                        title={editorTheme === 'vs-dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                      >
                        <FontAwesomeIcon icon={editorTheme === 'vs-dark' ? faSun : faMoon} className="text-sm" />
                      </button>

                      {/* Language Selector Dropdown */}
                      <div className="relative" ref={languageDropdownRef}>
                        <button
                          onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-2 border ${
                            editorTheme === 'vs-dark' 
                              ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' 
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <FontAwesomeIcon icon={faCode} className="text-emerald-500" />
                          <span className="capitalize">{selectedLanguage || currentExercise.prog_language || 'javascript'}</span>
                          <FontAwesomeIcon icon={faChevronDown} className={`text-[10px] transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showLanguageDropdown && (
                          <div className={`absolute top-full right-0 mt-1 w-44 rounded-lg shadow-xl border z-50 py-1 max-h-64 overflow-y-auto ${
                            editorTheme === 'vs-dark' 
                              ? 'bg-gray-800 border-gray-700' 
                              : 'bg-white border-gray-200'
                          }`}>
                            {[
                              { id: 'javascript', name: 'JavaScript', ext: '.js' },
                              { id: 'typescript', name: 'TypeScript', ext: '.ts' },
                              { id: 'python', name: 'Python', ext: '.py' },
                              { id: 'java', name: 'Java', ext: '.java' },
                              { id: 'c', name: 'C', ext: '.c' },
                              { id: 'cpp', name: 'C++', ext: '.cpp' },
                              { id: 'csharp', name: 'C#', ext: '.cs' },
                              { id: 'html', name: 'HTML', ext: '.html' },
                              { id: 'css', name: 'CSS', ext: '.css' },
                              { id: 'php', name: 'PHP', ext: '.php' },
                              { id: 'ruby', name: 'Ruby', ext: '.rb' },
                              { id: 'go', name: 'Go', ext: '.go' },
                              { id: 'rust', name: 'Rust', ext: '.rs' },
                              { id: 'sql', name: 'SQL', ext: '.sql' },
                            ].map((lang) => (
                              <button
                                key={lang.id}
                                onClick={() => {
                                  setSelectedLanguage(lang.id);
                                  setShowLanguageDropdown(false);
                                }}
                                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${
                                  (selectedLanguage || currentExercise.prog_language || 'javascript') === lang.id
                                    ? editorTheme === 'vs-dark'
                                      ? 'bg-emerald-600/20 text-emerald-400'
                                      : 'bg-emerald-50 text-emerald-600'
                                    : editorTheme === 'vs-dark'
                                      ? 'text-gray-300 hover:bg-gray-700'
                                      : 'text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                <span className="font-medium">{lang.name}</span>
                                <span className={`text-[10px] ${editorTheme === 'vs-dark' ? 'text-gray-500' : 'text-gray-400'}`}>{lang.ext}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* SQL Help Button - Only for SQL */}
                      {(selectedLanguage || currentExercise.prog_language || '').toLowerCase() === 'sql' && (
                        <button
                          onClick={() => setShowSQLHelpModal(true)}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 border ${
                            editorTheme === 'vs-dark'
                              ? 'bg-gray-700 border-gray-600 text-blue-400 hover:bg-blue-900/30 hover:border-blue-500'
                              : 'bg-white border-gray-300 text-blue-500 hover:bg-blue-50 hover:border-blue-400'
                          }`}
                          title="SQL Syntax Help"
                        >
                          <FontAwesomeIcon icon={faCircleQuestion} className="text-xs" />
                          <span>Help</span>
                        </button>
                      )}

                      {/* Reset Database Button - Only for SQL */}
                      {(selectedLanguage || currentExercise.prog_language || '').toLowerCase() === 'sql' && pgliteReady && (
                        <button
                          onClick={async () => {
                            if (pgliteRef.current) {
                              try {
                                await pgliteRef.current.close();
                                pgliteRef.current = null;
                                setPgliteReady(false);
                                setExerciseOutput('🗑️ Database reset! A fresh PostgreSQL instance will be created on next run.');
                              } catch (e) {
                                pgliteRef.current = null;
                                setPgliteReady(false);
                                setExerciseOutput('🗑️ Database reset!');
                              }
                            }
                          }}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 border ${
                            editorTheme === 'vs-dark'
                              ? 'bg-gray-700 border-gray-600 text-red-400 hover:bg-red-900/30 hover:border-red-500'
                              : 'bg-white border-gray-300 text-red-500 hover:bg-red-50 hover:border-red-400'
                          }`}
                          title="Reset Database - Clear all tables and data"
                        >
                          <FontAwesomeIcon icon={faTrash} className="text-xs" />
                          <span>Reset DB</span>
                        </button>
                      )}

                      {/* Run Code Button */}
                      <button
                        onClick={handleRunExerciseCode}
                        disabled={isRunningCode || pgliteLoading}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                          isRunningCode || pgliteLoading
                            ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-900 cursor-wait shadow-lg' 
                            : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg active:scale-95'
                        }`}
                      >
                        {isRunningCode || pgliteLoading ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>{pgliteLoading ? 'Loading DB...' : 'Running...'}</span>
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faPlay} className="text-xs" />
                            <span>Run Code</span>
                          </>
                        )}
                      </button>

                      {/* Submit Exercise Button - Only for enrolled students */}
                      {enrollmentId && (
                        <button
                          onClick={handleSubmitExercise}
                          disabled={isSubmittingExercise || isRunningCode}
                          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                            isSubmittingExercise
                              ? 'bg-gradient-to-r from-purple-400 to-violet-500 text-white cursor-wait shadow-lg'
                              : 'bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white shadow-md hover:shadow-lg active:scale-95'
                          }`}
                          title="Submit exercise for AI evaluation"
                        >
                          {isSubmittingExercise ? (
                            <>
                              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faPaperPlane} className="text-xs" />
                              <span>Submit</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Evaluation Button - Show when evaluated */}
                      {enrollmentId && exerciseSubmission?.status === 'evaluated' && (
                        <button
                          onClick={() => setShowEvaluationModal(true)}
                          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                            exerciseSubmission.evaluation?.isCorrect
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700'
                              : 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700'
                          } text-white shadow-md hover:shadow-lg active:scale-95`}
                          title="View AI evaluation feedback"
                        >
                          <FontAwesomeIcon icon={faClipboardList} className="text-xs" />
                          <span>Evaluation</span>
                          {exerciseSubmission.evaluation?.isCorrect ? (
                            <FontAwesomeIcon icon={faCheckCircle} className="text-xs text-green-200" />
                          ) : (
                            <FontAwesomeIcon icon={faTimesCircle} className="text-xs text-red-200" />
                          )}
                        </button>
                      )}

                      {/* Pending Evaluation Indicator */}
                      {enrollmentId && exerciseSubmission?.status === 'pending' && (
                        <div className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 bg-yellow-100 text-yellow-800 border border-yellow-300">
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Evaluating...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Monaco Editor - Takes remaining space */}
                  <div className="flex-1 min-h-0" style={{ height: `calc(100% - ${exerciseTerminalHeight}px - 32px)` }}>
                    <Editor
                      key={`${selectedLecture.id}_${currentExercise.exercise_id}`}
                      height="100%"
                      language={getLanguageForMonaco(selectedLanguage || currentExercise.prog_language)}
                      value={exerciseCode || (() => {
                        const lang = (selectedLanguage || currentExercise.prog_language || 'javascript').toLowerCase();
                        if (lang === 'sql') {
                          return `-- ${currentExercise.title}\n-- Write your SQL queries here\n-- PostgreSQL syntax is supported\n\n`;
                        } else if (lang === 'html') {
                          return `<!-- ${currentExercise.title} -->\n<!-- Write your HTML here -->\n\n`;
                        } else if (lang === 'css') {
                          return `/* ${currentExercise.title} */\n/* Write your CSS here */\n\n`;
                        } else if (lang === 'python') {
                          return `# ${currentExercise.title}\n# Write your Python code here\n\n`;
                        } else {
                          return `// ${currentExercise.title}\n// Write your ${lang} code here\n\n`;
                        }
                      })()}
                      theme={editorTheme}
                      onMount={(editor) => {
                        exerciseEditorRef.current = editor;
                      }}
                      onChange={(value) => setExerciseCode(value || '')}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        padding: { top: 12, bottom: 12 },
                        wordWrap: 'on',
                        tabSize: 2,
                        fontFamily: "'Fira Code', 'Monaco', 'Menlo', monospace",
                        fontLigatures: true,
                        lineHeight: 22,
                      }}
                    />
                  </div>

                  {/* Terminal Resizer */}
                  <div 
                    className={`h-1.5 hover:bg-emerald-500 cursor-row-resize flex-shrink-0 transition-colors flex items-center justify-center group ${editorTheme === 'vs-dark' ? 'bg-gray-700' : 'bg-gray-300'}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsResizingTerminal(true);
                      const startY = e.clientY;
                      const startHeight = exerciseTerminalHeight;
                      
                      const handleMouseMove = (e: MouseEvent) => {
                        const delta = startY - e.clientY;
                        const newHeight = Math.min(400, Math.max(80, startHeight + delta));
                        setExerciseTerminalHeight(newHeight);
                      };
                      
                      const handleMouseUp = () => {
                        setIsResizingTerminal(false);
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                      };
                      
                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                  >
                    <div className="w-8 h-0.5 bg-gray-500 group-hover:bg-white rounded-full"></div>
                  </div>

                  {/* Terminal Output */}
                  <div 
                    className={`flex flex-col flex-shrink-0 ${editorTheme === 'vs-dark' ? 'bg-gray-950' : 'bg-gray-50'}`}
                    style={{ height: `${exerciseTerminalHeight}px` }}
                  >
                    <div className={`px-3 py-1.5 flex items-center justify-between flex-shrink-0 ${editorTheme === 'vs-dark' ? 'bg-gray-800' : 'bg-gray-200'}`}>
                      <span className={`text-xs font-medium flex items-center gap-1.5 ${editorTheme === 'vs-dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        <FontAwesomeIcon icon={faTerminal} />
                        Output
                      </span>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] flex items-center gap-2 ${editorTheme === 'vs-dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                          <span className="flex items-center gap-1">
                            <FontAwesomeIcon icon={faClock} />
                            {executionTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <FontAwesomeIcon icon={faMemory} />
                            {executionMemory}
                          </span>
                        </span>
                        <span className={`text-[10px] font-medium flex items-center gap-1 ${
                          isRunningCode ? 'text-yellow-500' : 'text-green-500'
                        }`}>
                          <FontAwesomeIcon icon={isRunningCode ? faSpinner : faCircleCheck} className={isRunningCode ? 'animate-spin' : ''} />
                          {isRunningCode ? 'Running' : 'Ready'}
                        </span>
                        {exerciseOutput && (
                          <button
                            onClick={() => setExerciseOutput('')}
                            className={`transition-colors ${editorTheme === 'vs-dark' ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                          >
                            <FontAwesomeIcon icon={faXmark} className="text-xs" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
                      {exerciseOutput ? (
                        exerciseOutput.startsWith('__HTML_PREVIEW__') ? (
                          <iframe
                            srcDoc={exerciseOutput.replace('__HTML_PREVIEW__', '')}
                            className="w-full h-full bg-white rounded border border-gray-300"
                            title="HTML Preview"
                            sandbox="allow-scripts"
                          />
                        ) : (
                          <pre className={`whitespace-pre-wrap ${editorTheme === 'vs-dark' ? 'text-gray-300' : 'text-gray-700'}`}>{exerciseOutput}</pre>
                        )
                      ) : (
                        <span className={editorTheme === 'vs-dark' ? 'text-gray-600' : 'text-gray-400'}>
                          {isRunningCode ? '⏳ Running...' : '$ Click "Run Code" to execute'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'assessment':
        return (
          <div>
            <div className="p-4 bg-gray-50 rounded-lg mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{selectedLecture.title}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full mt-2 inline-block" style={{ backgroundColor: `${getItemColor(type)}15`, color: getItemColor(type) }}>
                {getTypeLabel(type)}
              </span>
            </div>
            <div className="flex items-center justify-center bg-gray-50 rounded-lg p-12">
              <div className="text-center">
                <FontAwesomeIcon icon={faClipboardCheck} className="text-5xl text-purple-500 mb-4" />
                <p className="text-gray-600">Assessment will be available soon</p>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center bg-gray-50 rounded-lg py-12">
            <p className="text-gray-500">Content type not supported</p>
          </div>
        );
    }
  };

  // Helper function to get attachment icon
  const getAttachmentIcon = (type: string) => {
    const t = type?.toLowerCase();
    if (t?.includes('pdf')) return faFilePdf;
    if (t?.includes('doc') || t?.includes('word')) return faFileWord;
    if (t?.includes('xls') || t?.includes('excel')) return faFileExcel;
    if (t?.includes('ppt') || t?.includes('powerpoint')) return faFilePowerpoint;
    if (t?.includes('image') || t?.includes('jpg') || t?.includes('png') || t?.includes('gif')) return faFileImage;
    if (t?.includes('zip') || t?.includes('rar')) return faFileZipper;
    return faFile;
  };

  // Helper function to get attachment color
  const getAttachmentColor = (type: string) => {
    const t = type?.toLowerCase();
    if (t?.includes('pdf')) return '#EF4444';
    if (t?.includes('doc') || t?.includes('word')) return '#3B82F6';
    if (t?.includes('xls') || t?.includes('excel')) return '#10B981';
    if (t?.includes('ppt') || t?.includes('powerpoint')) return '#F97316';
    if (t?.includes('image') || t?.includes('jpg') || t?.includes('png') || t?.includes('gif')) return '#8B5CF6';
    if (t?.includes('zip') || t?.includes('rar')) return '#6B7280';
    return '#6B7280';
  };

  // Helper function to get rating badge
  const getRatingBadge = (rating: string) => {
    switch (rating) {
      case 'helpful':
        return { icon: '👍', label: 'Helpful', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' };
      case 'excellent':
        return { icon: '⭐', label: 'Excellent', bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' };
      case 'needs-improvement':
        return { icon: '🤔', label: 'Needs Improvement', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' };
      default:
        return { icon: '💬', label: 'Feedback', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };
    }
  };

  // Helper function to get initials color
  const getInitialsColor = (initials: string) => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
    const index = initials.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Handle feedback submit
  const handleSubmitFeedback = async () => {
    const feedbackText = feedbackTextRef.current;
    if (!feedbackText.trim() || !feedbackRating) return;
    if (!currentUser?.userId && !currentUser?.uid) {
      console.error('User not logged in');
      return;
    }
    
    setIsSubmittingFeedback(true);
    
    try {
      const userId = currentUser.userId || currentUser.uid;
      const userName = currentUser?.fullName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Anonymous';
      const userInitials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
      
      if (isEditingFeedback && userFeedback) {
        // Update existing feedback
        const success = await firebaseService.updateCourseFeedback(courseSlug, userFeedback.id, {
          rating: feedbackRating,
          comment: feedbackText
        });
        
        if (success) {
          // Update local state
          const updatedFeedback = {
            ...userFeedback,
            rating: feedbackRating,
            comment: feedbackText,
            updatedAt: new Date()
          };
          setUserFeedback(updatedFeedback);
          setFeedbacks(feedbacks.map(f => f.id === userFeedback.id ? updatedFeedback : f));
          setIsEditingFeedback(false);
        }
      } else {
        // Add new feedback
        const feedbackId = await firebaseService.addCourseFeedback(courseSlug, {
          userId,
          userName,
          userInitials,
          rating: feedbackRating,
          comment: feedbackText
        });
        
        if (feedbackId) {
          const newFeedback: Feedback = {
            id: feedbackId,
            userId,
            userName,
            userInitials,
            rating: feedbackRating,
            comment: feedbackText,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          setUserFeedback(newFeedback);
          setFeedbacks([newFeedback, ...feedbacks]);
        }
      }
      
      // Clear the textarea and ref
      feedbackTextRef.current = '';
      if (feedbackTextareaRef.current) {
        feedbackTextareaRef.current.value = '';
      }
      setFeedbackRating(null);
      setCanSubmitFeedback(false);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };
  
  // Handle edit feedback click
  const handleEditFeedback = () => {
    if (userFeedback) {
      feedbackTextRef.current = userFeedback.comment;
      if (feedbackTextareaRef.current) {
        feedbackTextareaRef.current.value = userFeedback.comment;
      }
      setFeedbackRating(userFeedback.rating);
      setCanSubmitFeedback(true);
      setIsEditingFeedback(true);
    }
  };
  
  // Cancel edit
  const handleCancelEdit = () => {
    feedbackTextRef.current = '';
    if (feedbackTextareaRef.current) {
      feedbackTextareaRef.current.value = '';
    }
    setFeedbackRating(null);
    setCanSubmitFeedback(false);
    setIsEditingFeedback(false);
  };
  
  // Handle feedback text change (update ref and button state on blur)
  const handleFeedbackTextBlur = () => {
    const hasText = feedbackTextRef.current.trim().length > 0;
    setCanSubmitFeedback(hasText && feedbackRating !== null);
  };
  
  // Update canSubmitFeedback when rating changes
  const handleRatingChange = (rating: 'helpful' | 'needs-improvement' | 'excellent') => {
    setFeedbackRating(rating);
    const hasText = feedbackTextRef.current.trim().length > 0;
    setCanSubmitFeedback(hasText);
  };

  // Render tabs section
  const renderTabs = () => {
    // Sample attachments (in real app, these come from selectedLecture.attachments)
    const attachments: Attachment[] = selectedLecture?.attachments || [];
    
    // Handle expanding tabs - load content if not cached
    const handleExpandTabs = async () => {
      setIsTabsOpen(true);
      
      // Load content if not already loaded
      if (selectedLecture && !selectedLecture.isContentLoaded) {
        const content = await loadLectureContent(selectedLecture.id);
        if (content) {
          setSelectedLecture(prev => prev ? {
            ...prev,
            textContent: content.textContent,
            attachments: content.attachments,
            isContentLoaded: true,
          } : null);
        }
      }
      
      // Scroll to tabs after opening
      setTimeout(() => {
        tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    };
    
    // If tabs are closed, show a button to open them
    if (!isTabsOpen) {
      return (
        <button
          onClick={handleExpandTabs}
          className="mt-6 mb-5 w-full py-3 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium text-gray-600"
        >
          <FontAwesomeIcon icon={faNoteSticky} />
          Show Notes, Attachments & Feedback
          <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
        </button>
      );
    }
    
    return (
      <div ref={tabsRef} className="mt-6 border border-gray-200 rounded-xl bg-white flex flex-col">
        {/* Tab Headers */}
        <div className="flex items-center border-b border-gray-200 bg-gray-50 relative flex-shrink-0 rounded-t-xl">
          <button
            onClick={() => handleTabClick('notes')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'notes' 
                ? 'text-gray-900' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faNoteSticky} />
            Notes
            {isLoadingContent && activeTab === 'notes' && (
              <span className="ml-2 animate-spin">⏳</span>
            )}
            {activeTab === 'notes' && (
              <div 
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: brand.gradients.primary }}
              />
            )}
          </button>
          <button
            onClick={() => handleTabClick('attachments')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'attachments' 
                ? 'text-gray-900' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faPaperclip} />
            Attachments
            {attachments.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-200 text-gray-600">
                {attachments.length}
              </span>
            )}
            {activeTab === 'attachments' && (
              <div 
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: brand.gradients.primary }}
              />
            )}
          </button>
          <button
            onClick={() => handleTabClick('feedback')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'feedback' 
                ? 'text-gray-900' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faCommentDots} />
            Feedback
            {feedbacks.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-200 text-gray-600">
                {feedbacks.length}
              </span>
            )}
            {activeTab === 'feedback' && (
              <div 
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: brand.gradients.primary }}
              />
            )}
          </button>
          
          {/* Close Button */}
          <button
            onClick={() => setIsTabsOpen(false)}
            className="ml-auto mr-3 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600 self-center"
            title="Close"
          >
            <FontAwesomeIcon icon={faChevronDown} className="transform rotate-180" />
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 flex-1">
          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div>
              {isLoadingContent ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
                  <p className="text-sm text-gray-500">Loading notes...</p>
                </div>
              ) : selectedLecture?.textContent ? (
                <div className="prose prose-sm max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: selectedLecture.textContent }} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <FontAwesomeIcon icon={faNoteSticky} className="text-3xl text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No Notes Available</h3>
                  <p className="text-sm text-gray-500 max-w-sm">
                    Notes for this lecture will appear here once they're added by the instructor.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Attachments Tab */}
          {activeTab === 'attachments' && (
            <div>
              {isLoadingContent ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
                  <p className="text-sm text-gray-500">Loading attachments...</p>
                </div>
              ) : attachments.length > 0 ? (
                <div className="grid gap-3">
                  {attachments.map((attachment) => (
                    <div 
                      key={attachment.id}
                      className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors group"
                    >
                      <div 
                        className="w-12 h-12 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${getAttachmentColor(attachment.type)}15` }}
                      >
                        <FontAwesomeIcon 
                          icon={getAttachmentIcon(attachment.type)} 
                          className="text-xl"
                          style={{ color: getAttachmentColor(attachment.type) }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{attachment.name}</p>
                        <p className="text-sm text-gray-500">{attachment.size || 'Unknown size'}</p>
                      </div>
                      <button 
                        className="px-4 py-2 text-sm font-medium rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        style={{ 
                          background: brand.gradients.primary,
                          color: 'white'
                        }}
                      >
                        <FontAwesomeIcon icon={faDownload} className="mr-2" />
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <FontAwesomeIcon icon={faFolderOpen} className="text-3xl text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No Attachments</h3>
                  <p className="text-sm text-gray-500 max-w-sm">
                    Supplementary materials like PDFs, documents, and resources will appear here when available.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Feedback Tab */}
          {activeTab === 'feedback' && (
            <div>
              {isLoadingFeedback ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-10 h-10 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
                </div>
              ) : (
                <>
                  {/* User's Existing Feedback or Form */}
                  {userFeedback && !isEditingFeedback ? (
                    // Show user's submitted feedback
                    <div className="border border-green-200 bg-green-50 rounded-xl p-5 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <FontAwesomeIcon icon={faCircleCheck} className="text-green-500" />
                          <h3 className="font-semibold text-gray-900">Your Feedback</h3>
                        </div>
                        {canEditFeedback(userFeedback) && (
                          <button
                            onClick={handleEditFeedback}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <FontAwesomeIcon icon={faNoteSticky} className="text-xs" />
                            Edit
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        {(() => {
                          const badge = getRatingBadge(userFeedback.rating);
                          return (
                            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${badge.bg} ${badge.text} ${badge.border}`}>
                              {badge.icon} {badge.label}
                            </span>
                          );
                        })()}
                        <span className="text-sm text-gray-400">{formatFeedbackDate(userFeedback.createdAt)}</span>
                        {!canEditFeedback(userFeedback) && (
                          <span className="text-xs text-gray-400 italic">(Edit window expired)</span>
                        )}
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{userFeedback.comment}</p>
                    </div>
                  ) : (
                    // Feedback Form
                    <div className="border border-gray-200 rounded-xl p-5 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <FontAwesomeIcon icon={faCommentDots} className="text-gray-400" />
                          <h3 className="font-semibold text-gray-900">
                            {isEditingFeedback ? 'Edit Your Feedback' : 'Share Your Thoughts'}
                          </h3>
                        </div>
                        {isEditingFeedback && (
                          <button
                            onClick={handleCancelEdit}
                            className="text-sm text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      
                      <textarea
                        ref={feedbackTextareaRef}
                        defaultValue={feedbackTextRef.current}
                        onChange={(e) => { feedbackTextRef.current = e.target.value; }}
                        onBlur={handleFeedbackTextBlur}
                        placeholder="How was this course? Any questions, suggestions, or areas that need clarification?"
                        className="w-full p-4 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-opacity-20 text-sm"
                        style={{ focusRing: brand.colors.primary }}
                        rows={4}
                      />
                      
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="rating"
                              checked={feedbackRating === 'helpful'}
                              onChange={() => handleRatingChange('helpful')}
                              className="hidden"
                            />
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                              feedbackRating === 'helpful' 
                                ? 'bg-blue-50 border-blue-300 text-blue-600' 
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}>
                              <span>👍</span> Helpful
                            </div>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="rating"
                              checked={feedbackRating === 'needs-improvement'}
                              onChange={() => handleRatingChange('needs-improvement')}
                              className="hidden"
                            />
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                              feedbackRating === 'needs-improvement' 
                                ? 'bg-orange-50 border-orange-300 text-orange-600' 
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}>
                              <span>🤔</span> Needs Improvement
                            </div>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="rating"
                              checked={feedbackRating === 'excellent'}
                              onChange={() => handleRatingChange('excellent')}
                              className="hidden"
                            />
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                              feedbackRating === 'excellent' 
                                ? 'bg-green-50 border-green-300 text-green-600' 
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}>
                              <span>⭐</span> Excellent
                            </div>
                          </label>
                        </div>
                        
                        <button
                          onClick={handleSubmitFeedback}
                          disabled={!feedbackRating || isSubmittingFeedback}
                          className="px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: brand.gradients.primary }}
                        >
                          {isSubmittingFeedback ? 'Submitting...' : isEditingFeedback ? 'Update Feedback' : 'Submit Feedback'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Recent Feedback */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <FontAwesomeIcon icon={faCommentDots} className="text-gray-400" />
                      <h3 className="font-semibold text-gray-900">Recent Feedback</h3>
                    </div>
                    
                    {feedbacks.length > 0 ? (
                      <div className="space-y-4">
                        {feedbacks.filter(f => f.id !== userFeedback?.id).map((feedback) => {
                          const badge = getRatingBadge(feedback.rating);
                          return (
                            <div 
                              key={feedback.id}
                              className="border border-gray-200 rounded-xl p-5"
                            >
                              <div className="flex items-center gap-3 mb-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${getInitialsColor(feedback.userInitials)}`}>
                                  {feedback.userInitials}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900">{feedback.userName}</span>
                                    <span className="text-sm text-gray-400">{formatFeedbackDate(feedback.createdAt)}</span>
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.bg} ${badge.text} ${badge.border}`}>
                                      {badge.icon} {badge.label}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{feedback.comment}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="text-sm text-gray-500">No feedback yet. Be the first to share your thoughts!</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-white">
      {/* Header - Exactly like App.tsx */}
      <header className="sticky top-0 z-[9998] bg-white shadow-sm border-b border-gray-200 w-full flex-shrink-0">
        <div className="flex items-center justify-between px-6 py-2.5">
          {/* Left - Logo (exactly like App.tsx) */}
          <div className="flex items-center space-x-4">
            <Logo size="medium" showText={true} brand={brand} collegeName={collegeName} />
            
            {/* Divider + Course Name */}
            <div className="w-px h-8 bg-gray-200"></div>
            <div className="flex items-center space-x-3 px-3 py-2">
              <div 
                className="w-9 h-9 rounded-full flex items-center justify-center shadow-md"
                style={{ background: brand.gradients.primary }}
              >
                <FontAwesomeIcon icon={faCirclePlay} className="text-white" />
              </div>
              <p className="text-base font-semibold text-gray-900 max-w-lg truncate">
                {courseName}
              </p>
            </div>
          </div>

          {/* Right - Back button + ProfileDropdown (exactly like App.tsx) */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-colors text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              <FontAwesomeIcon icon={faChevronLeft} />
              <span className="font-semibold">Back to Courses</span>
            </button>
            
            {/* AI Assistant Button - Visible to all users */}
            <button
              onClick={() => setShowAIAssistant(true)}
              className="relative p-2.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="AI Learning Assistant"
            >
              <FontAwesomeIcon icon={faRobot} className="text-gray-700" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse"></span>
            </button>
            
            <div className="ml-2">
              <ProfileDropdown
                isSecureBrowser={isSecureBrowser}
                user={{
                  name: currentUser?.fullName || currentUser?.email?.split('@')[0].replace(/[._]/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'User',
                  email: currentUser?.email || '',
                  role: currentUser?.userType || 'student',
                  roleName: currentUser?.userType ? firebaseService.getUserTypeDisplayName(currentUser.userType) : 'User',
                  organization: collegeName || '',
                  avatar: currentUser?.profilePicture || undefined
                }}
                onEditProfile={onEditProfile || (() => {})}
                onDownloadBrowser={onDownloadBrowser || (() => {})}
                onViewLoginDetails={onViewLoginDetails || (() => {})}
                onAddUniversity={onAddUniversity || (() => {})}
                onSignOut={onSignOut || (() => {})}
                onProfileClick={onEditProfile || (() => {})}
                onSwitchMode={() => onBack()}
                currentMode="learning"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left - Curriculum Panel (ToC) - Collapsible - Hidden for Exercise unless toggled */}
        {(selectedLecture?.type?.toLowerCase() !== 'exercise' || showCurriculumInExercise) && (
        isSidebarCollapsed ? (
          /* Collapsed State - Vertical Bar with stats */
          <div className="border-r border-gray-200 flex flex-col bg-white shadow-xl py-4" style={{ width: '63px', minWidth: '63px' }}>
            {/* Expand Button */}
            <div className="flex justify-center mb-2">
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                title="Expand Curriculum"
              >
                <FontAwesomeIcon icon={faChevronRight} className="text-gray-500" />
              </button>
            </div>
            
            {/* Vertical CURRICULUM Text - Top to Bottom */}
            <div className="flex justify-center mb-4">
              <div 
                className="text-xs font-semibold tracking-wider"
                style={{ 
                  writingMode: 'vertical-lr', 
                  textOrientation: 'mixed',
                  color: brand.colors.primary
                }}
              >
                CURRICULUM
              </div>
            </div>
            
            {/* Vertical Stats */}
            <div className="flex flex-col items-center gap-3 px-1">
              <div className="flex flex-col items-center">
                <FontAwesomeIcon icon={faLayerGroup} className="text-gray-400 mb-1" />
                <span className="text-xs font-semibold text-gray-700">{curriculumData.length}</span>
                <span className="text-[10px] text-gray-400">Units</span>
              </div>
              <div className="flex flex-col items-center">
                <FontAwesomeIcon icon={faBookBookmark} className="text-gray-400 mb-1" />
                <span className="text-xs font-semibold text-gray-700">{curriculumData.reduce((acc: number, sec: any) => acc + (sec.chapters || []).length, 0)}</span>
                <span className="text-[10px] text-gray-400">Chapters</span>
              </div>
              <div className="flex flex-col items-center">
                <FontAwesomeIcon icon={faBullseye} className="text-gray-400 mb-1" />
                <span className="text-xs font-semibold text-gray-700">{curriculumData.reduce((acc: number, sec: any) => acc + (sec.chapters || []).reduce((a: number, ch: any) => a + (ch.items || []).length, 0), 0)}</span>
                <span className="text-[10px] text-gray-400">Items</span>
              </div>
            </div>
          </div>
        ) : (
          /* Expanded State - Full Panel */
          <div className="w-[450px] border-r border-gray-200 flex flex-col bg-white shadow-xl transition-all duration-300">
            {/* Stats Row with Collapse Button */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faLayerGroup} className="text-gray-500" />
                  <span className="text-sm text-gray-600"><strong>{curriculumData.length}</strong> Units</span>
                </div>
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faBookBookmark} className="text-gray-500" />
                  <span className="text-sm text-gray-600"><strong>{curriculumData.reduce((acc: number, sec: any) => acc + (sec.chapters || []).length, 0)}</strong> Chapters</span>
                </div>
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faBullseye} className="text-gray-500" />
                  <span className="text-sm text-gray-600"><strong>{curriculumData.reduce((acc: number, sec: any) => acc + (sec.chapters || []).reduce((a: number, ch: any) => a + (ch.items || []).length, 0), 0)}</strong> Items</span>
                </div>
              </div>
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                title="Collapse Sidebar"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="text-gray-500" />
              </button>
            </div>
            
            {/* Progress Bar */}
            <div className="px-5 py-2 bg-white border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500 font-medium">Course Progress</span>
                <span className="text-[10px] font-semibold" style={{ color: brand.colors.primary }}>35%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: '35%',
                    background: brand.gradients.primary
                  }}
                />
              </div>
            </div>
          
          {/* Curriculum Content */}
          <div className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div 
                  className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mb-3"
                  style={{ borderColor: brand.colors.primary, borderTopColor: 'transparent' }}
                />
                <p className="text-sm text-gray-500">Loading curriculum...</p>
              </div>
            ) : curriculumData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FontAwesomeIcon icon={faListCheck} className="text-4xl text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">No curriculum available for this course.</p>
              </div>
            ) : (
              curriculumData.map((section: any, secIdx: number) => (
                <div key={section.id} className="mb-3 border-b border-gray-100 pb-3 last:border-b-0">
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg transition-all hover:bg-gray-50"
                    style={{ backgroundColor: expandedSections.includes(section.id) ? `${brand.colors.primary}10` : '' }}
                  >
                    <div 
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: brand.gradients.primary }}
                    >
                      {secIdx + 1}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-gray-900 text-sm">{section.title}</div>
                      <div className="text-xs text-gray-500">{(section.chapters || []).length} chapters</div>
                    </div>
                    <FontAwesomeIcon 
                      icon={faChevronDown} 
                      className={`text-gray-400 text-xs transition-transform ${expandedSections.includes(section.id) ? 'rotate-180' : ''}`}
                    />
                  </button>
                  
                  {/* Chapters */}
                  {expandedSections.includes(section.id) && (
                    <div className="mt-1">
                      {(section.chapters || []).map((chapter: any, chIdx: number) => (
                        <div key={chapter.id} className="mb-2">
                          {/* Chapter Header */}
                          <button
                            onClick={() => toggleChapter(chapter.id)}
                            className="w-full flex items-center gap-3 p-2 rounded-lg transition-all hover:bg-gray-100"
                            style={{ backgroundColor: '#f8f9fa' }}
                          >
                            <div 
                              className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold flex-shrink-0"
                              style={{ backgroundColor: `${brand.colors.primary}20`, color: brand.colors.primary }}
                            >
                              {secIdx + 1}.{chIdx + 1}
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium text-gray-800 text-sm">{chapter.title}</div>
                              <div className="text-xs text-gray-400">{(chapter.items || []).length} items</div>
                            </div>
                            <FontAwesomeIcon 
                              icon={faChevronDown} 
                              className={`text-gray-400 text-xs transition-transform ${expandedChapters.includes(chapter.id) ? 'rotate-180' : ''}`}
                            />
                          </button>
                          
                          {/* Items - Notebook style */}
                          {expandedChapters.includes(chapter.id) && (
                            <div className="mt-1 rounded-lg overflow-hidden" style={{ backgroundColor: '#fafbfc' }}>
                              {(chapter.items || []).map((item: any, itemIdx: number) => {
                                const isSelected = selectedLecture?.id === item.id;
                                return (
                                  <div 
                                    key={item.id}
                                    onClick={() => handleLectureClick(item, chapter.title)}
                                    className={`flex items-center gap-3 p-2 pl-4 transition-all cursor-pointer group ${itemIdx !== (chapter.items || []).length - 1 ? 'border-b border-dashed border-gray-200' : ''} ${isSelected ? 'rounded-lg' : 'hover:bg-gray-100'}`}
                                    style={isSelected ? { background: brand.gradients.primary } : {}}
                                  >
                                    <FontAwesomeIcon 
                                      icon={getItemIcon(item.type)} 
                                      className="w-4 flex-shrink-0"
                                      style={{ color: isSelected ? 'white' : getItemColor(item.type) }}
                                    />
                                    <div className="flex-1 text-left">
                                      <div className={`text-sm ${isSelected ? 'text-white font-medium' : 'text-gray-700 group-hover:text-gray-900'}`}>{item.title}</div>
                                    </div>
                                    <div 
                                      className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                                      style={isSelected 
                                        ? { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }
                                        : { backgroundColor: `${getItemColor(item.type)}15`, color: getItemColor(item.type) }
                                      }
                                    >
                                      {item.duration}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          
          {/* Footer with Copyright */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-center flex-shrink-0 bg-gray-50">
            <p className="text-[10px] text-gray-400">© Tutorials Point India Private Limited</p>
          </div>
        </div>
        ))}

        {/* Right - Content Viewer (Video Player) */}
        <div className="flex-1 p-[5px] pb-5 mb-5 overflow-y-auto bg-gray-50 flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center">
                <div
                  className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
                  style={{ borderColor: brand.colors.primary, borderTopColor: 'transparent' }}
                />
                <p className="text-gray-500">Loading curriculum...</p>
              </div>
            </div>
          ) : (
            <div key={`content-${selectedLecture?.id || 'none'}-${selectedLecture?.type || 'none'}`} className="flex flex-col flex-1 h-full">
              {renderContent()}
              {/* Only show tabs for video/text when content is loaded and not loading */}
              {selectedLecture && 
               ['video', 'text'].includes(selectedLecture.type?.toLowerCase()) && 
               !isLoadingContent && 
               (selectedLecture.type?.toLowerCase() === 'video' || selectedLecture.isContentLoaded) && 
               renderTabs()}
            </div>
          )}
        </div>
      </div>

      {/* AI Learning Assistant Dialog */}
      <AILearningAssistant 
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        courseName={courseName}
        currentChapter={currentChapterName}
        currentLecture={selectedLecture?.title || ''}
        courseSlug={courseSlug}
      />

      {/* SQL Help Modal */}
      <SQLHelpModal 
        isOpen={showSQLHelpModal}
        onClose={() => setShowSQLHelpModal(false)}
      />

      {/* Exercise Evaluation Modal */}
      {showEvaluationModal && exerciseSubmission?.evaluation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className={`p-6 ${exerciseSubmission.evaluation.isCorrect ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-orange-500 to-red-600'} text-white`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${exerciseSubmission.evaluation.isCorrect ? 'bg-white/20' : 'bg-white/20'}`}>
                    <FontAwesomeIcon 
                      icon={exerciseSubmission.evaluation.isCorrect ? faCheckCircle : faTimesCircle} 
                      className="text-2xl"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      {exerciseSubmission.evaluation.isCorrect ? 'Great Job!' : 'Keep Trying!'}
                    </h2>
                    <p className="text-white/80 text-sm">AI Evaluation Result</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEvaluationModal(false)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Score */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1">
                  <div className="text-sm text-gray-500 mb-1">Score</div>
                  <div className="flex items-center gap-2">
                    <div className="text-3xl font-bold text-gray-800">{exerciseSubmission.evaluation.score}</div>
                    <div className="text-lg text-gray-400">/100</div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-500 mb-1">Optimization</div>
                  <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                    exerciseSubmission.evaluation.isOptimized 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    <FontAwesomeIcon icon={exerciseSubmission.evaluation.isOptimized ? faCheckCircle : faLightbulb} className="text-xs" />
                    {exerciseSubmission.evaluation.isOptimized ? 'Optimized' : 'Can be improved'}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-500 mb-1">Attempts</div>
                  <div className="text-xl font-semibold text-gray-700">{exerciseSubmission.attempts}</div>
                </div>
              </div>

              {/* Feedback */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FontAwesomeIcon icon={faCommentDots} className="text-blue-500" />
                  Feedback
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 text-gray-700 text-sm leading-relaxed">
                  {exerciseSubmission.evaluation.feedback}
                </div>
              </div>

              {/* Suggestions */}
              {exerciseSubmission.evaluation.suggestions && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <FontAwesomeIcon icon={faLightbulb} className="text-yellow-500" />
                    Suggestions for Improvement
                  </h3>
                  <div className="bg-yellow-50 rounded-lg p-4 text-gray-700 text-sm leading-relaxed border border-yellow-200">
                    {exerciseSubmission.evaluation.suggestions}
                  </div>
                </div>
              )}

              {/* Submitted Code */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FontAwesomeIcon icon={faCode} className="text-purple-500" />
                  Your Submitted Code
                </h3>
                <pre className="bg-gray-900 rounded-lg p-4 text-green-400 text-sm overflow-x-auto font-mono">
                  {exerciseSubmission.submittedCode}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowEvaluationModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
              >
                Close
              </button>
              {!exerciseSubmission.evaluation.isCorrect && (
                <button
                  onClick={() => {
                    setShowEvaluationModal(false);
                    // Focus on editor to try again
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseCurriculum;