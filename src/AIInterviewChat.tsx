import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faPaperPlaneTop,
  faRobot,
  faUser,
  faCircleCheck,
  faCircleXmark,
  faShieldCheck,
  faTriangleExclamation,
  faTrophy,
  faSpinner,
} from '@fortawesome/sharp-light-svg-icons';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseService } from './services/firebase_service';
import ReactMarkdown from 'react-markdown';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  questionNumber?: number;
  isQuestion?: boolean;
}

interface InterviewQuestion {
  questionNumber: number;
  question: string;
  studentAnswer: string;
  isCorrect: boolean;
  aiEvaluation: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  answeredAt: Date;
}

interface GateConfig {
  gate: number;
  questionsAtGate: number;
  requiredCorrect: number;
  nextGateQuestions: number;
}

interface AIInterviewChatProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: number;
  courseSlug: string;
  courseName: string;
  enrollmentId: string;
  topicsContext: string[];
  userId: string;
  collegeId: string;
  userName: string;
  brandTheme: {
    colors: { primary: string; secondary: string };
    gradients: { primary: string };
  };
  onInterviewComplete?: () => void;
}

// ─── Gate Logic (unchanged) ─────────────────────────────────────────────────

const GATES: GateConfig[] = [
  { gate: 1, questionsAtGate: 3, requiredCorrect: 1, nextGateQuestions: 5 },
  { gate: 2, questionsAtGate: 5, requiredCorrect: 3, nextGateQuestions: 7 },
  { gate: 3, questionsAtGate: 7, requiredCorrect: 5, nextGateQuestions: 10 },
  { gate: 4, questionsAtGate: 10, requiredCorrect: 7, nextGateQuestions: 12 },
];

const MAX_QUESTIONS = 12;

function evaluateGate(
  totalAsked: number,
  correctCount: number
): { shouldContinue: boolean; currentGate: number; reason?: string } {
  for (const gate of GATES) {
    if (totalAsked === gate.questionsAtGate) {
      if (correctCount >= gate.requiredCorrect) {
        return { shouldContinue: true, currentGate: gate.gate + 1 };
      } else {
        return {
          shouldContinue: false,
          currentGate: gate.gate,
          reason: `You answered ${correctCount} out of ${gate.questionsAtGate} correctly. You needed at least ${gate.requiredCorrect} to continue.`,
        };
      }
    }
  }
  if (totalAsked >= MAX_QUESTIONS) {
    return { shouldContinue: false, currentGate: 5, reason: 'Interview complete! All 12 questions answered.' };
  }
  return { shouldContinue: true, currentGate: Math.floor(totalAsked / 3) + 1 };
}

function getPerformanceLevel(score: number): 'needs-improvement' | 'developing' | 'proficient' | 'excellent' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'proficient';
  if (score >= 40) return 'developing';
  return 'needs-improvement';
}

// ─── Component ───────────────────────────────────────────────────────────────

const AIInterviewChat: React.FC<AIInterviewChatProps> = ({
  isOpen,
  onClose,
  courseId,
  courseSlug,
  courseName,
  enrollmentId,
  topicsContext,
  userId,
  collegeId,
  userName,
  brandTheme: _brandTheme,
  onInterviewComplete,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestionNum, setCurrentQuestionNum] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [isInterviewEnded, setIsInterviewEnded] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isAnimatedIn, setIsAnimatedIn] = useState(false);
  // Store last user message for tracking Q&A pairs
  const lastUserMessageRef = useRef<string>('');
  // Store last question text from AI for tracking
  const lastQuestionTextRef = useRef<string>('');
  // Refs for tracking inside async callbacks (React state is stale in closures)
  const questionsRef = useRef<InterviewQuestion[]>([]);
  const correctCountRef = useRef(0);
  const currentQuestionNumRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Slide-in animation
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimatedIn(true));
      });
    } else {
      setIsAnimatedIn(false);
    }
  }, [isOpen]);

  // Focus input
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Initialize interview on open
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isOpen && !isInitializedRef.current) {
      isInitializedRef.current = true;
      initializeInterview();
    }
    if (!isOpen) {
      // Reset everything when modal closes
      isInitializedRef.current = false;
      setMessages([]);
      setInputMessage('');
      setInterviewId(null);
      setInterviewStarted(false);
      setQuestions([]);
      setCurrentQuestionNum(0);
      setCorrectCount(0);
      setIsInterviewEnded(false);
      setFeedback(null);
      setShowFeedback(false);
      setShowExitConfirm(false);
      lastUserMessageRef.current = '';
      lastQuestionTextRef.current = '';
      questionsRef.current = [];
      correctCountRef.current = 0;
      currentQuestionNumRef.current = 0;
    }
  }, [isOpen]);

  // ─── AI Communication ─────────────────────────────────────────────────────

  const callAI = useCallback(async (
    purpose: string,
    payload: Record<string, any>
  ) => {
    try {
      const functions = getFunctions();
      const aiInterviewFn = httpsCallable(functions, 'aiInterviewChat');
      const result = await aiInterviewFn({ purpose, ...payload });
      return (result.data as any);
    } catch (error) {
      console.error('AI Interview call error:', error);
      return null;
    }
  }, []);

  const initializeInterview = async () => {
    const id = await firebaseService.createAIInterview({
      userId,
      collegeId,
      courseId,
      courseSlug,
      courseName,
      enrollmentId,
      topicsContext,
    });
    setInterviewId(id);

    // Send initial chat to get AI's greeting (no user message yet)
    setIsLoading(true);
    try {
      const result = await callAI('chat', {
        courseName,
        topicsContext,
        userName,
        maxQuestions: MAX_QUESTIONS,
        conversationHistory: [],
        lastQuestionNumber: 0,
      });

      if (result?.response) {
        const aiMsg: ChatMessage = {
          id: 'welcome-1',
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
          questionNumber: result.meta?.questionNumber || 0,
          isQuestion: (result.meta?.questionNumber || 0) > 0,
        };
        setMessages([aiMsg]);

        // If AI already asked Q1 in the greeting (unlikely but handle it)
        if (result.meta?.questionNumber > 0) {
          currentQuestionNumRef.current = result.meta.questionNumber;
          setCurrentQuestionNum(result.meta.questionNumber);
          setInterviewStarted(true);
        }
      } else {
        // Fallback greeting
        const fallbackMsg: ChatMessage = {
          id: 'welcome-1',
          role: 'assistant',
          content: `Hello ${userName}! 👋 I'm Mac, your interviewer today for **${courseName}**. Shall we get started?`,
          timestamp: new Date(),
        };
        setMessages([fallbackMsg]);
      }
    } catch (error) {
      console.error('Error initializing interview:', error);
      const fallbackMsg: ChatMessage = {
        id: 'welcome-1',
        role: 'assistant',
        content: `Hello ${userName}! 👋 I'm Mac, your interviewer today for **${courseName}**. Shall we get started?`,
        timestamp: new Date(),
      };
      setMessages([fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Send Message (single unified flow) ────────────────────────────────────

  const sendMessage = async () => {
    const text = inputMessage.trim();
    if (!text || isLoading || isInterviewEnded) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    lastUserMessageRef.current = text;

    setIsLoading(true);
    try {
      // Build conversation history from all messages
      const conversationHistory = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const result = await callAI('chat', {
        interviewId,
        courseName,
        topicsContext,
        userName,
        maxQuestions: MAX_QUESTIONS,
        conversationHistory,
        lastQuestionNumber: currentQuestionNumRef.current,
      });

      if (!result?.response) {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: "I'm sorry, I had a brief moment there. Could you repeat your answer?",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMsg]);
        setIsLoading(false);
        return;
      }

      const meta = result.meta || {};
      const newQuestionNum = meta.questionNumber || 0;
      const isCorrectRaw = meta.isCorrect;
      const topic = meta.topic || '';
      const aiEnded = meta.isEnded || false;

      console.log('🎤 [AI Interview] Backend response:', {
        meta: result.meta,
        newQuestionNum,
        isCorrectRaw,
        topic,
        aiEnded,
        currentQuestionNumRef: currentQuestionNumRef.current,
        correctCountRef: correctCountRef.current,
        questionsTracked: questionsRef.current.length,
        willTrack: currentQuestionNumRef.current > 0 && newQuestionNum > currentQuestionNumRef.current,
      });

      // Track answer if user was answering a question (currentQuestionNumRef > 0)
      // The AI response contains feedback + next question, so we track the answered question
      if (currentQuestionNumRef.current > 0 && newQuestionNum > currentQuestionNumRef.current) {
        const answeredQNum = currentQuestionNumRef.current;
        // If backend couldn't determine correctness, default to false
        const isCorrect = isCorrectRaw === true;

        // Determine difficulty based on question number
        let difficulty: 'easy' | 'medium' | 'hard' = 'easy';
        if (answeredQNum > 7) difficulty = 'hard';
        else if (answeredQNum > 3) difficulty = 'medium';

        const questionRecord: InterviewQuestion = {
          questionNumber: answeredQNum,
          question: lastQuestionTextRef.current || `Question ${answeredQNum}`,
          studentAnswer: lastUserMessageRef.current,
          isCorrect,
          aiEvaluation: '',
          topic,
          difficulty,
          answeredAt: new Date(),
        };

        // Update refs (always current, no stale closure issues)
        questionsRef.current = [...questionsRef.current, questionRecord];
        correctCountRef.current = correctCountRef.current + (isCorrect ? 1 : 0);

        const updatedQuestions = questionsRef.current;
        const newCorrectCount = correctCountRef.current;

        // Sync React state for UI
        setQuestions(updatedQuestions);
        setCorrectCount(newCorrectCount);

        // Update Firestore
        if (interviewId) {
          await firebaseService.updateAIInterview(interviewId, {
            questions: updatedQuestions.map(q => ({
              ...q,
              answeredAt: q.answeredAt.toISOString(),
            })),
            totalQuestions: answeredQNum,
            correctAnswers: newCorrectCount,
            score: Math.round((newCorrectCount / answeredQNum) * 100),
            currentGate: Math.floor(answeredQNum / 3) + 1,
          });
        }

        // Check gate logic
        const gateResult = evaluateGate(answeredQNum, newCorrectCount);

        if (!gateResult.shouldContinue || aiEnded) {
          // Interview ends — strip the next question from AI's response, only show evaluation feedback
          let feedbackOnly = result.response;
          // Remove everything from "Question-N:" onwards (the AI already asked the next question)
          const nextQMatch = feedbackOnly.match(/\*\*Question[-\s]?\d+/i);
          if (nextQMatch && nextQMatch.index !== undefined) {
            feedbackOnly = feedbackOnly.substring(0, nextQMatch.index).trim();
          }

          if (feedbackOnly) {
            const aiMsg: ChatMessage = {
              id: `ai-${Date.now()}`,
              role: 'assistant',
              content: feedbackOnly,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, aiMsg]);
          }
          await endInterview(updatedQuestions, newCorrectCount, answeredQNum, gateResult.currentGate, gateResult.reason);
          setIsLoading(false);
          return;
        }
      }

      // Update question tracking
      if (newQuestionNum > 0) {
        currentQuestionNumRef.current = newQuestionNum;
        setCurrentQuestionNum(newQuestionNum);
        setInterviewStarted(true);
        // Extract question text for tracking (text after "Question-N" heading)
        const qMatch = result.response.match(/\*\*Question[-\s]?\d+[:\*]*\*\*\s*([\s\S]*?)$/i);
        if (qMatch) {
          lastQuestionTextRef.current = qMatch[1].trim();
        }
      }

      // Check if AI says interview is done
      if (aiEnded && !isInterviewEnded) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMsg]);
        await endInterview(questionsRef.current, correctCountRef.current, currentQuestionNumRef.current, 5, 'Interview complete!');
        setIsLoading(false);
        return;
      }

      // Normal message — show AI's response
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
        questionNumber: newQuestionNum > 0 ? newQuestionNum : undefined,
        isQuestion: newQuestionNum > 0,
      };
      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
      console.error('Error in chat:', error);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "Sorry, I encountered an issue. Please try sending your response again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const endInterview = async (
    allQuestions: InterviewQuestion[],
    totalCorrect: number,
    totalAsked: number,
    endedAtGate: number,
    _reason?: string
  ) => {
    setIsInterviewEnded(true);

    const score = totalAsked > 0 ? Math.round((totalCorrect / totalAsked) * 100) : 0;
    const level = getPerformanceLevel(score);

    // Generate feedback via AI
    let feedbackData: any = null;
    try {
      const result = await callAI('generate_feedback', {
        interviewId,
        courseName,
        questions: allQuestions.map(q => ({
          question: q.question,
          answer: q.studentAnswer,
          isCorrect: q.isCorrect,
          topic: q.topic,
        })),
        score,
        totalCorrect,
        totalAsked,
        terminatedAtGate: endedAtGate < 5 ? endedAtGate : null,
      });

      feedbackData = {
        overallSummary: result?.overallSummary || `You scored ${score}% answering ${totalCorrect} out of ${totalAsked} questions correctly.`,
        strengths: result?.strengths || [],
        weaknesses: result?.weaknesses || [],
        motivationalMessage: result?.motivationalMessage || 'Keep practicing and you\'ll improve!',
        topicsToReview: result?.topicsToReview || [],
        performanceLevel: level,
      };
    } catch (e) {
      feedbackData = {
        overallSummary: `You scored ${score}% answering ${totalCorrect} out of ${totalAsked} questions correctly.`,
        strengths: [],
        weaknesses: [],
        motivationalMessage: 'Keep practicing and you\'ll improve!',
        topicsToReview: [],
        performanceLevel: level,
      };
    }

    setFeedback(feedbackData);

    // Build gate results
    const gateResults: Record<string, any> = {};
    GATES.forEach(g => {
      if (totalAsked >= g.questionsAtGate) {
        const correctAtGate = allQuestions.slice(0, g.questionsAtGate).filter(q => q.isCorrect).length;
        gateResults[`gate${g.gate}`] = {
          passed: correctAtGate >= g.requiredCorrect,
          correctCount: correctAtGate,
          requiredCount: g.requiredCorrect,
        };
      }
    });

    // Update Firestore with final data
    if (interviewId) {
      await firebaseService.updateAIInterview(interviewId, {
        status: endedAtGate < 5 ? 'terminated' : 'completed',
        completedAt: new Date().toISOString(),
        totalQuestions: totalAsked,
        correctAnswers: totalCorrect,
        score,
        gateResults,
        terminatedAtGate: endedAtGate < 5 ? endedAtGate : null,
        feedback: feedbackData,
        questions: allQuestions.map(q => ({
          ...q,
          answeredAt: q.answeredAt.toISOString(),
        })),
      });
    }

    // Show graceful closing message from Mac
    const displayName = userName || 'there';
    let closingMessage = '';
    if (score >= 80) {
      closingMessage = `That wraps up our interview, ${displayName}! 🎉\n\nI have to say, you did a fantastic job — you really know your stuff! You scored **${score}%** (${totalCorrect}/${totalAsked} correct).\n\nI've prepared a detailed feedback report for you. Click **"View Feedback"** below to see your strengths and areas to explore further. Keep up the great work! 💪`;
    } else if (score >= 60) {
      closingMessage = `Alright ${displayName}, that brings us to the end of the interview! 👏\n\nYou did well — there's a solid foundation here. You scored **${score}%** (${totalCorrect}/${totalAsked} correct).\n\nI've put together a feedback report with some pointers on where you can sharpen your skills. Click **"View Feedback"** below to check it out. You're on the right track!`;
    } else if (score >= 40) {
      closingMessage = `Thank you for your time, ${displayName}! 🙏\n\nI appreciate you giving it your best shot. You scored **${score}%** (${totalCorrect}/${totalAsked} correct). There are definitely some areas where a bit more practice will make a big difference.\n\nI've prepared a feedback report with specific topics to review — click **"View Feedback"** below. Don't be discouraged, every expert was once a beginner! 🌱`;
    } else {
      closingMessage = `Thank you for sitting through this interview, ${displayName}! 🙏\n\nI know some of those questions were tough, and I appreciate your honesty. You scored **${score}%** (${totalCorrect}/${totalAsked} correct).\n\nThe good news? I've put together a detailed feedback report with exactly what to focus on. Click **"View Feedback"** below — a little targeted practice and you'll see a huge improvement next time. I believe in you! 💪`;
    }

    const endMsg: ChatMessage = {
      id: 'interview-end',
      role: 'assistant',
      content: closingMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, endMsg]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClose = () => {
    if (interviewStarted && !isInterviewEnded) {
      setShowExitConfirm(true);
      return;
    }
    // Notify parent to refresh dashboard when closing after interview
    if (isInterviewEnded) {
      onInterviewComplete?.();
    }
    onClose();
  };

  const confirmExit = () => {
    setShowExitConfirm(false);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] transition-opacity duration-300"
        style={{ opacity: isAnimatedIn ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className="fixed right-2 top-2 bottom-2 z-[10000] w-[calc(100%-16px)] max-w-[38rem] bg-white shadow-2xl overflow-hidden rounded-2xl flex flex-col transition-all duration-300 ease-out"
        style={{
          transform: isAnimatedIn ? 'translateX(0)' : 'translateX(100%)',
          opacity: isAnimatedIn ? 1 : 0,
        }}
      >

        {/* Header */}
        <div
          className="px-5 py-3 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
          style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20">
              <FontAwesomeIcon icon={faRobot} className="text-white text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AI Interview</h2>
              <p className="text-xs text-white/80 truncate max-w-[280px]">{courseName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress indicator */}
            {interviewStarted && (
              <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg">
                <span className="text-xs font-semibold text-white">Q {currentQuestionNum}/{MAX_QUESTIONS}</span>
                <span className="text-xs text-white/70">•</span>
                <span className="text-xs font-semibold text-white">{correctCount} ✓</span>
              </div>
            )}
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <FontAwesomeIcon icon={faXmark} className="text-white text-lg" />
            </button>
          </div>
        </div>

        {/* Gate Progress Bar */}
        {interviewStarted && !isInterviewEnded && (
          <div className="px-5 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <span>Interview Progress</span>
              <span className="ml-auto font-medium text-gray-700">
                Gate {Math.min(Math.floor(questions.length / 3) + 1, 4)} of 4
              </span>
            </div>
            <div className="flex gap-1">
              {GATES.map((g, i) => {
                const answeredCount = questions.length;
                const isActive = answeredCount >= (i > 0 ? GATES[i - 1].questionsAtGate : 0);
                const isPassed = answeredCount > g.questionsAtGate;
                return (
                  <div
                    key={g.gate}
                    className="flex-1 h-2 rounded-full overflow-hidden bg-gray-200"
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: isPassed ? '100%' : (isActive ? `${Math.min(((answeredCount - (i > 0 ? GATES[i - 1].questionsAtGate : 0)) / (g.questionsAtGate - (i > 0 ? GATES[i - 1].questionsAtGate : 0))) * 100, 100)}%` : '0%'),
                        background: isPassed ? '#22c55e' : 'linear-gradient(90deg, #8b5cf6, #7c3aed)',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className="w-full">
              <div
                className={`w-full rounded-xl shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-gray-900 text-white'
                    : msg.isQuestion
                      ? 'bg-purple-50 border border-purple-200 text-gray-900'
                      : 'bg-gray-50 text-gray-900 border border-gray-200'
                }`}
              >
                {/* Message header */}
                <div className={`flex items-center justify-between px-4 py-2 border-b ${
                  msg.role === 'user' ? 'border-white/10' : msg.isQuestion ? 'border-purple-200' : 'border-gray-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon
                      icon={msg.role === 'user' ? faUser : faRobot}
                      className={`text-xs ${msg.role === 'user' ? 'text-white/70' : 'text-purple-500'}`}
                    />
                    <span className={`text-xs font-medium ${msg.role === 'user' ? 'text-white/70' : 'text-gray-500'}`}>
                      {msg.role === 'user' ? 'You' : 'AI Interviewer'}
                    </span>
                  </div>
                  {msg.questionNumber != null && msg.questionNumber > 0 && (
                    <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                      Q{msg.questionNumber}
                    </span>
                  )}
                </div>

                {/* Message body */}
                <div className="px-4 py-3">
                  {msg.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">{msg.content}</p>
                  ) : (
                    <div className="text-sm prose prose-sm max-w-none leading-relaxed [&_:not(pre)>code]:before:content-none [&_:not(pre)>code]:after:content-none [&_:not(pre)>code]:bg-gray-100 [&_:not(pre)>code]:text-purple-700 [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:text-xs [&_:not(pre)>code]:font-semibold [&_pre>code]:bg-transparent [&_pre>code]:p-0 [&_pre>code]:text-inherit">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="w-full">
              <div className="w-full rounded-xl shadow-sm bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200">
                  <FontAwesomeIcon icon={faRobot} className="text-xs text-purple-500" />
                  <span className="text-xs font-medium text-gray-500">AI Interviewer</span>
                </div>
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Feedback Overlay Modal */}
        {isInterviewEnded && feedback && showFeedback && (
          <div className="absolute inset-0 z-50 flex flex-col bg-white rounded-2xl overflow-hidden">
            {/* Feedback Header */}
            <div className="flex-shrink-0" style={{
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              padding: '20px 24px',
            }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Interview Report</h2>
                <button
                  onClick={() => setShowFeedback(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-white text-lg" />
                </button>
              </div>
              {/* Score + Stats Row */}
              <div className="flex items-center gap-5">
                {/* Score Ring */}
                <div className="relative w-[72px] h-[72px] flex-shrink-0">
                  <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
                    <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
                    <circle
                      cx="36" cy="36" r="30" fill="none"
                      stroke="white" strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${(2 * Math.PI * 30)}`}
                      strokeDashoffset={`${(2 * Math.PI * 30) * (1 - (currentQuestionNum > 0 ? correctCount / currentQuestionNum : 0))}`}
                      style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-extrabold text-white">
                      {currentQuestionNum > 0 ? Math.round((correctCount / currentQuestionNum) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div className="bg-white/15 rounded-lg px-3 py-2 text-center backdrop-blur-sm">
                    <div className="text-lg font-bold text-white">{currentQuestionNum}</div>
                    <div className="text-[10px] text-white/70 uppercase tracking-wide">Asked</div>
                  </div>
                  <div className="bg-white/15 rounded-lg px-3 py-2 text-center backdrop-blur-sm">
                    <div className="text-lg font-bold text-emerald-300">{correctCount}</div>
                    <div className="text-[10px] text-white/70 uppercase tracking-wide">Correct</div>
                  </div>
                  <div className="bg-white/15 rounded-lg px-3 py-2 text-center backdrop-blur-sm">
                    <div className="text-lg font-bold text-red-300">{currentQuestionNum - correctCount}</div>
                    <div className="text-[10px] text-white/70 uppercase tracking-wide">Wrong</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Feedback Body */}
            <div className="flex-1 overflow-y-auto">
              {/* Performance Level Badge */}
              <div className="px-6 pt-5 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold" style={{
                    background: feedback.performanceLevel === 'excellent' ? 'rgba(34,197,94,0.1)'
                      : feedback.performanceLevel === 'proficient' ? 'rgba(59,130,246,0.1)'
                      : feedback.performanceLevel === 'developing' ? 'rgba(245,158,11,0.1)'
                      : 'rgba(239,68,68,0.1)',
                    color: feedback.performanceLevel === 'excellent' ? '#16a34a'
                      : feedback.performanceLevel === 'proficient' ? '#2563eb'
                      : feedback.performanceLevel === 'developing' ? '#d97706'
                      : '#dc2626',
                  }}>
                    <FontAwesomeIcon icon={
                      feedback.performanceLevel === 'excellent' ? faTrophy
                        : feedback.performanceLevel === 'proficient' ? faShieldCheck
                        : faTriangleExclamation
                    } />
                    <span className="capitalize">{(feedback.performanceLevel || '').replace('-', ' ')}</span>
                  </div>
                  {courseName && (
                    <span className="text-xs text-gray-400 truncate">{courseName}</span>
                  )}
                </div>
                {feedback.overallSummary && (
                  <p className="text-sm text-gray-600 leading-relaxed mt-3">{feedback.overallSummary}</p>
                )}
              </div>

              {/* Question-by-Question Breakdown */}
              <div className="px-6 pb-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>Q</span>
                  Question-by-Question Breakdown
                </h3>
                <div className="space-y-2.5">
                  {questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border overflow-hidden transition-all"
                      style={{
                        borderColor: q.isCorrect ? '#bbf7d0' : '#fecaca',
                        background: q.isCorrect ? '#f0fdf4' : '#fef2f2',
                      }}
                    >
                      {/* Question header row */}
                      <div className="flex items-start gap-3 px-4 py-3">
                        {/* Number + status icon */}
                        <div className="flex-shrink-0 mt-0.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center"
                            style={{
                              background: q.isCorrect ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                            }}
                          >
                            <FontAwesomeIcon
                              icon={q.isCorrect ? faCircleCheck : faCircleXmark}
                              className="text-white text-xs"
                            />
                          </div>
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-gray-400">Q{q.questionNumber}</span>
                            {q.topic && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/80 text-gray-500 border border-gray-200">{q.topic}</span>
                            )}
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ml-auto ${
                              q.difficulty === 'hard' ? 'bg-red-100 text-red-600'
                                : q.difficulty === 'medium' ? 'bg-amber-100 text-amber-600'
                                : 'bg-green-100 text-green-600'
                            }`}>
                              {q.difficulty}
                            </span>
                          </div>
                          <p className="text-[13px] font-medium text-gray-900 leading-snug mb-2">{q.question}</p>

                          {/* Student answer */}
                          <div className="rounded-lg px-3 py-2 mb-2" style={{ background: 'rgba(0,0,0,0.04)' }}>
                            <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Your Answer</div>
                            <p className="text-xs text-gray-700 leading-relaxed">{q.studentAnswer}</p>
                          </div>

                          {/* AI Evaluation */}
                          <div className="flex items-start gap-1.5">
                            <FontAwesomeIcon icon={faRobot} className="text-[10px] text-purple-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-gray-500 leading-relaxed italic">{q.aiEvaluation}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              {(feedback.strengths?.length > 0 || feedback.weaknesses?.length > 0) && (
                <div className={`px-6 pb-4 grid gap-3 ${feedback.strengths?.length > 0 && feedback.weaknesses?.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {feedback.strengths?.length > 0 && (
                    <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
                      <h4 className="text-xs font-bold text-green-700 mb-2 flex items-center gap-1.5">
                        <FontAwesomeIcon icon={faCircleCheck} className="text-green-500" /> Strengths
                      </h4>
                      <ul className="space-y-1.5">
                        {feedback.strengths.map((s: string, i: number) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                            <span className="text-green-400 mt-0.5 flex-shrink-0">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {feedback.weaknesses?.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                      <h4 className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1.5">
                        <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500" /> Improve
                      </h4>
                      <ul className="space-y-1.5">
                        {feedback.weaknesses.map((w: string, i: number) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                            <span className="text-amber-400 mt-0.5 flex-shrink-0">•</span>
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Topics to Review */}
              {feedback.topicsToReview?.length > 0 && (
                <div className="px-6 pb-4">
                  <h4 className="text-xs font-bold text-gray-700 mb-2">📚 Topics to Review</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {feedback.topicsToReview.map((t: string, i: number) => (
                      <span key={i} className="text-[11px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200 font-medium">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Motivational Message */}
              {feedback.motivationalMessage && (
                <div className="px-6 pb-5">
                  <div className="p-4 rounded-xl border border-purple-200" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(124,58,237,0.03))' }}>
                    <p className="text-sm text-purple-800 leading-relaxed">💪 {feedback.motivationalMessage}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex gap-3">
              <button
                onClick={() => setShowFeedback(false)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Back to Chat
              </button>
              <button
                onClick={handleClose}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Input Area / Action Buttons */}
        <div className="px-5 py-3 bg-white border-t border-gray-200 flex-shrink-0 rounded-b-2xl">
          {isInterviewEnded ? (
            <div className="flex gap-3">
              <button
                onClick={() => setShowFeedback(!showFeedback)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}
              >
                <FontAwesomeIcon icon={faTrophy} />
                {showFeedback ? 'Hide Feedback' : 'View Feedback'}
              </button>
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="relative w-full">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your response..."
                  rows={2}
                  className="w-full px-4 py-3 pr-14 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-400 transition-all resize-none text-sm"
                  style={{ maxHeight: '120px' }}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className="absolute right-3 p-2 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', top: '50%', transform: 'translateY(calc(-30% - 10px))' }}
                >
                  {isLoading ? (
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin text-base" />
                  ) : (
                    <FontAwesomeIcon icon={faPaperPlaneTop} className="text-base" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Press Enter to send, Shift+Enter for new line</p>
            </form>
          )}
        </div>
      </div>

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowExitConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-[90%] max-w-[380px] overflow-hidden">
            <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)' }} />
            <div className="px-6 pt-5 pb-2 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500 text-2xl" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Leave Interview?</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Are you sure you want to leave? The interview will be saved as incomplete.
              </p>
            </div>
            <div className="px-6 pb-5 pt-3 flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Continue Interview
              </button>
              <button
                onClick={confirmExit}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
};

export default AIInterviewChat;