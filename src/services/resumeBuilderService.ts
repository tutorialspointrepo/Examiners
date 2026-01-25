// services/resumeBuilderService.ts
import { 
  doc, 
  getDoc,
  setDoc, 
  serverTimestamp,
  getFirestore
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseService } from './firebase_service';

// Types
export interface PersonalInfo {
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

export interface Experience {
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

export interface Education {
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

export interface Project {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  link?: string;
  github?: string;
}

export interface ResumeData {
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
  selectedTemplate?: string;
  selectedColor?: string;
  completedSteps?: string[];
  lastModified?: string;
  createdAt?: string;
  userId?: string;
  organizationId?: string;
}

export interface AIEnhancementRequest {
  type: 'summary' | 'experience' | 'skills' | 'optimize';
  content: string;
  context?: any;
  userId: string;
  organizationId: string;
}

export interface AIEnhancementResponse {
  enhanced: string | string[];
  suggestions?: string[];
  metadata?: any;
}

// Constants
const RESUME_COLLECTION = 'resumes';

// Helper to get Firestore instance
const getDb = () => {
  const app = (firebaseService as any).app;
  if (!app) {
    throw new Error('Firebase not initialized');
  }
  return getFirestore(app);
};

// Helper to get Functions instance
const getFunctionsInstance = () => {
  const app = (firebaseService as any).app;
  if (!app) {
    throw new Error('Firebase not initialized');
  }
  return getFunctions(app, 'us-central1');
};

// Firebase API call for AI enhancement
const callEnhanceResumeContent = async (
  request: AIEnhancementRequest
): Promise<AIEnhancementResponse> => {
  try {
    const functions = getFunctionsInstance();
    const enhanceContentFn = httpsCallable(functions, 'enhanceResumeContent');
    const result = await enhanceContentFn(request);
    return result.data as AIEnhancementResponse;
  } catch (error) {
    console.error('Enhance content API call failed:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to enhance content');
  }
};

// AI Enhancement Service
export class ResumeAIService {
  static async enhancePersonalSummary(
    summary: string,
    personalInfo: Partial<PersonalInfo>,
    userId: string,
    organizationId: string
  ): Promise<string> {
    try {
      const request: AIEnhancementRequest = {
        type: 'summary',
        content: summary,
        context: {
          personalInfo,
          userProfile: { userId, organizationId }
        },
        userId,
        organizationId
      };

      const response = await callEnhanceResumeContent(request);
      return typeof response.enhanced === 'string' ? response.enhanced : summary;
    } catch (error) {
      console.error('Error enhancing personal summary:', error);
      throw new Error('Failed to enhance summary with AI');
    }
  }

  static async enhanceJobDescription(
    description: string,
    position: string,
    company: string,
    userId: string,
    organizationId: string
  ): Promise<string[]> {
    try {
      const request: AIEnhancementRequest = {
        type: 'experience',
        content: description,
        context: {
          position,
          company
        },
        userId,
        organizationId
      };

      const response = await callEnhanceResumeContent(request);
      return Array.isArray(response.enhanced) ? response.enhanced : [description];
    } catch (error) {
      console.error('Error enhancing job description:', error);
      throw new Error('Failed to enhance job description with AI');
    }
  }
}

// Main Resume Service
export class ResumeService {
  // Save resume to Firebase
  static async saveResumeToFirebase(
    userId: string,
    organizationId: string,
    resumeData: Partial<ResumeData>
  ): Promise<void> {
    try {
      const db = getDb();
      const resumeRef = doc(db, RESUME_COLLECTION, `${organizationId}_${userId}`);
    
      const dataToSave: ResumeData = {
        ...resumeData,
        userId,
        organizationId,
        lastModified: new Date().toISOString(),
        createdAt: resumeData.createdAt || new Date().toISOString()
      } as ResumeData;

      await setDoc(resumeRef, {
        ...dataToSave,
        lastModified: serverTimestamp(),
        createdAt: dataToSave.createdAt ? new Date(dataToSave.createdAt) : serverTimestamp()
      }, { merge: true });

    } catch (error) {
      console.error('Error saving resume to Firebase:', error);
      throw new Error('Failed to save resume. Please try again.');
    }
  }

  // Load resume from Firebase
  static async loadResumeFromFirebase(
    userId: string,
    organizationId: string
  ): Promise<ResumeData | null> {
    try {
      const db = getDb();
      const resumeRef = doc(db, RESUME_COLLECTION, `${organizationId}_${userId}`);
      const resumeSnap = await getDoc(resumeRef);

      if (resumeSnap.exists()) {
        const data = resumeSnap.data();
        return {
          ...data,
          lastModified: data.lastModified?.toDate?.()?.toISOString() || data.lastModified,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        } as ResumeData;
      }

      return null;
    } catch (error) {
      console.error('Error loading resume from Firebase:', error);
      throw new Error('Failed to load resume data.');
    }
  }
}

// Export main service functions
export const saveResumeToFirebase = ResumeService.saveResumeToFirebase;
export const loadResumeFromFirebase = ResumeService.loadResumeFromFirebase;

// Export AI enhancement functions
export const enhancePersonalSummary = ResumeAIService.enhancePersonalSummary;
export const enhanceJobDescription = ResumeAIService.enhanceJobDescription;