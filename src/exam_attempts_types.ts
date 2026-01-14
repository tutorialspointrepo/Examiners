export interface AIEvaluationFeedback {
  suggestedMarks: number;
  maxMarks: number;
  confidenceScore: number;
  keyPointsFound: string[];
  keyPointsMissing: string[];
  strengths: string[];
  improvements: string[];
  keywordsFound: string[];
  keywordsMissing: string[];
  plagiarismScore: number;
  plagiarismSources?: string[];
  isPlagiarized: boolean;
  answerLength: number;
  answerLengthScore: number;
  relevancyScore: number;
  accuracyScore: number;
  completenessScore: number;
  rubricScores?: Record<string, number>;
  aiModel: string;
  tokensUsed: number;
  evaluatedAt: Date;
  evaluationTime: number;
}

export interface StudentExamAttempt {
  attemptId: string;
  examId: string;
  studentId: string;
  responses: any[];
  totalScore: number;
  pendingEvaluations: number;
  maximumScore: number;
}

export interface StudentQuestionResponse {
  responseId: string;
  attemptId: string;
  questionNo: number;
}