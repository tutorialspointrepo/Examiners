import React, { useState, useEffect, useRef } from 'react';

import { ChevronLeft, ChevronRight, Download, Eye, Sun, Moon, AlertCircle, Info, User, Briefcase, GraduationCap, Award, Code, Globe, Plus, Trash2, Edit3, Sparkles, FileText, X, MapPin, Mail, Phone, Upload, FolderKanban, Trophy } from 'lucide-react';
import { useReactToPrint } from "react-to-print";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faListCheck, 
  faPalette, 
  faRobot, 
  faFileArrowDown,
  faCircleCheck,
  faLightbulb,
  faRocket,
  faBriefcase,
  faGraduationCap,
  faBolt,
} from '@fortawesome/sharp-light-svg-icons';
import { 
  loadResumeFromFirebase, 
  saveResumeToFirebase,
  enhancePersonalSummary, 
  enhanceJobDescription 
} from './services/resumeBuilderService';
import type { ResumeData as ServiceResumeData } from './services/resumeBuilderService';

import { COLOR_PALETTES, DEFAULT_COLOR, getColorTheme } from './constants';

import './ResumeBuilderApp.css';
import { 
  ModernTemplatePreview,
  CreativeTemplatePreview,
  ProfessionalBlueTemplatePreview,
  ExecutiveTemplatePreview,
  BoldTemplatePreview,
  MinimalTemplatePreview,
  ElegantTemplatePreview,
  TechTemplatePreview,
  StartupTemplatePreview,
  ConsultingTemplatePreview,
  MedicalTemplatePreview,
  FinanceTemplatePreview,
  MarketingTemplatePreview,
  DataTemplatePreview,
  NonprofitTemplatePreview,
  AcademicTemplatePreview
} from './TemplatePreviews';


import { renderModernTemplate,
  renderProfessionalBlueTemplate,
  renderCreativeTemplate,
  renderExecutiveTemplate,
  renderMinimalTemplate,
  renderAcademicTemplate,
  renderBoldTemplate,
  renderElegantTemplate,
  renderTechTemplate,
  renderStartupTemplate,
  renderConsultingTemplate,
  renderMedicalTemplate,
  renderFinanceTemplate,
  renderMarketingTemplate,
  renderDataTemplate,
  renderNonprofitTemplate
} from './types/ResumeTemplates';

type TemplateId = string;
type Theme = 'light' | 'dark';

type NotificationType = 'success' | 'error' | 'info' | 'warning';


interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  website: string;
  summary: string;
  profilePicture?: string;
  title?: string; 
}
    
interface Experience {
  id: string;
  company: string;
  position: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string[];
  type?: 'full-time' | 'internship' | 'freelance' | 'project' | 'volunteer';
}

interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  location: string;
  startDate: string;
  endDate: string;
  gpa?: string;
  achievements: string[];
}

interface Project {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  link?: string;
  github?: string;
}

interface ResumeData {
  personalInfo: PersonalInfo;
  experiences: Experience[];
  education: Education[];
  skills: {
    technical: string[];
    soft: string[];
    languages: string[];
  };
  projects: Project[];
  certifications: string[];
  achievements: string[];
  // Add these fields to match the service
  selectedTemplate?: string;
  selectedColor?: string; // Add this line
  completedSteps?: string[];
  lastModified?: string;
  createdAt?: string;
  userId?: string;
  organizationId?: string;
}

interface ResumeStep {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  required: boolean;
}


interface Template {
  id: TemplateId;
  name: string;
  category: string;
  thumbnail: string;
  description: string;
  color: string;
}


interface ResumeBuilderAppProps {
  isOpen?: boolean;
  onClose?: () => void;
  currentUser?: any;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}


interface EducationFormProps {
  data: Education[];
  onChange: (data: Education[]) => void;
  onComplete: () => void;
  completing: boolean;
  completed: boolean;
}

interface APIResumeData {
  resumeData?: ResumeData;
  selectedTemplate?: string;
  completedSteps?: string[];
}

interface APIResponse {
  hasResume: boolean;
  userData: APIResumeData;
}

const CompactColorPicker: React.FC<{
  selectedColor: string;
  onColorChange: (color: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ selectedColor, onColorChange, isOpen, onToggle }) => {
  const selectedTheme = getColorTheme(selectedColor);
  
  return (
    <div className="compact-color-picker">
      {/* Color Trigger Button - Now with circular design */}
      <button
        className="color-trigger-btn"
        onClick={onToggle}
        title="Change template colors"
      >
        <div 
          className="color-preview-circle"
          style={{ backgroundColor: selectedTheme.primary }}
        />
        <span>Colors</span>
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <polyline points="6,9 12,15 18,9"></polyline>
        </svg>
      </button>

      {/* Color Dropdown - Updated with circular options */}
      {isOpen && (
        <div className="color-dropdown">
          <div className="color-dropdown-header">
            <h4>Template Colors</h4>
            <button 
              className="color-close-btn"
              onClick={onToggle}
            >
              <X size={14} />
            </button>
          </div>
          <div className="color-grid-compact">
            {Object.entries(COLOR_PALETTES).map(([colorKey, colors]) => (
              <div
                key={colorKey}
                className={`color-option-compact ${selectedColor === colorKey ? 'selected' : ''}`}
                onClick={() => {
                  onColorChange(colorKey);
                  onToggle(); // Close picker after selection
                }}
                title={colorKey.charAt(0).toUpperCase() + colorKey.slice(1)}
              >
                {/* Updated circular preview */}
                <div className="color-preview-compact-circles">
                  <div 
                    className="color-circle-primary" 
                    style={{ backgroundColor: colors.primary }}
                  />
                  <div 
                    className="color-circle-secondary" 
                    style={{ backgroundColor: colors.secondary }}
                  />
                  <div 
                    className="color-circle-accent" 
                    style={{ backgroundColor: colors.accent }}
                  />
                </div>
                <span className="color-name-compact">{colorKey}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Profile Picture Upload Component
// Modern Profile Picture Upload Component with Drag & Drop
const ProfilePictureUpload: React.FC<{
  currentPicture?: string;
  onPictureChange: (base64Image: string | null) => void;
}> = ({ currentPicture, onPictureChange }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Function to resize and compress image (keep existing logic)
  const resizeAndCompressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate dimensions for square crop (profile picture)
        const size = Math.min(img.width, img.height);
        const offsetX = (img.width - size) / 2;
        const offsetY = (img.height - size) / 2;

        // Set canvas size (aim for ~150x150 for better quality with 20KB limit)
        const targetSize = 150;
        canvas.width = targetSize;
        canvas.height = targetSize;

        // Draw cropped and resized image
        ctx?.drawImage(
          img,
          offsetX, offsetY, size, size, // Source crop
          0, 0, targetSize, targetSize  // Destination size
        );

        // Try different quality levels to get under 20KB
        const tryCompress = (quality: number): string => {
          const base64 = canvas.toDataURL('image/jpeg', quality);
          
          // Calculate approximate file size (base64 is ~4/3 of actual size)
          const sizeKB = (base64.length * 3) / (4 * 1024);
          
          if (sizeKB <= 20 || quality <= 0.1) {
            return base64;
          }
          
          // Reduce quality and try again
          return tryCompress(quality - 0.1);
        };

        resolve(tryCompress(0.9));
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  // Process file (common logic for both drag/drop and file input)
  const processFile = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image is too large. Please select an image under 10MB');
      return;
    }

    setIsProcessing(true);

    try {
      const compressedImage = await resizeAndCompressImage(file);
      
      // Calculate final size
      const finalSizeKB = (compressedImage.length * 3) / (4 * 1024);
      console.log(`Image compressed to ${finalSizeKB.toFixed(1)}KB`);
      
      onPictureChange(compressedImage);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Failed to process image. Please try a different image.');
    } finally {
      setIsProcessing(false);
    }
  };

  // File input handler
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await processFile(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter <= 1) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const imageFile = files.find(file => file.type.startsWith('image/'));
      if (imageFile) {
        await processFile(imageFile);
      } else {
        alert('Please drop a valid image file');
      }
    }
  };

  const handleRemovePicture = () => {
    onPictureChange(null);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="modern-profile-upload">
      <label className="upload-label">
        Profile Picture (Optional)
      </label>
      
      <div className="upload-container">
        {/* Main Upload Zone */}
        <div 
          ref={dropZoneRef}
          className={`upload-zone ${isDragging ? 'dragging' : ''} ${currentPicture ? 'has-image' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleUploadClick}
        >
          {currentPicture ? (
            // Image Preview Section
            <div className="image-preview-container">
              <img 
                src={currentPicture} 
                alt="Profile Preview" 
                className="preview-image"
              />
              <div className="image-overlay">
                <div className="overlay-actions">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUploadClick();
                    }}
                    disabled={isProcessing}
                    className="overlay-btn change"
                    title="Change photo"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemovePicture();
                    }}
                    className="overlay-btn remove"
                    title="Remove photo"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Upload Area
            <div className="upload-content">
              <div className="upload-icon-container">
                {isProcessing ? (
                  <div className="processing-spinner"></div>
                ) : isDragging ? (
                  <div className="drag-icon">
                    <Download size={32} />
                  </div>
                ) : (
                  <div className="upload-icon">
                    <Upload size={32} />
                  </div>
                )}
              </div>
              
              <div className="upload-text">
                <h3>
                  {isProcessing ? 'Processing image...' : 
                   isDragging ? 'Drop your image here' : 
                   'Upload your photo'}
                </h3>
                <p>
                  {isDragging ? 'Release to upload' : 
                   'Drag & drop or click to browse'}
                </p>
              </div>
              
              <div className="upload-specs">
                <span>JPG, PNG, GIF • Max 10MB</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      
      <div className="upload-hint">
        Upload a square photo for best results. Images are automatically compressed to under 20KB.
      </div>
    </div>
  );
};
const ResumeBuilderApp: React.FC<ResumeBuilderAppProps> = ({
  onClose,
  currentUser,
}) => {
  // Map currentUser fields to expected userProfile structure
  const userProfile = currentUser ? {
    uid: currentUser.userId || currentUser.uid,
    organizationId: currentUser.collegeId || currentUser.organizationId,
    name: currentUser.fullName || currentUser.name,
    email: currentUser.email,
    mobile: currentUser.phone || currentUser.mobile,
  } : null;
  
  // Add body class management
  useEffect(() => {
    console.log("Inside ResumeBuilderApp >>>>>>>");
    document.body.classList.add('resume-builder-active');
    
    return () => {
      document.body.classList.remove('resume-builder-active');
    };
  }, []);
  
  // Theme and UI state
  const [theme, setTheme] = useState<Theme>('light');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [resumeData, setResumeData] = useState<ResumeData>({
    personalInfo: {
      fullName: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      website: '',
      summary: ''
    },
    experiences: [],
    education: [],
    skills: {
      technical: [],
      soft: [],
      languages: []
    },
    projects: [],
    certifications: [],
    achievements: [],
    selectedColor: DEFAULT_COLOR // Use constant instead of hardcoded 'blue'
  });
  
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('modern');
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<{
      message: string; 
     type: NotificationType;
   } | null>(null);

  const [_isResizing, setIsResizing] = useState<boolean>(false);
  const [middlePanelWidth, setMiddlePanelWidth] = useState<number>(45);
  const [builderStarted, setBuilderStarted] = useState<boolean>(false);
  const [aiEnhancing, setAiEnhancing] = useState<boolean>(false);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [completingStep, setCompletingStep] = useState<string | null>(null);
  const [completedStep, setCompletedStep] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(1.0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showTemplates, setShowTemplates] = useState<boolean>(true);
  const [previewMode, _setPreviewMode] = useState('single');
  const [isPreparingPrint, _setIsPreparingPrint] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({
      currentStep: 0,
      totalSteps: 6,
      currentSection: 'personal'
   });
   const [loadingComplete, setLoadingComplete] = useState(false);
   const [hasFoundResume, setHasFoundResume] = useState(false);
   const [foundUserName, setFoundUserName] = useState('');
   const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_COLOR);
   const [showColorPicker, setShowColorPicker] = useState<boolean>(false);

  // Refs for resizing
  const containerRef = useRef<HTMLDivElement>(null);

  const getTemplateDefaultColor = (templateId: string): string => {
    const templateColorMap: Record<string, string> = {
      modern: 'blue',
      professionalBlue: 'blue', 
      creative: 'orange',
      executive: 'gray',
      minimal: 'green',
      academic: 'purple',
      bold: 'red',
      elegant: 'indigo',
      tech: 'cyan',
      startup: 'orange',
      consulting: 'teal',
      medical: 'emerald',
      finance: 'blue',
      marketing: 'orange',
      data: 'violet',
      nonprofit: 'pink'
    };
    return templateColorMap[templateId] || DEFAULT_COLOR;
  };

  // Auto-save timeout variable
  let autoSaveTimeout: NodeJS.Timeout;

  // Add this useEffect after your existing useEffects
  useEffect(() => {
    // Clear any existing timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    // Set up auto-save every 30 seconds when data changes
    if (builderStarted && (resumeData || selectedTemplate || completedSteps.size > 0)) {
      autoSaveTimeout = setTimeout(() => {
        console.log('Auto-saving...');
        autoSave();
      }, 60000); // Auto-save every 60 seconds
    }

    // Cleanup
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [resumeData, selectedTemplate, completedSteps, builderStarted]);

  // API service for fetching user resume data
  const resumeAPI = {
    async fetchUserResume(userId: string, organizationId: string): Promise<APIResponse> {
      try {
        console.log('Fetching resume for user:', userId, 'org:', organizationId);
        
        const resumeData = await loadResumeFromFirebase(userId, organizationId);
        
        if (resumeData) {
        
          console.log('DETAILED FIREBASE INSPECTION:',resumeData );
          return {
            hasResume: true,
            userData: {
              resumeData: resumeData as ResumeData,
              selectedTemplate: resumeData.selectedTemplate || 'modern',
              completedSteps: resumeData.completedSteps || []
            }
          };
        } else {
          return {
            hasResume: false,
            userData: {
              resumeData: getEmptyResumeData(),
              selectedTemplate: 'modern',
              completedSteps: []
            }
          };
        }
      } catch (error) {
        console.error('Error fetching user resume:', error);
        return {
          hasResume: false,
          userData: {
            resumeData: getEmptyResumeData(),
            selectedTemplate: 'modern',
            completedSteps: []
          }
        };
      }
    }
  };

// REPLACE your entire handleStartBuilding function with this:
const handleStartBuilding = async (): Promise<void> => {
  // Get user info from auth context
  const userId = userProfile?.uid;
  const organizationId = userProfile?.organizationId;
  
  if (!userId || !organizationId) {
    alert('Please log in to continue');
    return;
  }
  
  try {
    setIsLoadingUserData(true);
    setLoadingComplete(false);
    setHasFoundResume(false);
    setFoundUserName('');
    
    // Simulate progressive loading for better UX
    const sections = ['personal', 'experience', 'education', 'skills', 'projects', 'certifications'];
    
    // Show progress for each section
    for (let i = 0; i < sections.length; i++) {
      setLoadingProgress({
        currentStep: i,
        totalSteps: sections.length,
        currentSection: sections[i]
      });
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    
    let response: APIResponse;
    let dataSource: 'cloud' | 'local' = 'cloud';
    let cloudError: any = null;
    
    try {
      // Attempt to fetch from Firebase first
      console.log('Attempting to load resume from Firebase...');
      response = await resumeAPI.fetchUserResume(userId, organizationId);
      console.log('Resume data loaded from Firebase');
      dataSource = 'cloud';
    } catch (error) {
      console.log('Firebase load failed, attempting localStorage fallback...', error);
      cloudError = error;
      
      // Fallback to localStorage
      const savedData = localStorage.getItem('resumeBuilderData');
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          
          // Validate that the parsed data has the expected structure
          if (parsedData && parsedData.resumeData) {
            response = {
              hasResume: true,
              userData: {
                resumeData: parsedData.resumeData,
                selectedTemplate: parsedData.selectedTemplate || 'modern',
                completedSteps: parsedData.completedSteps || []
              }
            };
            dataSource = 'local';
            console.log('Resume data loaded from localStorage');
          } else {
            throw new Error('Invalid localStorage data structure');
          }
        } catch (parseError) {
          console.error('Failed to parse localStorage data:', parseError);
          throw new Error('No valid resume data found in localStorage');
        }
      } else {
        console.log('No localStorage data found');
        throw new Error('No resume data available offline');
      }
    }
    
    // Final progress update
    setLoadingProgress({
      currentStep: sections.length,
      totalSteps: sections.length,
      currentSection: 'complete'
    });
    
    // Set completion status
    setLoadingComplete(true);
    setHasFoundResume(response.hasResume);
    
    // Determine user name for display
    if (response.hasResume && response.userData.resumeData?.personalInfo?.fullName) {
      setFoundUserName(response.userData.resumeData.personalInfo.fullName);
    } else if (userProfile?.name) {
      setFoundUserName(userProfile.name);
    }
    
    // Show completion message for 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Set the loaded data to state
    const loadedData = response.userData.resumeData || getEmptyResumeData();
    
    // Pre-fill with user profile data if resume is empty
    if (!response.hasResume && userProfile) {
      loadedData.personalInfo = {
        ...loadedData.personalInfo,
        fullName: userProfile.name || '',
        email: userProfile.email || '',
        phone: userProfile.mobile || '',
      };
    }
    
    setResumeData(loadedData);

    // Restore template selection
    if (response.userData.selectedTemplate) {
      setSelectedTemplate(response.userData.selectedTemplate as TemplateId);
    }
    
    // RESTORE COLOR SELECTION - NEW CODE BLOCK
    if (response.userData.resumeData?.selectedColor) {
      setSelectedColor(response.userData.resumeData.selectedColor);
    } else if (loadedData.selectedColor) {
      setSelectedColor(loadedData.selectedColor);
    } else {
      // Set default color if none found
      setSelectedColor('blue');
      loadedData.selectedColor = 'blue';
    }

    // Initialize completed steps
    const completedStepsFromData = new Set<string>();

    // Mark completed steps if user has existing data
    if (response.hasResume) {
      // Use saved completed steps if available, otherwise determine from data
      if (response.userData.completedSteps && response.userData.completedSteps.length > 0) {
        response.userData.completedSteps.forEach((step: string) => completedStepsFromData.add(step));
      } else {
        // Auto-detect completed steps from data content
        if (loadedData.personalInfo?.fullName && 
            loadedData.personalInfo?.email && 
            loadedData.personalInfo?.phone) {
          completedStepsFromData.add('personal');
        }

        if (loadedData.experiences?.length > 0) {
          completedStepsFromData.add('experience');
        }

        if (loadedData.education?.length > 0) {
          completedStepsFromData.add('education');
        }

        if (loadedData.skills?.technical?.length > 0 || 
            loadedData.skills?.soft?.length > 0 || 
            loadedData.skills?.languages?.length > 0) {
          completedStepsFromData.add('skills');
        }

        if (loadedData.projects?.length > 0) {
          completedStepsFromData.add('projects');
        }

        if (loadedData.certifications?.length > 0) {
          completedStepsFromData.add('certifications');
        }

        if (loadedData.achievements?.length > 0) {
          completedStepsFromData.add('achievements');
        }
      }
    }

    // Set the completed steps
    setCompletedSteps(completedStepsFromData);

    // Hide loading states
    setIsLoadingUserData(false);
    
    // Start the main builder
    setBuilderStarted(true);
    
    // Update localStorage with the loaded data (sync local with cloud if cloud was successful)
    const saveData = {
      resumeData: {
        ...loadedData,
        selectedColor: selectedColor // Make sure to include selected color
      },
      selectedTemplate: response.userData.selectedTemplate || selectedTemplate,
      completedSteps: Array.from(completedStepsFromData || []),
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('resumeBuilderData', JSON.stringify(saveData));
    setLastSaved(new Date());
    
    // Show appropriate notification based on data source
    if (dataSource === 'local') {
      if (cloudError) {
        showNotification('Loaded from local backup (offline mode)', 'info');
      }
    } else {
      showNotification('Resume data loaded successfully', 'success');
    }
    
  } catch (error) {
    console.error('Error loading user data:', error);
    setIsLoadingUserData(false);
    setLoadingComplete(false);
    
    // Final fallback: start with basic profile data or completely empty
    let fallbackData = getEmptyResumeData();
    let fallbackMessage = 'Starting with blank resume';
    
    if (userProfile) {
      // Pre-fill with user profile information
      fallbackData.personalInfo = {
        ...fallbackData.personalInfo,
        fullName: userProfile.name || '',
        email: userProfile.email || '',
        phone: userProfile.mobile || '',
      };
      fallbackData.selectedColor = 'blue'; // Set default color
      fallbackMessage = 'Started with your profile information';
      setFoundUserName(userProfile.name || 'New User');
    }
    
    setResumeData(fallbackData);
    setSelectedColor('blue'); // Set default color
    setBuilderStarted(true);
    
    // Show appropriate error message
    if (navigator.onLine === false) {
      showNotification('No internet connection - ' + fallbackMessage, 'warning');
    } else {
      showNotification('Failed to load existing data - ' + fallbackMessage, 'warning');
    }
  }
};

// REPLACE your entire autoSave function with this:

const autoSave = async () => {
  try {
    const saveData = {
      resumeData: {
        ...resumeData,
        selectedColor // ADD THIS LINE to include selected color
      },
      selectedTemplate,
      completedSteps: Array.from(completedSteps),
      timestamp: new Date().toISOString()
    };

    // Always save locally
    localStorage.setItem('resumeBuilderData', JSON.stringify(saveData));
    setLastSaved(new Date());
    console.log('Auto-save completed locally');

    // Silently attempt cloud save if user is authenticated
    const userId = userProfile?.uid;
    const organizationId = userProfile?.organizationId;

    if (userId && organizationId) {
      try {
        const cloudSaveData: Partial<ServiceResumeData> = {
          personalInfo: resumeData.personalInfo,
          experiences: resumeData.experiences,
          education: resumeData.education,
          skills: resumeData.skills,
          projects: resumeData.projects,
          certifications: resumeData.certifications,
          achievements: resumeData.achievements,
          selectedTemplate,
          selectedColor, // ADD THIS LINE
          completedSteps: Array.from(completedSteps),
        };

        await saveResumeToFirebase(userId, organizationId, cloudSaveData);
        console.log('Auto-save: Cloud sync successful');
      } catch (cloudError) {
        console.log('Auto-save: Cloud sync failed, local backup preserved');
      }
    }
  } catch (error) {
    console.error('Auto-save failed completely:', error);
  }
};

// REPLACE your entire saveResume function with this:
const saveResume = async () => {
  setIsSaving(true);
  let localSaveSuccess = false;
  let cloudSaveSuccess = false;

  try {
    const userId = userProfile?.uid;
    const organizationId = userProfile?.organizationId;

    // Always save to localStorage first
    try {
      const saveData = {
        resumeData: {
          ...resumeData,
          selectedColor // ADD THIS LINE
        },
        selectedTemplate,
        completedSteps: Array.from(completedSteps),
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('resumeBuilderData', JSON.stringify(saveData));
      setLastSaved(new Date());
      localSaveSuccess = true;
      console.log('Local backup saved');
    } catch (localError) {
      console.error('Local save failed:', localError);
    }

    // Try cloud save if user is authenticated
    if (userId && organizationId) {
      try {
        const saveData: Partial<ServiceResumeData> = {
          personalInfo: resumeData.personalInfo,
          experiences: resumeData.experiences,
          education: resumeData.education,
          skills: resumeData.skills,
          projects: resumeData.projects,
          certifications: resumeData.certifications,
          achievements: resumeData.achievements,
          selectedTemplate,
          selectedColor, // ADD THIS LINE
          completedSteps: Array.from(completedSteps),
        };

        await saveResumeToFirebase(userId, organizationId, saveData);
        cloudSaveSuccess = true;
        console.log('Cloud save successful');
      } catch (cloudError) {
        console.error('Cloud save failed:', cloudError);
      }
    }

    // Give accurate feedback based on what actually succeeded
    if (cloudSaveSuccess && localSaveSuccess) {
      showNotification('Resume saved to cloud & local backup created!', 'success');
    } else if (cloudSaveSuccess) {
      showNotification('Resume saved to cloud successfully!', 'success');
    } else if (localSaveSuccess) {
      showNotification('Resume saved locally (cloud sync failed)', 'warning');
    } else {
      showNotification('Save failed completely', 'error');
    }

  } catch (error) {
    console.error('Save error:', error);
    if (localSaveSuccess) {
      showNotification('Saved locally, cloud sync failed', 'warning');
    } else {
      showNotification('Save failed completely', 'error');
    }
  }

  setIsSaving(false);
};

// ALSO UPDATE your getEmptyResumeData function to include selectedColor:
const getEmptyResumeData = (): ResumeData => ({
  personalInfo: {
    fullName: '', title: '', email: '', phone: '', location: '',
    linkedin: '', github: '', website: '', summary: ''
  },
  experiences: [],
  education: [],
  skills: { technical: [], soft: [], languages: [] },
  projects: [],
  certifications: [],
  achievements: [],
  selectedColor: 'blue' // ADD THIS LINE
});

// ALSO UPDATE your existing useEffect for loading saved data:

useEffect(() => {
  const savedData = localStorage.getItem('resumeBuilderData');
  if (savedData && !builderStarted) {
    try {
      const parsedData = JSON.parse(savedData);
      // Only use localStorage as fallback when not connected to database
      setResumeData(parsedData.resumeData || resumeData);
      setSelectedTemplate(parsedData.selectedTemplate || 'modern');
      
      // LOAD SELECTED COLOR - ADD THESE LINES
      if (parsedData.resumeData?.selectedColor) {
        setSelectedColor(parsedData.resumeData.selectedColor);
      } else if (parsedData.selectedColor) {
        setSelectedColor(parsedData.selectedColor);
      }
      
      setCompletedSteps(new Set(parsedData.completedSteps || []));
      setLastSaved(new Date(parsedData.timestamp));
    } catch (error) {
      console.error('Error loading saved resume data:', error);
    }
  }
}, [builderStarted]);


  const InlineProgress: React.FC<{
    currentStep: number;
    totalSteps: number;
    currentSection: string;
    hasResume: boolean;
    loadingComplete: boolean;
    foundUserName: string;
  }> = ({ currentStep, totalSteps, currentSection, hasResume, loadingComplete, foundUserName }) => {

    const progressPercentage = (currentStep / totalSteps) * 100;
    
    const sections = [
      { id: 'personal', name: 'Personal Information', icon: '' },
      { id: 'experience', name: 'Work Experience', icon: '' },
      { id: 'education', name: 'Education', icon: '' },
      { id: 'skills', name: 'Skills', icon: '' },
      { id: 'projects', name: 'Projects', icon: '' },
      { id: 'certifications', name: 'Certifications', icon: '' }
    ];
    
    return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
        }}>
        {!loadingComplete ? (
          <>
            {/* Progress Bar */}
              <div style={{
                width: '200px',
                height: '5px',
                background: 'rgba(102, 126, 234, 0.2)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
              <div style={{
                width: `${progressPercentage}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '3px',
                transition: 'width 0.5s ease'
              }} />
            </div>

            {/* Current Section */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: '#667eea',
              fontWeight: '500'
            }}>
              <div style={{
                width: '14px',
                height: '14px',
                border: '2px solid #667eea',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span>{sections.find(s => s.id === currentSection)?.name}...</span>
            </div>
          </>
        ) : (
          <>
            {/* Completion Message */}
            {hasResume ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#10b981',
                fontSize: '13px',
                fontWeight: '500',
              }}>
                <span style={{ fontSize: '16px' }}>✅</span>
                <span>Found resume for {foundUserName}!</span>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: '#667eea',
                fontSize: '13px',
                fontWeight: '500'
              }}>
                <span style={{ fontSize: '16px' }}>🚀</span>
                <span>Creating new resume...</span>
              </div>
            )}
          </>
        )}
      </div>
    );
  };
const printTargetRef = useRef<HTMLDivElement>(null);

const printResume = useReactToPrint({
  contentRef: printTargetRef,
  documentTitle: " ",
  pageStyle: `
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
      
      /* Attempt to clear browser header/footer content */
      @top-left { content: ""; }
      @top-center { content: ""; }
      @top-right { content: ""; }
      @bottom-left { content: ""; }
      @bottom-center { content: ""; }
      @bottom-right { content: ""; }
    }

    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      
    
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        -webkit-print-color-adjust: exact !important;
      }

      .resume-pages {
        transform: none !important;
        width: 100% !important;
        padding: 0 !important;
      }

      h2, h3 {
            break-after: avoid;
      }

        /* Keeps an entire experience or education block together if possible */
        .experience-item, .education-item {
            break-inside: avoid;
        }

      .a4-page {
        width: 100% !important;
        min-height: auto !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
      }

      .a4-content {
        overflow: visible !important;
      }

      .resume-section, .experience-card, .education-card, .project-card {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    }
  `,
});

  // Resume building steps
  const resumeSteps: ResumeStep[] = [
    {
      id: 'personal',
      title: 'Personal Information',
      icon: <User size={16} />,
      description: 'Basic contact details and professional summary',
      required: true
    },
    {
      id: 'experience',
      title: 'Work Experience',
      icon: <Briefcase size={16} />,
      description: 'Professional work history and achievements',
      required: true
    },
    {
      id: 'education',
      title: 'Education',
      icon: <GraduationCap size={16} />,
      description: 'Academic background and qualifications',
      required: true
    },
    {
      id: 'skills',
      title: 'Skills & Languages',
      icon: <Code size={16} />,
      description: 'Technical skills, soft skills, and languages',
      required: true
    },
    {
      id: 'projects',
      title: 'Projects',
      icon: <FolderKanban size={16} />,
      description: 'Notable projects and portfolio items',
      required: false
    },
    {
      id: 'certifications',
      title: 'Certifications',
      icon: <Award size={16} />,
      description: 'Professional certifications and awards',
      required: false
    },
    {
      id: 'achievements',
      title: 'Achievements',
      icon: <Trophy size={16} />,
      description: 'Notable accomplishments and recognitions',
      required: false
    },
    {
      id: 'finalize',
      title: 'Review & Download',
      icon: <Download size={16} />,
      description: 'Final review and download options',
      required: true
    }
  ];

  // Resume templates
  const templates: Template[] = [
    {
      id: 'modern',
      name: 'Modern Professional',
      category: 'Professional',
      thumbnail: '🎯',
      description: 'Clean, modern design perfect for tech and business roles',
      color: getColorTheme('blue').primary
    },
    {
      id: 'professionalBlue',
      name: 'Professional Blue',
      category: 'Professional',
      thumbnail: '💼',
      description: 'Modern two-column layout with blue gradient header',
      color: getColorTheme('blue').primary
    },
    {
      id: 'creative',
      name: 'Creative Designer',
      category: 'Creative',
      thumbnail: '🎨',
      description: 'Colorful and creative layout for design professionals',
       color: getColorTheme('orange').primary
    },
    {
      id: 'executive',
      name: 'Executive Classic',
      category: 'Executive',
      thumbnail: '👔',
      description: 'Traditional, professional design for senior roles',
      color: getColorTheme('gray').primary
    },
    {
      id: 'minimal',
      name: 'Minimal Clean',
      category: 'Minimal',
      thumbnail: '✨',
      description: 'Ultra-clean, minimal design that focuses on content',
      color: getColorTheme('green').primary
    },
    {
      id: 'academic',
      name: 'Academic Scholar',
      category: 'Academic',
      thumbnail: '🎓',
      description: 'Perfect for academic and research positions',
      color: getColorTheme('purple').primary
    },
    {
      id: 'bold',
      name: 'Bold Impact',
      category: 'Creative',
      thumbnail: '💥',
      description: 'Eye-catching design for creative professionals',
      color: getColorTheme('red').primary
    },
    {
      id: 'elegant',
      name: 'Elegant Classic',
      category: 'Professional',
      thumbnail: '💎',
      description: 'Sophisticated design for premium positions',
      color: getColorTheme('indigo').primary
    },
    {
      id: 'tech',
      name: 'Tech Innovator',
      category: 'Tech',
      thumbnail: '🚀',
      description: 'Modern tech-focused design with clean lines',
      color: getColorTheme('cyan').primary
    },
    {
      id: 'startup',
      name: 'Startup Founder',
      category: 'Entrepreneurial',
      thumbnail: '⚡',
      description: 'Dynamic design for entrepreneurs and innovators',
      color: getColorTheme('orange').primary
    },
    {
      id: 'consulting',
      name: 'Consulting Pro',
      category: 'Business',
      thumbnail: '📊',
      description: 'Professional consulting and business strategy focused',
      color: getColorTheme('teal').primary
    },
    {
      id: 'medical',
      name: 'Medical Professional',
      category: 'Healthcare',
      thumbnail: '⚕️',
      description: 'Clean, trustworthy design for healthcare professionals',
      color: getColorTheme('emerald').primary
    },
    {
      id: 'finance',
      name: 'Finance Executive',
      category: 'Finance',
      thumbnail: '💰',
      description: 'Conservative, numbers-focused design for financial sector',
      color: getColorTheme('blue').primary
    },
    {
      id: 'marketing',
      name: 'Marketing Specialist',
      category: 'Marketing',
      thumbnail: '📈',
      description: 'Vibrant, results-oriented design for marketing professionals',
      color: getColorTheme('orange').primary
    },
    {
      id: 'data',
      name: 'Data Scientist',
      category: 'Tech',
      thumbnail: '📊',
      description: 'Modern, analytical design perfect for data and research roles',
      color: getColorTheme('violet').primary
    },
    {
      id: 'nonprofit',
      name: 'Non-Profit Leader',
      category: 'Social Impact',
      thumbnail: '🤝',
      description: 'Purpose-driven design for social impact and community roles',
      color: getColorTheme('pink').primary
    }
  ];

  // Apply theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = theme;
  }, [theme]);

  // Load saved resume data on mount
  useEffect(() => {
    const savedData = localStorage.getItem('resumeBuilderData');
    if (savedData && !builderStarted) {
      try {
        const parsedData = JSON.parse(savedData);
        // Only use localStorage as fallback when not connected to database
        setResumeData(parsedData.resumeData || resumeData);
        setSelectedTemplate(parsedData.selectedTemplate || 'modern');
        setCompletedSteps(new Set(parsedData.completedSteps || []));
        setLastSaved(new Date(parsedData.timestamp));
      } catch (error) {
        console.error('Error loading saved resume data:', error);
      }
    }
  }, [builderStarted]);

  // Template preview data
  const templatePreviews = {
    modern: {
      title: "Modern Professional Template",
      description: "Clean, contemporary design perfect for tech professionals and modern businesses. Features a sleek layout with excellent readability.",
      preview: <ModernTemplatePreview />
    },
    creative: {
      title: "Creative Professional Template", 
      description: "Stylish and modern design for creative professionals. Perfect for designers, artists, and creative roles while maintaining professionalism.",
      preview: <CreativeTemplatePreview />
    },
    professionalBlue: {
      title: "Professional Blue Template",
      description: "Modern two-column layout with blue gradient header and professional styling. Perfect for customer success, operations, and business development roles.",
      preview: <ProfessionalBlueTemplatePreview />
    },
    executive: {
      title: "Executive Classic Template",
      description: "Traditional, authoritative design ideal for C-level executives, senior management, and prestigious positions. Timeless elegance with professional gravitas.",
      preview: <ExecutiveTemplatePreview />
    },
    bold: {
      title: "Bold Impact Template",
      description: "Eye-catching design for professionals who want to make a statement. Perfect for marketing, sales, and leadership roles while maintaining professionalism.",
      preview: <BoldTemplatePreview />
    },
    minimal: {
      title: "Minimal Elegant Template",
      description: "Sophisticated, understated design with maximum impact. Perfect for professionals who value clean aesthetics and effective communication.",
      preview: <MinimalTemplatePreview />
    },
    elegant: {
      title: "Elegant Premium Template",
      description: "Refined and sophisticated design for premium professional presentation. Features tasteful accents and modern typography.",
      preview: <ElegantTemplatePreview />
    },
    tech: {
      title: "Tech Innovator Template",
      description: "Modern design optimized for technology professionals. Features clean code-inspired aesthetics with excellent skill visualization.",
      preview: <TechTemplatePreview />
    },
    startup: {
      title: "Startup Founder Template",
      description: "Dynamic design for entrepreneurs and startup professionals. Features bold branding elements and achievement-focused layout.",
      preview: <StartupTemplatePreview />
    },
    consulting: {
      title: "Consulting Professional Template",
      description: "Authoritative design for management consultants and advisors. Features structured layout emphasizing strategic expertise.",
      preview: <ConsultingTemplatePreview />
    },
    medical: {
      title: "Medical Professional Template",
      description: "Clean, professional design for healthcare professionals. Features credential-focused layout with emphasis on qualifications.",
      preview: <MedicalTemplatePreview />
    },
    finance: {
      title: "Finance Professional Template",
      description: "Sophisticated design for finance and banking professionals. Features data-driven layout with emphasis on achievements.",
      preview: <FinanceTemplatePreview />
    },
    marketing: {
      title: "Marketing Creative Template",
      description: "Vibrant design for marketing and communications professionals. Features campaign-focused layout with brand-forward presentation.",
      preview: <MarketingTemplatePreview />
    },
    data: {
      title: "Data Science Template",
      description: "Modern design for data professionals and analysts. Features skill-matrix layout with project showcase section.",
      preview: <DataTemplatePreview />
    },
    nonprofit: {
      title: "Nonprofit Professional Template",
      description: "Purpose-driven design for nonprofit and social impact professionals. Features mission-focused layout with impact metrics.",
      preview: <NonprofitTemplatePreview />
    },
    academic: {
      title: "Academic Scholar Template",
      description: "Scholarly design perfect for academic and research positions. Ideal for professors, researchers, PhD candidates, and academic professionals.",
      preview: <AcademicTemplatePreview />
    }
  };

  // Get completion percentage
  const getCompletionPercentage = () => {
    const requiredSteps = resumeSteps.filter(step => step.required);
    const completedRequiredSteps = requiredSteps.filter(step => completedSteps.has(step.id));
    return Math.round((completedRequiredSteps.length / requiredSteps.length) * 100);
  };

  // Navigate between steps
  const changeStep = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= resumeSteps.length) return;
    
    saveResume();
    setCurrentStepIndex(newIndex);
  };

  // Mark step as completed
  const markStepCompleted = async (stepId: string) => {
    setCompletingStep(stepId);

    // Simulate processing time for visual feedback
    await new Promise(resolve => setTimeout(resolve, 1000));

    setCompletedSteps(prev => new Set(Array.from(prev).concat(stepId)));
    setCompletingStep(null);
    setCompletedStep(stepId);

    showNotification(`✅ ${resumeSteps.find(s => s.id === stepId)?.title} completed!`, 'success');

    // Auto-save after completion
    setTimeout(async () => {
      await saveResume();
      setCompletedStep(null);
  
      // Auto-advance to next step after completion
      const currentIndex = resumeSteps.findIndex(s => s.id === stepId);
      if (currentIndex < resumeSteps.length - 1) {
        setCurrentStepIndex(currentIndex + 1);
      }
    }, 800);
  };

  // Show notification
  const showNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Handle resizer mouse down
  const handleResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.classList.add('resizing');

    const startX = e.clientX;
    const startMiddleWidth = middlePanelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - startX;
      const deltaPercentage = (deltaX / containerRect.width) * 100;

      let newMiddleWidth = startMiddleWidth + deltaPercentage;
      newMiddleWidth = Math.max(25, Math.min(75, newMiddleWidth));

      setMiddlePanelWidth(newMiddleWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle template click
  const handleTemplateClick = (template: Template) => {
    if (templatePreviews[template.id as keyof typeof templatePreviews]) {
      setPreviewTemplate(template);
      setShowTemplateModal(true);
    } else {
      // Set template and reset to its default color
      setSelectedTemplate(template.id);
      const defaultColor = getTemplateDefaultColor(template.id);
      setSelectedColor(defaultColor);
      setResumeData(prev => ({ ...prev, selectedColor: defaultColor }));
      showNotification(`✨ ${template.name} template selected!`, 'success');
    }
  };

  // Handle template selection from modal
  const handleSelectTemplate = () => {
    if (previewTemplate) {
      // Set template and reset to its default color
      setSelectedTemplate(previewTemplate.id);
      const defaultColor = getTemplateDefaultColor(previewTemplate.id);
      setSelectedColor(defaultColor);
      setResumeData(prev => ({ ...prev, selectedColor: defaultColor }));
      setShowTemplateModal(false);
      setPreviewTemplate(null);
      showNotification(`✨ ${previewTemplate.name} template selected!`, 'success');
    }
  };

  // Close template modal
  const closeTemplateModal = () => {
    setShowTemplateModal(false);
    setPreviewTemplate(null);
  };

  // Toggle theme
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

const enhanceWithAI = async (text: string, context: string): Promise<string> => {
  setAiEnhancing(true);

  try {
    const userId = userProfile?.uid;
    const organizationId = userProfile?.organizationId;

    if (!userId || !organizationId) {
      throw new Error('User authentication required');
    }

    let enhanced: string;

    // Use the existing exported functions (NOT ResumeAIService)
    if (context === 'professional summary' || context.includes('summary')) {
      enhanced = await enhancePersonalSummary(
        text,
        resumeData.personalInfo,
        userId,
        organizationId
      );
    } else {
      // For other contexts like experience descriptions
      const enhancedArray = await enhanceJobDescription(
        text,
        'Current Position',
        'Current Company',
        userId,
        organizationId
      );
      enhanced = enhancedArray[0] || text;
    }

    setAiEnhancing(false);
    showNotification('Content enhanced with AI!', 'success');
    return enhanced;

  } catch (error) {
    console.error('AI enhancement error:', error);
    setAiEnhancing(false);
    showNotification('AI enhancement failed', 'error');
    return text;
  }
};


 // Download handlers
 const handlePrint = async () => {
    if (!printTargetRef.current) {
      showNotification('Resume not ready', 'error');
      return;
    }
    try {
      await printResume();
    } catch (err) {
      console.error('Print failed:', err);
      showNotification('Print failed', 'error');
    }
  };
  
  // Download current resume
const downloadHTML = () => {
  showNotification('HTML download started...', 'info');
  
  try {
    // Get the current resume content
    const resumeElement = document.querySelector('.a4-page .a4-content');
    if (!resumeElement) {
      showNotification('Resume content not found', 'error');
      return;
    }

    // Get the current color theme
    const colors = getColorTheme(selectedColor);
    
    // Clone the resume content
    const clonedContent = resumeElement.cloneNode(true) as HTMLElement;
    
    // Remove any print-specific elements
    const spacers = clonedContent.querySelectorAll('.overlay-spacer, .auto-break');
    spacers.forEach(spacer => spacer.remove());

    // Create complete HTML document
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${resumeData.personalInfo.fullName || 'Resume'} - Professional Resume</title>
    <style>
        /* Reset and base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #2d3748;
            background-color: #f7fafc;
            margin: 0;
            padding: 20px;
        }
        
        .container {
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            overflow: hidden;
        }
        
        .resume-content {
            padding: 40px;
            min-height: 297mm;
        }
        
        /* Typography */
        h1, h2, h3, h4, h5, h6 {
            font-weight: 600;
            line-height: 1.2;
            margin-bottom: 0.5em;
        }
        
        h1 { font-size: 2.5em; color: ${colors.primary}; }
        h2 { font-size: 1.8em; color: ${colors.primary}; }
        h3 { font-size: 1.4em; color: ${colors.text}; }
        h4 { font-size: 1.2em; color: ${colors.text}; }
        
        p {
            margin-bottom: 1em;
            color: ${colors.text};
        }
        
        a {
            color: ${colors.primary};
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        /* Layout components */
        .section {
            margin-bottom: 2em;
        }
        
        .section-header {
            border-bottom: 2px solid ${colors.primary};
            padding-bottom: 0.5em;
            margin-bottom: 1em;
        }
        
        .two-column {
            display: grid;
            grid-template-columns: 1fr 2fr;
            gap: 2em;
        }
        
        .flex {
            display: flex;
        }
        
        .flex-between {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .flex-wrap {
            flex-wrap: wrap;
        }
        
        .gap-4 {
            gap: 1rem;
        }
        
        /* Contact info */
        .contact-info {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            font-size: 0.9em;
            color: ${colors.secondary};
            margin-bottom: 1.5em;
        }
        
        .contact-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        /* Skills */
        .skills-list {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        
        .skill-tag {
            background: ${colors.accent};
            color: ${colors.primary};
            padding: 0.25rem 0.75rem;
            border-radius: 1rem;
            font-size: 0.85em;
            font-weight: 500;
        }
        
        /* Experience and education cards */
        .card {
            background: ${colors.accent};
            padding: 1.5rem;
            border-radius: 8px;
            margin-bottom: 1rem;
            border-left: 4px solid ${colors.primary};
        }
        
        .card-header {
            margin-bottom: 0.5rem;
        }
        
        .card-title {
            color: ${colors.text};
            font-weight: 600;
            margin-bottom: 0.25rem;
        }
        
        .card-subtitle {
            color: ${colors.primary};
            font-weight: 500;
            margin-bottom: 0.25rem;
        }
        
        .card-meta {
            color: ${colors.secondary};
            font-size: 0.9em;
        }
        
        /* Lists */
        ul {
            margin-left: 1.5rem;
            margin-bottom: 1rem;
        }
        
        li {
            margin-bottom: 0.25rem;
            color: ${colors.text};
        }
        
        /* Profile picture */
        .profile-picture {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            object-fit: cover;
            border: 4px solid ${colors.primary};
            margin-bottom: 1rem;
        }
        
        /* Template-specific styles */
        .modern-header {
            border-bottom: 3px solid ${colors.primary};
            padding-bottom: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .professional-gradient {
            background: linear-gradient(135deg, ${colors.primary}, ${colors.secondary});
            color: white;
            padding: 2rem;
            margin: -40px -40px 2rem -40px;
        }
        
        .professional-gradient h1,
        .professional-gradient h2,
        .professional-gradient p {
            color: white;
        }
        
        /* Print styles */
        @media print {
            body {
                background: white;
                padding: 0;
            }
            
            .container {
                box-shadow: none;
                border-radius: 0;
                max-width: none;
            }
            
            .resume-content {
                padding: 20px;
            }
            
            .section {
                break-inside: avoid;
            }
            
            .card {
                break-inside: avoid;
            }
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
            .two-column {
                grid-template-columns: 1fr;
            }
            
            .flex-between {
                flex-direction: column;
                align-items: flex-start;
            }
            
            .contact-info {
                flex-direction: column;
                gap: 0.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="resume-content">
            ${clonedContent.innerHTML}
        </div>
    </div>
    
    <script>
        // Add any interactive features here if needed
        console.log('Resume loaded successfully');
        
        // Optional: Add print functionality
        function printResume() {
            window.print();
        }
        
        // Add keyboard shortcut for printing
        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                printResume();
            }
        });
    </script>
</body>
</html>`;

    // Create and download the HTML file
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resumeData.personalInfo.fullName || 'Resume'}_${new Date().toISOString().split('T')[0]}.html`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('HTML resume downloaded successfully!', 'success');
  } catch (error) {
    console.error('HTML download failed:', error);
    showNotification('HTML download failed', 'error');
  }
};

  const currentStep = resumeSteps[currentStepIndex];

  if (!userProfile && !isLoadingUserData) {
    return (
      <div className="startup-container">
        <div className="startup-card">
          <h1>Authentication Required</h1>
          <p>Please log in to access the resume builder.</p>
          <button onClick={onClose} className="btn btn-primary">
            Go Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (!builderStarted) {
    return (
      <div style={{ 
        flex: 1,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '20px',
        paddingBottom: '120px',
        backgroundColor: '#f8fafc'
      }}>      
        <div style={{
          maxWidth: '900px',
          width: '100%',
          margin: '0 auto',
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
        }}>
          {/* Feature Cards - 4 columns */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '24px 16px',
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #e5e7eb'
            }}>
              <FontAwesomeIcon icon={faListCheck} style={{ fontSize: '48px', color: '#3b82f6', marginBottom: '16px' }} />
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>Step-by-Step</div>
              <div style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.4' }}>Guided process to build your perfect resume</div>
            </div>
        
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '24px 16px',
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #e5e7eb'
            }}>
              <FontAwesomeIcon icon={faPalette} style={{ fontSize: '48px', color: '#8b5cf6', marginBottom: '16px' }} />
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>15 Templates</div>
              <div style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.4' }}>Professional templates for every industry</div>
            </div>
        
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '24px 16px',
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #e5e7eb'
            }}>
              <FontAwesomeIcon icon={faRobot} style={{ fontSize: '48px', color: '#10b981', marginBottom: '16px' }} />
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>AI Enhanced</div>
              <div style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.4' }}>AI suggestions to improve your content</div>
            </div>
        
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '24px 16px',
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #e5e7eb'
            }}>
              <FontAwesomeIcon icon={faFileArrowDown} style={{ fontSize: '48px', color: '#f59e0b', marginBottom: '16px' }} />
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>Multi-Format</div>
              <div style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.4' }}>Download as PDF or HTML</div>
            </div>
          </div>

          {/* How It Works */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            border: '1px solid #e5e7eb',
            padding: '24px 28px',
            marginBottom: '24px'
          }}>
            <h3 style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              color: '#1e293b',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <FontAwesomeIcon icon={faLightbulb} style={{ color: '#f59e0b', fontSize: '18px' }} />
              How It Works
            </h3>
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {[
                'Fill out each section step by step',
                'Choose from 15 professional resume templates',
                'Get AI-powered suggestions to enhance your content',
                'Preview your resume in real-time',
                'Download as PDF or HTML when ready'
              ].map((text, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  fontSize: '15px',
                  color: '#374151'
                }}>
                  <FontAwesomeIcon icon={faCircleCheck} style={{ color: '#10b981', fontSize: '18px' }} />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Buttons row with inline progress */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '16px'
          }}>
            {/* Inline Progress - Left side */}
            {isLoadingUserData && (
              <div style={{ marginRight: 'auto' }}>
                <InlineProgress 
                  currentStep={loadingProgress.currentStep}
                  totalSteps={loadingProgress.totalSteps}
                  currentSection={loadingProgress.currentSection}
                  hasResume={hasFoundResume}
                  loadingComplete={loadingComplete}
                  foundUserName={foundUserName}
                />
              </div>
            )}

            {/* Buttons - Right side */}
            <button 
              onClick={() => {
                if (onClose) {
                  onClose();
                } else {
                  window.history.back();
                }
              }}
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#374151',
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Close
            </button>

            <button 
              onClick={handleStartBuilding}
              disabled={isLoadingUserData}
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: '600',
                color: 'white',
                background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                border: 'none',
                borderRadius: '6px',
                cursor: isLoadingUserData ? 'not-allowed' : 'pointer',
                opacity: isLoadingUserData ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <FontAwesomeIcon icon={faRocket} style={{ fontSize: '12px' }} />
              {isLoadingUserData ? (
                loadingComplete ? (
                  hasFoundResume ? 'Loading...' : 'Creating...'
                ) : 'Checking...'
              ) : (
                'Start Building Resume'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Main Content */}
      <div className="main-content" ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Middle Panel - Form Content */}
        <div 
          className={`middle-panel ${theme}`}
          style={{ width: `${middlePanelWidth}%` }}
        >
          <div className="step-header" style={{ padding: '12px 20px', gap: '12px' }}>
            <div className="step-icon" style={{ width: '36px', height: '36px', fontSize: '16px' }}>{currentStep.icon}</div>
            <div>
              <h1 className="step-title" style={{ fontSize: '18px', marginBottom: '2px' }}>{currentStep.title}</h1>
              <p className="step-description" style={{ fontSize: '12px', margin: 0 }}>{currentStep.description}</p>
            </div>
          </div>

          <div className="step-content">
            {currentStep.id === 'personal' && (
              <PersonalInfoForm 
                data={resumeData.personalInfo}
                onChange={(data) => setResumeData(prev => ({ ...prev, personalInfo: data }))}
                onComplete={() => markStepCompleted('personal')}
                enhanceWithAI={enhanceWithAI}
                aiEnhancing={aiEnhancing}
                completing={completingStep === 'personal'}
                completed={completedStep === 'personal'}
              />
            )}
            
            {currentStep.id === 'experience' && (
              <ExperienceForm 
                data={resumeData.experiences}
                onChange={(data) => setResumeData(prev => ({ ...prev, experiences: data }))}
                onComplete={() => markStepCompleted('experience')}
                enhanceWithAI={enhanceWithAI}
                aiEnhancing={aiEnhancing}
                completing={completingStep === 'experience'}
                completed={completedStep === 'experience'}
              />
            )}
            
            {currentStep.id === 'education' && (
              <EducationForm 
                data={resumeData.education}
                onChange={(data) => setResumeData(prev => ({ ...prev, education: data }))}
                onComplete={() => markStepCompleted('education')}
                completing={completingStep === 'education'}
                completed={completedStep === 'education'}
              />
            )}
            
            {currentStep.id === 'skills' && (
              <SkillsForm 
                data={resumeData.skills}
                onChange={(data) => setResumeData(prev => ({ ...prev, skills: data }))}
                onComplete={() => markStepCompleted('skills')}
                completing={completingStep === 'skills'}
                completed={completedStep === 'skills'}
              />
            )}
            
            {currentStep.id === 'projects' && (
              <ProjectsForm 
                data={resumeData.projects}
                onChange={(data) => setResumeData(prev => ({ ...prev, projects: data }))}
                onComplete={() => markStepCompleted('projects')}
                completing={completingStep === 'projects'}
                completed={completedStep === 'projects'}
                enhanceWithAI={enhanceWithAI}
                aiEnhancing={aiEnhancing}
              />
            )}
            
            {currentStep.id === 'certifications' && (
              <CertificationsForm 
                data={resumeData.certifications}
                onChange={(data) => setResumeData(prev => ({ ...prev, certifications: data }))}
                onComplete={() => markStepCompleted('certifications')}
                completing={completingStep === 'certifications'}
                completed={completedStep === 'certifications'}
              />
            )}
            
            {currentStep.id === 'achievements' && (
              <AchievementsForm 
                data={resumeData.achievements}
                onChange={(data) => setResumeData(prev => ({ ...prev, achievements: data }))}
                onComplete={() => markStepCompleted('achievements')}
                completing={completingStep === 'achievements'}
                completed={completedStep === 'achievements'}
              />
            )}
            
          {currentStep.id === 'finalize' && (
            <FinalizeForm 
              resumeData={resumeData}
              onHandlePrint={handlePrint}
              onDownloadHTML={downloadHTML}
              completedSteps={completedSteps}
              requiredSteps={resumeSteps.filter(s => s.required)}
            />
          )}
          </div>

          {/* Bottom Navigation Bar */}
          <div className="bottom-navigation" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#fff',
            marginTop: 'auto'
          }}>
            <div className="nav-info" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              <strong style={{ fontSize: '14px', color: '#1a202c' }}>Step {currentStepIndex + 1} of {resumeSteps.length}</strong>
              <span style={{ fontSize: '12px', color: '#718096' }}>{currentStep.required ? 'Required' : 'Optional'} • {getCompletionPercentage()}% Complete</span>
            </div>
            <div className="nav-buttons" style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => changeStep(currentStepIndex - 1)}
                disabled={currentStepIndex === 0}
                className="btn"
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <button
                onClick={() => changeStep(currentStepIndex + 1)}
                disabled={currentStepIndex === resumeSteps.length - 1}
                className="btn"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Resizer */}
        <div 
          className="resizer"
          onMouseDown={handleResizerMouseDown}
        >
          <div className="resizer-handle"></div>
        </div>

        {/* Right Panel - Templates & Preview */}
        <div 
          className={`right-panel ${theme}`}
          style={{ width: `${100 - middlePanelWidth}%` }}
        >
          <div className="preview-header">
            <div className="preview-title">
              <Eye size={16} />
              Resume Preview - {templates.find(t => t.id === selectedTemplate)?.name}
            </div>
            <div className="preview-controls">
              <div className="zoom-controls">
                <button
                  onClick={() => setPreviewZoom(Math.max(0.3, previewZoom - 0.1))}
                  className="btn btn-zoom"
                  title="Zoom Out"
                >
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>−</span>
                </button>
                <span className="zoom-level">{Math.round(previewZoom * 100)}%</span>
                <button
                  onClick={() => setPreviewZoom(Math.min(1.5, previewZoom + 0.1))}
                  className="btn btn-zoom"
                  title="Zoom In"
                >
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>+</span>
                </button>
              </div>

              <div className="action-controls">
                {/* Toggle Templates Button */}
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="btn btn-toggle-templates"
                  title={showTemplates ? "Hide templates" : "Show templates"}
                >
                  {showTemplates ? (
                    <>
                      <div className="circle-icon">−</div>
                       Templates
                    </>
                  ) : (
                    <>
                      <div className="circle-icon">+</div>
                       Templates
                    </> 
                  )}
                </button>

                <button
                  onClick={saveResume}
                  className="btn btn-save"
                  disabled={isSaving}
                  title={lastSaved ? `Last saved: ${lastSaved.toLocaleTimeString()}` : 'Save resume'}
                >
                 Save
                </button>

                <button
                  onClick={handlePrint}
                  className="btn btn-download-preview"
                  title="Print & Download resume as PDF"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6,9 6,2 18,2 18,9"></polyline>
                    <path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                  Print
                </button>
              </div>
            </div>
          </div>
          {/* Template Selection - Show/Hide based on state */}
          {showTemplates && (
            <div className="template-section">
              <div className="template-header">
                <div className="template-header-left">
                  <h3 className="template-title">Choose Template</h3>
                  <CompactColorPicker 
                    selectedColor={selectedColor}
                    onColorChange={(color) => {
                      console.log('Color changed to:', color);
                      setSelectedColor(color);
                      setResumeData(prev => ({ ...prev, selectedColor: color }));
                    }}
                    isOpen={showColorPicker}
                    onToggle={() => setShowColorPicker(!showColorPicker)}
                  />
                </div>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="btn-close-templates"
                  title="Hide templates"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Remove the old ColorPalette component - it's now integrated above */}

              <div className="template-grid">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                    onClick={() => handleTemplateClick(template)}
                    style={{ 
                      borderColor: selectedTemplate === template.id ? 
                        getColorTheme(selectedColor).primary : 
                        'transparent' 
                    }}
                  >
                    <div className="template-thumbnail" style={{ background: template.color }}>
                      {template.thumbnail}
                    </div>
                    <div className="template-info">
                      <div className="template-name">{template.name}</div>
                      <div className="template-category">{template.category}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

            {/* Resume Preview */}
            <div className={`preview-area ${previewMode === 'single' ? 'preview-mode-single' : ''}`}>
              <ResumePreview 
                data={resumeData}
                template={selectedTemplate}
                selectedColor={selectedColor}
                zoom={previewZoom}
                previewMode={previewMode}
                isPreparingPrint={isPreparingPrint}
                printRef={printTargetRef}
              />
            </div>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className={`status-bar ${theme}`}>
          <div className="status-left">
            <div className="status-item">
              <div className="status-dot dot-completed"></div>
              Completed: {completedSteps.size}/{resumeSteps.length}
            </div>
            <div className="status-item">
              <div className="status-dot dot-required"></div>
              Required: {resumeSteps.filter(s => s.required && completedSteps.has(s.id)).length}/{resumeSteps.filter(s => s.required).length}
            </div>
            <div className="status-item">
              <div className="status-dot dot-template"></div>
              Template: {templates.find(t => t.id === selectedTemplate)?.name}
            </div>

            {/* Add offline indicator */}
            {!navigator.onLine && (
              <div className="status-item offline">
                <div className="status-dot dot-offline"></div>
                Offline Mode
              </div>
            )}
          </div>

      
          <div className="status-right">
            {/* Add Print Preview button here */}
              <button
                onClick={() => setShowPrintPreview(true)}
                className="btn-status-print"
                title="Preview & Print resume"
              >
                {isPreparingPrint ? (
                  <div style={{
                    width: '14px',
                    height: '14px', 
                    border: '2px solid #ccc',
                    borderTop: '2px solid #333',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6,9 6,2 18,2 18,9"></polyline>
                    <path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                )}
              </button>

            <button
              onClick={toggleTheme}
              className="btn-theme-single"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} theme`}
            >
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            </button>

            {lastSaved && (
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                💾 Local: {lastSaved.toLocaleTimeString()}
              </span>
            )}

            <span>Progress: {getCompletionPercentage()}%</span>

            {getCompletionPercentage() === 100 && (
              <span style={{ color: '#10b981', fontWeight: 600 }}>
                ✅ Ready to Download!
              </span>
            )}
          </div>
        </div>

        {/* Template Modal */}
        {showTemplateModal && previewTemplate && (
          <div className="modal-overlay" onClick={closeTemplateModal}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">
                  <span className="template-emoji" style={{ background: previewTemplate.color }}>
                    {previewTemplate.thumbnail}
                  </span>
                  <div>
                    <h3>{templatePreviews[previewTemplate.id as keyof typeof templatePreviews]?.title}</h3>
                    <p>{templatePreviews[previewTemplate.id as keyof typeof templatePreviews]?.description}</p>
                  </div>
                </div>
                <button className="modal-close" onClick={closeTemplateModal}>×</button>
              </div>
              
              <div className="modal-content">
                <div className="template-preview-large">
                  {templatePreviews[previewTemplate.id as keyof typeof templatePreviews]?.preview}
                </div>
              </div>
              
              <div className="modal-actions">
                <button className="btn modal-btn secondary" onClick={closeTemplateModal}>
                  Close Preview
                </button>
                <button 
                  className="btn modal-btn primary" 
                  onClick={handleSelectTemplate}
                  style={{ background: previewTemplate.color, borderColor: previewTemplate.color }}
                >
                  Select This Template
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Print Preview Modal */}
        {showPrintPreview && (
          <PrintPreviewModal
            resumeData={resumeData}
            selectedTemplate={selectedTemplate}
            selectedColor={selectedColor}
            onClose={() => setShowPrintPreview(false)}
            onPrint={() => { setShowPrintPreview(false); handlePrint(); }}
            printRef={printTargetRef}
          />
        )}

        {/* Notification */}
        {notification && (
          <div className={`notification ${notification.type}`}>
            <div className="notification-icon">
              {notification.type === 'success' && <Award size={20} />}
              {notification.type === 'error' && <AlertCircle size={20} />}
              {notification.type === 'info' && <Info size={20} />}
            </div>
            <span>{notification.message}</span>
          </div>
        )}
      </div>
    );
};

// Personal Info Form Component
const PersonalInfoForm: React.FC<{
  data: PersonalInfo;
  onChange: (data: PersonalInfo) => void;
  onComplete: () => void;
  enhanceWithAI: (text: string, context: string) => Promise<string>;
  aiEnhancing: boolean;
  completing: boolean;
  completed: boolean;
}> = ({ data, onChange, enhanceWithAI, aiEnhancing }) => {
  
  const [textareaHeight, setTextareaHeight] = useState<number>(120);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateField = (field: keyof PersonalInfo, value: string) => {
    const newData = { ...data, [field]: value };
    onChange(newData);
    
    // Auto-expand textarea for summary field
    if (field === 'summary' && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      
      // Calculate minimum height for ~200 words (approximately 1200 characters)
      const minHeightFor200Words = Math.max(120, Math.min(300, scrollHeight));
      const newHeight = Math.max(minHeightFor200Words, scrollHeight);
      
      setTextareaHeight(newHeight);
      textarea.style.height = `${newHeight}px`;
    }
  };

  // Move handlePictureChange to component level
  const handlePictureChange = (base64Image: string | null) => {
    const newData = { ...data, profilePicture: base64Image || undefined };
    onChange(newData);
  };

  // Auto-expand on initial load if there's existing content
  useEffect(() => {
    if (data.summary && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const minHeightFor200Words = Math.max(120, Math.min(300, scrollHeight));
      const newHeight = Math.max(minHeightFor200Words, scrollHeight);
      setTextareaHeight(newHeight);
    }
  }, [data.summary]);

  const handleAiEnhance = async () => {
    const enhanced = await enhanceWithAI(data.summary, 'professional summary');
    updateField('summary', enhanced);
  };

  return (
    <div className="form-section">
      <ProfilePictureUpload
        currentPicture={data.profilePicture}
        onPictureChange={handlePictureChange}
      />
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Full Name *</label>
          <input
            type="text"
            className="form-input"
            value={data.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            placeholder="John Doe"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Professional Title</label>
          <input
            type="text"
            className="form-input"
            value={data.title || ''}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="Senior Software Engineer"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Email Address *</label>
          <input
            type="email"
            className="form-input"
            value={data.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="john.doe@email.com"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Phone Number *</label>
          <input
            type="tel"
            className="form-input"
            value={data.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="+91 98765 43210"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Location</label>
          <input
            type="text"
            className="form-input"
            value={data.location}
            onChange={(e) => updateField('location', e.target.value)}
            placeholder="Bangalore, Karnataka"
          />
        </div>

        <div className="form-group">
          <label className="form-label">LinkedIn Profile</label>
          <input
            type="url"
            className="form-input"
            value={data.linkedin}
            onChange={(e) => updateField('linkedin', e.target.value)}
            placeholder="https://linkedin.com/in/yourname"
          />
        </div>
      </div>

      <div className="form-group">
        <div className="form-label-row">
          <label className="form-label">Professional Summary *</label>
          <button 
            className="btn-ai"
            onClick={handleAiEnhance}
            disabled={aiEnhancing || !data.summary}
            title="Get AI suggestions to improve your summary" 
          >
            {aiEnhancing ? (
              <>
                <div className="ai-spinner"></div>
                <span>Enhancing...</span>
              </>
            ) : (
              <>
                <Sparkles size={12} />
                <span>AI Enhance</span>
              </>
            )}
          </button>
        </div>
        <div style={{ position: 'relative', width: '100%' }}>
          <textarea
            ref={textareaRef}
            className="form-textarea"
            value={data.summary}
            onChange={(e) => {
              const text = e.target.value;
              const words = text.trim().split(/\s+/).filter(Boolean);

              if (words.length <= 200) {
                updateField('summary', text);
              } else {
                // Trim to 200 words while preserving newlines
                let count = 0;
                const trimmed = text.replace(/\S+/g, (word) => {
                  if (count < 200) { count++; return word; }
                  return '';
                }).replace(/\n{3,}/g, '\n\n').trimEnd();
                updateField('summary', trimmed);
              }
            }}
            placeholder="Write a compelling professional summary that highlights your key skills and experience..."
            style={{ 
              height: `${textareaHeight}px`,
              width:'100%',
              minHeight: '150px', 
              maxHeight: '200px', 
              resize: 'vertical',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
              fontSize: '14px',
              lineHeight: '1.6',
              fontWeight: '400',
              overflow: 'auto',
              transition: 'height 0.1s ease'
            }}
          />

          {/* Word Counter */}
          <div style={{ 
            position: 'absolute', 
            right: '10px', 
            bottom: '8px', 
            fontSize: '12px', 
            color: '#666',
            background:'#fff',
            padding:'5px 5px'
          }}>
            {data.summary.trim().split(/[\s|\r\n]+/).filter(Boolean).length} / 200 words
          </div>
        </div>

        <div className="form-hint">
          Write 2-3 sentences about your professional background and career goals
        </div>
      </div>

    </div>
  );
};

// Experience Form Component
const ExperienceForm: React.FC<{
  data: Experience[];
  onChange: (data: Experience[]) => void;
  onComplete: () => void;
  enhanceWithAI: (text: string, context: string) => Promise<string>;
  aiEnhancing: boolean;
  completing: boolean;
  completed: boolean;
}> = ({ data, onChange }) => {
  
  const experienceListRef = useRef<HTMLDivElement>(null);
  const prevDataLengthRef = useRef(data.length);
  
  const addExperience = () => {
    const newExp: Experience = {
      id: Date.now().toString(),
      company: '',
      position: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      description: [''],
      type: 'full-time'
    };
    onChange([...data, newExp]);
  };

  // Auto-scroll to bottom when new experience is added
  useEffect(() => {
    if (data.length > prevDataLengthRef.current && experienceListRef.current) {
      setTimeout(() => {
        experienceListRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end' 
        });
      }, 100);
    }
    prevDataLengthRef.current = data.length;
  }, [data.length]);

  const updateExperience = (id: string, field: keyof Experience, value: any) => {
    const updated = data.map(exp => 
      exp.id === id ? { ...exp, [field]: value } : exp
    );
    onChange(updated);
  };

  const removeExperience = (id: string) => {
    onChange(data.filter(exp => exp.id !== id));
  };

  const addDescription = (id: string) => {
    const updated = data.map(exp => 
      exp.id === id ? { ...exp, description: [...exp.description, ''] } : exp
    );
    onChange(updated);
  };

  const updateDescription = (id: string, index: number, value: string) => {
    const updated = data.map(exp => 
      exp.id === id ? { 
        ...exp, 
        description: exp.description.map((desc, i) => i === index ? value : desc)
      } : exp
    );
    onChange(updated);
  };

  const removeDescription = (id: string, index: number) => {
    const updated = data.map(exp => 
      exp.id === id ? { 
        ...exp, 
        description: exp.description.filter((_, i) => i !== index)
      } : exp
    );
    onChange(updated);
  };

  return (
    <div className="form-section">
      {data.length === 0 ? (
        <>
          <div className="section-header-simple">
            <div className="section-title-area">
              <h3>Professional Experience</h3>
              <p className="section-subtitle">Add your work history, internships, projects, and relevant experience</p>
            </div>
          </div>
          
          <div className="empty-state">
            <Briefcase size={48} />
            <h3>Add Your Experience</h3>
            <p>Include work experience, internships, freelance projects, college projects, or volunteer work</p>
            <div className="experience-types">
              <span className="experience-type-tag">💼 Full-time Jobs</span>
              <span className="experience-type-tag">🎓 Internships</span>
              <span className="experience-type-tag">💻 Freelance Work</span>
              <span className="experience-type-tag">🚀 College Projects</span>
              <span className="experience-type-tag">❤️ Volunteer Work</span>
            </div>
            <button 
              className="btn btn-primary btn-large" 
              onClick={addExperience}
              style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                border: 'none',
                color: '#fff'
              }}
            >
              <Plus size={16} />
              Add Your First Experience
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="section-header">
            <div className="section-title-area">
              <h3>Professional Experience</h3>
              <p className="section-subtitle">Add your work history, internships, projects, and relevant experience</p>
            </div>
            <button 
              className="btn btn-add" 
              onClick={addExperience}
              style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                border: 'none',
                color: '#fff'
              }}
            >
              <Plus size={14} />
              Add Experience
            </button>
          </div>
          
          <div className="experience-list">{/* experience cards will be here */}</div>
        </>
      )}

      {data.length > 0 && (
        <div className="experience-list" ref={experienceListRef}>
          {data.map((exp, index) => (
            <div key={exp.id} className="experience-card">
              <div className="card-header">
                <div className="card-title-area">
                  <h4>Experience #{index + 1}</h4>
                  {exp.company && <span className="company-preview">{exp.company}</span>}
                </div>
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={() => removeExperience(exp.id)}
                  title="Remove this experience"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              
              <div className="form-section-group">
                <div className="form-group-title">Basic Information</div>
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Experience Type</label>
                    <select 
                      className="form-input"
                      value={exp.type || 'full-time'}
                      onChange={(e) => updateExperience(exp.id, 'type', e.target.value)}
                    >
                      <option value="full-time">Full-time Job</option>
                      <option value="internship">Internship</option>
                      <option value="freelance">Freelance Work</option>
                      <option value="project">College/Personal Project</option>
                      <option value="volunteer">Volunteer Work</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">
                      {exp.type === 'project' ? 'Project Name *' : 
                       exp.type === 'freelance' ? 'Client/Organization *' : 
                       'Company/Organization *'}
                    </label>
                    <input 
                      className="form-input" 
                      placeholder={
                        exp.type === 'project' ? 'e.g. E-commerce Website, Mobile App, AI Chatbot' :
                        exp.type === 'freelance' ? 'e.g. Local Startup, Small Business, NGO' :
                        exp.type === 'volunteer' ? 'e.g. Teach for India, Red Cross, Local NGO' :
                        'e.g. TCS, Infosys, Flipkart, Zomato, Paytm'
                      }
                      value={exp.company}
                      onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    {exp.type === 'project' ? 'Your Role *' : 'Job Title/Position *'}
                  </label>
                  <input 
                    className="form-input" 
                    placeholder={
                      exp.type === 'project' ? 'e.g. Full-stack Developer, Team Lead, UI/UX Designer' :
                      exp.type === 'internship' ? 'e.g. Software Development Intern, Marketing Intern' :
                      exp.type === 'freelance' ? 'e.g. Web Developer, Content Writer, Graphic Designer' :
                      exp.type === 'volunteer' ? 'e.g. Volunteer Coordinator, Tutor, Event Organizer' :
                      'e.g. Software Engineer, Product Manager, Data Analyst'
                    }
                    value={exp.position}
                    onChange={(e) => updateExperience(exp.id, 'position', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-section-group">
                <div className="form-group-title">Duration & Location</div>
                <div className="form-grid form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input 
                      type="month"
                      className="form-input"
                      value={exp.startDate}
                      onChange={(e) => updateExperience(exp.id, 'startDate', e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input 
                      type="month"
                      className="form-input"
                      value={exp.endDate}
                      disabled={exp.current}
                      placeholder={exp.current ? "Present" : ""}
                      onChange={(e) => updateExperience(exp.id, 'endDate', e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input 
                      className="form-input" 
                      placeholder={
                        exp.type === 'project' ? 'e.g. Personal Project, College, Home' :
                        'e.g. Bangalore, Mumbai, Delhi, Pune, Chennai, Hyderabad'
                      }
                      value={exp.location}
                      onChange={(e) => updateExperience(exp.id, 'location', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-checkbox">
                    <input 
                      type="checkbox"
                      checked={exp.current}
                      onChange={(e) => updateExperience(exp.id, 'current', e.target.checked)}
                    />
                    <span className="checkbox-text">
                      {exp.type === 'project' ? 'Currently working on this project' : 'I currently work here'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="form-section-group">
                <div className="form-group-title-row">
                  <div className="form-group-title">
                    {exp.type === 'project' ? 'Key Features & Achievements *' : 'Key Responsibilities & Achievements *'}
                  </div>
                  <button 
                    className="btn btn-sm btn-outline"
                    onClick={() => addDescription(exp.id)}
                  >
                    <Plus size={12} />
                    Add Point
                  </button>
                </div>
                
                <div className="description-list">
                  {exp.description.map((desc, descIndex) => (
                    <div key={descIndex} className="description-item" style={{ display: 'flex', alignItems: 'center' }}>
                      <div className="description-number">{descIndex + 1}</div>
                      <textarea
                        className="form-textarea description-textarea"
                        placeholder={
                          exp.type === 'project' ? 
                            (descIndex === 0 ? '• Built a full-stack e-commerce application using MERN stack with payment gateway integration...' : '• Implemented features like user authentication, shopping cart, and order tracking...') :
                          exp.type === 'internship' ?
                            (descIndex === 0 ? '• Collaborated with senior developers to build customer-facing features for fintech application...' : '• Gained hands-on experience in Agile development and code review processes...') :
                          exp.type === 'freelance' ?
                            (descIndex === 0 ? '• Delivered responsive website for local restaurant chain increasing online orders by 40%...' : '• Managed end-to-end project delivery from client requirements to deployment...') :
                          exp.type === 'volunteer' ?
                            (descIndex === 0 ? '• Organized coding workshops for underprivileged students in rural Karnataka...' : '• Mentored 20+ students in basic programming and computer literacy...') :
                            (descIndex === 0 ? '• Led development of microservices architecture serving 2M+ users across India...' : '• Improved system performance by 45% through database optimization and caching strategies...')
                        }
                        value={desc}
                        onChange={(e) => updateDescription(exp.id, descIndex, e.target.value)}
                        rows={2}
                          style={{ 
                            minHeight: '60px', 
                            maxHeight: '120px',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif', // ADD
                            fontSize: '14px', // ADD
                            lineHeight: '1.5', // ADD
                            fontWeight: '400' // ADD
                          }}
                      />
                      {exp.description.length > 1 && (
                        <button 
                          className="btn btn-icon btn-ghost"
                          onClick={() => removeDescription(exp.id, descIndex)}
                          title="Remove this point"
                          style={{
                            padding: '6px',
                            borderRadius: '6px',
                            border: 'none',
                            background: '#fee2e2',
                            color: '#ef4444',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            alignSelf: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#ef4444';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fee2e2';
                            e.currentTarget.style.color = '#ef4444';
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Education Form Component
const EducationForm: React.FC<EducationFormProps> = ({ data, onChange, onComplete: _onComplete, completing: _completing, completed: _completed }) => {
  
  const addEducation = () => {
    const newEdu: Education = {
      id: Date.now().toString(),
      institution: '',
      degree: '',
      field: '',
      location: '',
      startDate: '',
      endDate: '',
      gpa: '',
      achievements: ['']
    };
    onChange([...data, newEdu]);
  };

  const updateEducation = (id: string, field: keyof Education, value: any) => {
    const updated = data.map(edu => 
      edu.id === id ? { ...edu, [field]: value } : edu
    );
    onChange(updated);
  };

  const removeEducation = (id: string) => {
    onChange(data.filter(edu => edu.id !== id));
  };

  const addAchievement = (id: string) => {
    const updated = data.map(edu => 
      edu.id === id ? { ...edu, achievements: [...edu.achievements, ''] } : edu
    );
    onChange(updated);
  };

  const updateAchievement = (id: string, index: number, value: string) => {
    const updated = data.map(edu => 
      edu.id === id ? { 
        ...edu, 
        achievements: edu.achievements.map((ach, i) => i === index ? value : ach)
      } : edu
    );
    onChange(updated);
  };

  const removeAchievement = (id: string, index: number) => {
    const updated = data.map(edu => 
      edu.id === id ? { 
        ...edu, 
        achievements: edu.achievements.filter((_, i) => i !== index)
      } : edu
    );
    onChange(updated);
  };


    return (
      <div className="form-section">
        {data.length === 0 ? (
          <>
            <div className="section-header-simple">
              <div className="section-title-area">
                <h3>Education</h3>
                <p className="section-subtitle">Add your educational background, degrees, certifications, and academic achievements</p>
              </div>
            </div>
        
            <div className="empty-state">
              <GraduationCap size={48} />
              <h3>Add Your Education</h3>
              <p>Include degrees, diplomas, certifications, online courses, and academic achievements</p>
              <div className="experience-types">
                <span className="experience-type-tag">🎓 Bachelor's Degree</span>
                <span className="experience-type-tag">📚 Master's Degree</span>
                <span className="experience-type-tag">🏆 PhD/Doctorate</span>
                <span className="experience-type-tag">📜 Diploma/Certificate</span>
                <span className="experience-type-tag">💻 Online Courses</span>
              </div>
              <button 
                className="btn btn-primary btn-large" 
                onClick={addEducation}
                style={{
                  background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                  border: 'none',
                  color: '#fff'
                }}
              >
                <Plus size={16} />
                Add Your First Education
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="section-header">
              <div className="section-title-area">
                <h3>Education</h3>
                <p className="section-subtitle">Add your educational background, degrees, certifications, and academic achievements</p>
              </div>
              <button 
                className="btn btn-add" 
                onClick={addEducation}
                style={{
                  background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                  border: 'none',
                  color: '#fff'
                }}
              >
                <Plus size={14} />
                Add Education
              </button>
            </div>
        
            <div className="education-list">{/* education cards will be here */}</div>
          </>
        )}

        {data.length > 0 && (
        <div className="education-list">
          {data.map((edu, index) => (
            <div key={edu.id} className="education-card">
              <div className="card-header">
                <h4>Education #{index + 1}</h4>
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={() => removeEducation(edu.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Institution *</label>
                  <input 
                    className="form-input" 
                    placeholder="e.g. IIT Delhi, BITS Pilani, Delhi University, Anna University" 
                    value={edu.institution}
                    onChange={(e) => updateEducation(edu.id, 'institution', e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Degree *</label>
                  <input 
                    className="form-input" 
                    placeholder="e.g. B.Tech, B.E, BCA, MBA, M.Tech"
                    value={edu.degree}
                    onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Field of Study *</label>
                  <input 
                    className="form-input" 
                    placeholder="e.g. Computer Science, Information Technology, Electronics"
                    value={edu.field}
                    onChange={(e) => updateEducation(edu.id, 'field', e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input 
                    className="form-input" 
                    placeholder="e.g. New Delhi, Mumbai, Bangalore, Chennai, Pune"
                    value={edu.location}
                    onChange={(e) => updateEducation(edu.id, 'location', e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input 
                    type="month"
                    className="form-input"
                    value={edu.startDate}
                    onChange={(e) => updateEducation(edu.id, 'startDate', e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input 
                    type="month"
                    className="form-input"
                    value={edu.endDate}
                    onChange={(e) => updateEducation(edu.id, 'endDate', e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">GPA/Percentage (Optional)</label>
                  <input 
                    className="form-input" 
                    placeholder="e.g. 8.5/10 CGPA or 85%"
                    value={edu.gpa}
                    onChange={(e) => updateEducation(edu.id, 'gpa', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="form-label-row">
                  <label className="form-label">Achievements & Activities</label>
                  <button 
                    className="btn btn-sm"
                    onClick={() => addAchievement(edu.id)}
                  >
                    <Plus size={12} />
                    Add Achievement
                  </button>
                </div>
                
                {edu.achievements.map((achievement, achIndex) => (
                  <div key={achIndex} className="achievement-item">
                    <input
                      className="form-input"
                      placeholder="e.g. Dean's List, First Class, Published Research Paper, Cultural Secretary"
                      value={achievement}
                      onChange={(e) => updateAchievement(edu.id, achIndex, e.target.value)}
                    />
                    {edu.achievements.length > 1 && (
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => removeAchievement(edu.id, achIndex)}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Skills Form Component
const SkillsForm: React.FC<{
  data: { technical: string[]; soft: string[]; languages: string[]; };
  onChange: (data: { technical: string[]; soft: string[]; languages: string[]; }) => void;
  onComplete: () => void;
  completing: boolean;
  completed: boolean;
}> = ({ data, onChange, onComplete: _onComplete, completing: _completing, completed: _completed }) => {
  
  const [newSkill, setNewSkill] = useState({ technical: '', soft: '', languages: '' });

  const addSkill = (category: 'technical' | 'soft' | 'languages') => {
    if (newSkill[category].trim()) {
      const updated = {
        ...data,
        [category]: [...data[category], newSkill[category].trim()]
      };
      onChange(updated);
      setNewSkill({ ...newSkill, [category]: '' });
    }
  };

  const removeSkill = (category: 'technical' | 'soft' | 'languages', index: number) => {
    const updated = {
      ...data,
      [category]: data[category].filter((_, i) => i !== index)
    };
    onChange(updated);
  };


  return (
    <div className="form-section">
      <div className="skills-container">
        {/* Technical Skills */}
        <div className="skills-category">
          <h3>Technical Skills</h3>
          <div className="skill-input-group">
            <input
              className="form-input"
              placeholder="e.g. JavaScript, Python, React, Node.js, Java, SQL..."
              value={newSkill.technical}
              onChange={(e) => setNewSkill({ ...newSkill, technical: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && addSkill('technical')}
            />
            <button 
              className="btn btn-primary"
              onClick={() => addSkill('technical')}
              style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                border: 'none',
                color: '#fff'
              }}
            >
              <Plus size={14} />
            </button>
          </div>
          
          <div className="skills-list">
            {data.technical.map((skill, index) => (
              <div key={index} className="skill-tag">
                {skill}
                <button onClick={() => removeSkill('technical', index)}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Soft Skills */}
        <div className="skills-category">
          <h3>Soft Skills</h3>
          <div className="skill-input-group">
            <input
              className="form-input"
              placeholder="e.g. Leadership, Team Management, Communication, Problem Solving..."
              value={newSkill.soft}
              onChange={(e) => setNewSkill({ ...newSkill, soft: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && addSkill('soft')}
            />
            <button 
              className="btn btn-primary"
              onClick={() => addSkill('soft')}
              style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                border: 'none',
                color: '#fff'
              }}
            >
              <Plus size={14} />
            </button>
          </div>
          
          <div className="skills-list">
            {data.soft.map((skill, index) => (
              <div key={index} className="skill-tag">
                {skill}
                <button onClick={() => removeSkill('soft', index)}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Languages */}
        <div className="skills-category">
          <h3>Languages</h3>
          <div className="skill-input-group">
            <input
              className="form-input"
              placeholder="e.g. Hindi (Native), English (Fluent), Tamil (Conversational), Marathi (Basic)..."
              value={newSkill.languages}
              onChange={(e) => setNewSkill({ ...newSkill, languages: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && addSkill('languages')}
            />
            <button 
              className="btn btn-primary"
              onClick={() => addSkill('languages')}
              style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                border: 'none',
                color: '#fff'
              }}
            >
              <Plus size={14} />
            </button>
          </div>
          
          <div className="skills-list">
            {data.languages.map((skill, index) => (
              <div key={index} className="skill-tag">
                {skill}
                <button onClick={() => removeSkill('languages', index)}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Projects Form Component
const ProjectsForm: React.FC<{
  data: Project[];
  onChange: (data: Project[]) => void;
  onComplete: () => void;
  completing: boolean;
  completed: boolean;
  enhanceWithAI: (text: string, context: string) => Promise<string>;
  aiEnhancing: boolean;
}> = ({ data, onChange, onComplete: _onComplete, completing: _completing, completed: _completed, enhanceWithAI, aiEnhancing }) => {
  
  const projectsListRef = useRef<HTMLDivElement>(null);
  const prevDataLengthRef = useRef(data.length);
  
  const addProject = () => {
    const newProject: Project = {
      id: Date.now().toString(),
      name: '',
      description: '',
      technologies: [],
      link: '',
      github: ''
    };
    onChange([...data, newProject]);
  };

  // Auto-scroll to bottom when new project is added
  useEffect(() => {
    if (data.length > prevDataLengthRef.current && projectsListRef.current) {
      setTimeout(() => {
        projectsListRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end' 
        });
      }, 100);
    }
    prevDataLengthRef.current = data.length;
  }, [data.length]);

  const updateProject = (id: string, field: keyof Project, value: any) => {
    const updated = data.map(project => 
      project.id === id ? { ...project, [field]: value } : project
    );
    onChange(updated);
  };

  const removeProject = (id: string) => {
    onChange(data.filter(project => project.id !== id));
  };

  const addTechnology = (id: string, tech: string) => {
    if (tech.trim()) {
      const updated = data.map(project => 
        project.id === id ? { 
          ...project, 
          technologies: [...project.technologies, tech.trim()]
        } : project
      );
      onChange(updated);
    }
  };

  const removeTechnology = (id: string, index: number) => {
    const updated = data.map(project => 
      project.id === id ? { 
        ...project, 
        technologies: project.technologies.filter((_, i) => i !== index)
      } : project
    );
    onChange(updated);
  };

 return (
      <div className="form-section">
        {data.length === 0 ? (
          <>
            <div className="section-header-simple">
              <div className="section-title-area">
                <h3>Projects</h3>
                <p className="section-subtitle">Showcase your personal projects, college work, freelance projects, and portfolio items</p>
              </div>
            </div>
        
            <div className="empty-state">
              <FileText size={48} />
              <h3>Add Your Projects</h3>
              <p>Include personal projects, college assignments, freelance work, open source contributions, and portfolio items</p>
              <div className="experience-types">
                <span className="experience-type-tag">🌐 Web Development</span>
                <span className="experience-type-tag">📱 Mobile Apps</span>
                <span className="experience-type-tag">🤖 AI/ML Projects</span>
                <span className="experience-type-tag">🎮 Games</span>
                <span className="experience-type-tag">🔧 Tools & Utilities</span>
              </div>
              <button 
                className="btn btn-primary btn-large" 
                onClick={addProject}
                style={{
                  background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                  border: 'none',
                  color: '#fff'
                }}
              >
                <Plus size={16} />
                Add Your First Project
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="section-header">
              <div className="section-title-area">
                <h3>Projects</h3>
                <p className="section-subtitle">Showcase your personal projects, college work, freelance projects, and portfolio items</p>
              </div>
              <button 
                className="btn btn-add" 
                onClick={addProject}
                style={{
                  background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                  border: 'none',
                  color: '#fff'
                }}
              >
                <Plus size={14} />
                Add Project
              </button>
            </div>
        
            <div className="projects-list">{/* project cards will be here */}</div>
          </>
        )}

        {data.length > 0 && (
        <div className="projects-list" ref={projectsListRef}>
          {data.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={index}
              onUpdate={updateProject}
              onRemove={removeProject}
              onAddTechnology={addTechnology}
              onRemoveTechnology={removeTechnology}
              enhanceWithAI={enhanceWithAI}
              aiEnhancing={aiEnhancing}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Project Card Component
const ProjectCard: React.FC<{
  project: Project;
  index: number;
  onUpdate: (id: string, field: keyof Project, value: any) => void;
  onRemove: (id: string) => void;
  onAddTechnology: (id: string, tech: string) => void;
  onRemoveTechnology: (id: string, index: number) => void;
  enhanceWithAI: (text: string, context: string) => Promise<string>;
  aiEnhancing: boolean;
}> = ({ project, index, onUpdate, onRemove, onAddTechnology, onRemoveTechnology, enhanceWithAI, aiEnhancing }) => {
  
  const [newTech, setNewTech] = useState('');

  const handleAiEnhance = async () => {
    const enhanced = await enhanceWithAI(project.description, 'project description');
    onUpdate(project.id, 'description', enhanced);
  };

  const handleAddTech = () => {
    onAddTechnology(project.id, newTech);
    setNewTech('');
  };

  return (
    <div className="project-card">
      <div className="card-header">
        <h4>Project #{index + 1}</h4>
        <button 
          className="btn btn-danger btn-sm"
          onClick={() => onRemove(project.id)}
        >
          <Trash2 size={14} />
        </button>
      </div>
      
      <div className="form-grid-single">
          <div className="form-group">
            <label className="form-label">Project Name</label>
            <input 
              className="form-input" 
              placeholder="e.g. Food Delivery App, Student Management System, E-commerce Platform" 
              value={project.name}
              onChange={(e) => onUpdate(project.id, 'name', e.target.value)}
            />
          </div>
      
          <div className="form-group">
            <label className="form-label">Live Demo URL</label>
            <input 
              className="form-input" 
              placeholder="https://yourproject.netlify.app"
              value={project.link}
              onChange={(e) => onUpdate(project.id, 'link', e.target.value)}
            />
          </div>
      
          <div className="form-group">
            <label className="form-label">GitHub Repository</label>
            <input 
              className="form-input" 
              placeholder="https://github.com/username/project-name"
              value={project.github}
              onChange={(e) => onUpdate(project.id, 'github', e.target.value)}
            />
          </div>
      </div>

      <div className="form-group">
        <div className="form-label-row">
          <label className="form-label">Project Description</label>
          <button 
            className="btn-ai"
            onClick={handleAiEnhance}
            disabled={aiEnhancing || !project.description}
            title="Get AI suggestions to improve your project description" 
          >
            {aiEnhancing ? (
              <>
                <div className="ai-spinner"></div>
                <span>Enhancing...</span>
              </>
            ) : (
              <>
                <Sparkles size={12} />
                <span>AI Enhance</span>
              </>
            )}
          </button>
        </div>
        <textarea
          className="form-textarea"
          placeholder="Describe your project: what it does, technologies used, your role, and key achievements. Example: 'Built a full-stack food delivery application similar to Zomato using MERN stack. Implemented real-time order tracking, payment integration, and user reviews. Deployed on AWS and achieved 95% uptime.'"
          value={project.description}
          onChange={(e) => onUpdate(project.id, 'description', e.target.value)}
          rows={3}
        />
      </div>

      <div className="form-group" style={{ marginTop: '20px' }}>
        <label className="form-label">Technologies Used</label>
        <div className="skill-input-group">
          <input
            className="form-input"
            placeholder="e.g. React, Node.js, MongoDB, Express, Firebase, AWS..."
            value={newTech}
            onChange={(e) => setNewTech(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTech()}
          />
          <button 
            className="btn btn-primary"
            onClick={handleAddTech}
            style={{
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              border: 'none',
              color: '#fff'
            }}
          >
            <Plus size={14} />
          </button>
        </div>
        
        <div className="skills-list">
          {project.technologies.map((tech, techIndex) => (
            <div key={techIndex} className="skill-tag">
              {tech}
              <button onClick={() => onRemoveTechnology(project.id, techIndex)}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Certifications Form Component
const CertificationsForm: React.FC<{
  data: string[];
  onChange: (data: string[]) => void;
  onComplete: () => void;
  completing: boolean;
  completed: boolean;
}> = ({ data, onChange, onComplete: _onComplete, completing: _completing, completed: _completed }) => {
  
  const [newCert, setNewCert] = useState('');

  const addCertification = () => {
    if (newCert.trim()) {
      onChange([...data, newCert.trim()]);
      setNewCert('');
    }
  };

  const removeCertification = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  return (
    <div className="form-section">
      <div className="section-header">
        <h3>Certifications & Awards</h3>
      </div>

      <div className="form-group">
        <label className="form-label">Add Certification</label>
        <div className="skill-input-group">
          <input
            className="form-input"
            placeholder="e.g. AWS Certified, Google Cloud Professional, PMP, Certified Scrum Master..."
            value={newCert}
            onChange={(e) => setNewCert(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCertification()}
          />
          <button 
            className="btn btn-primary"
            onClick={addCertification}
            style={{
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              border: 'none',
              color: '#fff'
            }}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {data.length > 0 && (
        <div className="certifications-list">
          {data.map((cert, index) => (
            <div key={index} className="certification-item">
              <div className="certification-content">
                <Award size={16} />
                <span>{cert}</span>
              </div>
              <button 
                className="btn btn-danger btn-sm"
                onClick={() => removeCertification(index)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Achievements Form Component
const AchievementsForm: React.FC<{
  data: string[];
  onChange: (data: string[]) => void;
  onComplete: () => void;
  completing: boolean;
  completed: boolean;
}> = ({ data, onChange, onComplete: _onComplete, completing: _completing, completed: _completed }) => {
  
  const [newAchievement, setNewAchievement] = useState('');

  const addAchievement = () => {
    if (newAchievement.trim()) {
      onChange([...data, newAchievement.trim()]);
      setNewAchievement('');
    }
  };

  const removeAchievement = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  return (
    <div className="form-section">
      <div className="section-header">
        <h3>Achievements & Awards</h3>
      </div>

      <div className="form-group">
        <label className="form-label">Add Achievement</label>
        <div className="skill-input-group">
          <input
            className="form-input"
            placeholder="e.g. Employee of the Year, Hackathon Winner, Published Research Paper, Tech Speaker..."
            value={newAchievement}
            onChange={(e) => setNewAchievement(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addAchievement()}
          />
          <button 
            className="btn btn-primary"
            onClick={addAchievement}
            style={{
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              border: 'none',
              color: '#fff'
            }}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {data.length > 0 && (
        <div className="achievements-list">
          {data.map((achievement, index) => (
            <div key={index} className="achievement-item">
              <div className="achievement-content">
                <Award size={16} />
                <span>{achievement}</span>
              </div>
              <button 
                className="btn btn-danger btn-sm"
                onClick={() => removeAchievement(index)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Finalize Form Component
const FinalizeForm: React.FC<{
  resumeData: ResumeData;
  onHandlePrint: () => void;
  onDownloadHTML: () => void;
  completedSteps: Set<string>;
  requiredSteps: ResumeStep[];
}> = ({ resumeData, onHandlePrint, onDownloadHTML, completedSteps, requiredSteps }) => {
  
  const requiredCount = requiredSteps.filter(s => completedSteps.has(s.id)).length;
  const totalRequired = requiredSteps.length;
  const totalSkills = resumeData.skills.technical.length + resumeData.skills.soft.length + resumeData.skills.languages.length;
  const progressPercentage = Math.round((requiredCount / totalRequired) * 100);

  return (
    <div className="form-section" style={{ padding: '0' }}>
      <div style={{
        background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
        borderRadius: '16px',
        padding: '32px',
        marginBottom: '24px',
        color: 'white',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎉</div>
        <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px 0', color: 'white' }}>
          Your Resume is Ready!
        </h2>
        <p style={{ opacity: 0.9, margin: 0, fontSize: '14px' }}>
          Review your information and download your professional resume
        </p>
      </div>

      {/* Progress Section */}
      <div style={{
        background: '#f8fafc',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontWeight: '600', color: '#374151' }}>Completion Progress</span>
          <span style={{ 
            background: progressPercentage === 100 ? '#10b981' : '#f59e0b',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            {progressPercentage}% Complete
          </span>
        </div>
        <div style={{
          height: '8px',
          background: '#e5e7eb',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${progressPercentage}%`,
            height: '100%',
            background: progressPercentage === 100 
              ? 'linear-gradient(90deg, #10b981, #059669)' 
              : 'linear-gradient(90deg, #f59e0b, #d97706)',
            borderRadius: '4px',
            transition: 'width 0.5s ease'
          }} />
        </div>
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px', marginBottom: 0 }}>
          {requiredCount} of {totalRequired} required sections completed
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        marginBottom: '24px'
      }}>
        {[
          { value: resumeData.experiences.length, label: 'Experiences', icon: faBriefcase, color: '#3b82f6' },
          { value: resumeData.education.length, label: 'Education', icon: faGraduationCap, color: '#8b5cf6' },
          { value: totalSkills, label: 'Skills', icon: faBolt, color: '#ec4899' },
          { value: resumeData.projects.length, label: 'Projects', icon: faRocket, color: '#10b981' }
        ].map((stat, i) => (
          <div key={i} style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              background: `${stat.color}15`,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 8px auto'
            }}>
              <FontAwesomeIcon icon={stat.icon} style={{ fontSize: '22px', color: stat.color }} />
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Resume Details */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>
          Resume Overview
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {[
            { icon: <User size={16} />, label: 'Name', value: resumeData.personalInfo.fullName || 'Not provided', color: '#3b82f6' },
            { icon: <Mail size={16} />, label: 'Email', value: resumeData.personalInfo.email || 'Not provided', color: '#10b981' },
            { icon: <MapPin size={16} />, label: 'Location', value: resumeData.personalInfo.location || 'Not provided', color: '#f59e0b' },
            { icon: <Phone size={16} />, label: 'Phone', value: resumeData.personalInfo.phone || 'Not provided', color: '#8b5cf6' },
            { icon: <Award size={16} />, label: 'Certifications', value: `${resumeData.certifications.length} added`, color: '#ec4899' },
            { icon: <Globe size={16} />, label: 'Languages', value: `${resumeData.skills.languages.length} languages`, color: '#06b6d4' }
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              background: '#f8fafc',
              borderRadius: '8px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: `${item.color}15`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: item.color
              }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Download Section */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        borderRadius: '12px',
        padding: '24px',
        textAlign: 'center'
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600', color: 'white' }}>
          Download Your Resume
        </h4>
        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#94a3b8' }}>
          Choose your preferred format to download
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button 
            onClick={onHandlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(236, 72, 153, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Download size={16} />
            Print / Save as PDF
          </button>
          <button 
            onClick={onDownloadHTML}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'transparent',
              border: '2px solid #475569',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#ec4899';
              e.currentTarget.style.background = 'rgba(236, 72, 153, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#475569';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <FileText size={16} />
            Download HTML
          </button>
        </div>
        <p style={{ margin: '16px 0 0 0', fontSize: '11px', color: '#64748b' }}>
          💡 Tip: Use "Print / Save as PDF" for the best quality output
        </p>
      </div>
    </div>
  );
};

// Print Preview Modal with actual page breaks
const PrintPreviewModal: React.FC<{
  resumeData: ResumeData;
  selectedTemplate: string;
  selectedColor: string;
  onClose: () => void;
  onPrint: () => void;
  printRef: React.RefObject<HTMLDivElement | null>;
}> = ({ resumeData, selectedTemplate, selectedColor, onClose, onPrint, printRef }) => {
  const [pages, setPages] = useState<string[]>([]);
  const measureRef = useRef<HTMLDivElement>(null);


  const getSampleData = () => ({
    personalInfo: {
      fullName: resumeData.personalInfo.fullName || 'Your Name',
      email: resumeData.personalInfo.email || 'your.email@gmail.com',
      phone: resumeData.personalInfo.phone || '+91 98765 43210',
      location: resumeData.personalInfo.location || 'Bangalore, Karnataka',
      linkedin: resumeData.personalInfo.linkedin || '',
      github: resumeData.personalInfo.github || '',
      website: resumeData.personalInfo.website || '',
      summary: resumeData.personalInfo.summary || '',
      profilePicture: resumeData.personalInfo.profilePicture,
      title: resumeData.personalInfo.title
    },
    experiences: resumeData.experiences || [],
    education: resumeData.education || [],
    skills: {
      technical: resumeData.skills?.technical || [],
      soft: resumeData.skills?.soft || [],
      languages: resumeData.skills?.languages || []
    },
    projects: resumeData.projects || [],
    certifications: resumeData.certifications || [],
    achievements: resumeData.achievements || []
  });

  const cleanUrl = (url: string) => {
    if (!url) return '';
    return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').split('?')[0].split('#')[0];
  };

  const getTemplateContent = () => {
    const displayData = getSampleData();
    const colors = getColorTheme(selectedColor);
    const templateProps = { displayData, cleanUrl, mode: 'preview' as const, colors };
     
    switch (selectedTemplate) {
      case 'modern': return renderModernTemplate(templateProps);
      case 'professionalBlue': return renderProfessionalBlueTemplate(templateProps);
      case 'creative': return renderCreativeTemplate(templateProps);
      case 'executive': return renderExecutiveTemplate(templateProps);
      case 'minimal': return renderMinimalTemplate(templateProps);
      case 'academic': return renderAcademicTemplate(templateProps);
      case 'bold': return renderBoldTemplate(templateProps);
      case 'elegant': return renderElegantTemplate(templateProps);
      case 'tech': return renderTechTemplate(templateProps);
      case 'startup': return renderStartupTemplate(templateProps);
      case 'consulting': return renderConsultingTemplate(templateProps);
      case 'medical': return renderMedicalTemplate(templateProps);
      case 'finance': return renderFinanceTemplate(templateProps);
      case 'marketing': return renderMarketingTemplate(templateProps);
      case 'data': return renderDataTemplate(templateProps);
      case 'nonprofit': return renderNonprofitTemplate(templateProps);
      default: return renderModernTemplate(templateProps);
    }
  };

  // Paginate content after render
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!measureRef.current) return;
      
      const container = measureRef.current;
      const templateWrapper = container.firstElementChild as HTMLElement;
      if (!templateWrapper) return;

      const templateClass = templateWrapper.className;
      const templateStyle = (templateWrapper.getAttribute('style') || '')
        .replace(/min-height:\s*[^;]+;?/g, '')
        .replace(/height:\s*[^;]+;?/g, '');

      const childNodes = Array.from(templateWrapper.children).filter((node) => {
        const el = node as HTMLElement;
        return el.offsetHeight > 0;
      }) as HTMLElement[];

      // A4 page content height in pixels (297mm - 10mm margins = 287mm ≈ 1080px)
      const PAGE_CONTENT_HEIGHT = 1050;

      const pagesArr: string[] = [];
      let currentPageNodes: string[] = [];
      let currentHeight = 0;

      childNodes.forEach((node) => {
        const style = window.getComputedStyle(node);
        const margin = parseFloat(style.marginTop) + parseFloat(style.marginBottom);
        const nodeHeight = node.offsetHeight + margin;

        if (currentHeight + nodeHeight > PAGE_CONTENT_HEIGHT && currentPageNodes.length > 0) {
          pagesArr.push(`<div class="${templateClass}" style="${templateStyle}">${currentPageNodes.join('')}</div>`);
          currentPageNodes = [node.outerHTML];
          currentHeight = nodeHeight;
        } else {
          currentPageNodes.push(node.outerHTML);
          currentHeight += nodeHeight;
        }
      });

      if (currentPageNodes.length > 0) {
        pagesArr.push(`<div class="${templateClass}" style="${templateStyle}">${currentPageNodes.join('')}</div>`);
      }

      setPages(pagesArr);
    }, 150);

    return () => clearTimeout(timer);
  }, [resumeData, selectedTemplate, selectedColor]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        background: '#1f2937',
        borderBottom: '1px solid #374151'
      }}>
        <h2 style={{ margin: 0, color: 'white', fontSize: '16px' }}>
          📄 Print Preview ({pages.length} {pages.length === 1 ? 'page' : 'pages'})
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onPrint}
            style={{
              padding: '8px 20px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🖨️ Print / Save PDF
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: '#4b5563',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Hidden measuring container */}
      <div
        ref={measureRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          width: '210mm',
          padding: '10mm 12mm',
          background: 'white'
        }}
      >
        {getTemplateContent()}
      </div>

      {/* Visible Pages */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        background: '#4b5563'
      }}>
        {pages.length > 0 ? pages.map((pageHtml, index) => (
          <div key={index} style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute',
              top: '-22px',
              left: '0',
              color: '#d1d5db',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              Page {index + 1} of {pages.length}
            </div>
            <div
              ref={index === 0 ? printRef : undefined}
              className={selectedTemplate === 'professionalBlue' ? 'professionalBlue-print-page' : selectedTemplate === 'tech' ? 'tech-print-page' : ''}
              style={{
                background: 'white',
                width: '210mm',
                minHeight: '297mm',
                padding: (selectedTemplate === 'professionalBlue' || selectedTemplate === 'tech') ? '0' : '10mm 12mm',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
              }}
              dangerouslySetInnerHTML={{ __html: pageHtml }}
            />
          </div>
        )) : (
          <div style={{ color: 'white', padding: '40px' }}>Loading preview...</div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 24px',
        background: '#1f2937',
        borderTop: '1px solid #374151',
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: '12px'
      }}>
        💡 In print dialog, uncheck "Headers and footers" for clean output
      </div>
    </div>
  );
};
const ResumePreview: React.FC<{
  data: ResumeData;
  template: string;
  selectedColor: string;
  zoom: number;
  previewMode?: string;
  isPreparingPrint?: boolean;
  printRef?: React.RefObject<HTMLDivElement | null>;
}> = ({ data, template, selectedColor, zoom, previewMode = 'single', isPreparingPrint: _isPreparingPrint = false, printRef }) => {


  const getSampleData = () => ({
    personalInfo: {
      fullName: data.personalInfo.fullName || 'Your Name',
      email: data.personalInfo.email || 'your.email@gmail.com',
      phone: data.personalInfo.phone || '+91 98765 43210',
      location: data.personalInfo.location || 'Bangalore, Karnataka',
      linkedin: data.personalInfo.linkedin || '',
      github: data.personalInfo.github || '',
      website: data.personalInfo.website || '',
      summary: data.personalInfo.summary || 'Write your professional summary here.',
      profilePicture: data.personalInfo.profilePicture,
      title: data.personalInfo.title
    },
    experiences: data.experiences.length > 0 ? data.experiences : [],
    education: data.education.length > 0 ? data.education : [],
    skills: {
      technical: data.skills.technical.length > 0 ? data.skills.technical : [],
      soft: data.skills.soft.length > 0 ? data.skills.soft : [],
      languages: data.skills.languages.length > 0 ? data.skills.languages : []
    },
    projects: data.projects.length > 0 ? data.projects : [],
    certifications: data.certifications.length > 0 ? data.certifications : [],
    achievements: data.achievements.length > 0 ? data.achievements : []
  });

  const displayData = getSampleData();

  const cleanUrl = (url: string) => {
    if (!url) return '';
    return url
      .replace(/^https?:\/\/(www\.)?/, '')
      .replace(/\/$/, '')
      .split('?')[0]
      .split('#')[0];
  };

  const getTemplateContent = () => {
    const colors = getColorTheme(selectedColor);
    const templateProps = { displayData, cleanUrl, mode: 'preview' as const, colors };
     
    switch (template) {
      case 'modern': return renderModernTemplate(templateProps);
      case 'professionalBlue': return renderProfessionalBlueTemplate(templateProps);
      case 'creative': return renderCreativeTemplate(templateProps);
      case 'executive': return renderExecutiveTemplate(templateProps);
      case 'minimal': return renderMinimalTemplate(templateProps);
      case 'academic': return renderAcademicTemplate(templateProps);
      case 'bold': return renderBoldTemplate(templateProps);
      case 'elegant': return renderElegantTemplate(templateProps);
      case 'tech': return renderTechTemplate(templateProps);
      case 'startup': return renderStartupTemplate(templateProps);
      case 'consulting': return renderConsultingTemplate(templateProps);
      case 'medical': return renderMedicalTemplate(templateProps);
      case 'finance': return renderFinanceTemplate(templateProps);
      case 'marketing': return renderMarketingTemplate(templateProps);
      case 'data': return renderDataTemplate(templateProps);
      case 'nonprofit': return renderNonprofitTemplate(templateProps);
      default: return renderModernTemplate(templateProps);
    }
  };

  return (
    <div className={previewMode === 'single' ? 'preview-mode-single' : ''}>
      <div 
        ref={printRef}
        className="resume-pages" 
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
      >
       <div className={`a4-page ${template === 'professionalBlue' ? 'professionalBlue-page' : template === 'tech' ? 'tech-page' : ''}`}><div className={`a4-content ${template === 'professionalBlue' ? 'professionalBlue-content' : template === 'tech' ? 'tech-content' : ''}`}>{getTemplateContent()}</div></div>
      </div>
    </div>
  );
};

export default ResumeBuilderApp;