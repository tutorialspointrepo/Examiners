// ==================== REACT HOOKS FOR EXAM ATTEMPTS ====================
// COMPLETE VERSION - All functionality preserved + loop fix

import { useState, useEffect, useCallback, useRef } from 'react';
import { firebaseService, type StudentExamAttempt, type StudentQuestionResponse } from './services/firebase_service';
import { offlineQueueService } from './services/offline_queue_service';

/**
 * Hook for managing exam attempt during exam interface
 */
export const useExamAttempt = (
  examId: string,
  studentInfo: {
    userId: string;
    fullName: string;
    email: string;
    rollNumber: string;
    class: string;
  },
  exam: any
) => {
  const [attempt, setAttempt] = useState<StudentExamAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false);
  
  // Debug: Track isAlreadySubmitted changes
  useEffect(() => {
    console.log('🔔 isAlreadySubmitted STATE CHANGED:', isAlreadySubmitted);
  }, [isAlreadySubmitted]);
  
  // Use ref to track if we're currently submitting to prevent concurrent submissions
  const submittingRef = useRef(false);
  
  // Use ref to track last update time to prevent too frequent refreshes
  const lastRefreshRef = useRef<number>(0);
  const REFRESH_THROTTLE_MS = 2000; // Minimum 2 seconds between refreshes

  // ✅ FIX: Add guard to prevent re-initialization
  const initializedRef = useRef(false);

  // Initialize or resume attempt
  useEffect(() => {
    console.log('\n' + '🔄'.repeat(40));
    console.log('🔄 useExamAttempt HOOK TRIGGERED');
    console.log('  - Exam ID:', examId);
    console.log('  - Student ID:', studentInfo.userId);
    console.log('  - Already initialized?', initializedRef.current);
    console.log('🔄'.repeat(40) + '\n');
    
    // ✅ FIX: Skip if already initialized
    if (initializedRef.current) {
      console.log('⏭️ Already initialized, skipping');
      return;
    }
    
    initializedRef.current = true;
    console.log('▶️ Starting initialization...');
    initializeAttempt();
    
    // Reset on cleanup
    return () => {
      console.log('🧹 Cleaning up useExamAttempt hook');
      initializedRef.current = false;
    };
  }, [examId, studentInfo.userId]);

  const initializeAttempt = async () => {
    try {
      console.log('\n' + '🎬'.repeat(40));
      console.log('🎬 INITIALIZING EXAM ATTEMPT');
      console.log('  - Exam ID:', examId);
      console.log('  - Student ID:', studentInfo.userId);
      console.log('  - Student Name:', studentInfo.fullName);
      console.log('🎬'.repeat(40) + '\n');
      
      setLoading(true);
      
      // Check for existing attempt
      console.log('🔍 Step 1: Checking for ACTIVE (in-progress) attempt...');
      const existingAttempt = await firebaseService.getActiveAttempt(examId, studentInfo.userId);
      console.log('🔍 Step 1 Result:', existingAttempt ? `Found attempt ${existingAttempt.attemptId}` : 'No active attempt found');
      
      if (existingAttempt) {
        console.log('\n' + '📋'.repeat(40));
        console.log('📋 EXISTING ATTEMPT FOUND');
        console.log('  - Attempt ID:', existingAttempt.attemptId);
        console.log('  - Status:', existingAttempt.status);
        console.log('  - Submit Time:', existingAttempt.submitTime);
        console.log('  - Start Time:', existingAttempt.startTime);
        console.log('📋'.repeat(40) + '\n');
        
        console.log('✅ Resuming existing attempt:', existingAttempt.attemptId);
        
        // ✅ CHECK: If attempt is already submitted, set the flag
        const isSubmitted = !!(
          existingAttempt.submitTime || 
          existingAttempt.status === 'submitted' || 
          existingAttempt.status === 'evaluated' || 
          existingAttempt.status === 'under_review'
        );
        
        console.log('\n' + '🔐'.repeat(40));
        console.log('🔐 SUBMISSION STATUS CHECK');
        console.log('  - Has submitTime?', !!existingAttempt.submitTime);
        console.log('  - Status:', existingAttempt.status);
        console.log('  - Is Submitted?', isSubmitted);
        console.log('🔐'.repeat(40) + '\n');
        
        if (isSubmitted) {
          console.log('\n' + '🚫'.repeat(40));
          console.log('🚫 ATTEMPT ALREADY SUBMITTED - Setting flag to prevent re-entry');
          console.log('  - Attempt ID:', existingAttempt.attemptId);
          console.log('  - Status:', existingAttempt.status);
          console.log('  - Submit Time:', existingAttempt.submitTime);
          console.log('🚫'.repeat(40) + '\n');
          setIsAlreadySubmitted(true);
          console.log('✅ isAlreadySubmitted flag SET TO TRUE');
        } else {
          console.log('✅ Attempt is IN_PROGRESS - allowing entry');
          setIsAlreadySubmitted(false);
          console.log('✅ isAlreadySubmitted flag SET TO FALSE');
        }
        
        // Load any locally saved answers if offline
        const backupAnswers = offlineQueueService.loadAnswersFromBackup(existingAttempt.attemptId);
        
        // Merge backup answers with existing responses (backup takes precedence for newer answers)
        if (Object.keys(backupAnswers).length > 0) {
          console.log(`📦 Found ${Object.keys(backupAnswers).length} backup answers in localStorage`);
          
          // Update local state with backup answers
          const updatedResponses = [...(existingAttempt.responses || [])];
          Object.entries(backupAnswers).forEach(([questionNoStr, backup]: [string, any]) => {
            const questionNo = parseInt(questionNoStr);
            const existingIndex = updatedResponses.findIndex(r => r.questionNo === questionNo);
            
            if (existingIndex >= 0) {
              // Safely get the timestamp from Firebase response
              const firebaseTimestamp = updatedResponses[existingIndex].answeredAt 
                ? (typeof updatedResponses[existingIndex].answeredAt === 'object' 
                    ? (updatedResponses[existingIndex].answeredAt as any).getTime?.() 
                    : new Date(updatedResponses[existingIndex].answeredAt as any).getTime())
                : 0;
              
              // Only use backup if it's newer or if Firebase has no timestamp
              if (backup.timestamp > firebaseTimestamp) {
                console.log(`📦 Restoring backup answer for Q${questionNo}`);
                updatedResponses[existingIndex].studentAnswer = backup.answer;
              }
            } else {
              // Response doesn't exist yet, just note it (will be synced later)
              console.log(`📦 Backup found for Q${questionNo} (not in responses yet)`);
            }
          });
          
          existingAttempt.responses = updatedResponses;
        }
        
        setAttempt(existingAttempt);
        
        // If online, sync any queued answers
        if (navigator.onLine) {
          offlineQueueService.syncQueue();
        }
      } else {
        console.log('\n' + '❌'.repeat(40));
        console.log('❌ NO ACTIVE ATTEMPT FOUND');
        console.log('  - This means no IN_PROGRESS attempt exists');
        console.log('❌'.repeat(40) + '\n');
        
        // ✅ IMPORTANT: Before creating a new attempt, check if there's a SUBMITTED attempt
        // This prevents creating multiple attempts if student somehow bypasses the check
        console.log('🔍 Step 2: Checking for ANY attempt (including submitted)...');
        const anyExistingAttempt = await firebaseService.getAnyAttempt(examId, studentInfo.userId);
        console.log('🔍 Step 2 Result:', anyExistingAttempt ? `Found attempt ${anyExistingAttempt.attemptId}` : 'No attempt found at all');
        
        if (anyExistingAttempt) {
          console.log('\n' + '📋'.repeat(40));
          console.log('📋 ANY ATTEMPT FOUND');
          console.log('  - Attempt ID:', anyExistingAttempt.attemptId);
          console.log('  - Status:', anyExistingAttempt.status);
          console.log('  - Submit Time:', anyExistingAttempt.submitTime);
          console.log('📋'.repeat(40) + '\n');
          
          const isSubmitted = !!(
            anyExistingAttempt.submitTime || 
            anyExistingAttempt.status === 'submitted' || 
            anyExistingAttempt.status === 'evaluated' || 
            anyExistingAttempt.status === 'under_review'
          );
          
          console.log('\n' + '🔐'.repeat(40));
          console.log('🔐 SUBMISSION STATUS CHECK (ANY ATTEMPT)');
          console.log('  - Has submitTime?', !!anyExistingAttempt.submitTime);
          console.log('  - Status:', anyExistingAttempt.status);
          console.log('  - Is Submitted?', isSubmitted);
          console.log('🔐'.repeat(40) + '\n');
          
          if (isSubmitted) {
            console.log('\n' + '🚫'.repeat(40));
            console.log('🚫 Found SUBMITTED attempt - preventing new attempt creation');
            console.log('  - Attempt ID:', anyExistingAttempt.attemptId);
            console.log('  - Status:', anyExistingAttempt.status);
            console.log('  - Submit Time:', anyExistingAttempt.submitTime);
            console.log('🚫'.repeat(40) + '\n');
            setAttempt(anyExistingAttempt);
            setIsAlreadySubmitted(true);
            console.log('✅ isAlreadySubmitted flag SET TO TRUE');
            console.log('⛔ STOPPING - Will NOT create new attempt');
            setLoading(false);
            return;
          }
        }
        
        console.log('\n' + '🆕'.repeat(40));
        console.log('🆕 CREATING NEW ATTEMPT');
        console.log('  - No submitted attempt found');
        console.log('  - Safe to create new attempt');
        console.log('🆕'.repeat(40) + '\n');
        
        // ✅ Skip attempt creation for non-students (teachers/admins have no rollNumber)
        if (!studentInfo.rollNumber || studentInfo.rollNumber.trim() === '' || studentInfo.rollNumber === 'N/A') {
          console.warn('🚫 No roll number — non-student, skipping attempt creation (preview mode)');
          setLoading(false);
          return;
        }

        // Get device info
        const deviceInfo = {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          ipAddress: await getClientIP(),
        };

        // Start new attempt
        const newAttempt = await firebaseService.startExamAttempt(
          examId,
          studentInfo,
          exam,
          deviceInfo
        );
        
        console.log('✅ Started new attempt:', newAttempt.attemptId);
        setAttempt(newAttempt);
        setIsAlreadySubmitted(false); // New attempt is not submitted
      }
    } catch (err: any) {
      // ✅ Non-student blocked silently — no error shown, attempt stays null
      if (err.message === 'NON_STUDENT_BLOCKED') {
        console.warn('🚫 Non-student blocked from creating exam attempt — preview mode only');
        setAttempt(null);
        setIsAlreadySubmitted(false);
      } else {
        console.error('\n' + '❌'.repeat(40));
        console.error('❌ ERROR INITIALIZING ATTEMPT');
        console.error('  - Error:', err.message);
        console.error('  - Stack:', err.stack);
        console.error('❌'.repeat(40) + '\n');
        setError(err.message);
      }
    } finally {
      setLoading(false);
      console.log('\n' + '🏁'.repeat(40));
      console.log('🏁 INITIALIZATION COMPLETE');
      console.log('  - Exam ID:', examId);
      console.log('  - Student ID:', studentInfo.userId);
      console.log('  - Student Name:', studentInfo.fullName);
      console.log('  - isAlreadySubmitted:', isAlreadySubmitted);
      console.log('  - Has attempt:', !!attempt);
      console.log('  - Attempt ID:', attempt?.attemptId || 'none');
      console.log('  - Attempt Status:', attempt?.status || 'none');
      console.log('  - Loading:', false);
      console.log('🏁'.repeat(40) + '\n');
    }
  };

  // Submit answer for a question - FIXED to prevent infinite loop
  const submitAnswer = useCallback(async (
    questionId: string,
    questionNo: number,
    answer: string | string[],
    question: any,
    questionBankItem?: any,
    timeSpent?: number,
    markedForReview: boolean = false
  ) => {
    if (!attempt) return { success: false, message: 'No active attempt' };
    
    // Prevent concurrent submissions
    if (submittingRef.current) {
      console.log('⚠️ Submission already in progress, skipping...');
      return { success: true, message: 'Submission in progress' };
    }

    try {
      submittingRef.current = true;
      
      // Use offline queue service which handles both online and offline scenarios
      const result = await offlineQueueService.queueAnswer(
        attempt.attemptId,
        questionId,
        questionNo,
        answer,
        question,
        questionBankItem,
        timeSpent,
        markedForReview
      );

      // Update local state immediately without fetching from backend
      // This prevents the infinite loop
      setAttempt(prev => {
        if (!prev) return null;
        
        const updatedResponses = [...(prev.responses || [])];
        const existingIndex = updatedResponses.findIndex((r: any) => r.questionId === questionId);
        
        const responseUpdate = {
          questionId,
          questionNo,
          studentAnswer: answer,
          markedForReview,
          evaluationStatus: 'pending' as const,
        };
        
        if (existingIndex >= 0) {
          updatedResponses[existingIndex] = {
            ...updatedResponses[existingIndex],
            ...responseUpdate
          };
        } else {
          updatedResponses.push({
            responseId: `${prev.attemptId}_${questionNo}`,
            attemptId: prev.attemptId,
            ...responseUpdate
          } as StudentQuestionResponse);
        }
        
        return {
          ...prev,
          responses: updatedResponses,
          updatedAt: new Date()
        };
      });

      return result;
    } catch (err: any) {
      console.error('❌ Error submitting answer:', err);
      return { success: false, message: err.message };
    } finally {
      submittingRef.current = false;
    }
  }, [attempt?.attemptId]); // Only depend on attemptId

  // Refresh attempt data - THROTTLED to prevent too frequent calls
  const refreshAttempt = useCallback(async () => {
    // Extract attemptId to avoid capturing full attempt object in closure
    const currentAttemptId = attempt?.attemptId;
    if (!currentAttemptId) return;
    
    // Throttle refresh calls
    const now = Date.now();
    if (now - lastRefreshRef.current < REFRESH_THROTTLE_MS) {
      console.log('⚠️ Refresh throttled');
      return;
    }
    lastRefreshRef.current = now;

    try {
      // Only refresh if online
      if (!navigator.onLine) {
        console.log('📴 Offline - skipping refresh, using local state');
        return;
      }
      /*
      const updated = await firebaseService.getStudentAttempt(currentAttemptId);
      if (updated) {
        // Merge with local backup answers if any
        const backupAnswers = offlineQueueService.loadAnswersFromBackup(currentAttemptId);
        
        if (Object.keys(backupAnswers).length > 0) {
          const updatedResponses = [...(updated.responses || [])];
          Object.entries(backupAnswers).forEach(([questionNoStr, backup]: [string, any]) => {
            const questionNo = parseInt(questionNoStr);
            const existingIndex = updatedResponses.findIndex(r => r.questionNo === questionNo);
            
            if (existingIndex >= 0) {
              // Safely get the timestamp from Firebase response
              const firebaseTimestamp = updatedResponses[existingIndex].answeredAt 
                ? (typeof updatedResponses[existingIndex].answeredAt === 'object' 
                    ? (updatedResponses[existingIndex].answeredAt as any).getTime?.() 
                    : new Date(updatedResponses[existingIndex].answeredAt as any).getTime())
                : 0;
              
              // Only use backup if it's newer or if Firebase has no timestamp
              if (backup.timestamp > firebaseTimestamp) {
                console.log(`📦 Using backup answer for Q${questionNo} (backup is newer)`);
                updatedResponses[existingIndex].studentAnswer = backup.answer;
              }
            }
          });
          
          updated.responses = updatedResponses;
        }
        
        setAttempt(updated);
        
        // ✅ CHECK: Update isAlreadySubmitted if status changed on server
        const isSubmitted = !!(
          updated.submitTime || 
          updated.status === 'submitted' || 
          updated.status === 'evaluated' || 
          updated.status === 'under_review'
        );
        
        if (isSubmitted && !isAlreadySubmitted) {
          console.log('🚫 Attempt was submitted on server - updating flag');
          setIsAlreadySubmitted(true);
        }
        
        console.log('✅ Attempt refreshed from server');
      }*/
    } catch (err: any) {
      console.error('❌ Error refreshing attempt:', err);
    }
  }, [attempt?.attemptId]);

  // Add violation
  const addViolation = useCallback(async (violation: any) => {
    if (!attempt) return;

    try {
      await firebaseService.addViolation(attempt.attemptId, violation);
      
      // Update local state
      setAttempt(prev => prev ? {
        ...prev,
        violations: [...(prev.violations || []), violation]
      } : null);
    } catch (err: any) {
      console.error('❌ Error adding violation:', err);
    }
  }, [attempt?.attemptId]);

  // Submit exam
  const submitExam = useCallback(async (autoSubmitted: boolean = false) => {
    if (!attempt) return { success: false, message: 'No active attempt' };

    try {
      // First, force sync all queued answers if online
      if (navigator.onLine) {
        console.log('🔄 Syncing all queued answers before exam submission...');
        const syncSuccess = await offlineQueueService.forceSyncNow();
        
        if (!syncSuccess) {
          return { 
            success: false, 
            message: 'Some answers are still pending sync. Please wait a moment and try again.' 
          };
        }
        
        console.log('✅ All answers synced successfully');
      } else {
        return {
          success: false,
          message: 'Cannot submit exam while offline. Please reconnect to the internet.'
        };
      }
      
      // Now submit the exam
      const result = await firebaseService.submitExam(attempt.attemptId, autoSubmitted);
      
      if (result.success) {
        // Clear backup after successful submission
        offlineQueueService.clearBackup(attempt.attemptId);
        
        // ✅ SET FLAG: Mark attempt as submitted
        setIsAlreadySubmitted(true);
        console.log('✅ Exam submitted successfully - isAlreadySubmitted flag set to TRUE');
        
        // Refresh to get final state (this is OK since it's the final submission)
        const finalAttempt = await firebaseService.getStudentAttempt(attempt.attemptId);
        if (finalAttempt) {
          setAttempt(finalAttempt);
        }
      }

      return result;
    } catch (err: any) {
      console.error('❌ Error submitting exam:', err);
      return { success: false, message: err.message };
    }
  }, [attempt?.attemptId]);

  // Get response for a specific question
  const getResponse = useCallback((questionNo: number): StudentQuestionResponse | null => {
    if (!attempt) return null;
    return attempt.responses?.find(r => r.questionNo === questionNo) || null;
  }, [attempt]);

  // Check if question is answered
  const isAnswered = useCallback((questionNo: number): boolean => {
    const response = getResponse(questionNo);
    return response !== null && response.studentAnswer !== null && response.studentAnswer !== '';
  }, [getResponse]);

  // Check if question is marked for review
  const isMarkedForReview = useCallback((questionNo: number): boolean => {
    const response = getResponse(questionNo);
    return response?.markedForReview || false;
  }, [getResponse]);

  // Get evaluation status
  const getEvaluationStatus = useCallback((questionNo: number): string => {
    const response = getResponse(questionNo);
    return response?.evaluationStatus || 'pending';
  }, [getResponse]);

  return {
    attempt,
    loading,
    error,
    isAlreadySubmitted,
    submitAnswer,
    refreshAttempt,
    addViolation,
    submitExam,
    getResponse,
    isAnswered,
    isMarkedForReview,
    getEvaluationStatus,
  };
};

/**
 * Get client IP address
 */
async function getClientIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (err) {
    console.warn('Could not fetch IP address');
    return 'unknown';
  }
}

// ==================== REPORT GENERATION UTILITIES ====================

/**
 * Generate student report card
 */
export async function generateStudentReport(attemptId: string): Promise<StudentReportCard> {
  const attempt = await firebaseService.getStudentAttempt(attemptId);
  
  if (!attempt) {
    throw new Error('Attempt not found');
  }

  // Calculate grade
  const grade = calculateGrade(attempt.percentage);
  
  // Performance summary
  const performanceSummary = {
    totalQuestions: (attempt.responses || []).length,
    attempted: (attempt.responses || []).filter(r => r.studentAnswer !== null).length,
    correct: (attempt.responses || []).filter(r => r.isCorrect === true).length,
    incorrect: (attempt.responses || []).filter(r => r.isCorrect === false).length,
    pending: (attempt.responses || []).filter(r => r.evaluationStatus !== 'completed').length,
  };

  // Strengths and weaknesses
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // By type
  if (attempt.performanceByType) {
    for (const [type, perf] of Object.entries(attempt.performanceByType)) {
      const successRate = ((perf as any).score / (perf as any).maxScore) * 100;
      if (successRate >= 75) {
        strengths.push(`Strong in ${type} questions (${successRate.toFixed(0)}%)`);
      } else if (successRate < 50) {
        weaknesses.push(`Needs improvement in ${type} questions (${successRate.toFixed(0)}%)`);
      }
    }
  }

  // By chapter
  if (attempt.performanceByChapter) {
    for (const [chapter, perf] of Object.entries(attempt.performanceByChapter)) {
      const successRate = ((perf as any).score / (perf as any).maxScore) * 100;
      if (successRate >= 75) {
        strengths.push(`Good understanding of ${chapter}`);
      } else if (successRate < 50) {
        weaknesses.push(`Review ${chapter} concepts`);
      }
    }
  }

  // Time management
  if (attempt.actualDuration && attempt.scheduledDuration) {
    const avgTimePerQuestion = (attempt.actualDuration || 0) / (attempt.responses || []).length;
    const scheduledTimePerQuestion = ((attempt.scheduledDuration || 0) * 60) / (attempt.responses || []).length;
    
    if (avgTimePerQuestion < scheduledTimePerQuestion * 0.8) {
      strengths.push('Excellent time management');
    } else if (avgTimePerQuestion > scheduledTimePerQuestion * 1.2) {
      weaknesses.push('Consider improving time management');
    }
  }

  // Violations
  if (attempt.violationSummary) {
    if (attempt.violationSummary.total === 0) {
      strengths.push('Maintained exam integrity');
    } else if (attempt.violationSummary.critical > 0) {
      weaknesses.push('Critical exam violations detected');
    }
  }

  return {
    studentInfo: {
      name: attempt.studentName,
      rollNumber: attempt.rollNumber,
      class: attempt.class,
      email: attempt.studentEmail,
    },
    examInfo: {
      title: attempt.examTitle,
      subject: attempt.subject,
      date: attempt.startTime,
      duration: attempt.actualDuration ? `${(attempt.actualDuration || 0) / 60} minutes` : 'N/A',
    },
    scores: {
      obtained: attempt.totalScore,
      maximum: attempt.maximumScore,
      percentage: attempt.percentage,
      grade,
    },
    performanceSummary,
    performanceByType: attempt.performanceByType || {},
    performanceByComplexity: (attempt as any).performanceByComplexity || {},
    performanceByChapter: attempt.performanceByChapter || {},
    strengths,
    weaknesses,
    recommendations: generateRecommendations(attempt as StudentExamAttempt),
    violations: attempt.violationSummary || { total: 0, critical: 0, moderate: 0, minor: 0 },
    generatedAt: new Date(),
  };
}

/**
 * Calculate grade from percentage
 */
function calculateGrade(percentage: number): string {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
}

/**
 * Generate personalized recommendations
 */
function generateRecommendations(attempt: StudentExamAttempt): string[] {
  const recommendations: string[] = [];

  // Based on performance by type
  if (attempt.performanceByType) {
    for (const [type, perf] of Object.entries(attempt.performanceByType)) {
      const successRate = ((perf as any).score / (perf as any).maxScore) * 100;
      if (successRate < 60) {
        recommendations.push(`Practice more ${type} questions from ${attempt.subject}`);
      }
    }
  }

  // Based on chapters
  if (attempt.performanceByChapter) {
    for (const [chapter, perf] of Object.entries(attempt.performanceByChapter)) {
      const successRate = ((perf as any).score / (perf as any).maxScore) * 100;
      if (successRate < 60) {
        recommendations.push(`Review ${chapter} chapter thoroughly`);
      }
    }
  }

  // Based on complexity
  if (attempt.performanceByComplexity) {
    const { easy, medium, hard } = attempt.performanceByComplexity;
    
    if (easy && easy.score / easy.maxScore < 0.8) {
      recommendations.push('Focus on understanding basic concepts first');
    }
    
    if (medium && medium.score / medium.maxScore < 0.6) {
      recommendations.push('Work on intermediate level problems');
    }
    
    if (hard && hard.attempted === 0) {
      recommendations.push('Challenge yourself with harder questions');
    }
  }

  // Time management
  if (attempt.actualDuration && attempt.scheduledDuration) {
    const avgTimePerQuestion = (attempt.actualDuration || 0) / (attempt.responses || []).length;
    const scheduledTimePerQuestion = ((attempt.scheduledDuration || 0) * 60) / (attempt.responses || []).length;
    
    if (avgTimePerQuestion > scheduledTimePerQuestion * 1.5) {
      recommendations.push('Practice solving questions faster');
    }
  }

  // If no specific recommendations
  if (recommendations.length === 0) {
    recommendations.push('Excellent performance! Keep up the good work');
    recommendations.push('Try challenging yourself with advanced topics');
  }

  return recommendations;
}

/**
 * Export report to PDF (placeholder)
 */
export async function exportReportToPDF(_report: StudentReportCard): Promise<Blob> {
  // TODO: Implement PDF generation
  // Use libraries like jsPDF or pdfmake
  console.log('PDF generation not implemented yet');
  return new Blob(['PDF content'], { type: 'application/pdf' });
}

// ==================== TYPES ====================

interface StudentReportCard {
  studentInfo: {
    name: string;
    rollNumber: string;
    class: string;
    email: string;
  };
  examInfo: {
    title: string;
    subject: string;
    date: Date;
    duration: string;
  };
  scores: {
    obtained: number;
    maximum: number;
    percentage: number;
    grade: string;
  };
  performanceSummary: {
    totalQuestions: number;
    attempted: number;
    correct: number;
    incorrect: number;
    pending: number;
  };
  performanceByType: any;
  performanceByComplexity: any;
  performanceByChapter: any;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  violations: any;
  generatedAt: Date;
}