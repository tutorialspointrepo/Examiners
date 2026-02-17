import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { firebaseService } from './services/firebase_service';
import {
  faXmark,
  faFileUpload,
  faPaste,
  faWandMagicSparkles,
  faRoute,
  faArrowLeft,
  faArrowRight,
  faSpinner,
  faCheckCircle,
  faGripVertical,
  faTrash,
  faPlus,
  faSearch,
  faBookOpen,
  faLock,
  faLockOpen,
  faFileLines,
  faCheck,
  faExclamationTriangle,
  faCircleCheck,
  faCircle,
  faSave,
  faArrowsRotate,
} from '@fortawesome/sharp-light-svg-icons';

// ============ INTERFACES ============

interface ExtractedSkill {
  name: string;
  category: 'must_have' | 'should_have' | 'nice_to_have';
  weight: number; // 1-10
  matched: boolean;
  matchedCourseId?: number | string | null;
  altGroup?: string | null; // e.g. "database" — skills in same group are alternatives (pick one)
}

interface MappedCourse {
  courseId: number | string;
  courseName: string;
  category: string;
  duration: string;
  lectures: number;
  totalChapters?: number;
  slug?: string;
  thumbnailUrl?: string;
  courseAuthor?: string;
  complexityLevel?: number;
  matchedSkills: string[];
  phase: string;
  phaseNumber: number;
  sequenceOrder: number;
  isRequired: boolean;
}

interface CreateLearningPathModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandTheme: {
    colors: { primary: string; secondary: string };
    gradients: { primary: string };
  };
  currentUser: any;
  selectedCollege: any;
  onPathCreated?: (path: any) => void;
  editPath?: any; // Pass existing path data to enable edit mode
}

type ViewType = 'choice' | 'jd-input' | 'ai-processing' | 'review' | 'details' | 'success';

// ============ COMPONENT ============

export default function CreateLearningPathModal({
  isOpen,
  onClose,
  brandTheme,
  currentUser: _currentUser,
  selectedCollege,
  onPathCreated,
  editPath,
}: CreateLearningPathModalProps) {
  const [view, setView] = useState<ViewType>('choice');
  const [animatedIn, setAnimatedIn] = useState(false);
  
  // JD Input state
  const [jdText, setJdText] = useState('');
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [jdInputMethod, setJdInputMethod] = useState<'paste' | 'upload'>('paste');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState('');

  // AI Processing state
  const [aiProgress, setAiProgress] = useState(0);
  const [aiStage, setAiStage] = useState('');

  // Review state (AI-mapped courses)
  const [extractedSkills, setExtractedSkills] = useState<ExtractedSkill[]>([]);
  const [mappedCourses, setMappedCourses] = useState<MappedCourse[]>([]);

  // Details state (final step before save)
  const [pathName, setPathName] = useState('');
  const [pathDescription, setPathDescription] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [estimatedWeeks, setEstimatedWeeks] = useState(12);
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [isSequential, setIsSequential] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Standard path state
  const [isStandardPath, setIsStandardPath] = useState(false);
  const [showManualCoursePicker, setShowManualCoursePicker] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState('');

  // Course search/replace state
  const [courseSearchSkill, setCourseSearchSkill] = useState<string | null>(null);
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseLastDoc, setCourseLastDoc] = useState<any>(null);
  const [courseHasMore, setCourseHasMore] = useState(true);
  const [loadingMoreCourses, setLoadingMoreCourses] = useState(false);
  const courseSearchTimerRef = useRef<any>(null);


  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      if (editPath) {
        // Edit mode: pre-fill form and go to details
        setPathName(editPath.pathName || editPath.name || '');
        setPathDescription(editPath.description || '');
        setTargetRole(editPath.targetRole || '');
        setEstimatedWeeks(editPath.estimatedWeeks || 12);
        setDifficulty(editPath.difficulty || 'intermediate');
        setIsSequential(editPath.isSequential || false);
        setExtractedSkills(
          (editPath.skills || []).map((s: any) =>
            typeof s === 'string'
              ? { name: s, category: 'must_have' as const, weight: 5, matched: false, matchedCourseId: null, altGroup: null }
              : s
          )
        );
        setMappedCourses(
          (editPath.courses || []).map((c: any, idx: number) => ({
            courseId: c.courseId || c.id || '',
            courseName: c.courseName || c.name || '',
            category: c.category || '',
            duration: c.duration || '0h',
            lectures: c.lectures || 0,
            totalChapters: c.totalChapters || 0,
            slug: c.slug || '',
            thumbnailUrl: c.thumbnailUrl || c.thumbnail || '',
            courseAuthor: c.courseAuthor || '',
            complexityLevel: c.complexityLevel || 0,
            matchedSkills: c.matchedSkills || [],
            phase: c.phase || `Phase ${c.phaseNumber || 1}`,
            phaseNumber: c.phaseNumber || 1,
            sequenceOrder: c.sequenceOrder || idx + 1,
            isRequired: c.isRequired !== false,
          }))
        );
        setIsStandardPath(true);
        setJdText(editPath.jdText || '');
        setView('details');
      } else {
        setView('choice');
        resetForm();
      }
      setAnimatedIn(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimatedIn(true);
        });
      });
    } else {
      setAnimatedIn(false);
    }
  }, [isOpen, editPath]);

  const resetForm = () => {
    setJdText('');
    setJdFile(null);
    setJdInputMethod('paste');
    setFileError('');
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFilePreviewUrl(null);
    setDocxHtml('');
    setAiProgress(0);
    setAiStage('');
    setExtractedSkills([]);
    setMappedCourses([]);
    setPathName('');
    setPathDescription('');
    setTargetRole('');
    setEstimatedWeeks(12);
    setDifficulty('intermediate');
    setIsSequential(true);
    setIsStandardPath(false);
    setIsSubmitting(false);
    setCourseSearchSkill(null);
    setCourseSearchQuery('');
    setShowManualCoursePicker(false);
    setManualSearchQuery('');
  };

  // AI Processing — calls Cloud Function
  // AI Processing — calls Cloud Function via firebaseService
  const startAIProcessing = async () => {
    setView('ai-processing');
    setAiProgress(0);
    setAiStage('Preparing job description...');

    const stages = [
      { progress: 10, stage: 'Sending to AI...', delay: 500 },
      { progress: 25, stage: 'Reading job description...', delay: 2000 },
      { progress: 40, stage: 'Extracting required skills...', delay: 4000 },
      { progress: 55, stage: 'Matching skills to course catalog...', delay: 7000 },
      { progress: 70, stage: 'Generating course sequence...', delay: 10000 },
      { progress: 80, stage: 'Building learning phases...', delay: 14000 },
    ];

    const timers: NodeJS.Timeout[] = [];
    stages.forEach(s => {
      timers.push(setTimeout(() => {
        setAiProgress(s.progress);
        setAiStage(s.stage);
      }, s.delay));
    });

    try {
      let finalJdText = jdText.trim();
      let fileBase64: string | undefined;
      let fileName: string | undefined;

      // If user uploaded a file and didn't paste text, send the file
      if (!finalJdText && jdFile) {
        const ext = jdFile.name.split('.').pop()?.toLowerCase();

        if (ext === 'txt') {
          finalJdText = (await jdFile.text()).trim();
        } else if (ext === 'pdf' || ext === 'docx' || ext === 'doc') {
          setAiStage('Preparing document for upload...');
          const arrayBuffer = await jdFile.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          fileBase64 = btoa(binary);
          fileName = jdFile.name;
        } else {
          throw new Error(`Cannot process .${ext} files. Please use PDF, DOCX, or paste the text directly.`);
        }
      }

      if (!finalJdText && !fileBase64) {
        throw new Error('Please paste the job description or upload a PDF/DOCX file.');
      }
      if (finalJdText && finalJdText.length < 30) {
        throw new Error('Job description text is too short (minimum 30 characters).');
      }

      const result = await firebaseService.generateLearningPathAI(finalJdText || undefined, fileBase64, fileName);

      timers.forEach(t => clearTimeout(t));

      if (!result.success || !result.data) {
        throw new Error(result.error || 'AI processing failed');
      }

      const aiData = result.data;

      setAiProgress(95);
      setAiStage('Finalizing learning path...');

      setExtractedSkills(aiData.extractedSkills || []);
      setMappedCourses(aiData.mappedCourses || []);
      setPathName(aiData.pathName || '');
      setPathDescription(aiData.description || '');
      setTargetRole(aiData.targetRole || '');
      setEstimatedWeeks(aiData.estimatedWeeks || 8);
      setDifficulty(aiData.difficulty || 'intermediate');

      setAiProgress(100);
      setAiStage('Complete!');

      console.log(`✅ Learning Path AI: ${aiData.extractedSkills?.length} skills, ${aiData.mappedCourses?.length} courses, ${aiData.metadata?.tokensUsed} tokens`);

      setTimeout(() => setView('review'), 500);

    } catch (error: any) {
      console.error('❌ AI Processing failed:', error);
      timers.forEach(t => clearTimeout(t));
      setAiProgress(0);
      setAiStage('');
      setView('jd-input');
      setFileError(error?.message || error?.details || 'AI processing failed. Please try again.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File size exceeds 10MB limit');
      return;
    }

    const allowedTypes = [
      'application/pdf', 'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    const allowedExts = ['.pdf', '.txt', '.doc', '.docx', '.ppt', '.pptx'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      setFileError('Unsupported file type. Upload PDF, DOC, DOCX, PPT, PPTX, or TXT.');
      return;
    }

    // Revoke previous preview URL
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);

    setJdFile(file);
    setFileError('');
    setJdText('');
    setDocxHtml('');

    // Create object URL for preview (works for PDF in iframe)
    const previewUrl = URL.createObjectURL(file);
    setFilePreviewUrl(previewUrl);

    // For TXT files, read text content
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const text = await file.text();
      setJdText(text.trim());
    }

    // For DOCX files, convert to HTML using mammoth
    if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        // @ts-ignore
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (result.value) {
          setDocxHtml(result.value);
        }
      } catch (err) {
        console.warn('Mammoth DOCX preview failed:', err);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      // Simulate file input change
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
        fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // Direct call
        handleFileChange({ target: { files: [file] } } as any);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const removeCourse = (courseId: number | string) => {
    setMappedCourses(prev => {
      const filtered = prev.filter(c => String(c.courseId) !== String(courseId));
      return filtered.map((c, i) => ({ ...c, sequenceOrder: i + 1 }));
    });
  };

  const removeSkill = (skillName: string) => {
    const course = getCourseForSkill(skillName);
    if (course) removeCourse(course.courseId);
    setExtractedSkills(prev => prev.filter(s => s.name !== skillName));
  };

  const handleSave = async (status: 'draft' | 'published') => {
    setIsSubmitting(true);
    try {
      const pathPayload = {
        pathName,
        description: pathDescription,
        targetRole,
        estimatedWeeks,
        difficulty,
        isSequential,
        status,
        skills: extractedSkills,
        courses: mappedCourses,
        totalCourses: mappedCourses.length,
        totalDurationHours: mappedCourses.reduce((acc: number, c: any) => acc + parseInt(c.duration || '0'), 0),
        jdText: jdText || '',
        collegeId: selectedCollege?.id || selectedCollege?.collegeId || '',
      };

      if (editPath?.id) {
        // Update existing path
        const result = await firebaseService.updateLearningPath(editPath.id, pathPayload);
        if (!result.success) {
          throw new Error(result.error || 'Failed to update');
        }
        console.log('✅ Learning path updated:', editPath.id);
        setIsSubmitting(false);
        setView('success');
        setTimeout(() => {
          onPathCreated?.({ id: editPath.id, pathName, status });
          onClose();
        }, 2000);
      } else {
        // Create new path
        const result = await firebaseService.saveLearningPath({
          pathName,
          description: pathDescription,
          targetRole,
          estimatedWeeks,
          difficulty,
          isSequential,
          status,
          skills: extractedSkills,
          courses: mappedCourses,
          jdText: jdText || undefined,
          collegeId: selectedCollege?.id || selectedCollege?.collegeId || '',
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to save');
        }

        console.log('✅ Learning path saved:', result.pathId);
        setIsSubmitting(false);
        setView('success');
        setTimeout(() => {
          onPathCreated?.({ id: result.pathId, pathName, status });
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      console.error('❌ Save failed:', error);
      setIsSubmitting(false);
      alert(error.message || 'Failed to save learning path');
    }
  };

  // Fetch courses paginated for the search/replace picker
  const fetchCoursesPaginated = async (searchQuery: string = '', reset: boolean = true) => {
    if (reset) {
      setLoadingCourses(true);
      setAllCourses([]);
      setCourseLastDoc(null);
      setCourseHasMore(true);
    } else {
      setLoadingMoreCourses(true);
    }
    try {
      const result = await firebaseService.searchCoursesPaginated({
        searchQuery,
        pageSize: 15,
        lastDoc: reset ? null : courseLastDoc,
      });
      if (reset) {
        setAllCourses(result.courses);
      } else {
        setAllCourses(prev => [...prev, ...result.courses]);
      }
      setCourseLastDoc(result.lastDoc);
      setCourseHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to fetch courses:', err);
    }
    setLoadingCourses(false);
    setLoadingMoreCourses(false);
  };

  // Load more on scroll
  const handleCourseListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      if (courseHasMore && !loadingMoreCourses && !loadingCourses) {
        fetchCoursesPaginated(courseSearchQuery, false);
      }
    }
  };

  // Open course picker for a skill
  const openCoursePicker = (skillName: string) => {
    setCourseSearchSkill(skillName);
    setCourseSearchQuery('');
    fetchCoursesPaginated('', true);
  };

  // Debounced search when typing
  const handleCourseSearchChange = (value: string) => {
    setCourseSearchQuery(value);
    if (courseSearchTimerRef.current) clearTimeout(courseSearchTimerRef.current);
    courseSearchTimerRef.current = setTimeout(() => {
      fetchCoursesPaginated(value, true);
    }, 400);
  };

  // Assign a course to a skill (replace existing or add new)
  const assignCourseToSkill = (skillName: string, course: any) => {
    // Remove old mapping for this skill if exists
    const existingCourse = mappedCourses.find(c => c.matchedSkills.includes(skillName));
    
    const newCourse: MappedCourse = {
      courseId: course.courseId,
      courseName: course.courseName,
      category: (course.courseCategories || []).join(', '),
      duration: `${course.totalDuration ? Math.round(course.totalDuration / 3600) : 0}h`,
      lectures: course.totalLectures || 0,
      totalChapters: course.totalChapters || 0,
      slug: course.slug || '',
      thumbnailUrl: course.thumbnailUrl || '',
      courseAuthor: course.courseAuthor || '',
      complexityLevel: course.complexityLevel || 1,
      matchedSkills: [skillName],
      phase: existingCourse?.phase || 'Core Skills',
      phaseNumber: existingCourse?.phaseNumber || 2,
      sequenceOrder: mappedCourses.length + 1,
      isRequired: true,
    };

    setMappedCourses(prev => {
      let updated: MappedCourse[];
      if (existingCourse) {
        // Replace: remove old course's reference to this skill
        updated = prev.map(c => {
          if (String(c.courseId) === String(existingCourse.courseId)) {
            const remainingSkills = c.matchedSkills.filter(s => s !== skillName);
            if (remainingSkills.length === 0) return null as any; // remove course entirely
            return { ...c, matchedSkills: remainingSkills };
          }
          return c;
        }).filter(Boolean);
        updated.push(newCourse);
      } else {
        updated = [...prev, newCourse];
      }
      return updated.map((c, i) => ({ ...c, sequenceOrder: i + 1 }));
    });

    // Update skill as matched
    setExtractedSkills(prev =>
      prev.map(s => s.name === skillName ? { ...s, matched: true, matchedCourseId: course.courseId } : s)
    );

    setCourseSearchSkill(null);
  };

  // Add course manually (for standard path)
  const addCourseManually = (course: any) => {
    const alreadyAdded = mappedCourses.some(mc => String(mc.courseId) === String(course.courseId));
    if (alreadyAdded) return;

    const newCourse: MappedCourse = {
      courseId: course.courseId,
      courseName: course.courseName,
      category: (course.courseCategories || []).join(', '),
      duration: `${course.totalDuration ? Math.round(course.totalDuration / 3600) : 0}h`,
      lectures: course.totalLectures || 0,
      totalChapters: course.totalChapters || 0,
      slug: course.slug || '',
      thumbnailUrl: course.thumbnailUrl || '',
      courseAuthor: course.courseAuthor || '',
      complexityLevel: course.complexityLevel || 1,
      matchedSkills: [],
      phase: 'Core Skills',
      phaseNumber: 2,
      sequenceOrder: mappedCourses.length + 1,
      isRequired: true,
    };

    setMappedCourses(prev => [...prev, newCourse].map((c, i) => ({ ...c, sequenceOrder: i + 1 })));
  };

  // Open manual picker
  const openManualCoursePicker = () => {
    setShowManualCoursePicker(true);
    setManualSearchQuery('');
    fetchCoursesPaginated('', true);
  };

  // Search in manual picker
  const handleManualSearchChange = (value: string) => {
    setManualSearchQuery(value);
    if (courseSearchTimerRef.current) clearTimeout(courseSearchTimerRef.current);
    courseSearchTimerRef.current = setTimeout(() => {
      fetchCoursesPaginated(value, true);
    }, 400);
  };

  // Get the mapped course for a specific skill
  const getCourseForSkill = (skillName: string): MappedCourse | undefined => {
    return mappedCourses.find(c => c.matchedSkills.includes(skillName));
  };

  // Drag-and-drop state for course reordering
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleCourseDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleCourseDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setDragOverIndex(index);
  };

  const handleCourseDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    if (view === 'review') {
      // Reorder skills in review screen
      setExtractedSkills(prev => {
        const arr = [...prev];
        const [moved] = arr.splice(dragIndex, 1);
        arr.splice(index, 0, moved);
        return arr;
      });
    }
    // Always reorder mapped courses
    setMappedCourses(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIndex, 1);
      arr.splice(index, 0, moved);
      return arr.map((c, i) => ({ ...c, sequenceOrder: i + 1 }));
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleCourseDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const canProceedFromJD = jdText.trim().length > 50 || jdFile !== null;

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        .custom-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .custom-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="fixed inset-0 z-[10000] flex items-start justify-start p-2">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/70 backdrop-blur-sm z-0 transition-opacity duration-300"
          style={{ opacity: animatedIn ? 1 : 0 }}
          onClick={onClose} 
        />
        
        {/* Modal */}
        <div
          className="relative bg-white shadow-2xl w-[calc(100%-8px)] max-w-[50rem] h-[calc(100%-4px)] flex flex-col overflow-hidden z-10 rounded-2xl transform transition-all duration-500 ease-in-out"
          style={{ transform: animatedIn ? 'translateX(0)' : 'translateX(-100%)' }}
          onClick={(e) => e.stopPropagation()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div
            className="px-5 py-3 flex items-center justify-between border-b flex-shrink-0 rounded-t-2xl"
            style={{ background: brandTheme.gradients.primary }}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <FontAwesomeIcon icon={faRoute} className="text-white text-lg" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {view === 'choice' ? 'Create Learning Path' :
                   view === 'jd-input' ? 'Upload Job Description' :
                   view === 'ai-processing' ? 'AI is Working...' :
                   view === 'review' ? 'Review Course Mapping' :
                   view === 'details' ? (editPath ? 'Edit Learning Path' : 'Path Details') :
                   'Success!'}
                </h2>
                <p className="text-xs text-white text-opacity-80">
                  {view === 'choice' ? 'Choose how you want to create the learning path' :
                   view === 'jd-input' ? 'Paste or upload a job description' :
                   view === 'ai-processing' ? 'Analyzing JD and mapping courses' :
                   view === 'review' ? 'Review AI-suggested courses and sequencing' :
                   view === 'details' ? (editPath ? 'Update path name, description, courses and settings' : 'Finalize path name, description and settings') :
                   `Learning path ${editPath ? 'updated' : 'created'} successfully`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {view !== 'choice' && view !== 'ai-processing' && view !== 'success' && !editPath && (
                <button
                  onClick={() => {
                    if (view === 'jd-input') setView('choice');
                    else if (view === 'review') setView('jd-input');
                    else if (view === 'details') setView(isStandardPath ? 'choice' : 'review');
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
                >
                  <FontAwesomeIcon icon={faArrowLeft} className="text-white text-sm" />
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
              >
                <FontAwesomeIcon icon={faXmark} className="text-white text-sm" />
              </button>
            </div>
          </div>

          {/* ===================== STEP 1: CHOICE VIEW ===================== */}
          {view === 'choice' && (
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col justify-center">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto w-full">
                {/* JD Based Option */}
                <button
                  onClick={() => { setIsStandardPath(false); setView('jd-input'); }}
                  className="group relative border rounded-xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 text-left"
                  style={{
                    background: `linear-gradient(135deg, ${brandTheme.colors.primary}10 0%, ${brandTheme.colors.secondary}10 100%)`,
                    borderColor: brandTheme.colors.primary + '40'
                  }}
                >
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
                      style={{ background: brandTheme.gradients.primary }}
                    >
                      <FontAwesomeIcon icon={faWandMagicSparkles} className="text-white text-xl" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 mb-2">JD Based Learning Path</h3>
                      <p className="text-sm text-gray-600">
                        Upload a job description and let AI extract skills and map courses automatically
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center pt-2">
                      <span className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ backgroundColor: brandTheme.colors.primary + '20', color: brandTheme.colors.primary }}>
                        🤖 AI Powered
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ backgroundColor: brandTheme.colors.primary + '20', color: brandTheme.colors.primary }}>
                        📄 PDF / Text
                      </span>
                    </div>
                  </div>
                </button>

                {/* Standard Option */}
                <button
                  onClick={() => { setIsStandardPath(true); setView('details'); }}
                  className="group relative border rounded-xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 text-left"
                  style={{
                    background: `linear-gradient(135deg, ${brandTheme.colors.secondary}10 0%, ${brandTheme.colors.primary}10 100%)`,
                    borderColor: brandTheme.colors.secondary + '40'
                  }}
                >
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
                      style={{ background: brandTheme.gradients.primary }}
                    >
                      <FontAwesomeIcon icon={faRoute} className="text-white text-xl" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 mb-2">Standard Learning Path</h3>
                      <p className="text-sm text-gray-600">
                        Manually create a learning path by selecting and sequencing courses
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center pt-2">
                      <span className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ backgroundColor: brandTheme.colors.secondary + '20', color: brandTheme.colors.secondary }}>
                        ✏️ Manual
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ backgroundColor: brandTheme.colors.secondary + '20', color: brandTheme.colors.secondary }}>
                        📚 Pick Courses
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ===================== STEP 2: JD INPUT ===================== */}
          {view === 'jd-input' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Content area */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {/* Paste input */}
                {jdInputMethod === 'paste' && (
                  <div className="flex flex-col h-full">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Paste the Job Description
                    </label>
                    <textarea
                      value={jdText}
                      onChange={e => setJdText(e.target.value)}
                      placeholder="Paste the complete job description here including requirements, responsibilities, qualifications..."
                      className="w-full flex-1 min-h-[calc(100vh-340px)] px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 resize-none"
                      style={{ focusRingColor: brandTheme.colors.primary } as any}
                    />
                    <p className="mt-2 text-[11px] text-gray-400">
                      {jdText.length} characters · Minimum 50 characters required
                    </p>
                  </div>
                )}

                {/* Upload input */}
                {jdInputMethod === 'upload' && (
                <div className="flex flex-col h-full">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  {!jdFile ? (
                    /* Drop zone - no file yet */
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragOver}
                      onDragLeave={handleDragLeave}
                      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors flex-1 flex items-center justify-center ${
                        isDragging ? '' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      style={{ 
                        borderColor: isDragging ? brandTheme.colors.primary : undefined,
                        backgroundColor: isDragging ? brandTheme.colors.primary + '08' : undefined 
                      }}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                          <FontAwesomeIcon icon={faFileUpload} className="text-2xl text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-[11px] text-gray-400 mt-1">PDF, DOC, DOCX, PPT, PPTX, or TXT (Max 10MB)</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* File uploaded - show preview */
                    <div className="flex flex-col flex-1 min-h-0">
                      {/* File info bar */}
                      <div className="flex items-center gap-3 mb-3 px-1">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: brandTheme.colors.primary + '15' }}>
                          <FontAwesomeIcon icon={faFileLines} className="text-sm" style={{ color: brandTheme.colors.primary }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{jdFile.name}</p>
                          <p className="text-[11px] text-gray-400">{(jdFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button
                          onClick={() => {
                            if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
                            setJdFile(null);
                            setFilePreviewUrl(null);
                            setJdText('');
                            setFileError('');
                            setDocxHtml('');
                          }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Remove file"
                        >
                          <FontAwesomeIcon icon={faXmark} className="text-sm" />
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          Change
                        </button>
                      </div>

                      {/* Document Preview */}
                      <div 
                        className="flex-1 min-h-0 rounded-xl overflow-hidden bg-white"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragOver}
                        onDragLeave={handleDragLeave}
                      >
                        {/* PDF preview via iframe */}
                        {(jdFile.type === 'application/pdf' || jdFile.name.endsWith('.pdf')) && filePreviewUrl && (
                          <div className="w-full h-full min-h-[calc(100vh-340px)]" style={{ background: '#525659' }}>
                            <iframe
                              src={filePreviewUrl + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH'}
                              className="w-full h-full border-0"
                              title="PDF Preview"
                            />
                          </div>
                        )}

                        {/* TXT preview - editable */}
                        {(jdFile.type === 'text/plain' || jdFile.name.endsWith('.txt')) && (
                          <textarea
                            value={jdText}
                            onChange={e => setJdText(e.target.value)}
                            className="w-full h-full min-h-[calc(100vh-340px)] px-4 py-3 text-sm text-gray-700 focus:outline-none resize-none bg-transparent"
                          />
                        )}

                        {/* DOCX preview via mammoth HTML */}
                        {(jdFile.name.endsWith('.docx') || jdFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') && (
                          docxHtml ? (
                            <div 
                              className="w-full h-full min-h-[calc(100vh-340px)] overflow-auto px-8 py-6 bg-white prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: docxHtml }}
                              style={{ fontSize: '14px', lineHeight: '1.7' }}
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-340px)] gap-3">
                              <FontAwesomeIcon icon={faSpinner} className="text-xl animate-spin" style={{ color: brandTheme.colors.primary }} />
                              <p className="text-sm text-gray-500">Loading document preview...</p>
                            </div>
                          )
                        )}

                        {/* DOC/PPT/PPTX - not directly previewable */}
                        {!jdFile.name.endsWith('.pdf') && !jdFile.name.endsWith('.txt') && !jdFile.name.endsWith('.docx') && (
                          <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-340px)] gap-4">
                            <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: brandTheme.colors.primary + '10' }}>
                              <FontAwesomeIcon 
                                icon={faFileLines} 
                                className="text-4xl" 
                                style={{ color: brandTheme.colors.primary }} 
                              />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-semibold text-gray-900">{jdFile.name}</p>
                              <p className="text-[11px] text-gray-400 mt-1">
                                Preview not available for .{jdFile.name.split('.').pop()} files
                              </p>
                              <p className="text-[11px] mt-2 font-medium" style={{ color: brandTheme.colors.primary }}>
                                AI will process this document directly
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {fileError && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                      <FontAwesomeIcon icon={faExclamationTriangle} />
                      {fileError}
                    </div>
                  )}
                </div>
              )}

              </div>

              {/* Bottom bar with toggle + analyze */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setJdInputMethod('paste')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                      jdInputMethod === 'paste'
                        ? 'text-white border-transparent shadow-md'
                        : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                    style={jdInputMethod === 'paste' ? { background: brandTheme.gradients.primary } : {}}
                  >
                    <FontAwesomeIcon icon={faPaste} />
                    Paste Text
                  </button>
                  <button
                    onClick={() => setJdInputMethod('upload')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                      jdInputMethod === 'upload'
                        ? 'text-white border-transparent shadow-md'
                        : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                    style={jdInputMethod === 'upload' ? { background: brandTheme.gradients.primary } : {}}
                  >
                    <FontAwesomeIcon icon={faFileUpload} />
                    Upload File
                  </button>
                </div>
                <button
                  onClick={startAIProcessing}
                  disabled={!canProceedFromJD}
                  className={`flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-xl shadow-md transition-all ${
                    canProceedFromJD ? 'hover:shadow-lg' : 'opacity-50 cursor-not-allowed'
                  }`}
                  style={{ background: brandTheme.gradients.primary }}
                >
                  <FontAwesomeIcon icon={faWandMagicSparkles} />
                  Analyze with AI
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </button>
              </div>
            </div>
          )}

          {/* ===================== STEP 3: AI PROCESSING ===================== */}
          {view === 'ai-processing' && (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="w-full max-w-md">
                {/* Animated icon */}
                <div className="flex justify-center mb-8">
                  <div className="relative">
                    <div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
                      style={{ background: brandTheme.gradients.primary }}
                    >
                      <FontAwesomeIcon icon={faWandMagicSparkles} className="text-white text-3xl animate-pulse" />
                    </div>
                    {aiProgress < 100 && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow">
                        <FontAwesomeIcon icon={faSpinner} className="text-xs animate-spin" style={{ color: brandTheme.colors.primary }} />
                      </div>
                    )}
                    {aiProgress === 100 && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow">
                        <FontAwesomeIcon icon={faCheck} className="text-white text-[10px]" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{aiStage || 'Starting analysis...'}</h3>
                  <p className="text-sm text-gray-500">{aiProgress}% complete</p>
                </div>

                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${aiProgress}%`, background: brandTheme.gradients.primary }}
                  />
                </div>

                {/* Stage checklist */}
                <div className="mt-8 space-y-3">
                  {[
                    { label: 'Parse job description', threshold: 15 },
                    { label: 'Extract skills & requirements', threshold: 35 },
                    { label: 'Match with course catalog', threshold: 55 },
                    { label: 'Generate course sequence', threshold: 75 },
                    { label: 'Finalize learning path', threshold: 90 },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {aiProgress >= item.threshold ? (
                        <FontAwesomeIcon icon={faCircleCheck} className="text-green-500" />
                      ) : (
                        <FontAwesomeIcon icon={faCircle} className="text-gray-300 text-sm" />
                      )}
                      <span className={`text-sm ${aiProgress >= item.threshold ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===================== STEP 4: REVIEW COURSES ===================== */}
          {view === 'review' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Stats bar */}
              <div className="flex items-center gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-green-600">{extractedSkills.filter(s => s.matched).length} matched</span>
                </div>
                {extractedSkills.some(s => !s.matched) && (
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-amber-600">{extractedSkills.filter(s => !s.matched).length} need courses</span>
                  </div>
                )}
                <span className="text-[11px] text-gray-400">{extractedSkills.length} skills total</span>
              </div>

              {/* Skill cards */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
                <div className="space-y-2">
                  {(() => {
                    // Pre-group skills: consecutive skills with same altGroup get wrapped together
                    const groups: { isAltGroup: boolean; groupName: string | null; skills: { skill: ExtractedSkill; idx: number }[] }[] = [];
                    extractedSkills.forEach((skill, idx) => {
                      const lastGroup = groups[groups.length - 1];
                      if (skill.altGroup && lastGroup?.isAltGroup && lastGroup.groupName === skill.altGroup) {
                        lastGroup.skills.push({ skill, idx });
                      } else {
                        groups.push({
                          isAltGroup: !!skill.altGroup,
                          groupName: skill.altGroup || null,
                          skills: [{ skill, idx }],
                        });
                      }
                    });

                    return groups.map((group, gi) => {
                      // Render a single altGroup wrapper
                      if (group.isAltGroup && group.skills.length > 1) {
                        return (
                          <div key={`g-${gi}`} className="rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-3 space-y-0">
                            {/* Group header */}
                            <div className="flex items-center gap-2 mb-2 px-1">
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2.5 py-1 rounded-full">
                                ↕ Choose one
                              </span>
                              <span className="text-[10px] text-blue-400">{group.skills.length} alternatives</span>
                              <div className="flex-1 h-px bg-blue-200" />
                            </div>

                            {group.skills.map(({ skill, idx: skillIdx }, si) => {
                              const course = getCourseForSkill(skill.name);
                              const isPickerOpen = courseSearchSkill === skill.name;
                              const weightDots = Math.round((skill.weight / 10) * 5);
                              const categoryLabel = skill.category === 'must_have' ? 'Must Have' : skill.category === 'should_have' ? 'Should Have' : 'Nice to Have';
                              const categoryClass = skill.category === 'must_have' ? 'bg-red-50 text-red-600' : skill.category === 'should_have' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600';

                              return (
                                <div key={skillIdx}>
                                  {/* OR divider between alternatives */}
                                  {si > 0 && (
                                    <div className="flex items-center gap-3 py-1.5 px-8">
                                      <div className="flex-1 h-px bg-blue-200" />
                                      <span className="text-[10px] font-bold text-blue-500 bg-white px-3 py-0.5 rounded-full border border-blue-200">OR</span>
                                      <div className="flex-1 h-px bg-blue-200" />
                                    </div>
                                  )}

                                  {/* Skill card inside group */}
                                  <div
                                    draggable
                                    onDragStart={() => handleCourseDragStart(skillIdx)}
                                    onDragOver={(e) => handleCourseDragOver(e, skillIdx)}
                                    onDrop={() => handleCourseDrop(skillIdx)}
                                    onDragEnd={handleCourseDragEnd}
                                    className={`rounded-2xl border p-4 transition-all hover:shadow-sm bg-white ${
                                      course
                                        ? 'border-l-[3px] border-l-green-500 border-gray-100'
                                        : 'border-l-[3px] border-l-amber-400 border-amber-100'
                                    } ${dragIndex === skillIdx ? 'opacity-40 scale-[0.98]' : ''} ${dragOverIndex === skillIdx ? 'ring-2 shadow-md' : ''}`}
                                    style={dragOverIndex === skillIdx ? { borderColor: brandTheme.colors.primary } : {}}
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 transition-colors">
                                        <FontAwesomeIcon icon={faGripVertical} className="text-xs" />
                                      </div>
                                      <div className="w-[50px] text-center flex-shrink-0">
                                        <div className="text-[22px] font-extrabold" style={{ background: brandTheme.gradients.primary, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{skill.weight}</div>
                                        <div className="text-[7px] font-semibold text-gray-400 uppercase tracking-[1px]">weight</div>
                                        <div className="flex gap-[3px] justify-center mt-1">
                                          {[1,2,3,4,5].map(d => (
                                            <span key={d} className={`w-[5px] h-[5px] rounded-full ${d <= weightDots ? 'opacity-100' : 'bg-gray-200'}`} style={d <= weightDots ? { background: brandTheme.colors.primary } : {}} />
                                          ))}
                                        </div>
                                      </div>
                                      <div className="w-[130px] flex-shrink-0">
                                        <div className="text-[13px] font-bold text-gray-900">{skill.name}</div>
                                        <span className={`inline-block text-[8px] font-bold px-2 py-[2px] rounded mt-1 uppercase tracking-[0.5px] ${categoryClass}`}>{categoryLabel}</span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        {course ? (
                                          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                                            {course.thumbnailUrl ? (
                                              <img src={course.thumbnailUrl} alt="" className="w-11 h-8 rounded-lg object-cover flex-shrink-0" />
                                            ) : (
                                              <div className="w-11 h-8 rounded-lg flex-shrink-0" style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary}20, ${brandTheme.colors.secondary}20)` }}>
                                                <div className="w-full h-full flex items-center justify-center"><FontAwesomeIcon icon={faBookOpen} className="text-[9px] text-gray-300" /></div>
                                              </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <div className="text-[12px] font-semibold text-gray-800 truncate">{course.courseName}</div>
                                              <div className="text-[10px] text-gray-400 mt-0.5">{course.lectures} lectures · {course.duration} · <span className="text-[9px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{course.phase}</span></div>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border-[1.5px] border-dashed border-amber-300 rounded-xl">
                                            <FontAwesomeIcon icon={faExclamationTriangle} className="text-[10px] text-amber-500" />
                                            <span className="text-[11px] font-medium text-amber-700">No matching course in catalog</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex-shrink-0 flex items-center gap-1.5">
                                        <button onClick={() => openCoursePicker(skill.name)} className={`text-[10px] font-semibold py-[7px] px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${course ? 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200' : 'text-white shadow-sm hover:opacity-90'}`} style={!course ? { background: brandTheme.gradients.primary, minWidth: '78px' } : {}}>
                                          <FontAwesomeIcon icon={course ? faArrowsRotate : faPlus} className="text-[8px]" />
                                          {course ? 'Replace' : 'Add'}
                                        </button>
                                        <button
                                          onClick={() => removeSkill(skill.name)}
                                          className="w-[30px] h-[30px] rounded-lg flex items-center justify-center bg-gray-100 text-gray-400 border border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all"
                                          title="Remove skill"
                                        >
                                          <FontAwesomeIcon icon={faTrash} className="text-[9px]" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Inline course picker */}
                                  {isPickerOpen && (
                                    <div className="bg-white border border-gray-200 rounded-xl mx-2 my-2 shadow-lg overflow-hidden">
                                      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                                        <FontAwesomeIcon icon={faSearch} className="text-gray-400 text-xs" />
                                        <input type="text" value={courseSearchQuery} onChange={e => handleCourseSearchChange(e.target.value)} placeholder={`Search courses for "${skill.name}"...`} className="flex-1 text-sm outline-none bg-transparent" autoFocus />
                                        <button onClick={() => setCourseSearchSkill(null)} className="text-gray-400 hover:text-gray-600 text-xs"><FontAwesomeIcon icon={faXmark} /></button>
                                      </div>
                                      <div className="max-h-60 overflow-y-auto" onScroll={handleCourseListScroll}>
                                        {loadingCourses ? (
                                          <div className="px-3 py-4 text-center text-[11px] text-gray-400"><FontAwesomeIcon icon={faSpinner} className="animate-spin mr-1" /> Loading courses...</div>
                                        ) : allCourses.length === 0 ? (
                                          <div className="px-3 py-4 text-center text-[11px] text-gray-400">No courses found</div>
                                        ) : (
                                          <>
                                            {allCourses.map(c => {
                                              const isAlreadyMapped = mappedCourses.some(mc => String(mc.courseId) === String(c.courseId));
                                              return (
                                                <button key={c.courseId || c.slug} onClick={() => assignCourseToSkill(skill.name, c)} className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${isAlreadyMapped ? 'bg-blue-50/30' : ''}`}>
                                                  {c.thumbnailUrl ? <img src={c.thumbnailUrl} alt="" className="w-8 h-6 rounded object-cover flex-shrink-0" /> : <div className="w-8 h-6 rounded bg-gray-100 flex-shrink-0" />}
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-medium text-gray-900 truncate">{c.courseName}</p>
                                                    <p className="text-[9px] text-gray-400 truncate">{(c.courseCategories || []).join(', ')}</p>
                                                  </div>
                                                  {isAlreadyMapped && <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 flex-shrink-0">in path</span>}
                                                </button>
                                              );
                                            })}
                                            {loadingMoreCourses && (
                                              <div className="px-3 py-2 text-center text-[10px] text-gray-400"><FontAwesomeIcon icon={faSpinner} className="animate-spin mr-1" /> Loading more...</div>
                                            )}
                                            {!courseHasMore && allCourses.length > 0 && (
                                              <div className="px-3 py-2 text-center text-[10px] text-gray-300">No more courses</div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }

                      // Render normal (non-grouped) skill
                      const { skill, idx: skillIdx } = group.skills[0];
                      const course = getCourseForSkill(skill.name);
                      const isPickerOpen = courseSearchSkill === skill.name;
                      const weightDots = Math.round((skill.weight / 10) * 5);
                      const categoryLabel = skill.category === 'must_have' ? 'Must Have' : skill.category === 'should_have' ? 'Should Have' : 'Nice to Have';
                      const categoryClass = skill.category === 'must_have' ? 'bg-red-50 text-red-600' : skill.category === 'should_have' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600';

                      return (
                        <div key={skillIdx}>
                          <div
                            draggable
                            onDragStart={() => handleCourseDragStart(skillIdx)}
                            onDragOver={(e) => handleCourseDragOver(e, skillIdx)}
                            onDrop={() => handleCourseDrop(skillIdx)}
                            onDragEnd={handleCourseDragEnd}
                            className={`rounded-2xl border p-4 transition-all hover:shadow-sm ${
                              course
                                ? 'border-l-[3px] border-l-green-500 border-gray-100 bg-white'
                                : 'border-l-[3px] border-l-amber-400 border-amber-100 bg-amber-50/30'
                            } ${dragIndex === skillIdx ? 'opacity-40 scale-[0.98]' : ''} ${dragOverIndex === skillIdx ? 'ring-2 shadow-md' : ''}`}
                            style={dragOverIndex === skillIdx ? { borderColor: brandTheme.colors.primary } : {}}
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 transition-colors">
                                <FontAwesomeIcon icon={faGripVertical} className="text-xs" />
                              </div>
                              <div className="w-[50px] text-center flex-shrink-0">
                                <div className="text-[22px] font-extrabold" style={{ background: brandTheme.gradients.primary, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{skill.weight}</div>
                                <div className="text-[7px] font-semibold text-gray-400 uppercase tracking-[1px]">weight</div>
                                <div className="flex gap-[3px] justify-center mt-1">
                                  {[1,2,3,4,5].map(d => (
                                    <span key={d} className={`w-[5px] h-[5px] rounded-full ${d <= weightDots ? 'opacity-100' : 'bg-gray-200'}`} style={d <= weightDots ? { background: brandTheme.colors.primary } : {}} />
                                  ))}
                                </div>
                              </div>
                              <div className="w-[130px] flex-shrink-0">
                                <div className="text-[13px] font-bold text-gray-900">{skill.name}</div>
                                <span className={`inline-block text-[8px] font-bold px-2 py-[2px] rounded mt-1 uppercase tracking-[0.5px] ${categoryClass}`}>{categoryLabel}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                {course ? (
                                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                                    {course.thumbnailUrl ? (
                                      <img src={course.thumbnailUrl} alt="" className="w-11 h-8 rounded-lg object-cover flex-shrink-0" />
                                    ) : (
                                      <div className="w-11 h-8 rounded-lg flex-shrink-0" style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary}20, ${brandTheme.colors.secondary}20)` }}>
                                        <div className="w-full h-full flex items-center justify-center"><FontAwesomeIcon icon={faBookOpen} className="text-[9px] text-gray-300" /></div>
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[12px] font-semibold text-gray-800 truncate">{course.courseName}</div>
                                      <div className="text-[10px] text-gray-400 mt-0.5">{course.lectures} lectures · {course.duration} · <span className="text-[9px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{course.phase}</span></div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border-[1.5px] border-dashed border-amber-300 rounded-xl">
                                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-[10px] text-amber-500" />
                                    <span className="text-[11px] font-medium text-amber-700">No matching course in catalog</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex-shrink-0 flex items-center gap-1.5">
                                <button onClick={() => openCoursePicker(skill.name)} className={`text-[10px] font-semibold py-[7px] px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${course ? 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200' : 'text-white shadow-sm hover:opacity-90'}`} style={!course ? { background: brandTheme.gradients.primary, minWidth: '78px' } : {}}>
                                  <FontAwesomeIcon icon={course ? faArrowsRotate : faPlus} className="text-[8px]" />
                                  {course ? 'Replace' : 'Add'}
                                </button>
                                <button
                                  onClick={() => removeSkill(skill.name)}
                                  className="w-[30px] h-[30px] rounded-lg flex items-center justify-center bg-gray-100 text-gray-400 border border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all"
                                  title="Remove skill"
                                >
                                  <FontAwesomeIcon icon={faTrash} className="text-[9px]" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Inline course picker */}
                          {isPickerOpen && (
                            <div className="bg-white border border-gray-200 rounded-xl mx-2 my-2 shadow-lg overflow-hidden">
                              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                                <FontAwesomeIcon icon={faSearch} className="text-gray-400 text-xs" />
                                <input type="text" value={courseSearchQuery} onChange={e => handleCourseSearchChange(e.target.value)} placeholder={`Search courses for "${skill.name}"...`} className="flex-1 text-sm outline-none bg-transparent" autoFocus />
                                <button onClick={() => setCourseSearchSkill(null)} className="text-gray-400 hover:text-gray-600 text-xs"><FontAwesomeIcon icon={faXmark} /></button>
                              </div>
                              <div className="max-h-60 overflow-y-auto" onScroll={handleCourseListScroll}>
                                {loadingCourses ? (
                                  <div className="px-3 py-4 text-center text-[11px] text-gray-400"><FontAwesomeIcon icon={faSpinner} className="animate-spin mr-1" /> Loading courses...</div>
                                ) : allCourses.length === 0 ? (
                                  <div className="px-3 py-4 text-center text-[11px] text-gray-400">No courses found</div>
                                ) : (
                                  <>
                                    {allCourses.map(c => {
                                      const isAlreadyMapped = mappedCourses.some(mc => String(mc.courseId) === String(c.courseId));
                                      return (
                                        <button key={c.courseId || c.slug} onClick={() => assignCourseToSkill(skill.name, c)} className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${isAlreadyMapped ? 'bg-blue-50/30' : ''}`}>
                                          {c.thumbnailUrl ? <img src={c.thumbnailUrl} alt="" className="w-8 h-6 rounded object-cover flex-shrink-0" /> : <div className="w-8 h-6 rounded bg-gray-100 flex-shrink-0" />}
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-medium text-gray-900 truncate">{c.courseName}</p>
                                            <p className="text-[9px] text-gray-400 truncate">{(c.courseCategories || []).join(', ')}</p>
                                          </div>
                                          {isAlreadyMapped && <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 flex-shrink-0">in path</span>}
                                        </button>
                                      );
                                    })}
                                    {loadingMoreCourses && (
                                      <div className="px-3 py-2 text-center text-[10px] text-gray-400"><FontAwesomeIcon icon={faSpinner} className="animate-spin mr-1" /> Loading more...</div>
                                    )}
                                    {!courseHasMore && allCourses.length > 0 && (
                                      <div className="px-3 py-2 text-center text-[10px] text-gray-300">No more courses</div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-white">
                <p className="text-[11px] text-gray-400">
                  {mappedCourses.length} courses · {mappedCourses.reduce((acc, c) => acc + parseInt(c.duration), 0)}h total
                </p>
                <button
                  onClick={() => setView('details')}
                  className="flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  Continue
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </button>
              </div>
            </div>
          )}

          {/* ===================== STEP 5: PATH DETAILS ===================== */}
          {view === 'details' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              <div className="max-w-2xl mx-auto space-y-5">
                {/* Path Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Path Name *</label>
                  <input
                    type="text"
                    value={pathName}
                    onChange={e => setPathName(e.target.value)}
                    placeholder="e.g., Full Stack Web Developer"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                    style={{ '--tw-ring-color': brandTheme.colors.primary + '40' } as any}
                  />
                </div>

                {/* Target Role */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Target Role *</label>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={e => setTargetRole(e.target.value)}
                    placeholder="e.g., Full Stack Developer"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                    style={{ '--tw-ring-color': brandTheme.colors.primary + '40' } as any}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                  <textarea
                    value={pathDescription}
                    onChange={e => setPathDescription(e.target.value)}
                    placeholder="Describe what students will learn and achieve..."
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 resize-none transition-all"
                    style={{ '--tw-ring-color': brandTheme.colors.primary + '40' } as any}
                  />
                </div>

                {/* Difficulty & Weeks */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Difficulty</label>
                    <div className="flex gap-2">
                      {(['beginner', 'intermediate', 'advanced'] as const).map(d => (
                        <button
                          key={d}
                          onClick={() => setDifficulty(d)}
                          className={`flex-1 py-2 text-[11px] font-medium rounded-lg border transition-all capitalize ${
                            difficulty === d
                              ? 'text-white border-transparent'
                              : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50'
                          }`}
                          style={difficulty === d ? { background: brandTheme.gradients.primary } : {}}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Estimated Weeks</label>
                    <input
                      type="number"
                      value={estimatedWeeks}
                      onChange={e => setEstimatedWeeks(parseInt(e.target.value) || 0)}
                      min={1}
                      max={52}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': brandTheme.colors.primary + '40' } as any}
                    />
                  </div>
                </div>

                {/* Sequential Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={isSequential ? faLock : faLockOpen} className="text-gray-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Sequential Learning</p>
                      <p className="text-[11px] text-gray-500">
                        {isSequential
                          ? 'Students must complete courses in order'
                          : 'Students can take courses in any order'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSequential(!isSequential)}
                    className="relative w-11 h-6 rounded-full transition-colors duration-200"
                    style={{ background: isSequential ? brandTheme.colors.primary : '#D1D5DB' }}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                      isSequential ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Course list for standard path OR AI path courses preview */}
                {(isStandardPath || mappedCourses.length > 0) && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        Courses ({mappedCourses.length})
                      </label>
                      <button
                        onClick={openManualCoursePicker}
                        className="text-[11px] font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-white"
                        style={{ background: brandTheme.gradients.primary }}
                      >
                        <FontAwesomeIcon icon={faPlus} className="text-[9px]" />
                        Add Course
                      </button>
                    </div>

                    {mappedCourses.length === 0 ? (
                      <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                        <FontAwesomeIcon icon={faBookOpen} className="text-3xl text-gray-300 mb-3" />
                        <p className="text-sm font-medium text-gray-500 mb-1">No courses added yet</p>
                        <p className="text-[11px] text-gray-400 mb-4">Add courses to build your learning path</p>
                        <button
                          onClick={openManualCoursePicker}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-gray-700"
                        >
                          <FontAwesomeIcon icon={faPlus} className="text-xs" />
                          Add Courses
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {mappedCourses.map((course, index) => (
                          <div
                            key={course.courseId}
                            draggable
                            onDragStart={() => handleCourseDragStart(index)}
                            onDragOver={(e) => handleCourseDragOver(e, index)}
                            onDrop={() => handleCourseDrop(index)}
                            onDragEnd={handleCourseDragEnd}
                            className={`flex items-center gap-3 p-2.5 bg-white border rounded-xl transition-all group ${
                              dragIndex === index ? 'opacity-40 scale-[0.98]' : dragOverIndex === index ? 'border-2 shadow-md' : 'border-gray-100 hover:border-gray-200'
                            }`}
                            style={dragOverIndex === index ? { borderColor: brandTheme.colors.primary } : {}}
                          >
                            <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400">
                              <FontAwesomeIcon icon={faGripVertical} className="text-xs" />
                            </div>
                            <div
                              className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                              style={{ background: brandTheme.gradients.primary }}
                            >
                              {course.sequenceOrder}
                            </div>
                            {course.thumbnailUrl ? (
                              <img src={course.thumbnailUrl} alt="" className="w-10 h-7 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                            ) : (
                              <div className="w-10 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <FontAwesomeIcon icon={faBookOpen} className="text-gray-300 text-[8px]" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] font-semibold text-gray-900 truncate">{course.courseName}</div>
                              <div className="text-[10px] text-gray-400">{course.lectures} lectures · {course.duration}</div>
                            </div>
                            <button
                              onClick={() => removeCourse(course.courseId)}
                              className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                            >
                              <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Manual course picker dropdown */}
                    {showManualCoursePicker && (
                      <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                          <FontAwesomeIcon icon={faSearch} className="text-gray-400 text-xs" />
                          <input
                            type="text"
                            value={manualSearchQuery}
                            onChange={e => handleManualSearchChange(e.target.value)}
                            placeholder="Search courses to add..."
                            className="flex-1 text-sm outline-none bg-transparent"
                            autoFocus
                          />
                          <button onClick={() => setShowManualCoursePicker(false)} className="text-gray-400 hover:text-gray-600 text-xs">
                            <FontAwesomeIcon icon={faXmark} />
                          </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto" onScroll={handleCourseListScroll}>
                          {loadingCourses ? (
                            <div className="px-3 py-4 text-center text-[11px] text-gray-400">
                              <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-1" /> Loading courses...
                            </div>
                          ) : allCourses.length === 0 ? (
                            <div className="px-3 py-4 text-center text-[11px] text-gray-400">No courses found</div>
                          ) : (
                            <>
                              {allCourses.map(c => {
                                const isAlreadyAdded = mappedCourses.some(mc => String(mc.courseId) === String(c.courseId));
                                return (
                                  <button
                                    key={c.courseId || c.slug}
                                    onClick={() => !isAlreadyAdded && addCourseManually(c)}
                                    disabled={isAlreadyAdded}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors border-b border-gray-50 last:border-0 ${
                                      isAlreadyAdded ? 'bg-gray-50 opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                                    }`}
                                  >
                                    {c.thumbnailUrl ? (
                                      <img src={c.thumbnailUrl} alt="" className="w-8 h-6 rounded object-cover flex-shrink-0" />
                                    ) : (
                                      <div className="w-8 h-6 rounded bg-gray-100 flex-shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] font-medium text-gray-900 truncate">{c.courseName}</p>
                                      <p className="text-[9px] text-gray-400 truncate">{(c.courseCategories || []).join(', ')}</p>
                                    </div>
                                    {isAlreadyAdded ? (
                                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-100 text-green-600 flex-shrink-0">✓ Added</span>
                                    ) : (
                                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 flex-shrink-0">+ Add</span>
                                    )}
                                  </button>
                                );
                              })}
                              {loadingMoreCourses && (
                                <div className="px-3 py-2 text-center text-[10px] text-gray-400">
                                  <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-1" /> Loading more...
                                </div>
                              )}
                              {!courseHasMore && allCourses.length > 0 && (
                                <div className="px-3 py-2 text-center text-[10px] text-gray-300">No more courses</div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Save Buttons */}
              <div className="mt-8 max-w-2xl mx-auto flex items-center gap-3">
                <button
                  onClick={() => handleSave('draft')}
                  disabled={!pathName.trim() || !targetRole.trim() || isSubmitting}
                  className="flex-1 py-3 text-sm font-semibold rounded-xl border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderColor: brandTheme.colors.primary, color: brandTheme.colors.primary }}
                >
                  {isSubmitting ? (
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                  ) : (
                    <FontAwesomeIcon icon={faSave} className="mr-2" />
                  )}
                  {editPath ? 'Save as Draft' : 'Save as Draft'}
                </button>
                <button
                  onClick={() => handleSave('published')}
                  disabled={!pathName.trim() || !targetRole.trim() || isSubmitting}
                  className="flex-1 py-3 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  {isSubmitting ? (
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                  ) : (
                    <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
                  )}
                  {editPath ? 'Update & Publish' : 'Publish Path'}
                </button>
              </div>
            </div>
          )}

          {/* ===================== SUCCESS ===================== */}
          {view === 'success' && (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6" style={{ background: '#10B981' + '15' }}>
                <FontAwesomeIcon icon={faCircleCheck} className="text-green-500 text-4xl" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Learning Path {editPath ? 'Updated' : 'Created'}!</h3>
              <p className="text-sm text-gray-500 text-center max-w-sm">
                Your learning path "<span className="font-medium">{pathName}</span>" has been {editPath ? 'updated' : 'created'} successfully. {!editPath && 'You can now assign it to students.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}