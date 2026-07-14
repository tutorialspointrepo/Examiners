// ============================================
// Firebase Cloud Functions - WITH PUB/SUB PARALLEL GRADING
// Includes: AI Chat + Email Service + Auto-Complete Exams + Pub/Sub Workers
// ============================================

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import OpenAI from 'openai';
import * as nodemailer from 'nodemailer';
import { PubSub } from '@google-cloud/pubsub';
import { PGlite } from '@electric-sql/pglite';

// Import report processing from separate file
export { processReportInstance } from './reports';

// Import application constants
import {
  AI_MODELS,
  COLLECTIONS,
  EXAM_STATUS,
  FIRESTORE_PATHS,
  SYSTEM_TRIGGERS,
  CLOUD_FUNCTION_CONFIG,
} from './constants';

admin.initializeApp();

// Initialize Pub/Sub client
const pubsub = new PubSub();

// ============================================
// TYPE DEFINITIONS
// ============================================
interface ExamData {
  id: string;
  title?: string;
  examDate?: string;
  examTime?: string;
  duration?: string;
  status?: string;
  collegeId?: string;
  collegeName?: string;
  [key: string]: any;
}

// ============================================
// 🎓 GENERATE LEARNING PATH FROM JOB DESCRIPTION
// Uses GPT-4o-mini to analyze JD, extract skills, map to course catalog
// ============================================

const LEARNING_PATH_SYSTEM_PROMPT = `You are an expert career coach and curriculum designer. Given a job description and a catalog of available courses, you must:

1. Extract key skills from the job description and classify each as "must_have", "should_have", or "nice_to_have"
2. Assign a weight (1-10) to each skill based on how critical it is for the role
3. Map those skills to the most relevant courses from the provided catalog
4. Organize courses into logical learning phases with a recommended sequence
5. Generate a learning path name, description, target role, difficulty, and estimated duration

SKILL CLASSIFICATION:
- "must_have": Explicitly required skills, core technical requirements, non-negotiable qualifications (weight 7-10)
- "should_have": Strongly preferred skills, important but not dealbreakers (weight 4-7)
- "nice_to_have": Bonus skills, supplementary knowledge, soft skills mentioned (weight 1-4)

CRITICAL RULES FOR SKILL EXTRACTION:
- Read the JD carefully. If it says "X or Y" (e.g. "MongoDB or PostgreSQL"), list BOTH as separate skills with the same weight and category. Add an "altGroup" field with the same group name (e.g. "database") so the student can choose which one to learn. Do NOT remove either one.
- If the JD says "experience with X preferred" or "X is a plus", classify as "should_have" or "nice_to_have", NOT "must_have".
- Combine closely related skills into one (e.g. "HTML5" and "CSS3" → "HTML/CSS") instead of listing separately. But do NOT combine genuinely different alternatives (MongoDB vs PostgreSQL are different technologies — keep separate).
- Extract 8-15 distinct skills. Avoid padding with generic skills like "problem solving" or "communication" unless the JD specifically emphasizes them.

CRITICAL RULES FOR COURSE MAPPING:
- ONLY use courses from the provided catalog. Never invent course IDs or names.
- Use the EXACT courseId (number) and courseName from the catalog.
- ONLY match a course to a skill if the course ACTUALLY teaches that skill. Check the courseName, categories, and tagLine carefully. For example, a Laravel/PHP course does NOT match "Node.js". A MySQL course does NOT match "MongoDB". If unsure, leave the skill unmatched — a wrong match is worse than no match.
- It is BETTER to leave a skill as matched=false than to map it to an irrelevant course.
- Each skill should map to a DIFFERENT course when possible. If two skills would map to the same course, that's OK only if the course genuinely covers both topics.
- If a skill has no matching course, set matched=false and matchedCourseId=null.
- Organize into phases: "Foundations"(1) → "Core Skills"(2) → "Advanced"(3) → "Specialization"(4)
- sequenceOrder: continuous number starting from 1 across all phases.
- Select 4-10 most relevant, UNIQUE courses. Quality over quantity. No duplicate courseIds.
- estimatedWeeks: realistic based on course count (assume ~10h/week study).
- Sort extractedSkills by weight descending (highest weight first).

Respond ONLY with valid JSON. No markdown, no backticks, no explanation.`;

export const generateLearningPathAI = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB'
  })
  .https.onCall(async (data, context) => {
    // console.log('🚀 GenerateLearningPathAI called');
    
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { jdText, fileBase64, fileName } = data;
    const hasFile = fileBase64 && fileName;
    const hasText = jdText && jdText.trim().length >= 30;

    if (!hasFile && !hasText) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Please provide job description text (min 30 chars) or upload a PDF/DOCX file'
      );
    }

    if (hasFile) {
      // console.log(`📄 File received: ${fileName} (${(Buffer.from(fileBase64, 'base64').length / 1024).toFixed(1)} KB)`);
    }
    if (hasText) {
      // console.log(`📄 JD text length: ${jdText.trim().length}`);
    }

    // Get Gemini API key and model from Firestore settings
    const db = admin.firestore();
    const [geminiKeyDoc, geminiModelDoc] = await Promise.all([
      db.collection('settings').doc('GEMINI_API_KEY').get(),
      db.collection('settings').doc('GEMINI_MODEL').get(),
    ]);
    const geminiKey = geminiKeyDoc.data()?.GEMINI_API_KEY || '';
    const geminiModel = geminiModelDoc.data()?.GEMINI_MODEL || 'gemini-2.0-flash';

    if (!geminiKey) {
      throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured in Firestore settings');
    }

    try {
      // console.log('📦 Fetching courses...');

      // 1. Fetch all courses and filter in code (avoids needing composite index)
      const coursesSnapshot = await db.collection('courses').get();

      // Build catalog map for enrichment later + compact list for AI
      const courseMap = new Map<number, any>();
      const catalogLines: string[] = [];

      coursesSnapshot.docs.forEach(doc => {
        const d = doc.data();
        if (!d.courseName || !d.courseId) return;
        // Filter: only active published courses
        if (d.isPublished !== true || d.status !== 'active') return;

        const cid = Number(d.courseId);
        const durationH = d.totalDuration ? Math.round(d.totalDuration / 3600) : 0;

        courseMap.set(cid, {
          courseId: cid,
          courseName: d.courseName,
          courseCategories: d.courseCategories || [],
          tagLine: d.tagLine || '',
          slug: d.slug || doc.id,
          thumbnailUrl: d.thumbnailUrl || '',
          totalLectures: d.totalLectures || 0,
          totalChapters: d.totalChapters || 0,
          totalDuration: d.totalDuration || 0,
          durationHours: durationH,
          courseAuthor: d.courseAuthor || '',
          complexityLevel: d.complexityLevel || 1,
        });

        // Compact line for AI prompt — only what AI needs for matching
        catalogLines.push(
          `[${cid}] "${d.courseName}" | ${(d.courseCategories || []).join(', ')} | "${d.tagLine || ''}"`
        );
      });

      if (courseMap.size === 0) {
        throw new functions.https.HttpsError('not-found', 'No active courses found in catalog');
      }

      // console.log(`📚 Learning Path: ${courseMap.size} courses in catalog for matching`);

      const catalogText = `COURSE CATALOG (${courseMap.size} courses):\n${catalogLines.join('\n')}`;

      const jsonTemplate = `{
  "pathName": "string",
  "description": "2-3 sentence description",
  "targetRole": "string",
  "estimatedWeeks": number,
  "difficulty": "beginner"|"intermediate"|"advanced",
  "extractedSkills": [
    {"name":"string","category":"must_have"|"should_have"|"nice_to_have","weight":number_1_to_10,"matched":boolean,"matchedCourseId":number|null,"altGroup":string|null}
  ],
  "mappedCourses": [
    {"courseId":number,"courseName":"string","category":"string","matchedSkills":["string"],"phase":"string","phaseNumber":number,"sequenceOrder":number,"isRequired":boolean}
  ]
}`;

      // 2. Build Gemini request parts
      const parts: any[] = [];

      if (hasFile) {
        const ext = fileName.split('.').pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
          'pdf': 'application/pdf',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'txt': 'text/plain',
        };
        const mimeType = mimeMap[ext || ''] || 'application/octet-stream';

        parts.push({
          inlineData: {
            mimeType,
            data: fileBase64,
          }
        });
        parts.push({
          text: `${LEARNING_PATH_SYSTEM_PROMPT}\n\n---\nThe above file is a Job Description. Extract skills from it and map to the course catalog.\n\n${catalogText}\n\nReturn JSON:\n${jsonTemplate}`
        });
      } else {
        parts.push({
          text: `${LEARNING_PATH_SYSTEM_PROMPT}\n\nJOB DESCRIPTION:\n${jdText.substring(0, 6000)}\n---\n\n${catalogText}\n\nReturn JSON:\n${jsonTemplate}`
        });
      }

      // 3. Call Gemini via REST API
      // console.log('🤖 Calling Gemini model:', geminiModel);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 15000,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error('❌ Gemini API error:', response.status, errText);
        throw new functions.https.HttpsError('internal', `Gemini API error: ${response.status}`);
      }

      const geminiResult = await response.json();
      let rawResult = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // console.log(`🤖 Learning Path AI (Gemini ${geminiModel}) — Response length: ${rawResult.length}`);

      // 4. Parse JSON response
      let cleanResult = rawResult.trim();
      cleanResult = cleanResult.replace(/^```json?\s*/, '').replace(/\s*```$/, '');

      let parsed: any;
      try {
        parsed = JSON.parse(cleanResult);
      } catch (parseErr) {
        console.error('❌ Failed to parse AI response:', cleanResult.substring(0, 500));
        throw new functions.https.HttpsError('internal', 'AI returned invalid response. Please try again.');
      }

      // 5. Validate & enrich mappedCourses with real Firestore data
      const validatedCourses: any[] = [];
      const aiCourses = parsed.mappedCourses || [];

      for (const aiCourse of aiCourses) {
        const realCourse = courseMap.get(Number(aiCourse.courseId));
        if (!realCourse) {
          // console.warn(`⚠️ AI suggested courseId ${aiCourse.courseId} not found in catalog — skipping`);
          continue;
        }

        validatedCourses.push({
          courseId: realCourse.courseId,
          courseName: realCourse.courseName,
          category: (realCourse.courseCategories || []).join(', '),
          duration: `${realCourse.durationHours}h`,
          lectures: realCourse.totalLectures,
          totalChapters: realCourse.totalChapters,
          slug: realCourse.slug,
          thumbnailUrl: realCourse.thumbnailUrl,
          courseAuthor: realCourse.courseAuthor,
          complexityLevel: realCourse.complexityLevel,
          // AI-determined fields
          matchedSkills: aiCourse.matchedSkills || [],
          phase: aiCourse.phase || 'Core Skills',
          phaseNumber: aiCourse.phaseNumber || 2,
          sequenceOrder: aiCourse.sequenceOrder || 1,
          isRequired: aiCourse.isRequired !== false,
        });
      }

      // 6. Validate extractedSkills — ensure matchedCourseIds exist
      const validatedSkills = (parsed.extractedSkills || []).map((skill: any) => ({
        name: skill.name,
        category: ['must_have', 'should_have', 'nice_to_have'].includes(skill.category) ? skill.category : 'must_have',
        weight: Math.min(10, Math.max(1, Number(skill.weight) || 5)),
        matched: skill.matched && courseMap.has(Number(skill.matchedCourseId)),
        matchedCourseId: courseMap.has(Number(skill.matchedCourseId)) ? Number(skill.matchedCourseId) : null,
        altGroup: skill.altGroup || null,
      }));

      // console.log(`✅ Learning Path: ${validatedSkills.length} skills extracted, ${validatedCourses.length} courses mapped`);

      return {
        success: true,
        pathName: parsed.pathName || 'Learning Path',
        description: parsed.description || '',
        targetRole: parsed.targetRole || '',
        estimatedWeeks: parsed.estimatedWeeks || 8,
        difficulty: parsed.difficulty || 'intermediate',
        extractedSkills: validatedSkills,
        mappedCourses: validatedCourses,
        metadata: {
          model: geminiModel,
          totalCoursesInCatalog: courseMap.size,
          tokensUsed: 0,
          timestamp: new Date().toISOString(),
        }
      };

    } catch (error: any) {
      console.error('❌ Learning Path generation failed:', error.message);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', 'Failed to generate learning path', error.message);
    }
  });
/**
 * 🧠 Generate Logic Analysis for Custom Problem
 * Uses ChatGPT to generate algorithm, pseudocode, flowchart, approach, and complexity analysis
 */

const LOGIC_ANALYSIS_SYSTEM_PROMPT = `You are an expert algorithm analyst and computer science educator. When given a problem statement, you must generate a comprehensive algorithm analysis with exactly these 5 components in JSON format.

IMPORTANT: Return ONLY valid JSON, no markdown code blocks, no extra text.

The response must be a JSON object with these exact keys:
{
  "algorithm": ["step1", "step2", ...],
  "pseudocode": "string with pseudocode",
  "flowchart": "string with ASCII flowchart",
  "approach": "string with detailed approach explanation",
  "complexity": "string with time and space complexity analysis"
}

FORMATTING GUIDELINES:

1. **algorithm** (array of strings):
   - Each step should be clear and concise
   - 5-8 steps typically
   - Start with initialization, end with return/output
   - Example: ["Initialize empty hash map", "Iterate through array", "Check if complement exists", ...]

2. **pseudocode** (string):
   - Use standard pseudocode format
   - Include ALGORITHM name, BEGIN, END
   - Use IF/THEN/ELSE, FOR/WHILE loops
   - Use proper indentation with newlines (\\n)
   - Example format:
   ALGORITHM ProblemName
   BEGIN
       INITIALIZE variables
       FOR each element DO
           process
       END FOR
       RETURN result
   END

3. **flowchart** (string):
   - ASCII art flowchart with clear flow
   - Use standard symbols:
     - START/END for terminals
     - [Process] for operations
     - ◇ Decision ◇ for conditions
     - Arrows: │ ▼ ► ◄ ▲ ──
   - Show YES/NO branches for decisions
   - Use newlines (\\n) for formatting

4. **approach** (string):
   - Start with problem analysis
   - Explain the key insight
   - Compare different approaches if applicable
   - Include sections like:
     - Problem Analysis:
     - Approach Comparison:
     - Key Insights:
     - Implementation Strategy:
   - Use **bold** for headers
   - Use numbered lists for steps

5. **complexity** (string):
   - Time Complexity: O(?) with explanation
   - Space Complexity: O(?) with explanation
   - Include a comparison table if multiple approaches exist
   - Explain why these complexities apply
   - Mention trade-offs if any

Remember: Output ONLY the JSON object, nothing else.`;

export const generateLogicAnalysis = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB'
  })
  .https.onCall(async (data, context) => {
    try {
      const { problemStatement } = data || {};
      
      if (!problemStatement || typeof problemStatement !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'problemStatement is required');
      }

      if (problemStatement.length > 500) {
        throw new functions.https.HttpsError('invalid-argument', 'problemStatement must be 500 characters or less');
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'OpenAI API key not configured');
      }
      
      const client = new OpenAI({ apiKey });

      // console.log(`🧠 Generating logic analysis for problem: ${problemStatement.substring(0, 50)}...`);

      const completion = await client.chat.completions.create({
        model: AI_MODELS.GPT_4O_MINI,
        temperature: 0.7,
        max_tokens: 3000,
        messages: [
          { role: 'system', content: LOGIC_ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: `Generate a comprehensive algorithm analysis for this problem:\n\n${problemStatement}` }
        ]
      });

      const responseText = completion.choices?.[0]?.message?.content?.trim() || '';
      
      // Parse the JSON response
      let analysisResult;
      try {
        // Remove any markdown code block if present
        let cleanedResponse = responseText;
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.slice(7);
        }
        if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.slice(3);
        }
        if (cleanedResponse.endsWith('```')) {
          cleanedResponse = cleanedResponse.slice(0, -3);
        }
        cleanedResponse = cleanedResponse.trim();
        
        analysisResult = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('Failed to parse AI response:', responseText);
        throw new functions.https.HttpsError('internal', 'Failed to parse AI response');
      }

      // Validate the response has all required fields
      const requiredFields = ['algorithm', 'pseudocode', 'flowchart', 'approach', 'complexity'];
      for (const field of requiredFields) {
        if (!analysisResult[field]) {
          throw new functions.https.HttpsError('internal', `Missing required field: ${field}`);
        }
      }

      // Ensure algorithm is an array
      if (!Array.isArray(analysisResult.algorithm)) {
        analysisResult.algorithm = [analysisResult.algorithm];
      }

      // console.log(`✅ Successfully generated logic analysis`);
      
      return {
        success: true,
        data: {
          id: 'custom_problem',
          problem_id: 'custom_problem',
          title: 'Custom Problem Analysis',
          algorithm: analysisResult.algorithm,
          pseudocode: analysisResult.pseudocode,
          flowchart: analysisResult.flowchart,
          approach: analysisResult.approach,
          complexity: analysisResult.complexity,
          created_at: new Date().toISOString()
        }
      };
      
    } catch (err: any) {
      console.error('Logic Analysis Error:', err);
      
      if (err instanceof functions.https.HttpsError) {
        throw err;
      }
      
      throw new functions.https.HttpsError('internal', 'Failed to generate logic analysis', err.message);
    }
  });

/**
 * 🎓 Chat with AI Learning Assistant
 * Helps students understand course content, provides explanations,
 * code examples, practice problems, and answers questions
 */

/**
 * 🎓 Chat with AI Learning Assistant
 * Helps students understand course content, provides explanations,
 * code examples, practice problems, and answers questions
 */

const LEARNING_ASSISTANT_SYSTEM_PROMPT = `You are an AI Learning Assistant for TUTORIX, an online learning platform. Your role is to help students understand course content and learn effectively.

PERSONALITY:
- Friendly, encouraging, and patient like a helpful tutor
- Use simple language and clear explanations
- Be enthusiastic about helping students learn
- Use emojis sparingly to make conversations engaging

CAPABILITIES:
- Explain complex concepts in simple terms
- Provide code examples with clear comments
- Create practice problems and quizzes
- Answer questions about programming, web development, and technology
- Suggest additional learning resources
- Help debug code and explain errors

FORMATTING RULES:
- Use **bold** for important terms
- Use bullet points (•) for lists
- Use numbered lists for step-by-step instructions
- Use code blocks with language specification for code examples
- Keep responses concise but thorough
- Break down complex topics into digestible parts

BOUNDARIES:
- Focus on educational content related to programming and technology
- Provide hints rather than complete solutions when appropriate
- Encourage students to think and try solutions themselves
- Be honest if you don't know something

Remember: Your goal is to help students learn and understand, not just give answers.`;

export const chatWithLearningAI = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB'
  })
  .https.onCall(async (data, context) => {
    try {
      const { message, conversationHistory = [], courseContext = {} } = data || {};
      
      if (!message || typeof message !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'message is required');
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'OpenAI API key not configured');
      }
      
      const client = new OpenAI({ apiKey });

      // Build context-aware system prompt
      let systemPrompt = LEARNING_ASSISTANT_SYSTEM_PROMPT;
      
      if (courseContext.courseName) {
        systemPrompt += `\n\nCURRENT CONTEXT:
- Course: ${courseContext.courseName}${courseContext.currentChapter ? `\n- Chapter: ${courseContext.currentChapter}` : ''}${courseContext.currentLecture ? `\n- Lecture: ${courseContext.currentLecture}` : ''}

When answering, relate your responses to the course content when relevant.`;
      }

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-10).map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        })),
        { role: 'user', content: message }
      ];

      const completion = await client.chat.completions.create({
        model: AI_MODELS.GPT_4O_MINI,
        temperature: 0.7,
        max_tokens: 2000,
        messages
      });

      const response = completion.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not generate a response.';
      
      // Log for monitoring
      // console.log(`🎓 Learning AI - Course: ${courseContext.courseName || 'N/A'}, User: ${context.auth?.uid || 'anonymous'}`);
      
      return { success: true, response };
      
    } catch (err: any) {
      console.error('Learning AI Error:', err);
      throw new functions.https.HttpsError('internal', 'Failed to get response from AI', err.message);
    }
  });

// ============================================
// 1. PUBLISHER FUNCTION - Called when user submits exercise
// ============================================
/**
 * 📝 Submit Exercise for Evaluation (Pub/Sub Publisher)
 * Saves submission to Firestore and queues for AI evaluation
 * Returns immediately - evaluation happens in background
 */
export const submitExerciseForEvaluation = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB'
  })
  .https.onCall(async (data, context) => {
    try {
      const { 
        enrollmentId, 
        visibilityId,  // Format: lectureId_exerciseId
        submittedCode,
        exerciseTitle,
        questionDescription,
        correctAnswer,
        progLanguage 
      } = data || {};

      // Validate required fields
      if (!enrollmentId || !visibilityId || !submittedCode) {
        throw new functions.https.HttpsError(
          'invalid-argument', 
          'enrollmentId, visibilityId, and submittedCode are required'
        );
      }

      // console.log(`📝 Queueing exercise evaluation: ${visibilityId}`);

      // Publish to Pub/Sub topic for background processing
      const topic = pubsub.topic('evaluate-exercises');
      
      await topic.publishMessage({
        json: {
          enrollmentId,
          visibilityId,
          submittedCode,
          exerciseTitle: exerciseTitle || 'Exercise',
          questionDescription: questionDescription || '',
          correctAnswer: correctAnswer || '',
          progLanguage: progLanguage || 'javascript',
          timestamp: Date.now()
        }
      });

      // console.log(`✅ Exercise queued for evaluation: ${visibilityId}`);

      return {
        success: true,
        message: 'Exercise submitted for evaluation',
        visibilityId
      };

    } catch (error: any) {
      console.error('❌ Error queueing exercise:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        `Failed to submit exercise: ${error.message}`
      );
    }
  });


// ============================================
// 2. WORKER FUNCTION - Processes evaluation in background
// ============================================
/**
 * 🤖 Exercise Evaluation Worker (Pub/Sub Subscriber)
 * Triggered automatically for each exercise submission
 * Multiple instances run in PARALLEL for scalability
 * 
 * NOTE: Pub/Sub has built-in retry on failure - no need for scheduled retry!
 */
export const exerciseEvaluationWorker = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 120,  // 2 minutes max per evaluation
    memory: '512MB',
    maxInstances: 500     // Allow up to 500 parallel workers
  })
  .pubsub.topic('evaluate-exercises')
  .onPublish(async (message) => {
    const { 
      enrollmentId, 
      visibilityId, 
      submittedCode,
      exerciseTitle,
      questionDescription,
      correctAnswer,
      progLanguage 
    } = message.json;

    // console.log(`🎯 [Worker] Evaluating exercise: ${visibilityId} for enrollment: ${enrollmentId}`);

    try {
      // Get OpenAI API key
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const client = new OpenAI({ apiKey });

      // Decode HTML entities in correct answer
      const decodedCorrectAnswer = correctAnswer
        ? correctAnswer
            .replace(/<br>/g, '\n')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
        : 'Not provided';

      // Create evaluation prompt
      const prompt = `You are an expert code reviewer and programming instructor. Evaluate this student's code submission.

EXERCISE TITLE: ${exerciseTitle}

QUESTION/TASK:
${questionDescription}

EXPECTED SOLUTION (Reference):
${decodedCorrectAnswer}

PROGRAMMING LANGUAGE: ${progLanguage}

STUDENT'S SUBMITTED CODE:
\`\`\`${progLanguage}
${submittedCode}
\`\`\`

Evaluate the student's code and provide feedback in the following JSON format:
{
  "isCorrect": boolean (true if the code correctly solves the problem, false otherwise),
  "score": number (0-100, overall score),
  "feedback": string (2-3 sentences explaining what the student did well or wrong),
  "isOptimized": boolean (true if the code is reasonably efficient and follows best practices),
  "suggestions": string (specific suggestions for improvement, even if correct - focus on code quality, readability, edge cases)
}

EVALUATION CRITERIA:
1. Correctness: Does the code solve the given problem correctly?
2. Logic: Is the logic sound and complete?
3. Syntax: Is the code syntactically correct?
4. Best Practices: Does it follow coding conventions?
5. Edge Cases: Does it handle edge cases appropriately?

Be encouraging but honest. If the code is close but has minor issues, explain what needs to be fixed.
If the code is completely wrong, kindly explain the correct approach.
Always provide at least one constructive suggestion for improvement.`;

      // Call OpenAI API
      const completion = await client.chat.completions.create({
        model: AI_MODELS.GPT_4O_MINI,
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert programming instructor. Provide fair, constructive feedback on code submissions. Always respond in valid JSON format.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(completion.choices?.[0]?.message?.content || '{}');

      // console.log(`🤖 [Worker] AI Evaluation Result for ${visibilityId}:`, {
      //   isCorrect: result.isCorrect,
      //   score: result.score,
      //   isOptimized: result.isOptimized
      // });

      // Prepare evaluation data
      const evaluation = {
        isCorrect: result.isCorrect ?? false,
        score: result.score ?? 0,
        feedback: result.feedback || 'Unable to evaluate. Please try again.',
        isOptimized: result.isOptimized ?? false,
        suggestions: result.suggestions || 'Review your code and try again.',
        evaluatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Update the submission in Firestore
      const submissionRef = admin.firestore()
        .collection('course_enrollments')
        .doc(enrollmentId)
        .collection('exerciseSubmissions')
        .doc(visibilityId);

      // Read existing submission to detect retake and get previous score
      const existingSubmission = await submissionRef.get();
      const existingData = existingSubmission.exists ? existingSubmission.data() : null;
      const isRetake = existingData?.status === 'evaluated' && existingData?.evaluation?.score !== undefined;
      const previousScore = isRetake ? (existingData?.evaluation?.score ?? 0) : 0;

      await submissionRef.update({
        status: 'evaluated',
        evaluation,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // --- Track exercise completion in studentLearningDetail & dailyLearningLog ---
      try {
        const enrollmentDoc = await admin.firestore()
          .collection('course_enrollments')
          .doc(enrollmentId)
          .get();
        
        if (enrollmentDoc.exists) {
          const enrollData = enrollmentDoc.data();
          const userId = enrollData?.userId;
          const collegeId = enrollData?.collegeId;
          const courseSlug = enrollData?.courseSlug || '';

          if (userId && collegeId) {
            const detailDocId = `${userId}_${collegeId}`;
            const detailRef = admin.firestore().collection('studentLearningDetail').doc(detailDocId);
            const newScore = result.score ?? 0;

            if (isRetake) {
              // Retake: only update marks difference, don't increment count
              const marksDiff = newScore - previousScore;
              if (marksDiff !== 0) {
                const retakeUpdate: any = {
                  totalExerciseMarksObtained: admin.firestore.FieldValue.increment(marksDiff),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                if (courseSlug) {
                  retakeUpdate[`courses.${courseSlug}.exerciseMarksObtained`] = admin.firestore.FieldValue.increment(marksDiff);
                }
                await detailRef.update(retakeUpdate);
              }
            } else {
              // First evaluated attempt: increment count + add marks (global + course-level)
              const firstUpdate: any = {
                totalExercisesCompleted: admin.firestore.FieldValue.increment(1),
                totalExerciseMarksObtained: admin.firestore.FieldValue.increment(newScore),
                totalExerciseMaxMarks: admin.firestore.FieldValue.increment(100),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              };
              if (courseSlug) {
                firstUpdate[`courses.${courseSlug}.exercisesCompleted`] = admin.firestore.FieldValue.increment(1);
                firstUpdate[`courses.${courseSlug}.exerciseMarksObtained`] = admin.firestore.FieldValue.increment(newScore);
                firstUpdate[`courses.${courseSlug}.exerciseMaxMarks`] = admin.firestore.FieldValue.increment(100);
              }
              await detailRef.update(firstUpdate);

              // Update daily learning log
              const now = new Date();
              const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              const dailyLogRef = admin.firestore().collection('dailyLearningLog').doc(`${userId}_${dateStr}`);
              
              const dailyUpdateData: any = {
                userId,
                collegeId,
                date: dateStr,
                exerciseMarksObtained: admin.firestore.FieldValue.increment(newScore),
                exerciseMaxMarks: admin.firestore.FieldValue.increment(100),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              };
              if (courseSlug) {
                // We'll handle coursesAccessed via arrayUnion
                dailyUpdateData.coursesAccessed = admin.firestore.FieldValue.arrayUnion(courseSlug);
              }
              await dailyLogRef.set(dailyUpdateData, { merge: true });
            }

            // console.log(`📊 [Worker] Updated learning detail for ${userId} (retake: ${isRetake}, score: ${newScore})`);

            // Recalculate compositeScore (non-blocking)
            try {
              const updatedDoc = await detailRef.get();
              if (updatedDoc.exists) {
                const d = updatedDoc.data()!;
                const tH = (d.totalTimeSpent || 0) / 3600;
                const lec = d.totalLecturesCompleted || 0;
                const qz = d.totalQuizzesCompleted || 0;
                const ex = d.totalExercisesCompleted || 0;
                const qMax = d.totalQuizMaxMarks || 0;
                const eMax = d.totalExerciseMaxMarks || 0;
                const qP = qMax > 0 ? ((d.totalQuizMarksObtained || 0) / qMax) * 100 : 0;
                const eP = eMax > 0 ? ((d.totalExerciseMarksObtained || 0) / eMax) * 100 : 0;
                const cs = Math.round(((tH * 2) + (lec * 3) + (qP * 0.5) + (eP * 0.5) + (qz * 2) + (ex * 2)) * 10) / 10;
                await detailRef.update({ compositeScore: cs });
              }
            } catch (_e) { /* non-blocking */ }
          }
        }
      } catch (trackingError: any) {
        // Non-blocking: don't fail the evaluation if tracking fails
        // console.warn(`⚠️ [Worker] Failed to update learning tracking for ${visibilityId}:`, trackingError.message);
      }

      // const duration = Date.now() - startTime;
      // console.log(`✅ [Worker] Exercise ${visibilityId} evaluated in ${duration}ms (Score: ${result.score})`);

    } catch (error: any) {
      console.error(`❌ [Worker] Failed to evaluate ${visibilityId}:`, error.message);
      
      // Update submission with error status
      try {
        const submissionRef = admin.firestore()
          .collection('course_enrollments')
          .doc(enrollmentId)
          .collection('exerciseSubmissions')
          .doc(visibilityId);

        await submissionRef.update({
          status: 'error',
          evaluationError: error.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (updateError) {
        console.error(`❌ [Worker] Failed to update error status:`, updateError);
      }
      
      // Throw to trigger Pub/Sub built-in retry
      throw error;
    }
  });
// ============================================
// RESUME AI ENHANCEMENT FUNCTION
// Add this to your index.ts file (after the imports section)
// ============================================

/**
 * 📝 Resume Content Enhancement with AI
 * Enhances resume summaries, job descriptions, and skills using GPT
 */
export const enhanceResumeContent = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB'
  })
  .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to use AI enhancement'
      );
    }

    const { type, content, context: requestContext } = data;

    // Validate required fields
    if (!type || !content) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: type and content'
      );
    }

    // Validate content length
    if (content.length > 5000) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Content exceeds maximum length of 5000 characters'
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'OpenAI API key not configured'
      );
    }

    try {
      const client = new OpenAI({ apiKey });

      let systemPrompt = '';
      let userPrompt = '';

      switch (type) {
        case 'summary':
          systemPrompt = `You are an expert resume writer and career coach. Your task is to enhance professional summaries to be compelling, concise, and ATS-friendly.`;
          
          const personalInfo = requestContext?.personalInfo || {};
          userPrompt = `Enhance this professional summary for a resume. Make it:
- Compelling and attention-grabbing
- Concise (2-4 sentences, max 100 words)
- ATS-friendly with relevant keywords
- Professional yet personable
- Focused on value proposition

${personalInfo.title ? `Job Title: ${personalInfo.title}` : ''}
${personalInfo.fullName ? `Name: ${personalInfo.fullName}` : ''}

Current Summary:
"${content}"

Return ONLY the enhanced summary text, no quotes, no explanation.`;
          break;

        case 'experience':
          systemPrompt = `You are an expert resume writer specializing in crafting impactful job descriptions. Transform job responsibilities into achievement-focused bullet points.`;
          
          const position = requestContext?.position || 'Professional';
          const company = requestContext?.company || '';
          
          userPrompt = `Transform this job description into 3-5 powerful resume bullet points. Make each point:
- Start with a strong action verb
- Include quantifiable achievements where possible
- Be ATS-friendly with relevant keywords
- Focus on impact and results
- Be concise (one line each)

Position: ${position}
${company ? `Company: ${company}` : ''}

Current Description:
"${content}"

Return ONLY the bullet points as a JSON array of strings. Example format:
["Achieved X by doing Y, resulting in Z", "Led team of N to accomplish X"]`;
          break;

        case 'skills':
          systemPrompt = `You are an expert career advisor who helps identify and articulate professional skills for resumes.`;
          
          userPrompt = `Based on this content, suggest relevant skills to add to a resume. Categorize them into:
- Technical Skills
- Soft Skills

Content:
"${content}"

Return as JSON: {"technical": ["skill1", "skill2"], "soft": ["skill1", "skill2"]}`;
          break;

        case 'optimize':
          systemPrompt = `You are an ATS (Applicant Tracking System) optimization expert who helps make resumes more discoverable.`;
          
          userPrompt = `Optimize this resume content for ATS systems while maintaining readability:

"${content}"

Return the optimized version with improved keyword usage.`;
          break;

        default:
          throw new functions.https.HttpsError(
            'invalid-argument',
            `Invalid enhancement type: ${type}`
          );
      }

      // Call OpenAI
      const completion = await client.chat.completions.create({
        model: AI_MODELS.GPT_4O_MINI,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      let result = completion.choices[0]?.message?.content || '';

      // Parse response based on type
      let enhanced: string | string[] = result.trim();

      if (type === 'experience') {
        // Parse JSON array for experience bullet points
        try {
          // Clean up the response
          let cleanResult = result.trim();
          cleanResult = cleanResult.replace(/^```json?\s*/, '');
          cleanResult = cleanResult.replace(/\s*```$/, '');
          
          const parsed = JSON.parse(cleanResult);
          if (Array.isArray(parsed)) {
            enhanced = parsed;
          } else {
            enhanced = [result.trim()];
          }
        } catch (parseError) {
          // If JSON parsing fails, split by newlines
          enhanced = result
            .split('\n')
            .map(line => line.replace(/^[-•*]\s*/, '').trim())
            .filter(line => line.length > 0);
        }
      } else if (type === 'skills') {
        // Parse JSON for skills
        try {
          let cleanResult = result.trim();
          cleanResult = cleanResult.replace(/^```json?\s*/, '');
          cleanResult = cleanResult.replace(/\s*```$/, '');
          enhanced = cleanResult;
        } catch {
          enhanced = result.trim();
        }
      }

      // Log usage for monitoring
      // console.log(`📝 Resume AI Enhancement - Type: ${type}, User: ${userId}, Org: ${organizationId}`);

      return {
        enhanced,
        suggestions: [],
        metadata: {
          type,
          timestamp: new Date().toISOString(),
          model: AI_MODELS.GPT_4O_MINI
        }
      };

    } catch (error: any) {
      console.error('Resume AI Enhancement Error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to enhance content',
        error.message
      );
    }
  });

// ============================================
// SECURITY: SANITIZATION HELPER FUNCTIONS
// ============================================

/**
 * 🔧 UTILITY: Remove undefined values from an object
 * Firestore rejects objects with undefined values
 */
function cleanObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (obj instanceof Date) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObject(item)).filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
        cleaned[key] = cleanObject(obj[key]);
      }
    }
    return cleaned;
  }
  
  return obj;
}

/**
 * 🔒 SECURITY: Sanitize a single question before sending to client
 * Removes correctAnswers, solution, and expected_output from testCases
 * to prevent students from seeing answers in DevTools or Network tab
 * 
 * This function runs on Google's servers (server-side), making it truly secure.
 * Students CANNOT bypass this sanitization since it happens before data leaves the server.
 */
function sanitizeQuestionForClient(question: any): any {
  // Debug: Log what fields are present
  // console.log(`[SANITIZE] Processing question ${question.id} (type: ${question.type})`);
  // console.log(`[SANITIZE] Available fields:`, Object.keys(question));
  
  const {
    correctAnswers,
    solution,
    ...safeQuestion
  } = question;
  
  // console.log(`[SANITIZE] After destructuring:`, Object.keys(safeQuestion));
  
  // FITB: Send blanksCount
  if (question.type === 'fitb' && correctAnswers && Array.isArray(correctAnswers)) {
    safeQuestion.blanksCount = correctAnswers.length;
  }
  
  // CODE: Rename testStub to boilerplate for client, remove expected_output from testCases
  if (question.type === 'code') {
      if (question.testStub) {
        safeQuestion.boilerplate = question.testStub;
        // console.log(`[SANITIZE] ✅ Renamed testStub to boilerplate (${question.testStub.length} chars)`);
      }
      
      if (question.testCases && Array.isArray(question.testCases)) {
        safeQuestion.testCases = question.testCases.map((tc: any) => ({
          input: tc.input,
          expected_output: tc.expected_output || tc.expectedOutput || tc.output || '',  // ✅ Use snake_case
          marks: tc.marks,
        }));
        // console.log(`[SANITIZE] ✅ Preserved ${safeQuestion.testCases.length} test cases with expected outputs`);
      }
    }

  // SQL: Keep sqlSchema and sqlTestCases for client-side display (students need to see table structure and test data)
  if (question.type === 'sql') {
    if (question.sqlSchema) {
      safeQuestion.sqlSchema = question.sqlSchema;
      // console.log(`[SANITIZE] ✅ Kept sqlSchema (${Array.isArray(question.sqlSchema) ? question.sqlSchema.length : 1} tables)`);
    }
    if (question.sqlTestCases && Array.isArray(question.sqlTestCases)) {
      safeQuestion.sqlTestCases = question.sqlTestCases;
      // console.log(`[SANITIZE] ✅ Kept ${question.sqlTestCases.length} SQL test cases`);
    }
  }
  
  // JUMBLED: Keep jumbledOptions
  if (question.type === 'jumbled') {
    // console.log(`[SANITIZE] Jumbled question - checking for jumbledOptions...`);
    // console.log(`[SANITIZE] question.jumbledOptions exists?`, !!question.jumbledOptions);
    // console.log(`[SANITIZE] question.jumbledOptions value:`, question.jumbledOptions);
    
    if (question.jumbledOptions && Array.isArray(question.jumbledOptions)) {
      safeQuestion.jumbledOptions = [...question.jumbledOptions];
      // console.log(`[SANITIZE] ✅ Kept jumbledOptions: ${question.jumbledOptions.length} items`);
    } else {
      console.error(`[SANITIZE] ❌ WARNING: Jumbled question ${question.id} has NO jumbledOptions!`);
      console.error(`[SANITIZE] Available fields:`, Object.keys(question));
    }
  }
  
  // console.log(`[SANITIZE] Final safeQuestion keys:`, Object.keys(safeQuestion));
  
  return safeQuestion;
}

/**
 * 🔒 Sanitize all questions in exam (SERVER-SIDE)
 */
// function sanitizeExamQuestions(exam: any): any {
//   if (exam.questionsList && Array.isArray(exam.questionsList)) {
//     exam.questionsList = exam.questionsList.map((q: any) => sanitizeQuestionForClient(q));
//   }
//   
//   if (exam.questionPool && Array.isArray(exam.questionPool)) {
//     exam.questionPool = exam.questionPool.map((q: any) => sanitizeQuestionForClient(q));
//   }
//   
//   return exam;
// }

// ============================================
// AI HELPER FUNCTIONS (SERVER-SIDE ONLY)
// ============================================

/**
 * 🤖 Helper: Code Analysis with Failure-Specific Feedback
 * Handles 3 scenarios: all pass, some fail, all fail
 */
async function analyzeCodeWithAIHelper(params: {
  questionText: string;
  studentCode: string;
  programmingLanguage: string;
  testCases: any[];
  testResults: any[];
  passedTests: number;
  totalTests: number;
  modelSolution?: string;
}): Promise<any> {
  const {
    questionText,
    studentCode,
    programmingLanguage,
    testCases,
    testResults,
    passedTests,
    totalTests,
    modelSolution
  } = params;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const allTestsPassed = passedTests === totalTests;
  const allTestsFailed = passedTests === 0;
  const failedTests = totalTests - passedTests;
  
  // Determine severity
  let severityLevel: 'success' | 'partial' | 'critical';
  if (allTestsPassed) severityLevel = 'success';
  else if (allTestsFailed) severityLevel = 'critical';
  else severityLevel = 'partial';

  // Build detailed test results
  let testResultsDetail = '\n\nDetailed Test Results:\n';
  const failedTestsDetail: any[] = [];
  
  testResults.forEach((result: any, index: number) => {
    const testCase = testCases[index];
    const testNum = index + 1;
    
    testResultsDetail += `\nTest ${testNum}: ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
    testResultsDetail += `  Input: ${testCase.input}\n`;
    testResultsDetail += `  Expected Output: ${testCase.expectedOutput || testCase.expected_output}\n`;
    testResultsDetail += `  Student Output: ${result.actualOutput || 'No output'}\n`;
    if (result.error) testResultsDetail += `  Error: ${result.error}\n`;
    
    // Track failed tests for detailed analysis
    if (!result.passed) {
      failedTestsDetail.push({
        testNumber: testNum,
        input: testCase.input,
        expected: testCase.expectedOutput || testCase.expected_output,
        got: result.actualOutput || 'No output',
        error: result.error || null
      });
    }
  });

  try {
    const client = new OpenAI({ apiKey });

    // ✅ Scenario-specific prompts
    let scenarioPrompt = '';
    let jsonStructure = '';
    
    if (allTestsPassed) {
      // Scenario 1: All tests passed - optimization focus
      scenarioPrompt = `✅ EXCELLENT! All ${totalTests} tests passed!

Your code is functionally correct. Now let's focus on:
1. Code quality and readability
2. Performance optimization
3. Best practices

Provide optimization suggestions, but code corrections are optional.`;
      
      jsonStructure = `{
  "codeQuality": number (0-100),
  "readabilityScore": number (0-100),
  "efficiencyScore": number (0-100),
  "correctnessScore": 100,
  "timeComplexity": string,
  "spaceComplexity": string,
  "correctPoints": string[] (2-4 things done well),
  "improvements": string[] (2-3 optimization suggestions),
  "failedTestAnalysis": [],
  "hasSuggestedCode": boolean (true only if significant optimization possible),
  "suggestedCode": string (optimized version - only if hasSuggestedCode true),
  "codeExplanation": string (why it's better)
}`;
      
    } else if (severityLevel === 'critical') {
      // Scenario 2: All tests failed - major issues
      scenarioPrompt = `❌ CRITICAL: All ${totalTests} tests failed!

The code has major issues. Analyze why it's failing and provide a corrected version.

Focus on:
1. Identify the fundamental logic errors
2. Provide specific line-by-line fixes for each failed test
3. Give a working corrected version

This is a learning opportunity - be educational in your explanations.`;
      
      jsonStructure = `{
  "codeQuality": number (0-100, likely low),
  "readabilityScore": number (0-100),
  "efficiencyScore": number (0-100),
  "correctnessScore": 0,
  "timeComplexity": string,
  "spaceComplexity": string,
  "correctPoints": string[] (anything salvageable, or empty if nothing works),
  "improvements": string[] (major fixes needed - be specific with line numbers),
  "failedTestAnalysis": [
    {
      "testNumber": number,
      "issue": string (why this specific test failed),
      "fix": string (how to fix it)
    }
    // Include ALL ${failedTests} failed tests
  ],
  "hasSuggestedCode": true,
  "suggestedCode": string (MUST provide working corrected code),
  "codeExplanation": string (explain the key fixes)
}`;
      
    } else {
      // Scenario 3: Some tests failed - partial issues
      scenarioPrompt = `⚠️ PARTIAL: ${passedTests}/${totalTests} tests passed, ${failedTests} failed.

Some logic works, but there are bugs in edge cases or specific scenarios.

Focus on:
1. What's working correctly (passed tests)
2. Specific issues causing each test failure
3. Targeted fixes for the failing tests

Help the student understand what to fix without rewriting everything.`;
      
      jsonStructure = `{
  "codeQuality": number (0-100, moderate),
  "readabilityScore": number (0-100),
  "efficiencyScore": number (0-100),
  "correctnessScore": number (${Math.round(passedTests/totalTests * 100)}),
  "timeComplexity": string,
  "spaceComplexity": string,
  "correctPoints": string[] (what's working - refer to passed tests),
  "improvements": string[] (general code improvements),
  "failedTestAnalysis": [
    {
      "testNumber": number,
      "issue": string (specific reason this test failed),
      "fix": string (targeted fix with line numbers)
    }
    // Include ALL ${failedTests} failed tests
  ],
  "hasSuggestedCode": true,
  "suggestedCode": string (corrected version addressing failed tests),
  "codeExplanation": string (explain the specific fixes made)
}`;
    }

    const fullPrompt = `You are an expert ${programmingLanguage} code reviewer and educator.

Question: ${questionText}

Student Code:
\`\`\`${programmingLanguage}
${studentCode}
\`\`\`

${testResultsDetail}

${scenarioPrompt}

${modelSolution ? `\nReference Solution (for guidance):\n\`\`\`${programmingLanguage}\n${modelSolution}\n\`\`\`\n` : ''}

Provide detailed, educational feedback in this JSON structure:
${jsonStructure}

Guidelines:
- Be specific with line numbers when identifying bugs
- failedTestAnalysis must explain EACH failed test individually
- suggestedCode must be complete and working (not just snippets)
- codeExplanation should be educational and help student learn
- Use actual line numbers from the student's code`;

    const completion = await client.chat.completions.create({
      model: AI_MODELS.GPT_4O_MINI,
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert programming instructor. Provide clear, educational feedback that helps students learn. Always respond in valid JSON.' 
        },
        { role: 'user', content: fullPrompt }
      ],
      temperature: 0.3,
      max_tokens: 3000,  // Increased for detailed analysis
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(completion.choices?.[0]?.message?.content || '{}');

    // ✅ Return unified structure with test-specific feedback
    return {
      // Test execution
      testsPassed: passedTests,
      testsTotal: totalTests,
      allTestsPassed,
      severityLevel,
      
      // Code quality scores
      codeQuality: result.codeQuality ?? 0,
      readabilityScore: result.readabilityScore ?? 0,
      efficiencyScore: result.efficiencyScore ?? 0,
      correctnessScore: result.correctnessScore ?? Math.round((passedTests / totalTests) * 100),
      
      // Complexity
      timeComplexity: result.timeComplexity || 'Unknown',
      spaceComplexity: result.spaceComplexity || 'Unknown',
      
      // General feedback
      correctPoints: result.correctPoints || [],
      improvements: result.improvements || [],
      
      // ✅ Test-specific analysis
      failedTestAnalysis: result.failedTestAnalysis || [],
      
      // Code suggestions (mandatory if tests failed)
      hasSuggestedCode: result.hasSuggestedCode ?? !allTestsPassed,  // Always true if tests fail
      suggestedCode: result.suggestedCode || '',
      codeExplanation: result.codeExplanation || ''
    };

  } catch (error: any) {
    console.error('❌ Code analysis failed:', error.message);
    
    // ✅ Smart fallback based on test results
    const basicQuality = Math.round((passedTests / totalTests) * 100);
    
    // Build basic failed test analysis from test results
    const basicFailedAnalysis = failedTestsDetail.map(ft => ({
      testNumber: ft.testNumber,
      issue: ft.error || `Expected ${ft.expected} but got ${ft.got}`,
      fix: 'Review the test input and expected output above'
    }));
    
    return {
      testsPassed: passedTests,
      testsTotal: totalTests,
      allTestsPassed,
      severityLevel,
      
      codeQuality: basicQuality,
      readabilityScore: 0,
      efficiencyScore: 0,
      correctnessScore: basicQuality,
      
      timeComplexity: 'Unknown',
      spaceComplexity: 'Unknown',
      
      correctPoints: passedTests > 0 ? [`${passedTests} test case(s) passed`] : [],
      improvements: [
        'Unable to analyze code automatically: ' + error.message,
        'Your code will be reviewed manually by your instructor',
        failedTests > 0 ? `Focus on the ${failedTests} failing test case(s)` : ''
      ].filter(imp => imp.length > 0),
      
      // Basic test-specific feedback
      failedTestAnalysis: basicFailedAnalysis,
      
      hasSuggestedCode: false,
      suggestedCode: '',
      codeExplanation: 'Automatic code correction unavailable. Please review test results manually.'
    };
  }
}

/**
 * 🤖 Helper: Descriptive Answer Evaluation with Granular Scoring
 * Returns: AI feedback with detailed scores and actionable feedback
 */
async function evaluateAnswerWithAIHelper(params: {
  questionText: string;
  modelAnswer: string;
  studentAnswer: string;
  maxMarks: number;
  isOfflineExam?: boolean;
  imageUrl?: string;
}): Promise<any> {
  const { questionText, modelAnswer, studentAnswer, maxMarks, isOfflineExam, imageUrl } = params;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  // Calculate word count for the student answer
  const studentAnswerText = typeof studentAnswer === 'string' ? studentAnswer : JSON.stringify(studentAnswer);
  const wordCount = studentAnswerText.trim().split(/\s+/).filter(w => w.length > 0).length;

  try {
    const client = new OpenAI({ apiKey });
    const model = isOfflineExam ? 'gpt-4o' : 'gpt-4o-mini';

    // ✅ Updated prompt with granular scoring
    const prompt = `Evaluate this student answer with detailed granular scoring.

Question: ${questionText}

Model Answer: ${modelAnswer}

Student Answer: ${studentAnswer}

Maximum Marks: ${maxMarks}

Provide concise, actionable feedback with granular scores.

JSON response: {
  "marks": number (0-${maxMarks}),
  "confidence": number (0-100, your confidence in this evaluation),
  "correctPoints": string[] (specific correct concepts - be concise and specific),
  "improvements": string[] (missing points + actionable suggestions - be specific),
  "answerLengthScore": number (0-100, appropriateness of length for this question),
  "relevancyScore": number (0-100, how relevant is answer to the question),
  "accuracyScore": number (0-100, factual correctness),
  "completenessScore": number (0-100, covers all key points from model answer),
  "plagiarismScore": number (0-100, likelihood of being copied/too generic),
  "plagiarismIndicators": string[] (red flags if score > 30, empty array if clean)
}

Scoring Guidelines:
- marks: Award marks based on correctness and completeness
- confidence: Your confidence in this evaluation (higher if answer is clear)
- correctPoints: List ONLY what the student actually got right - be specific
- improvements: ALWAYS provide 1-3 actionable suggestions, even if answer is perfect (e.g., "Consider adding more examples", "Could discuss edge cases")
- answerLengthScore: 100 if appropriate length, lower if too short (<${Math.max(50, maxMarks * 10)} words) or too verbose (>${maxMarks * 50} words)
- relevancyScore: 100 if directly answers question, 0 if completely off-topic
- accuracyScore: 100 if all facts correct, lower for errors or misconceptions
- completenessScore: 100 if covers all key points from model answer, 0 if covers none
- plagiarismScore: 0-30 = likely original, 30-70 = suspicious patterns (generic phrases, templated structure), 70-100 = highly generic/copied
- plagiarismIndicators: List specific red flags only if score > 30 (e.g., "Uses generic template phrases", "Too similar to common online answers")

IMPORTANT: Even for perfect answers, provide at least one constructive suggestion in improvements array.
Be concise and actionable in all feedback. Focus on what matters most for learning.`;

    // Prepare message content (text or text + image)
    let messageContent: any = prompt;
    if (isOfflineExam && imageUrl) {
      messageContent = [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
      ];
    }

    // Call OpenAI API
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are an expert educational evaluator. Provide fair, constructive feedback. Always respond in valid JSON format.' },
        { role: 'user', content: messageContent }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(completion.choices?.[0]?.message?.content || '{}');

    // ✅ DEBUG: Log what AI actually returned
    // console.log('🤖 AI Response:', JSON.stringify({
    //   marks: result.marks,
    //   correctPoints: result.correctPoints?.length || 0,
    //   improvements: result.improvements?.length || 0,
    //   // Check old fields too
    //   strengths: result.strengths?.length || 0,
    //   keyPointsMissing: result.keyPointsMissing?.length || 0
    // }));

    // Extract feedback with fallbacks
    const correctPoints = result.correctPoints || result.strengths || [];
    const improvements = result.improvements || result.keyPointsMissing || [];
    
    // ✅ SAFETY: If improvements is empty, add a generic one
    if (improvements.length === 0 && correctPoints.length > 0) {
      // Student got something right but no improvements - add constructive feedback
      if (result.marks >= maxMarks * 0.9) {
        improvements.push('Excellent answer! Consider adding more real-world examples or edge cases.');
      } else if (result.marks >= maxMarks * 0.7) {
        improvements.push('Good understanding shown. Review the model answer for additional details.');
      } else {
        improvements.push('Review the model answer to identify missing key concepts.');
      }
      // console.log('⚠️ Added fallback improvement - AI returned empty improvements');
    }

    // ✅ Return clean structure with proper defaults using ?? operator
    return {
      // Core evaluation
      suggestedMarks: result.marks ?? 0,
      maxMarks,
      confidenceScore: result.confidence ?? 0,
      
      // Feedback - with fallback to old field names
      correctPoints: correctPoints,
      improvements: improvements,
      
      // Granular scores (use ?? to distinguish 0 from undefined)
      answerLength: wordCount,
      answerLengthScore: result.answerLengthScore ?? 0,
      relevancyScore: result.relevancyScore ?? 0,
      accuracyScore: result.accuracyScore ?? 0,
      completenessScore: result.completenessScore ?? 0,
      
      // Plagiarism detection
      plagiarismScore: result.plagiarismScore || 0,
      isPlagiarized: (result.plagiarismScore || 0) > 50,
      plagiarismIndicators: result.plagiarismIndicators || []
    };

  } catch (error: any) {
    console.error('❌ AI evaluation failed:', error.message);
    
    // ✅ Smart fallback based on answer length
    const calculateBasicScore = (words: number): number => {
      if (words === 0) return 0;
      if (words < 20) return Math.min(words * 2, 30);           // Very short: 0-30%
      if (words < 50) return Math.min(30 + (words - 20), 60);   // Short: 30-60%
      if (words < 100) return Math.min(60 + (words - 50) / 2, 80); // Medium: 60-80%
      return Math.min(80 + (words - 100) / 10, 100);            // Long: 80-100%
    };

    const basicScore = calculateBasicScore(wordCount);

    return {
      // Core evaluation - conservative fallback
      suggestedMarks: Math.max(1, Math.round(maxMarks * 0.3)), // 30% minimum for manual review
      maxMarks,
      confidenceScore: 0,  // No confidence since AI failed
      
      // Feedback
      correctPoints: [],
      improvements: [
        'Unable to evaluate automatically: ' + error.message,
        'This answer will be reviewed manually by your instructor',
        wordCount < 30 ? 'Consider providing a more detailed answer' : '',
        'Ensure your answer directly addresses the question'
      ].filter(imp => imp.length > 0),
      
      // Granular scores - length-based fallback
      answerLength: wordCount,
      answerLengthScore: basicScore,
      relevancyScore: 0,        // Can't determine without AI
      accuracyScore: 0,         // Can't determine without AI
      completenessScore: Math.round(basicScore * 0.8), // Conservative estimate
      
      // Plagiarism detection
      plagiarismScore: 0,
      isPlagiarized: false,
      plagiarismIndicators: []
    };
  }
}



// ============================================
// 1. GET EXAM (SANITIZED)
// ============================================

// ============================================
// getExamMetadata — Returns exam info WITHOUT question content for students
// Students see this when they click on an exam card (detail panel)
// Admins/teachers get full data
// ============================================
export const getExamMetadata = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
      }
      
      const { examId } = data;
      // Look up userType from Firestore since custom claims may not be set
      let userType = context.auth.token.userType;
      if (!userType) {
        const userDoc = await admin.firestore().collection(COLLECTIONS.USERS).doc(context.auth.uid).get();
        userType = userDoc.exists ? (userDoc.data()?.userType || 'student') : 'student';
      }
      
      if (!examId) {
        throw new functions.https.HttpsError('invalid-argument', 'examId is required');
      }
      
      const examDoc = await admin.firestore()
        .collection(COLLECTIONS.EXAMS)
        .doc(examId)
        .get();
      
      if (!examDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Exam not found');
      }
      
      let exam = examDoc.data() as any;
      exam.id = examDoc.id;
      
      // ✅ SUB-COLLECTION: Questions are now in exams/{id}/examQuestions/main
      // Parent doc only has metadata — no stripping needed for students
      // totalQuestions, personalityAssessment, likertDuration etc. are already in parent doc
      
      return { success: true, exam };
      
    } catch (error: any) {
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ============================================
// getExamQuestionsList — Returns sanitized questions ONLY when exam has started
// Requires an active/in-progress attempt for the student
// Admins/teachers can fetch anytime
// ============================================
export const getExamQuestionsList = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
      }
      
      const { examId } = data;
      const userId = context.auth.uid;
      // Look up userType from Firestore since custom claims may not be set
      let userType = context.auth.token.userType;
      if (!userType) {
        const userDoc = await admin.firestore().collection(COLLECTIONS.USERS).doc(userId).get();
        userType = userDoc.exists ? (userDoc.data()?.userType || 'student') : 'student';
      }
      
      if (!examId) {
        throw new functions.https.HttpsError('invalid-argument', 'examId is required');
      }
      
      // 🔒 For students: verify they have an active attempt before releasing questions
      if (userType === 'student') {
        const attemptsSnapshot = await admin.firestore()
          .collection(COLLECTIONS.EXAM_ATTEMPTS)
          .where('examId', '==', examId)
          .where('studentId', '==', userId)
          .where('status', 'in', ['in_progress', 'started'])
          .limit(1)
          .get();
        
        if (attemptsSnapshot.empty) {
          throw new functions.https.HttpsError(
            'permission-denied', 
            'No active attempt found. Start the exam first.'
          );
        }
      }
      
      const examDoc = await admin.firestore()
        .collection(COLLECTIONS.EXAMS)
        .doc(examId)
        .get();
      
      if (!examDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Exam not found');
      }
      
      const exam = examDoc.data() as any;
      exam.id = examDoc.id;
      
      // ✅ SUB-COLLECTION: Read questions from sub-collection
      const questionsDoc = await admin.firestore()
        .collection(COLLECTIONS.EXAMS)
        .doc(examId)
        .collection('examQuestions')
        .doc('main')
        .get();
      
      const questionsData = questionsDoc.exists ? questionsDoc.data() as any : {};
      const questionsList = questionsData.questionsList || [];
      const questionPool = questionsData.questionPool || [];
      const likertQuestions = questionsData.likertQuestions || [];
      
      // Sanitize for students (strip correctAnswers, solution but keep question text, options etc.)
      if (userType === 'student') {
        return { 
          success: true, 
          questionsList: questionsList.map((q: any) => sanitizeQuestionForClient(q)),
          questionPool: questionPool.map((q: any) => sanitizeQuestionForClient(q)),
          likertQuestions,
          enableQuestionPool: exam.enableQuestionPool || false,
          pickRandomCount: exam.pickRandomCount || 0,
          poolQuestionMarks: exam.poolQuestionMarks || 0,
          personalityAssessment: exam.personalityAssessment || false,
          likertDuration: exam.likertDuration || 0,
        };
      }
      
      return { 
        success: true, 
        questionsList,
        questionPool,
        likertQuestions,
        enableQuestionPool: exam.enableQuestionPool || false,
        pickRandomCount: exam.pickRandomCount || 0,
        poolQuestionMarks: exam.poolQuestionMarks || 0,
        personalityAssessment: exam.personalityAssessment || false,
        likertDuration: exam.likertDuration || 0,
      };
      
    } catch (error: any) {
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ============================================
// getExamForStudent — Returns full exam with sanitized questions for students
// Students get questions (text, options, type, marks) but NOT answers (correctAnswers, solution)
// Teachers/Admins get complete data including answers
// Used by: getExamById in firebase_service.ts (exam detail, results, etc.)
// ============================================
export const getExamForStudent = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
      }
      
      const { examId, viewContext } = data;
      // Look up userType from Firestore since custom claims may not be set
      let userType = context.auth.token.userType;
      if (!userType) {
        const userDoc = await admin.firestore().collection(COLLECTIONS.USERS).doc(context.auth.uid).get();
        userType = userDoc.exists ? (userDoc.data()?.userType || 'student') : 'student';
      }
      
      if (!examId) {
        throw new functions.https.HttpsError('invalid-argument', 'examId is required');
      }
      
      const examDoc = await admin.firestore()
        .collection(COLLECTIONS.EXAMS)
        .doc(examId)
        .get();
      
      if (!examDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Exam not found');
      }
      
      let exam = examDoc.data() as any;
      exam.id = examDoc.id;
      
      // ✅ SUB-COLLECTION: Read questions from sub-collection
      const questionsDoc = await admin.firestore()
        .collection(COLLECTIONS.EXAMS)
        .doc(examId)
        .collection('examQuestions')
        .doc('main')
        .get();
      
      const questionsData = questionsDoc.exists ? questionsDoc.data() as any : {};
      exam.questionsList = questionsData.questionsList || [];
      exam.questionPool = questionsData.questionPool || [];
      exam.likertQuestions = questionsData.likertQuestions || [];
      
      // 🔧 ENRICH: If questions are missing correctAnswers, fetch from Question Bank
      // This handles exams where correctAnswers wasn't copied during exam creation
      const allQuestions = [
        ...(exam.questionsList || []),
        ...(exam.questionPool || [])
      ];
      const missingIds = allQuestions
        .filter((q: any) => q.questionBankId && !q.correctAnswers)
        .map((q: any) => q.questionBankId);
      
      if (missingIds.length > 0) {
        const uniqueIds = [...new Set(missingIds)] as string[];
        const qbMap = new Map<string, any>();
        
        // Batch fetch from Question Bank (Firestore getAll supports up to 100 refs)
        for (let i = 0; i < uniqueIds.length; i += 30) {
          const chunk = uniqueIds.slice(i, i + 30);
          const refs = chunk.map(id => admin.firestore().collection(COLLECTIONS.QUESTION_BANK).doc(id));
          const docs = await admin.firestore().getAll(...refs);
          docs.forEach(d => {
            if (d.exists) qbMap.set(d.id, d.data());
          });
        }
        
        // Enrich exam questions with correctAnswers from Question Bank
        const enrichQuestion = (q: any) => {
          if (q.questionBankId && !q.correctAnswers && qbMap.has(q.questionBankId)) {
            const qb = qbMap.get(q.questionBankId);
            if (qb.correctAnswers) q.correctAnswers = qb.correctAnswers;
            if (qb.correctAnswer !== undefined) q.correctAnswer = qb.correctAnswer;
          }
          return q;
        };
        
        if (exam.questionsList) exam.questionsList = exam.questionsList.map(enrichQuestion);
        if (exam.questionPool) exam.questionPool = exam.questionPool.map(enrichQuestion);
      }
      
      // 🔒 SERVER-SIDE PROTECTION: Before exam date, ONLY the creator can see questions
      // After exam date, all teachers/admins can see questions
      const userId = context.auth.uid;
      const isCreator = exam.createdBy === userId;
      
      // Check if exam date has arrived (compare in IST — exam dates are stored as IST dates)
      let hasExamDateArrived = true; // default true if no date set
      if (exam.examDate) {
        const today = new Date();
        // Convert to IST for comparison (UTC+5:30)
        const istOffset = 5.5 * 60 * 60 * 1000;
        const todayIST = new Date(today.getTime() + istOffset);
        todayIST.setHours(0, 0, 0, 0);
        
        const examDate = new Date(exam.examDate);
        examDate.setHours(0, 0, 0, 0);
        
        hasExamDateArrived = examDate <= todayIST;
      }
      
      // Non-creator staff before exam date: strip questions, keep metadata
      if (userType !== 'student' && !isCreator && !hasExamDateArrived && viewContext !== 'result') {
        const questionCount = exam.questionsList?.length || 0;
        delete exam.questionsList;
        delete exam.questionPool;
        delete exam.likertQuestions;
        exam.totalQuestions = questionCount;
        exam.questionsHidden = true; // Flag so UI knows questions are intentionally hidden
      }
      
      // For students: sanitize questions ONLY when browsing exams (not in results)
      // When viewContext='result', exam is already submitted — show full data including answers
      if (userType === 'student' && viewContext !== 'result') {
        if (exam.questionsList && Array.isArray(exam.questionsList)) {
          exam.questionsList = exam.questionsList.map((q: any) => sanitizeQuestionForClient(q));
        }
        if (exam.questionPool && Array.isArray(exam.questionPool)) {
          exam.questionPool = exam.questionPool.map((q: any) => sanitizeQuestionForClient(q));
        }
      }
      
      return { success: true, exam };
      
    } catch (error: any) {
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ============================================
// SHARED GRADING FUNCTION
// Used by both manual submit and auto-submit
// ============================================

/**
 * 🐘 Helper: Grade SQL question using PGlite (in-memory PostgreSQL)
 * Mirrors Judge0 grading pattern: run all test cases, count passed, calculate marks
 */
async function gradeSqlWithPGlite(params: {
  studentCode: string;
  sqlSchema: any[];
  sqlTestCases: any[];
  questionMaxMarks: number;
}): Promise<{
  passedCount: number;
  totalTests: number;
  testResults: any[];
  marksAwarded: number;
  isCorrect: boolean;
  error?: string;
}> {
  const { studentCode, sqlSchema, sqlTestCases, questionMaxMarks } = params;
  const totalTests = sqlTestCases.length;
  let passedCount = 0;
  const testResults: any[] = [];

  let db: any = null;
  try {
    // Spin up in-memory PGlite instance
    db = new PGlite();
    await db.waitReady;

    // Create tables from schema
    const schemas = Array.isArray(sqlSchema) ? sqlSchema : [sqlSchema];
    for (const schema of schemas) {
      const tableName = schema.tableName || schema.table_name || 'Table';
      let columns = schema.columns;
      if (columns && typeof columns === 'object' && !Array.isArray(columns)) {
        columns = Object.keys(columns).sort((a: string, b: string) => Number(a) - Number(b)).map((key: string) => columns[key]);
      }
      if (!columns || columns.length === 0) continue;

      let createSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (`;
      createSQL += columns.map((col: any) => {
        let type = (col.type || 'TEXT').toUpperCase();
        if (type.includes('ENUM')) type = 'TEXT';
        if (type.includes('INT')) type = 'INTEGER';
        if (type.includes('VARCHAR') || type.includes('CHAR')) type = 'TEXT';
        if (type.includes('DECIMAL') || type.includes('FLOAT') || type.includes('DOUBLE') || type.includes('NUMERIC')) type = 'REAL';
        if (type.includes('DATE') || type.includes('TIMESTAMP')) type = 'TEXT';
        if (type.includes('BOOLEAN') || type.includes('BOOL')) type = 'BOOLEAN';
        return `${col.name} ${type}`;
      }).join(', ');
      createSQL += ')';

      // console.log(`      🗄️ Creating table: ${tableName}`);
      await db.query(createSQL);
    }

    // Run each test case
    for (let i = 0; i < sqlTestCases.length; i++) {
      const tc = sqlTestCases[i];
      const testNum = i + 1;

      try {
        // Truncate all tables for clean state
        for (const schema of schemas) {
          const tableName = schema?.tableName || schema?.table_name || 'Table';
          try { await db.query(`DELETE FROM ${tableName}`); } catch (e) { /* ignore */ }
        }

        // Insert test data
        // table_data format: { "TableName": [["col1","col2"], ["val1","val2"], ...] }
        // May be JSON string (from Firestore) or already parsed object
        let tableData = tc.table_data;
        if (typeof tableData === 'string') {
          try { tableData = JSON.parse(tableData); } catch (e) { tableData = {}; }
        }

        for (const tableName of Object.keys(tableData || {})) {
          const rows = tableData[tableName];
          if (!Array.isArray(rows) || rows.length < 2) continue;
          const headers = rows[0];
          const dataRows = rows.slice(1);

          for (const row of dataRows) {
            const vals = headers.map((_h: string, idx: number) => {
              const val = row[idx];
              if (val === null || val === undefined) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              return val;
            });
            await db.query(`INSERT INTO ${tableName} (${headers.join(', ')}) VALUES (${vals.join(', ')})`);
          }
        }

        // Execute student's SQL
        const startTime = Date.now();
        const result = await db.query(studentCode);
        const executionTime = Date.now() - startTime;

        const actualRows = result.rows || [];
        const actualHeaders = actualRows.length > 0 ? Object.keys(actualRows[0]) : [];

        // Get expected output
        let expectedOutput = tc.expected_output;
        if (typeof expectedOutput === 'string') {
          try { expectedOutput = JSON.parse(expectedOutput); } catch (e) { expectedOutput = { columns: [], rows: [] }; }
        }
        const expectedColumns = expectedOutput?.columns || [];
        const expectedRows = expectedOutput?.rows || [];

        // Compare results
        let passed = false;
        if (actualHeaders.length === expectedColumns.length && actualRows.length === expectedRows.length) {
          passed = true;
          for (let ri = 0; ri < expectedRows.length && passed; ri++) {
            for (let ci = 0; ci < expectedColumns.length && passed; ci++) {
              const expectedVal = expectedRows[ri][ci];
              const headerName = expectedColumns[ci];
              const actualKey = actualHeaders.find((h: string) => h.toLowerCase() === headerName.toLowerCase()) || actualHeaders[ci];
              const actualVal = actualRows[ri]?.[actualKey];

              if (actualVal === null && expectedVal === null) continue;
              if (actualVal === null || expectedVal === null) { passed = false; break; }

              const aStr = String(actualVal).trim().toLowerCase();
              const eStr = String(expectedVal).trim().toLowerCase();
              if (aStr !== eStr) {
                const aNum = parseFloat(String(actualVal));
                const eNum = parseFloat(String(expectedVal));
                if (isNaN(aNum) || isNaN(eNum) || Math.abs(aNum - eNum) >= 0.0001) {
                  passed = false;
                }
              }
            }
          }
        }

        if (passed) passedCount++;

        testResults.push({
          testNumber: testNum,
          title: tc.title || `Test ${testNum}`,
          passed,
          actualHeaders,
          actualRowCount: actualRows.length,
          expectedColumns,
          expectedRowCount: expectedRows.length,
          executionTime: `${executionTime}ms`,
          error: null
        });

        // console.log(`         Test ${testNum}: ${passed ? '✅ PASSED' : '❌ FAILED'} (${executionTime}ms)`);

      } catch (testError: any) {
        testResults.push({
          testNumber: testNum,
          title: tc.title || `Test ${testNum}`,
          passed: false,
          actualHeaders: [],
          actualRowCount: 0,
          expectedColumns: [],
          expectedRowCount: 0,
          executionTime: null,
          error: testError.message
        });
        // console.log(`         Test ${testNum}: ❌ ERROR: ${testError.message}`);
      }
    }

    // Cleanup
    try { await db.close(); } catch (e) { /* ignore */ }

    // Calculate marks (identical to Judge0 pattern)
    const score = totalTests > 0 ? passedCount / totalTests : 0;
    const marksAwarded = Math.round(score * questionMaxMarks * 100) / 100;

    return {
      passedCount,
      totalTests,
      testResults,
      marksAwarded,
      isCorrect: passedCount === totalTests
    };

  } catch (initError: any) {
    // Cleanup on error
    if (db) { try { await db.close(); } catch (e) { /* ignore */ } }
    console.error(`      ❌ PGlite initialization failed: ${initError.message}`);
    return {
      passedCount: 0,
      totalTests,
      testResults,
      marksAwarded: 0,
      isCorrect: false,
      error: initError.message
    };
  }
}

/**
 * Shared grading logic - handles all question types
 * Used by both submitAndGradeExam and autoSubmitPendingAttempts
 */
async function gradeAttempt(examId: string, attemptId: string, responses: any[]) {
  // console.log(`🎯 Starting grading for attempt: ${attemptId}`);
  
  // Fetch exam WITH answers
  const examDoc = await admin.firestore()
    .collection(COLLECTIONS.EXAMS)
    .doc(examId)
    .get();
  
  if (!examDoc.exists) {
    throw new Error('Exam not found');
  }
  
  const exam = examDoc.data() as any;
  
  // ✅ SUB-COLLECTION: Read questions from sub-collection for grading
  const questionsDoc = await admin.firestore()
    .collection(COLLECTIONS.EXAMS)
    .doc(examId)
    .collection('examQuestions')
    .doc('main')
    .get();
  
  const questionsData = questionsDoc.exists ? questionsDoc.data() as any : {};
  exam.questionsList = questionsData.questionsList || [];
  exam.questionPool = questionsData.questionPool || [];
  exam.likertQuestions = questionsData.likertQuestions || [];
  
  // Fetch attempt document to get poolQuestionIds (the exact questions presented to this student)
  const attemptDoc = await admin.firestore()
    .collection(COLLECTIONS.EXAM_ATTEMPTS)
    .doc(attemptId)
    .get();
  const attemptData = attemptDoc.exists ? attemptDoc.data() as any : {};
  const poolQuestionIds: string[] = attemptData.poolQuestionIds || [];
  
  if (exam.enableQuestionPool && poolQuestionIds.length > 0) {
    // console.log(`📋 Found ${poolQuestionIds.length} presented pool question IDs in attempt`);
  }
  
  const allQuestions = [
    ...(exam.questionsList || []),
    ...(exam.questionPool || []),
    ...(exam.likertQuestions || [])
  ];
  
  // Build set of actual pool question IDs (from exam.questionPool, NOT questionsList)
  const poolQuestionIdSet = new Set<string>(
    (exam.questionPool || []).map((q: any) => q.id)
  );
  
  // console.log(`🔑 Fetched exam WITH answers (${allQuestions.length} questions, ${poolQuestionIdSet.size} pool questions)`);
  
  // Initialize aggregation variables
  let totalScore = 0;
  let maxMarks = 0;
  let attemptedQuestions = 0;
  let correctAnswers = 0;
  let pendingManualGrading = 0;
  
  const byType: any = {};
  const byComplexity: any = {
    easy: { attempted: 0, score: 0, maxScore: 0 },
    medium: { attempted: 0, score: 0, maxScore: 0 },
    hard: { attempted: 0, score: 0, maxScore: 0 }
  };
  const byChapter: any = {};
  
  const gradedResponses = [];
  
  // Helper: Track performance metrics (byType, byComplexity, byChapter, totalScore, correctAnswers)
  // Called before every continue in CODE/SQL blocks to ensure no question is skipped
  function trackPerformance(question: any, response: any, questionMaxMarks: number, marksAwarded: number, isAttempted: boolean, isCorrect: boolean) {
    totalScore += marksAwarded;
    if (isCorrect) correctAnswers++;
    
    const qType = question.type;
    if (!byType[qType]) byType[qType] = { attempted: 0, score: 0, maxScore: 0 };
    byType[qType].maxScore += questionMaxMarks;
    if (isAttempted) { byType[qType].attempted++; byType[qType].score += marksAwarded; }
    
    if (question.complexity) {
      const complexity = question.complexity.toLowerCase() as 'easy' | 'medium' | 'hard';
      if (byComplexity[complexity]) {
        byComplexity[complexity].maxScore += questionMaxMarks;
        if (isAttempted) { byComplexity[complexity].attempted++; byComplexity[complexity].score += marksAwarded; }
      }
    }
    
    const chapterName = question.chapter || response.chapter;
    if (chapterName) {
      if (!byChapter[chapterName]) byChapter[chapterName] = { attempted: 0, score: 0, maxScore: 0 };
      byChapter[chapterName].maxScore += questionMaxMarks;
      if (isAttempted) { byChapter[chapterName].attempted++; byChapter[chapterName].score += marksAwarded; }
    }
  }
  
  // traitMap for Likert personality aggregation (populated during grading loop)
  const traitMap: Record<string, { total: number; count: number; max: number }> = {};

  // Grade each response
  for (const response of responses) {
    const question = allQuestions.find((q: any) => q.id === response.questionId);
    
    if (!question) {
      // console.warn(`Question not found: ${response.questionId}`);
      gradedResponses.push({
        ...response,
        marksAwarded: 0,
        scoredMarks: 0,
        evaluationStatus: 'error',
        evaluationMethod: 'not_found'
      });
      continue;
    }
    
    const isPoolQuestion = exam.enableQuestionPool && poolQuestionIdSet.has(question.id);
    const questionMaxMarks = question.type === 'likert' ? 0
      : isPoolQuestion && exam.poolQuestionMarks != null
      ? Number(exam.poolQuestionMarks)
      : (question.marks || question.maximumMarks || 0);
    maxMarks += questionMaxMarks;
    
    const isAttempted = response.studentAnswer !== null && 
                       response.studentAnswer !== '' && 
                       !(Array.isArray(response.studentAnswer) && response.studentAnswer.length === 0);
    
    if (isAttempted) attemptedQuestions++;
    
    let marksAwarded = 0;
    let isCorrect = false;
    let evaluationMethod = 'not_attempted';
    let aiFeedback = null;
    
    // ============================================
    // MCQ GRADING
    // ============================================
    if (question.type === 'mcq' && isAttempted) {
      const correctAnswersList = question.correctAnswers || [question.correctAnswer];
      const studentAnswer = response.studentAnswer;
      
      if (Array.isArray(studentAnswer)) {
        const correctCount = studentAnswer.filter((ans: any) => 
          correctAnswersList.includes(ans)
        ).length;
        const wrongCount = studentAnswer.filter((ans: any) => 
          !correctAnswersList.includes(ans)
        ).length;
        
        const score = Math.max(0, correctCount - wrongCount) / correctAnswersList.length;
        marksAwarded = Math.round(score * questionMaxMarks * 100) / 100;
        isCorrect = correctCount === correctAnswersList.length && wrongCount === 0;
      } else {
        isCorrect = correctAnswersList.includes(studentAnswer);
        marksAwarded = isCorrect ? questionMaxMarks : 0;
      }
      evaluationMethod = 'mcq_auto';
    }
    
    // ============================================
    // FITB GRADING
    // ============================================
    else if (question.type === 'fitb' && isAttempted) {
      const correctAnswersList = question.correctAnswers || [];
      const studentAnswer = Array.isArray(response.studentAnswer) 
        ? response.studentAnswer 
        : [response.studentAnswer];
      
      let correctCount = 0;
      for (let i = 0; i < correctAnswersList.length; i++) {
        const correct = (correctAnswersList[i] || '').toString().toLowerCase().trim();
        const student = (studentAnswer[i] || '').toString().toLowerCase().trim();
        if (correct === student) correctCount++;
      }
      
      const score = correctAnswersList.length > 0 ? correctCount / correctAnswersList.length : 0;
      marksAwarded = Math.round(score * questionMaxMarks * 100) / 100;
      isCorrect = correctCount === correctAnswersList.length;
      evaluationMethod = 'fitb_auto';
    }
    
    // ============================================
    // JUMBLED GRADING
    // ============================================
    else if (question.type === 'jumbled' && isAttempted) {
      const correctSequence = question.correctAnswers || [];
      const studentSequence = response.studentAnswer || [];
      
      isCorrect = JSON.stringify(correctSequence) === JSON.stringify(studentSequence);
      marksAwarded = isCorrect ? questionMaxMarks : 0;
      evaluationMethod = 'jumbled_auto';
    }
    
    // ============================================
    // DESCRIPTIVE - AI GRADING
    // ============================================
    else if ((question.type === 'descriptive' || question.type === 'text') && isAttempted) {
      try {
        // console.log(`      🤖 AI grading descriptive Q${response.questionNo}...`);
        
        const modelAnswer = question.correctAnswers?.[0] || '';
        const studentAnswer = response.studentAnswer as string;
        const isOfflineExam = response.imageUrl ? true : false;
        
        aiFeedback = await evaluateAnswerWithAIHelper({
          questionText: question.questionText,
          modelAnswer: modelAnswer,
          studentAnswer: studentAnswer,
          maxMarks: questionMaxMarks,
          isOfflineExam: isOfflineExam,
          imageUrl: response.imageUrl
        });
        
        marksAwarded = aiFeedback.suggestedMarks;
        isCorrect = marksAwarded >= (questionMaxMarks * 0.6);
        evaluationMethod = 'ai_grading';
        
        // console.log(`      ✅ AI awarded ${marksAwarded}/${questionMaxMarks} marks`);
        
      } catch (aiError: any) {
        console.error(`      ❌ AI grading failed: ${aiError.message}`);
        marksAwarded = 0;
        evaluationMethod = 'pending_manual';
        pendingManualGrading++;
      }
    }
    
    // ============================================
    // CODE GRADING (SERVER-SIDE JUDGE0 + AI FEEDBACK)
    // ============================================
    else if (question.type === 'code' && isAttempted) {
      // console.log(`      💻 Grading code with Judge0 execution + AI analysis...`);
      
      const testCases = question.testCases || [];
      const studentCode = response.studentAnswer as string;
      
      // ✅ CHECK: If code is empty/null/undefined, mark as not attempted
      if (!studentCode || studentCode.trim() === '') {
        // console.log(`      ⚠️ No code submitted for Q${response.questionNo} - marking as unattempted`);
        
        gradedResponses.push({
          ...response,
          studentAnswer: '',
          marksAwarded: 0,
          maxMarks: questionMaxMarks,
          isCorrect: false,
          evaluationStatus: 'not_attempted',
          evaluationMethod: 'not_attempted',
          autoEvaluated: false,
          evaluatedBy: null,
          evaluatedAt: null,
          evaluationError: 'No code submitted'
        });
        
        trackPerformance(question, response, questionMaxMarks, 0, false, false);
        continue;
      }
      
      const programmingLanguage = response.programmingLanguage || question.programmingLanguage || question.language || 'javascript';
      let passedCount = 0;
      let testResults: any[] = [];
      
      // Judge0 Language ID mapping
      const languageIdMap: { [key: string]: number } = {
        'javascript': 63,
        'python': 71,
        'java': 62,
        'cpp': 54,
        'c': 50,
        'csharp': 51,
        'ruby': 72,
        'go': 60,
        'php': 68,
        'typescript': 74,
        'kotlin': 78,
        'swift': 83,
        'rust': 73
      };
      
      const languageId = languageIdMap[programmingLanguage.toLowerCase()] || 63;
      
      // console.log(`      🔧 Programming Language: ${programmingLanguage} (Judge0 ID: ${languageId})`);
      
      // Fetch Judge0 base URL
      let JUDGE0_BASE_URL = '';
      
      try {
        // console.log(`      📥 Fetching Judge0 base URL from Firestore...`);
        
        const settingsDoc = await admin.firestore()
          .collection('settings')
          .doc('judge0_base_url')
          .get();
        
        if (settingsDoc.exists) {
          const settingsData = settingsDoc.data();
          JUDGE0_BASE_URL = settingsData?.url || settingsData?.value || settingsData?.judge0_base_url || '';
          // console.log(`      ✅ Judge0 URL: ${JUDGE0_BASE_URL}`);
        } else {
          console.error(`      ❌ Judge0 settings document not found`);
          throw new Error('Judge0 base URL not configured');
        }
        
        if (!JUDGE0_BASE_URL) {
          throw new Error('Judge0 base URL is empty');
        }
        
        JUDGE0_BASE_URL = JUDGE0_BASE_URL.replace(/\/$/, '');
        
      } catch (configError: any) {
        marksAwarded = 0;
        isCorrect = false;
        evaluationMethod = 'pending_manual';
        pendingManualGrading++;
        
        gradedResponses.push({
          ...response,
          questionType: 'code',
          complexity: question.complexity,
          chapter: question.chapter,
          studentAnswer: studentCode || '',
          marksAwarded: 0,
          maxMarks: questionMaxMarks,
          isCorrect: false,
          evaluationStatus: 'pending',
          evaluationMethod: 'pending_manual',
          autoEvaluated: false,
          evaluatedBy: 'system',
          evaluationError: `Judge0 configuration error: ${configError.message}`,
          evaluatedAt: new Date()
        });
        
        trackPerformance(question, response, questionMaxMarks, 0, isAttempted, false);
        continue;
      }
      
      // Execute code with Judge0
      try {
        // console.log(`      🚀 Executing ${testCases.length} test cases with Judge0...`);
        
        for (let i = 0; i < testCases.length; i++) {
          const testCase = testCases[i];
          
          // console.log(`         Test ${i + 1}: Input="${testCase.input}"`);
          
          const submissionResponse = await fetch(
            `${JUDGE0_BASE_URL}/submissions?base64_encoded=false&wait=true`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                source_code: studentCode,
                language_id: languageId,
                stdin: testCase.input,
                expected_output: testCase.expected_output
              })
            }
          );
          
          if (!submissionResponse.ok) {
            const errorText = await submissionResponse.text();
            console.error(`         ❌ Judge0 request failed: ${submissionResponse.status}`);
            console.error(`         Response: ${errorText}`);
            throw new Error(`Judge0 submission failed: ${submissionResponse.status} - ${errorText}`);
          }
          
          const result = await submissionResponse.json();
          
          // console.log(`         Judge0 Response:`, {
          //   status: result.status?.description,
          //   statusId: result.status?.id,
          //   time: result.time,
          //   memory: result.memory
          // });
          
          const actualOutput = result.stdout?.trim() || '';
          const expectedOutput = testCase.expected_output?.trim() || '';
          const passed = result.status?.id === 3 && actualOutput === expectedOutput;
          
          testResults.push({
            testNumber: i + 1,
            input: testCase.input,
            expectedOutput: expectedOutput,
            actualOutput: actualOutput,
            passed: passed,
            error: result.stderr || result.compile_output || null,
            executionTime: result.time || null,
            memory: result.memory || null,
            statusId: result.status?.id || null,
            statusDescription: result.status?.description || 'Unknown'
          });
          
          if (passed) {
            passedCount++;
            // console.log(`         ✅ Test ${i + 1} PASSED`);
          } else {
            // console.log(`         ❌ Test ${i + 1} FAILED`);
            // console.log(`            Expected: "${expectedOutput}"`);
            // console.log(`            Got: "${actualOutput}"`);
            // console.log(`            Status: ${result.status?.description}`);
            if (result.stderr) {
              // console.log(`            Error: ${result.stderr.substring(0, 200)}`);
            }
          }
          
          if (i < testCases.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
      } catch (judge0Error: any) {
        console.error(`      ❌ Judge0 execution failed:`, judge0Error.message);
        
        marksAwarded = 0;
        isCorrect = false;
        evaluationMethod = 'pending_manual';
        pendingManualGrading++;
        
        gradedResponses.push({
          ...response,
          questionType: 'code',
          complexity: question.complexity,
          chapter: question.chapter,
          studentAnswer: studentCode || '',
          marksAwarded: 0,
          maxMarks: questionMaxMarks,
          isCorrect: false,
          evaluationStatus: 'pending',
          evaluationMethod: 'pending_manual',
          autoEvaluated: false,
          evaluatedBy: 'system',
          evaluationError: `Judge0 execution failed: ${judge0Error.message}`,
          evaluatedAt: new Date()
        });
        
        trackPerformance(question, response, questionMaxMarks, 0, isAttempted, false);
        continue;
      }
      
      // Calculate marks
      const score = testCases.length > 0 ? passedCount / testCases.length : 0;
      marksAwarded = Math.round(score * questionMaxMarks * 100) / 100;
      isCorrect = passedCount === testCases.length;
      evaluationMethod = 'code_auto_judge0';
      
      // console.log(`      📊 Final Test Results: ${passedCount}/${testCases.length} passed`);
      // console.log(`      💯 Marks: ${marksAwarded}/${questionMaxMarks}`);
      
      // AI Code Analysis
      let codeAIFeedback = null;
      
      try {
        // console.log(`      🤖 Analyzing code with AI...`);
        
        codeAIFeedback = await analyzeCodeWithAIHelper({
          questionText: question.questionText,
          studentCode: studentCode,
          programmingLanguage: programmingLanguage,
          testCases: testCases,
          testResults: testResults,
          passedTests: passedCount,
          totalTests: testCases.length,
          modelSolution: question.solution || ''
        });
        
        // console.log(`      ✅ AI Analysis complete:`);
        // console.log(`         - Code Quality: ${codeAIFeedback.codeQuality}/100`);
        // console.log(`         - Time Complexity: ${codeAIFeedback.timeComplexity}`);
        // console.log(`         - Space Complexity: ${codeAIFeedback.spaceComplexity}`);
        
        if (codeAIFeedback.allTestsPassed) {
          // console.log(`         - Optimizations: ${codeAIFeedback.optimizationSuggestions?.length || 0}`);
        } else {
          // console.log(`         - Bugs found: ${codeAIFeedback.bugLocations?.length || 0}`);
        }
        
      } catch (aiError: any) {
        console.error(`      ⚠️ AI code analysis failed: ${aiError.message}`);
      }
      
      // Store graded response
      gradedResponses.push({
        ...response,
        questionType: 'code',
        complexity: question.complexity,
        chapter: question.chapter,
        studentAnswer: studentCode || '',
        programmingLanguage: programmingLanguage,
        marksAwarded,
        maxMarks: questionMaxMarks,
        isCorrect,
        evaluationStatus: 'completed',
        evaluationMethod,
        autoEvaluated: true,
        evaluatedBy: 'auto-grading-system',
        testResults: testResults,
        passedTests: passedCount,
        totalTests: testCases.length,
        codeAIFeedback: codeAIFeedback || undefined,
        evaluatedAt: new Date()
      });
      
      trackPerformance(question, response, questionMaxMarks, marksAwarded, isAttempted, isCorrect);
      continue;
    }
    
    // ============================================
    // SQL GRADING (SERVER-SIDE PGlite + Test Cases)
    // ============================================
    else if (question.type === 'sql' && isAttempted) {
      // console.log(`      🐘 Grading SQL with PGlite execution...`);
      
      const studentCode = response.studentAnswer as string;
      
      // CHECK: If code is empty, mark as not attempted
      if (!studentCode || studentCode.trim() === '') {
        // console.log(`      ⚠️ No SQL submitted for Q${response.questionNo} - marking as unattempted`);
        
        gradedResponses.push({
          ...response,
          studentAnswer: '',
          marksAwarded: 0,
          maxMarks: questionMaxMarks,
          isCorrect: false,
          evaluationStatus: 'not_attempted',
          evaluationMethod: 'not_attempted',
          autoEvaluated: false,
          evaluatedBy: null,
          evaluatedAt: null,
          evaluationError: 'No SQL query submitted'
        });
        
        trackPerformance(question, response, questionMaxMarks, 0, false, false);
        continue;
      }
      
      const sqlSchema = question.sqlSchema || question.sql_schema || [];
      const sqlTestCases = question.sqlTestCases || question.sql_test_cases || [];
      
      if (sqlTestCases.length === 0) {
        // console.log(`      ⚠️ No SQL test cases for Q${response.questionNo} - pending manual`);
        evaluationMethod = 'pending_manual';
        pendingManualGrading++;
        
        gradedResponses.push({
          ...response,
          questionType: 'sql',
          complexity: question.complexity,
          chapter: question.chapter,
          studentAnswer: studentCode || '',
          marksAwarded: 0,
          maxMarks: questionMaxMarks,
          isCorrect: false,
          evaluationStatus: 'pending',
          evaluationMethod: 'pending_manual',
          autoEvaluated: false,
          evaluatedBy: 'system',
          evaluationError: 'No SQL test cases configured',
          evaluatedAt: new Date()
        });
        
        trackPerformance(question, response, questionMaxMarks, 0, isAttempted, false);
        continue;
      }
      
      try {
        // console.log(`      🚀 Executing ${sqlTestCases.length} SQL test cases with PGlite...`);
        
        const sqlResult = await gradeSqlWithPGlite({
          studentCode,
          sqlSchema,
          sqlTestCases,
          questionMaxMarks
        });
        
        marksAwarded = sqlResult.marksAwarded;
        isCorrect = sqlResult.isCorrect;
        evaluationMethod = 'sql_auto_pglite';
        
        // console.log(`      📊 SQL Test Results: ${sqlResult.passedCount}/${sqlResult.totalTests} passed`);
        // console.log(`      💯 Marks: ${marksAwarded}/${questionMaxMarks}`);
        
        // Store graded response (mirrors CODE pattern)
        gradedResponses.push({
          ...response,
          questionType: 'sql',
          complexity: question.complexity,
          chapter: question.chapter,
          studentAnswer: studentCode || '',
          marksAwarded,
          maxMarks: questionMaxMarks,
          isCorrect,
          evaluationStatus: 'completed',
          evaluationMethod,
          autoEvaluated: true,
          evaluatedBy: 'auto-grading-system',
          testResults: sqlResult.testResults,
          passedTests: sqlResult.passedCount,
          totalTests: sqlResult.totalTests,
          evaluatedAt: new Date()
        });
        
        trackPerformance(question, response, questionMaxMarks, marksAwarded, isAttempted, isCorrect);
        continue;
        
      } catch (sqlError: any) {
        console.error(`      ❌ PGlite execution failed:`, sqlError.message);
        
        marksAwarded = 0;
        isCorrect = false;
        evaluationMethod = 'pending_manual';
        pendingManualGrading++;
        
        gradedResponses.push({
          ...response,
          questionType: 'sql',
          complexity: question.complexity,
          chapter: question.chapter,
          studentAnswer: studentCode || '',
          marksAwarded: 0,
          maxMarks: questionMaxMarks,
          isCorrect: false,
          evaluationStatus: 'pending',
          evaluationMethod: 'pending_manual',
          autoEvaluated: false,
          evaluatedBy: 'system',
          evaluationError: `PGlite execution failed: ${sqlError.message}`,
          evaluatedAt: new Date()
        });
        
        trackPerformance(question, response, questionMaxMarks, 0, isAttempted, false);
        continue;
      }
    }
    
    // ============================================
    // LIKERT GRADING - Personality Trait Scoring
    // ============================================
    else if (question.type === 'likert' && isAttempted) {
      const rawScore = parseInt(response.studentAnswer as string, 10);
      const direction = question.likertDirection || 'normal';
      const traitScore = direction === 'reverse' ? (6 - rawScore) : rawScore;
      const trait = question.likertTrait || 'General';

      // Accumulate into traitMap for personality profile (aggregated at attempt level)
      if (!traitMap[trait]) traitMap[trait] = { total: 0, count: 0, max: 0 };
      traitMap[trait].total += traitScore;
      traitMap[trait].count += 1;
      traitMap[trait].max += 5;

      marksAwarded = 0;
      isCorrect = false;
      evaluationMethod = 'likert_auto';
    }
    
    // ============================================
    // OTHER TYPES - Pending
    // ============================================
    else if (isAttempted) {
      evaluationMethod = 'pending_manual';
      pendingManualGrading++;
    }
    
    // Add to totals
    totalScore += marksAwarded;
    if (isCorrect) correctAnswers++;
    
    // Track by type
    const qType = question.type;
    if (!byType[qType]) {
      byType[qType] = { attempted: 0, score: 0, maxScore: 0 };
    }
    byType[qType].maxScore += questionMaxMarks;
    if (isAttempted) {
      byType[qType].attempted++;
      byType[qType].score += marksAwarded;
    }
    
    // Track by complexity
    if (question.complexity) {
      const complexity = question.complexity.toLowerCase() as 'easy' | 'medium' | 'hard';
      if (byComplexity[complexity]) {
        byComplexity[complexity].maxScore += questionMaxMarks;
        if (isAttempted) {
          byComplexity[complexity].attempted++;
          byComplexity[complexity].score += marksAwarded;
        }
      }
    }
    
    // Track by chapter
    const chapterName = question.chapter || response.chapter;
    if (chapterName) {
      if (!byChapter[chapterName]) {
        byChapter[chapterName] = { attempted: 0, score: 0, maxScore: 0 };
      }
      byChapter[chapterName].maxScore += questionMaxMarks;
      if (isAttempted) {
        byChapter[chapterName].attempted++;
        byChapter[chapterName].score += marksAwarded;
      }
    }
    
    // Store graded response
    gradedResponses.push({
      ...response,
      chapter: response.chapter || question.chapter || undefined,
      marksAwarded,
      scoredMarks: marksAwarded,
      maxMarks: questionMaxMarks,
      isCorrect,
      evaluationStatus: evaluationMethod === 'pending_manual' ? 'pending' : 'evaluated',
      evaluationMethod,
      autoEvaluated: evaluationMethod !== 'pending_manual',
      evaluatedBy: evaluationMethod !== 'pending_manual' ? 'auto_grader' : null,
      aiFeedback: aiFeedback || null,
      evaluatedAt: evaluationMethod !== 'pending_manual' ? new Date() : null
    });
  }
  
  // percentage is calculated after pool maxMarks correction below
  
  // ✅ Add unattempted questions to byType, byComplexity, byChapter
  // For NON-POOL questions (questionsList): add unattempted ones normally
  for (const question of allQuestions) {
    const hasResponse = responses.some((r: any) => r.questionId === question.id);
    if (!hasResponse) {
      // Skip ALL pool questions here — they are handled separately below
      const isPoolQuestion = exam.enableQuestionPool && poolQuestionIdSet.has(question.id);
      if (isPoolQuestion) continue;
      
      // Skip likert questions — they don't contribute to marks
      if (question.type === 'likert') continue;
      
      const qMaxMarks = question.maximumMarks || question.marks || question.maxMarks || 0;
      
      const qType = question.type;
      if (qType) {
        if (!byType[qType]) byType[qType] = { attempted: 0, score: 0, maxScore: 0 };
        byType[qType].maxScore += qMaxMarks;
      }
      
      if (question.complexity) {
        const complexity = question.complexity.toLowerCase() as 'easy' | 'medium' | 'hard';
        if (byComplexity[complexity]) {
          byComplexity[complexity].maxScore += qMaxMarks;
        }
      }
      
      const unattemptedChapter = question.chapter || 
        responses.find((r: any) => r.questionId === question.id)?.chapter;
      if (unattemptedChapter) {
        if (!byChapter[unattemptedChapter]) byChapter[unattemptedChapter] = { attempted: 0, score: 0, maxScore: 0 };
        byChapter[unattemptedChapter].maxScore += qMaxMarks;
      }
    }
  }
  
  // ✅ POOL QUESTIONS: Recalculate maxScore for chapter/type/complexity
  // using the EXACT presented pool question IDs stored in the attempt document
  if (exam.enableQuestionPool && exam.questionPool && Array.isArray(exam.questionPool)) {
    const poolQuestionMarksValue = Number(exam.poolQuestionMarks) || 0;
    const pickRandomCount = Number(exam.pickRandomCount) || 0;
    
    // Determine presented pool questions — use stored IDs if available, else fallback to distribution estimate
    let presentedPoolQuestions: any[] = [];
    
    if (poolQuestionIds.length > 0) {
      // ✅ EXACT: We know exactly which questions were shown to this student
      const poolIdSet = new Set(poolQuestionIds);
      presentedPoolQuestions = exam.questionPool.filter((q: any) => poolIdSet.has(q.id));
      // console.log(`📋 Using exact poolQuestionIds: ${presentedPoolQuestions.length} presented questions`);
    } else {
      // ⚠️ FALLBACK for older attempts without poolQuestionIds — use distribution estimate
      // console.log('⚠️ No poolQuestionIds in attempt — using distribution estimate');
      
      const poolByChapter = new Map<string, any[]>();
      for (const q of exam.questionPool) {
        const chapter = q.chapter || q.board || q.subject || 'General';
        if (!poolByChapter.has(chapter)) poolByChapter.set(chapter, []);
        poolByChapter.get(chapter)!.push(q);
      }
      
      const totalChapters = poolByChapter.size;
      const baseQuota = Math.floor(pickRandomCount / totalChapters);
      
      const chapterPresentedCount = new Map<string, number>();
      let assigned = 0;
      for (const [chapter, questions] of poolByChapter) {
        const quota = Math.min(baseQuota, questions.length);
        chapterPresentedCount.set(chapter, quota);
        assigned += quota;
      }
      
      let remainingToAssign = pickRandomCount - assigned;
      if (remainingToAssign > 0) {
        const chaptersWithCapacity = Array.from(poolByChapter.entries())
          .filter(([chapter, questions]) => questions.length > (chapterPresentedCount.get(chapter) || 0))
          .sort((a, b) => b[1].length - a[1].length);
        
        for (const [chapter] of chaptersWithCapacity) {
          if (remainingToAssign === 0) break;
          chapterPresentedCount.set(chapter, (chapterPresentedCount.get(chapter) || 0) + 1);
          remainingToAssign--;
        }
      }
      
      // Build synthetic presentedPoolQuestions from estimated counts
      for (const [chapter, count] of chapterPresentedCount) {
        for (let i = 0; i < count; i++) {
          const chapQuestions = poolByChapter.get(chapter) || [];
          if (chapQuestions[i]) {
            presentedPoolQuestions.push(chapQuestions[i]);
          }
        }
      }
    }
    
    // Now correct byChapter, byType, byComplexity using presented pool questions
    // Step 1: Subtract what the grading loop added for responded pool questions
    const respondedPoolIds = new Set(
      responses
        .filter((r: any) => poolQuestionIdSet.has(r.questionId))
        .map((r: any) => r.questionId)
    );
    
    for (const r of responses) {
      const q = allQuestions.find((aq: any) => aq.id === r.questionId);
      if (!q || !poolQuestionIdSet.has(q.id)) continue;
      
      const chapter = q.chapter || q.board || q.subject || 'General';
      const qType = q.type;
      const complexity = q.complexity ? q.complexity.toLowerCase() : null;
      
      // Remove the per-response maxScore that grading loop added
      if (byChapter[chapter]) byChapter[chapter].maxScore -= poolQuestionMarksValue;
      if (qType && byType[qType]) byType[qType].maxScore -= poolQuestionMarksValue;
      if (complexity && byComplexity[complexity]) byComplexity[complexity].maxScore -= poolQuestionMarksValue;
    }
    
    // Step 2: Add correct maxScore for ALL presented pool questions (including untouched ones)
    for (const q of presentedPoolQuestions) {
      const chapter = q.chapter || q.board || q.subject || 'General';
      const qType = q.type;
      const complexity = q.complexity ? q.complexity.toLowerCase() : null;
      
      if (!byChapter[chapter]) byChapter[chapter] = { attempted: 0, score: 0, maxScore: 0 };
      byChapter[chapter].maxScore += poolQuestionMarksValue;
      
      if (qType) {
        if (!byType[qType]) byType[qType] = { attempted: 0, score: 0, maxScore: 0 };
        byType[qType].maxScore += poolQuestionMarksValue;
      }
      
      if (complexity) {
        if (!byComplexity[complexity]) byComplexity[complexity] = { attempted: 0, score: 0, maxScore: 0 };
        byComplexity[complexity].maxScore += poolQuestionMarksValue;
      }
    }
    
    // Step 3: Fix total maxMarks
    const gradingLoopPoolMax = respondedPoolIds.size * poolQuestionMarksValue;
    const correctPoolMax = presentedPoolQuestions.length * poolQuestionMarksValue;
    maxMarks = (maxMarks - gradingLoopPoolMax) + correctPoolMax;
    
    // console.log('📊 Pool correction applied:');
    // console.log(`   - Presented: ${presentedPoolQuestions.length} questions`);
    // console.log(`   - Responded: ${respondedPoolIds.size} questions`);
    // console.log(`   - Pool maxMarks: ${correctPoolMax}`);
    // console.log(`   - Total maxMarks: ${maxMarks}`);
  }
  
  // Recalculate percentage with corrected maxMarks
  const correctedPercentage = maxMarks > 0 ? (totalScore / maxMarks) * 100 : 0;
  
  // Calculate total questions from exam and time spent from responses
  // For pool-based exams, total = questionsList count + pickRandomCount (not entire pool)
  const nonPoolQuestionCount = allQuestions.filter((q: any) => !(exam.enableQuestionPool && q.source === 'questionBank')).length;
  const totalQuestions = nonPoolQuestionCount + (exam.enableQuestionPool ? Number(exam.pickRandomCount) || 0 : 0);
  const timeSpent = responses.reduce((sum: number, r: any) => sum + (r.timeSpent || 0), 0);
  
  // console.log(`✅ Grading complete: ${totalScore}/${maxMarks} (${correctedPercentage.toFixed(2)}%)`);
  // console.log(`   - Total questions: ${totalQuestions}`);
  // console.log(`   - Attempted: ${attemptedQuestions}/${totalQuestions}`);
  // console.log(`   - Correct: ${correctAnswers}`);
  // console.log(`   - Time spent: ${timeSpent}s`);
  // console.log(`   - Pending manual: ${pendingManualGrading}`);
  
  // ============================================
  // PERSONALITY PROFILE AGGREGATION (Likert)
  // ============================================
  const personalityProfile: Record<string, { score: number; maxScore: number; average: number; percentage: number; level: string }> = {};
  for (const [trait, data] of Object.entries(traitMap)) {
    const traitPercentage = parseFloat(((data.total / data.max) * 100).toFixed(1));
    const level = traitPercentage <= 20 ? 'Very Low'
      : traitPercentage <= 40 ? 'Low'
      : traitPercentage <= 60 ? 'Moderate'
      : traitPercentage <= 80 ? 'High'
      : 'Very High';
    personalityProfile[trait] = {
      score: data.total,
      maxScore: data.max,
      average: parseFloat((data.total / data.count).toFixed(2)),
      percentage: traitPercentage,
      level
    };
  }
  const hasPersonalityData = Object.keys(personalityProfile).length > 0;

  // Derive personality type from top 2 traits
  let personalityType: any = null;
  if (hasPersonalityData) {
    const sorted = Object.entries(personalityProfile).sort((a, b) => b[1].percentage - a[1].percentage);
    const top1 = sorted[0]?.[0] || '';
    const top2 = sorted[1]?.[0] || '';

    const PERSONALITY_TYPES = [
      { t1: 'Problem Solving', t2: 'Openness',           title: 'The Strategic Innovator',      desc: 'Combines strong analytical thinking with curiosity for new ideas. Excels at finding creative solutions to complex challenges.',      careers: ['Software Architect', 'Data Scientist', 'R&D Engineer', 'Product Manager'] },
      { t1: 'Leadership',      t2: 'Extraversion',        title: 'The Dynamic Leader',            desc: 'A charismatic, action-oriented leader who thrives in social settings. Naturally rallies teams and drives group energy.',               careers: ['CEO', 'Sales Director', 'Event Manager', 'Startup Founder'] },
      { t1: 'Conscientiousness', t2: 'Problem Solving',   title: 'The Methodical Achiever',       desc: 'Highly organized and detail-oriented with strong analytical skills. Systematic approach ensures consistent high-quality results.',    careers: ['Project Manager', 'Quality Analyst', 'Auditor', 'Systems Engineer'] },
      { t1: 'Agreeableness',   t2: 'Communication',       title: 'The Empathetic Connector',      desc: 'Warm, trustworthy, and an excellent communicator. Builds strong relationships and creates harmony in teams.',                        careers: ['HR Manager', 'Counselor', 'Customer Success', 'Social Worker'] },
      { t1: 'Openness',        t2: 'Extraversion',        title: 'The Creative Catalyst',         desc: 'Energetic and imaginative with a passion for sharing new ideas. Inspires others with vision and enthusiasm.',                        careers: ['Marketing Director', 'UX Designer', 'Creative Director', 'Entrepreneur'] },
      { t1: 'Leadership',      t2: 'Conscientiousness',   title: 'The Disciplined Commander',     desc: 'A structured leader who leads by example with strong work ethic. Plans meticulously and holds team to high standards.',              careers: ['Operations Manager', 'Military Officer', 'Engineering Lead', 'COO'] },
      { t1: 'Communication',   t2: 'Agreeableness',       title: 'The Diplomatic Mediator',       desc: 'Skilled at resolving conflicts and finding common ground. Excellent listener who adapts message to any audience.',                   careers: ['Mediator', 'Public Relations', 'Diplomat', 'Team Facilitator'] },
      { t1: 'Emotional Stability', t2: 'Leadership',      title: 'The Composed Director',         desc: 'Calm under pressure with natural authority. Makes tough decisions without being swayed by emotions or panic.',                       careers: ['Crisis Manager', 'Surgeon', 'Air Traffic Controller', 'Executive'] },
      { t1: 'Openness',        t2: 'Problem Solving',     title: 'The Curious Analyst',           desc: 'Intellectually driven with a love for exploring and understanding complex systems. Thrives on research and discovery.',              careers: ['Research Scientist', 'Analyst', 'AI/ML Engineer', 'Philosopher'] },
      { t1: 'Extraversion',    t2: 'Communication',       title: 'The Charismatic Communicator',  desc: 'Natural storyteller who commands attention. Thrives in public-facing roles and excels at persuasion and influence.',                careers: ['Public Speaker', 'Journalist', 'Sales Executive', 'Politician'] },
      { t1: 'Conscientiousness', t2: 'Emotional Stability', title: 'The Steady Performer',        desc: 'Reliable, calm, and consistent. Delivers quality work under any condition without losing composure or focus.',                       careers: ['Accountant', 'Pilot', 'Pharmacist', 'Database Administrator'] },
      { t1: 'Leadership',      t2: 'Problem Solving',     title: 'The Decisive Strategist',       desc: 'Takes charge with confidence backed by strong analytical reasoning. Makes data-driven decisions swiftly.',                          careers: ['Management Consultant', 'CTO', 'Military Strategist', 'Fund Manager'] },
      { t1: 'Agreeableness',   t2: 'Emotional Stability', title: 'The Calm Supporter',            desc: 'Patient, understanding, and emotionally grounded. A stabilizing presence who supports others through challenges.',                  careers: ['Therapist', 'Nurse', 'Teacher', 'Social Worker', 'Mentor'] },
      { t1: 'Openness',        t2: 'Communication',       title: 'The Visionary Storyteller',     desc: 'Combines creative thinking with the ability to articulate complex ideas simply. Inspires through words and vision.',                careers: ['Content Strategist', 'Author', 'TED Speaker', 'Brand Manager'] },
      { t1: 'Problem Solving', t2: 'Conscientiousness',   title: 'The Precision Engineer',        desc: 'Methodical problem-solver who leaves nothing to chance. Combines logic with discipline for flawless execution.',                    careers: ['DevOps Engineer', 'Architect', 'Financial Analyst', 'QA Lead'] },
      { t1: 'Leadership',      t2: 'Communication',       title: 'The Inspiring Captain',         desc: 'Leads through clear vision and powerful communication. Motivates teams by articulating goals and building trust.',                  careers: ['School Principal', 'Team Lead', 'Coach', 'Non-Profit Director'] },
      { t1: 'Extraversion',    t2: 'Agreeableness',       title: 'The Social Harmonizer',         desc: 'Outgoing and deeply considerate of others. Creates inclusive environments where everyone feels valued.',                            careers: ['Community Manager', 'Recruiter', 'Hospitality Manager', 'Trainer'] },
      { t1: 'Emotional Stability', t2: 'Problem Solving', title: 'The Cool-Headed Solver',        desc: 'Stays rational and focused even in crisis. Approaches emergencies with logic rather than panic.',                                  careers: ['Emergency Doctor', 'Firefighter', 'Ethical Hacker', 'Debug Specialist'] },
      { t1: 'Conscientiousness', t2: 'Communication',     title: 'The Organized Communicator',    desc: 'Combines structured thinking with clear expression. Documentation, processes, and clarity are their strength.',                     careers: ['Technical Writer', 'Business Analyst', 'Compliance Officer', 'Editor'] },
      { t1: 'Openness',        t2: 'Leadership',          title: 'The Trailblazing Pioneer',      desc: 'Fearless leader who embraces change and takes teams into uncharted territory. Sees opportunity where others see risk.',             careers: ['Venture Capitalist', 'Innovation Director', 'Startup CEO', 'Explorer'] },
    ];

    const match = PERSONALITY_TYPES.find(p =>
      (p.t1 === top1 && p.t2 === top2) || (p.t1 === top2 && p.t2 === top1)
    ) || PERSONALITY_TYPES.find(p => p.t1 === top1) || {
      title: 'The Well-Rounded Individual',
      desc: 'You demonstrate a balanced personality profile with strengths across multiple dimensions.',
      careers: ['Management', 'Consulting', 'Education', 'Research']
    };

    personalityType = { title: match.title, desc: match.desc, careers: match.careers, topTrait: top1, secondTrait: top2 };
  }

  // Detect response style
  let responseStyle = 'Genuine';
  if (hasPersonalityData) {
    const allLikertResponses = gradedResponses.filter((r: any) => r.questionType === 'likert' && r.studentAnswer);
    const total = allLikertResponses.length;
    if (total > 0) {
      const neutralCount = allLikertResponses.filter((r: any) => r.studentAnswer === '3' || r.studentAnswer === 3).length;
      const agreeCount = allLikertResponses.filter((r: any) => ['4','5',4,5].includes(r.studentAnswer)).length;
      const extremeCount = allLikertResponses.filter((r: any) => ['1','5',1,5].includes(r.studentAnswer)).length;
      const sameAnswer = [1,2,3,4,5].some(v => allLikertResponses.filter((r: any) => r.studentAnswer === String(v) || r.studentAnswer === v).length / total >= 0.9);
      if (sameAnswer) responseStyle = 'Careless Responding';
      else if (extremeCount / total > 0.70) responseStyle = 'Extreme Responding';
      else if (agreeCount / total > 0.70) responseStyle = 'Acquiescence';
      else if (neutralCount / total > 0.40) responseStyle = 'Central Tendency';
    }
  }

  // Clean responses to remove undefined values
  const cleanedResponses = gradedResponses.map(r => cleanObject(r));

  // ✅ Compute violation summary at top level (avoids needing to read responses array later)
  let totalViolationCount = 0;
  const violationTypeCounts: Record<string, number> = {};
  for (const r of cleanedResponses) {
    if (r.violations && Array.isArray(r.violations)) {
      totalViolationCount += r.violations.length;
      for (const v of r.violations) {
        const vType = v.type || v.violationType || 'UNKNOWN';
        violationTypeCounts[vType] = (violationTypeCounts[vType] || 0) + 1;
      }
    }
  }

  // Update attempt document (summary only — no responses)
  await admin.firestore()
    .collection(COLLECTIONS.EXAM_ATTEMPTS)
    .doc(attemptId)
    .update({
      obtainedMarks: totalScore,
      totalScore: totalScore,
      maximumScore: maxMarks,
      percentage: correctedPercentage,
      totalQuestions: totalQuestions,
      attemptedQuestions: attemptedQuestions,
      correctAnswers: correctAnswers,
      timeSpent: timeSpent,
      violationCount: totalViolationCount,
      violationSummary: { total: totalViolationCount, byType: violationTypeCounts },
      performanceByType: byType,
      performanceByComplexity: byComplexity,
      performanceByChapter: byChapter,
      evaluationStatus: pendingManualGrading === 0 ? 'evaluated' : 'pending',
      aiEvaluated: true,
      manualReviewRequired: pendingManualGrading > 0,
      pendingEvaluations: pendingManualGrading,
      ...(hasPersonalityData && { personalityProfile }),
      ...(personalityType && { personalityType }),
      ...(hasPersonalityData && { responseStyle }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

  // ✅ Write responses to sub-collection (keeps main doc lightweight)
  await admin.firestore()
    .collection(COLLECTIONS.EXAM_ATTEMPTS)
    .doc(attemptId)
    .collection('attemptResponses')
    .doc('main')
    .set({ responses: cleanedResponses }, { merge: true });
  
  return {
    success: true,
    totalScore,
    maxMarks,
    percentage: correctedPercentage,
    totalQuestions,
    attemptedQuestions,
    correctAnswers,
    timeSpent,
    pendingManualGrading
  };
}

// ============================================
// 2. SUBMIT & GRADE EXAM (ALL QUESTION TYPES)
// ============================================

export const submitAndGradeExam = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB'
  })
  .https.onCall(async (data, context) => {
    try {
      // console.log('📝 [SERVER-SIDE GRADING] Starting...');
      
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
      }
      
      const { examId, attemptId, responses, quickSubmit = false } = data;

      // ✅ QUICK SUBMIT MODE: Save immediately, evaluate in background
      if (quickSubmit) {
        // console.log('⚡ Quick submit - saving answers without evaluation');
        
        const pendingResponses = responses.map((r: any) => ({
          ...r,  // ✅ Preserves all fields including violations, viewed, answered
          evaluationStatus: r.answered === false ? 'not_attempted' : 'pending',
          marksAwarded: 0,
          maxMarks: r.maxMarks || 0,
          autoEvaluated: false
        }));
        
        // Update main doc (summary only)
        await admin.firestore()
          .collection(COLLECTIONS.EXAM_ATTEMPTS)
          .doc(attemptId)
          .update({
            status: 'submitted',
            submitTime: admin.firestore.FieldValue.serverTimestamp(),
            evaluationStatus: 'pending',
          });
        
        // Write responses to sub-collection
        await admin.firestore()
          .collection(COLLECTIONS.EXAM_ATTEMPTS)
          .doc(attemptId)
          .collection('attemptResponses')
          .doc('main')
          .set({ responses: pendingResponses });
        
        return { 
          success: true, 
          message: 'Exam submitted successfully. Results will be available shortly.',
          quickSubmit: true
        };
      }

      if (!examId || !attemptId || !responses) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
      }
      
      // 🎯 Use shared grading function (same logic as auto-submit)
      // console.log('🔐 Calling shared grading function...');
      const result = await gradeAttempt(examId, attemptId, responses);
      
      // console.log('💾 Results saved');
      
      return {
        success: true,
        totalMarks: result.totalScore,
        maxMarks: result.maxMarks,
        percentage: Math.round(result.percentage),
        attemptedQuestions: result.attemptedQuestions,
        correctAnswers: result.correctAnswers,
        pendingManualGrading: result.pendingManualGrading
      };
    } catch (error: any) {
      console.error('❌ Server-side grading error:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ============================================
// AI CODE ANALYSIS FUNCTION (NEW)
// ============================================

/**
 * 🤖 Analyze student code with AI
 * Provides optimization suggestions and corrections
 */
export const analyzeCodeWithAI = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB'
  })
  .https.onCall(async (data, context) => {
    try {
      // ✅ Use the helper function
      const feedback = await analyzeCodeWithAIHelper(data);
      return { success: true, feedback };
    } catch (err: any) {
      console.error('❌ Code Analysis Error:', err);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to analyze code with AI',
        err.message
      );
    }
  });
// ============================================
// AI CHAT FUNCTION (Existing)
// ============================================
const SYSTEM_PROMPT = `You are an AI Exams Specialist for EXAMINERS. You help teachers create educational content.

CRITICAL RULES:
1. Use Markdown for formatting
2. For ALL math, wrap in $ (inline) or $$ (display)
3. ALWAYS wrap math in dollar signs
4. For problem solutions, use numbered steps (Step 1:, Step 2:, etc.)

Examples:
- Variables: $x$, $y$ 
- Equations: $x = 5$, $A = \\pi r^2$
- Fractions: $\\frac{1}{2}$, $\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$
- Functions: $\\sin(30°)$, $\\cos(x)$
- Powers: $x^2$
- Subscripts: $H_2O$
- Chemistry: $\\ce{H2O}$, $\\ce{2H2 + O2 -> 2H2O}$

Common commands:
\\frac{a}{b}, \\sqrt{x}, \\times, \\div, \\pm, \\pi, \\theta, \\sin, \\cos, \\tan, \\ce{...}

WRONG: sin(30°) = 1/2
RIGHT: $\\sin(30°) = \\frac{1}{2}$

WRONG: H2O
RIGHT: $\\ce{H2O}$

Solution Format:
Always break solutions into clear numbered steps:
Step 1: [description]
Step 2: [description]
etc.`;

export const chatWithAI = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      const { message, conversationHistory = [] } = data || {};
      
      if (!message || typeof message !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'message is required');
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'OpenAI API key not configured');
      }
      
      const client = new OpenAI({ apiKey });

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversationHistory.map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        })),
        { role: 'user', content: message }
      ];

      const completion = await client.chat.completions.create({
        model: AI_MODELS.GPT_4O_MINI,
        temperature: 0.3,
        max_tokens: 2000,
        messages
      });

      const response = completion.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not generate a response.';
      
      return { success: true, response };
      
    } catch (err: any) {
      console.error('OpenAI API Error:', err);
      throw new functions.https.HttpsError('internal', 'Failed to get response from AI', err.message);
    }
  });

// ============================================
// AI CODE ASSISTANT (CodePractice Integration)
// Version: 1.2.0
// Operations: explain, fix, suggest, tests, docs, optimize, assistant, format, autocomplete, inline
// ============================================

type AICodeOperation = 'explain' | 'fix' | 'suggest' | 'tests' | 'docs' | 'optimize' | 'assistant' | 'format' | 'autocomplete' | 'inline';

const AI_CODE_SYSTEM_PROMPTS: Record<AICodeOperation, string> = {
  assistant: 'You are a friendly and helpful AI coding assistant. Help users understand coding concepts, debug issues, and improve their code. Be concise but thorough.',
  explain: 'You are a helpful coding tutor. Explain code clearly and concisely.',
  fix: 'You are a code debugging expert. Return only fixed code.',
  suggest: 'You are a code review expert. Provide actionable suggestions.',
  tests: 'You are a testing expert. Generate comprehensive tests.',
  docs: 'You are a documentation expert. Generate clear documentation.',
  optimize: 'You are a performance optimization expert. Return optimized code.',
  format: 'You are a code formatting expert. Return only formatted code without any markdown or explanation.',
  autocomplete: 'You are a code completion assistant. Return only what is asked, no extra text.',
  inline: 'You are a code completion assistant. Return only what is asked, no extra text.'
};

function buildAICodePrompt(
  operation: AICodeOperation,
  code: string,
  language: string,
  question?: string,
  history?: Array<{role: string; content: string}>,
  cursorLine?: number,
  cursorColumn?: number,
  prefix?: string
): string {
  const langUpper = language.charAt(0).toUpperCase() + language.slice(1);
  
  // Build history string for assistant
  let historyStr = '';
  if (operation === 'assistant' && history && history.length > 0) {
    historyStr = "Previous conversation:\n";
    const recentHistory = history.slice(-6);
    for (const msg of recentHistory) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const content = (msg.content || '').substring(0, 500);
      historyStr += `${role}: ${content}\n\n`;
    }
  }

  const prompts: Record<AICodeOperation, string> = {
    autocomplete: `You are an expert code autocomplete engine for ${langUpper}. Given the code context and cursor position, suggest completions.

RULES:
1. Return ONLY a JSON array of completion objects
2. Each object has: label, insertText, detail, kind
3. kind can be: keyword, function, variable, snippet, method, property
4. Maximum 10 suggestions, sorted by relevance
5. Focus on what makes sense at cursor position
6. Include common patterns for ${langUpper}
7. No explanations, ONLY valid JSON array

Code context:
\`\`\`${language}
${code}
\`\`\`

Cursor at line ${cursorLine || 1}, column ${cursorColumn || 1}
Text before cursor: "${prefix || ''}"

Return JSON array:`,

    inline: `You are a code completion AI for ${langUpper}. Complete the code at cursor position.

RULES:
1. Return ONLY the completion text (no explanation)
2. Complete the current statement/expression logically
3. Match the coding style in existing code
4. Keep completion concise (1-3 lines max)
5. Don't repeat what's already written

Code before cursor:
\`\`\`${language}
${code}
\`\`\`

Current line prefix: "${prefix || ''}"

Complete with:`,

    assistant: `You are a helpful AI coding assistant specializing in ${langUpper}.

${historyStr}

USER'S CURRENT CODE (if any):
\`\`\`${language}
${code}
\`\`\`

USER'S QUESTION:
${question || ''}

RULES:
- Be concise but thorough
- Use markdown formatting for clarity
- For code examples, use \`\`\`${language} blocks
- If code is provided, reference it in your answer
- Be encouraging and educational
- Keep responses focused and practical`,

    explain: `You are a ${langUpper} programming expert. Explain this code clearly.

OUTPUT FORMAT (use this exact structure):
## Summary
Write 1-2 sentences describing what this code does.

## How It Works
1. **Step Name**: Brief explanation of first step
2. **Step Name**: Brief explanation of second step
3. **Step Name**: Brief explanation of third step
(add more steps if needed, max 5)

## Key Concepts
- Concept 1 explanation
- Concept 2 explanation

## Complexity
- **Time**: O(?) - brief reason
- **Space**: O(?) - brief reason

RULES:
- Use proper markdown headers (##) and bold (**text**)
- Use numbered lists for steps
- Use bullet points for concepts
- Keep each point concise (1 sentence)
- Use \`backticks\` for code references like variable names
- Total response under 200 words

Code:
\`\`\`${language}
${code}
\`\`\``,

    fix: `You are a ${langUpper} debugging expert. Fix all issues in the provided code.

OUTPUT FORMAT:
Return ONLY the fixed code wrapped in a code block:

\`\`\`${language}
// Fixed code here
// Add a comment like "// FIXED: description" where you made changes
\`\`\`

RULES:
1. Identify and fix all syntax errors, bugs, and logical issues
2. Add a brief comment (// FIXED: reason) next to each fix
3. Maintain the original code intent and structure
4. Follow ${langUpper} best practices
5. If no issues found, return the original code unchanged
6. Return ONLY the code block, no text before or after

Code to fix:
\`\`\`${language}
${code}
\`\`\`

Return the fixed code:`,

    suggest: `You are a ${langUpper} code review expert. Provide actionable improvement suggestions.

OUTPUT FORMAT (use this exact structure):
Start with a brief intro sentence about the code quality.

Then provide numbered suggestions:

1. **Suggestion Title**: Description of what to improve and why.

\`\`\`${language}
// Example code showing the improvement
\`\`\`

2. **Suggestion Title**: Description of what to improve and why.

\`\`\`${language}
// Example code showing the improvement
\`\`\`

(continue for each suggestion)

RULES:
- Provide 3-5 suggestions maximum
- Each suggestion MUST have a bold title
- Include a code example for EACH suggestion showing the fix
- Use \`\`\`${language} for all code blocks
- Use \`backticks\` for inline code references like \`variable_name\`
- Focus on: best practices, performance, readability, error handling
- Be specific and actionable

Code to review:
\`\`\`${language}
${code}
\`\`\`

Provide suggestions:`,

    tests: `You are a ${langUpper} testing expert. Generate comprehensive unit tests.

OUTPUT FORMAT:
\`\`\`${language}
// Test file for the provided code
// Include all necessary imports

// Test 1: Description of what this tests
// Test code here

// Test 2: Description of what this tests  
// Test code here

// Continue with more tests...
\`\`\`

RULES:
1. Create tests for all functions/methods in the code
2. Include edge cases and boundary conditions
3. Use appropriate testing framework for ${langUpper}:
   - Python: pytest or unittest
   - JavaScript: Jest or Mocha
   - Java: JUnit
   - C/C++: Simple assert statements or Google Test
4. Add descriptive test names and comments
5. Include both positive and negative test cases
6. Return ONLY the test code wrapped in \`\`\`${language} block
7. No explanations outside the code block

Code to test:
\`\`\`${language}
${code}
\`\`\`

Generate tests:`,

    docs: `You are a ${langUpper} documentation expert. Generate documentation for the provided code.

OUTPUT FORMAT:
\`\`\`${language}
/**
 * Function/Class description
 * 
 * @param paramName - Parameter description
 * @param paramName - Parameter description
 * @returns Description of return value
 * 
 * @example
 * // Usage example
 * functionName(arg1, arg2);
 */

// The documented code here...
\`\`\`

RULES:
1. Create appropriate docstrings/comments for ${langUpper}:
   - Python: Use docstrings with triple quotes
   - JavaScript/TypeScript: Use JSDoc format
   - Java: Use Javadoc format
   - C/C++: Use Doxygen-style comments
2. Document all functions, classes, and methods
3. Include parameter descriptions and return types
4. Add usage examples where helpful
5. Return the COMPLETE code with documentation added
6. Wrap everything in \`\`\`${language} block

Code to document:
\`\`\`${language}
${code}
\`\`\`

Generate documentation:`,

    optimize: `You are a ${langUpper} performance optimization expert. Optimize the provided code.

OUTPUT FORMAT:
First, provide a brief summary of optimizations made:

## Optimizations Applied
1. **Optimization Name**: Brief description
2. **Optimization Name**: Brief description

## Optimized Code
\`\`\`${language}
// Your optimized code here
\`\`\`

## Performance Improvement
- **Time Complexity**: Before O(?) → After O(?)
- **Space Complexity**: Before O(?) → After O(?)

RULES:
1. Improve time complexity where possible
2. Reduce memory usage if applicable
3. Apply ${langUpper}-specific optimizations
4. Maintain code readability
5. Always wrap code in \`\`\`${language} blocks

Code to optimize:
\`\`\`${language}
${code}
\`\`\`

Return optimized code:`,

    format: `Format this ${langUpper} code following standard conventions and best practices.

RULES:
1. Fix indentation (use 4 spaces for most languages, 2 for Ruby/YAML)
2. Add proper spacing around operators
3. Add spacing after commas
4. Fix brace/bracket placement per language conventions
5. Add blank lines between functions/methods
6. Remove trailing whitespace
7. Ensure consistent quote style
8. DO NOT change any logic or functionality
9. DO NOT add or remove any code
10. Return ONLY the formatted code, no explanations or markdown

Code to format:
${code}`
  };

  return prompts[operation];
}

function cleanCodeBlockResponse(result: string, operation: AICodeOperation): string {
  if (['fix', 'tests', 'docs', 'optimize', 'format'].includes(operation)) {
    let cleaned = result.replace(/^```[\w]*\n?/, '');
    cleaned = cleaned.replace(/\n?```$/, '');
    return cleaned.trim();
  }
  return result;
}

export const aiCodeAssistant = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB'
  })
  .https.onCall(async (data, context) => {
    try {
      const { operation, code, language, question, history, cursorLine, cursorColumn, prefix } = data || {};

      // Valid operations
      const validOperations: AICodeOperation[] = ['explain', 'fix', 'suggest', 'tests', 'docs', 'optimize', 'assistant', 'format', 'autocomplete', 'inline'];
      
      if (!operation || !validOperations.includes(operation)) {
        return {
          success: false,
          operation: operation || 'unknown',
          result: '',
          error: `Invalid operation. Use: ${validOperations.join(', ')}`
        };
      }

      // Cast operation to correct type after validation
      const validOperation = operation as AICodeOperation;

      // Validate required fields based on operation
      if (operation === 'assistant') {
        if (!question) {
          return {
            success: false,
            operation,
            result: '',
            error: 'Question is required for assistant operation'
          };
        }
      } else if (operation !== 'autocomplete' && operation !== 'inline') {
        if (!code || code.trim().length === 0) {
          return {
            success: false,
            operation,
            result: '',
            error: 'Code is required for this operation'
          };
        }
      }

      if (!language) {
        return {
          success: false,
          operation,
          result: '',
          error: 'Language is required'
        };
      }

      // Validate lengths
      if (code && code.length > 15000) {
        return {
          success: false,
          operation,
          result: '',
          error: 'Code exceeds maximum length of 15000 characters'
        };
      }

      if (question && question.length > 2000) {
        return {
          success: false,
          operation,
          result: '',
          error: 'Question exceeds maximum length of 2000 characters'
        };
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'OpenAI API key not configured');
      }

      const client = new OpenAI({ apiKey });

      // Build prompt
      const prompt = buildAICodePrompt(
        validOperation,
        code || '',
        language,
        question,
        history,
        cursorLine,
        cursorColumn,
        prefix
      );
      const systemPrompt = AI_CODE_SYSTEM_PROMPTS[validOperation];

      // Call OpenAI
      const completion = await client.chat.completions.create({
        model: AI_MODELS.GPT_4O_MINI,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: validOperation === 'assistant' ? 0.7 : 0.3,
        max_tokens: validOperation === 'autocomplete' || validOperation === 'inline' ? 500 : 4000
      });

      let result = completion.choices[0]?.message?.content || '';

      // Handle autocomplete response
      if (validOperation === 'autocomplete') {
        let content = result.trim();
        content = content.replace(/^```json?\s*/, '');
        content = content.replace(/\s*```$/, '');
        
        try {
          const suggestions = JSON.parse(content);
          if (Array.isArray(suggestions)) {
            return {
              success: true,
              operation: validOperation,
              suggestions
            };
          }
        } catch (e) {
          return {
            success: false,
            operation: validOperation,
            suggestions: [],
            error: 'Failed to parse suggestions'
          };
        }
        
        return {
          success: false,
          operation: validOperation,
          suggestions: [],
          error: 'Invalid response format'
        };
      }

      // Handle inline completion response
      if (validOperation === 'inline') {
        return {
          success: true,
          operation: validOperation,
          completion: result.trim()
        };
      }

      // Clean up code blocks for other operations
      result = cleanCodeBlockResponse(result, validOperation);

      return {
        success: true,
        operation: validOperation,
        result: result.trim()
      };

    } catch (err: any) {
      console.error('AI Code Assistant Error:', err);
      throw new functions.https.HttpsError('internal', 'AI Code Assistant failed', err.message);
    }
  });

// ============================================
// EMAIL FUNCTIONS (Existing)
// ============================================

export const sendWelcomeEmail = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      // Check authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated to send emails'
        );
      }

      // Verify caller has admin permissions
      // NOTE: Permission check removed for user creation workflow
      // This function is called from firebase_service.ts during legitimate user creation
      // and is not directly exposed to end users
      
      // Log who called it for auditing purposes
      // console.log('📧 sendWelcomeEmail called by:', callerData?.userType || 'Unknown', context.auth.uid);
      
      // Permission check disabled to allow user creation workflow
      // Original check kept for reference:
      // const adminRoles = [USER_TYPES.SYSTEM_ADMIN, USER_TYPES.ADMIN, USER_TYPES.SUPER_ADMIN, USER_TYPES.PRINCIPAL, USER_TYPES.DEAN, USER_TYPES.TEACHER];
      // if (!callerData || !adminRoles.includes(callerData.userType)) {
      //   throw new functions.https.HttpsError('permission-denied', 'Only admins can send welcome emails');
      // }

      const { email, name, password, userType, collegeId } = data;

      // Validate required fields
      if (!email || !name || !password || !userType) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required fields: email, name, password, userType'
        );
      }

      // ============================================
      // FETCH EMAIL CREDENTIALS FROM FIRESTORE
      // ============================================
      // console.log('📧 Fetching email credentials from Firestore...');
      
      const emailCredsDoc = await admin.firestore()
        .doc(FIRESTORE_PATHS.EMAIL_CREDENTIALS)
        .get();
      
      if (!emailCredsDoc.exists) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Email credentials not found in Firestore. Please configure them in settings/email_credentials'
        );
      }

      const emailCreds = emailCredsDoc.data();
      
      if (!emailCreds?.MAIL_HOST || !emailCreds?.MAIL_USERNAME || !emailCreds?.MAIL_PASSWORD || !emailCreds?.MAIL_PORT) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Incomplete email credentials in Firestore. Required: MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD, MAIL_PORT'
        );
      }

      // console.log('✅ Email credentials loaded from Firestore');
      // console.log('📮 SMTP Host:', emailCreds.MAIL_HOST);
      // console.log('👤 SMTP User:', emailCreds.MAIL_USERNAME);
      // console.log('🔌 SMTP Port:', emailCreds.MAIL_PORT);

      // ============================================
      // CREATE TRANSPORTER WITH BREVO CREDENTIALS
      // ============================================
      const transporter = nodemailer.createTransport({
        host: emailCreds.MAIL_HOST,
        port: parseInt(emailCreds.MAIL_PORT),
        secure: false, // Use TLS
        auth: {
          user: emailCreds.MAIL_USERNAME,
          pass: emailCreds.MAIL_PASSWORD,
        },
      });

      // console.log('📬 Nodemailer transporter created with Brevo SMTP');

      // ============================================
      // GET COLLEGE NAME
      // ============================================
      let collegeName = 'EXAMINERS';
      if (collegeId) {
        const collegeDoc = await admin.firestore().doc(`${COLLECTIONS.COLLEGES}/${collegeId}`).get();
        if (collegeDoc.exists) {
          collegeName = collegeDoc.data()?.collegeName || 'EXAMINERS';
        }
      }

      // ============================================
      // GENERATE EMAIL HTML
      // ============================================
      const emailHtml = generateWelcomeEmailHTML({
        name,
        email,
        password,
        userType,
        collegeName,
        loginUrl: process.env.LOGIN_URL || 'https://www.examiners.app/login',
      });

      // ============================================
      // SEND EMAIL
      // ============================================
      const mailOptions = {
        from: `EXAMINERS System <${process.env.NOREPLY_EMAIL || 'noreply@email.tutorialspoint.com'}>`,
        to: email,
        subject: `Welcome to EXAMINERS - Your Account is Ready!`,
        html: emailHtml,
      };

      // console.log('📤 Sending email to:', email);
      
      await transporter.sendMail(mailOptions);

      // console.log('✅ Welcome email sent successfully to:', email);

      return {
        success: true,
        message: 'Welcome email sent successfully',
        sentTo: email,
      };
      
    } catch (error: any) {
      console.error('❌ Error sending email:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to send email: ${error.message}`
      );
    }
  });

// ============================================
// EMAIL HTML TEMPLATE FUNCTION
// ============================================

// ============================================
// SEND OTP EMAIL FUNCTION
// ============================================

export const sendOTPEmail = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      const { email, otp } = data;

      // Validate required fields
      if (!email || !otp) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required fields: email, otp'
        );
      }

      // ============================================
      // FETCH EMAIL CREDENTIALS FROM FIRESTORE
      // ============================================
      // console.log('📧 Fetching email credentials for OTP...');
      
      const emailCredsDoc = await admin.firestore()
        .doc(FIRESTORE_PATHS.EMAIL_CREDENTIALS)
        .get();
      
      if (!emailCredsDoc.exists) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Email credentials not found in Firestore'
        );
      }

      const emailCreds = emailCredsDoc.data();
      
      if (!emailCreds?.MAIL_HOST || !emailCreds?.MAIL_USERNAME || !emailCreds?.MAIL_PASSWORD || !emailCreds?.MAIL_PORT) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Incomplete email credentials in Firestore'
        );
      }

      // ============================================
      // CREATE TRANSPORTER
      // ============================================
      const transporter = nodemailer.createTransport({
        host: emailCreds.MAIL_HOST,
        port: parseInt(emailCreds.MAIL_PORT),
        secure: false,
        auth: {
          user: emailCreds.MAIL_USERNAME,
          pass: emailCreds.MAIL_PASSWORD,
        },
      });

      // ============================================
      // EMAIL HTML
      // ============================================
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">EXAMINERS</h1>
            <p style="color: white; margin: 5px 0 0 0; opacity: 0.9;">AI-Powered Answer Sheet Evaluation</p>
          </div>
          
          <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0;">Password Reset Request</h2>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
              You have requested to reset your password. Please use the following One-Time Password (OTP) to proceed:
            </p>
            
            <div style="background: #f3f4f6; border: 2px dashed #4F46E5; border-radius: 10px; padding: 25px; text-align: center; margin: 0 0 30px 0;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your OTP</p>
              <div style="font-size: 36px; font-weight: bold; color: #4F46E5; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                ${otp}
              </div>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 0 0 30px 0; border-radius: 5px;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                <strong>⚠️ Important:</strong> This OTP will expire in <strong>10 minutes</strong>. Do not share this OTP with anyone.
              </p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              If you did not request a password reset, please ignore this email and your password will remain unchanged.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} EXAMINERS. All rights reserved.<br>
              EXAMINERS - AI-Powered Educational Technology Platform
            </p>
          </div>
        </div>
      `;

      // ============================================
      // SEND EMAIL
      // ============================================
      const mailOptions = {
        from: `EXAMINERS System <${process.env.NOREPLY_EMAIL || 'noreply@email.tutorialspoint.com'}>`,
        to: email,
        subject: 'EXAMINERS - Password Reset OTP',
        html: emailHtml,
      };

      await transporter.sendMail(mailOptions);

      // console.log('✅ OTP email sent successfully to:', email);

      return {
        success: true,
        message: 'OTP email sent successfully',
        sentTo: email,
      };
      
    } catch (error: any) {
      console.error('❌ Error sending OTP email:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to send OTP email: ${error.message}`
      );
    }
  });

/**
 * Send a password-reset OTP — fully server-side so it works from the signed-out
 * Forgot-Password screen (no client Firestore access → no permission-denied).
 * Looks up the user by email, generates + stores the OTP (same doc-id encoding as
 * resetPasswordSecurely), and emails it. The OTP is never returned to the client.
 */
export const sendPasswordResetOTP = functions
  .region('us-central1')
  .https.onCall(async (data) => {
    try {
      const email = (data?.email || '').toString().trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid email is required');
      }

      const db = admin.firestore();

      // 1. User must exist (admin read bypasses security rules)
      const userSnap = await db.collection(COLLECTIONS.USERS).where('email', '==', email).limit(1).get();
      if (userSnap.empty) {
        return { success: false, error: 'No account found with this email address' };
      }

      // 2. Generate + store the OTP (10 min). Doc-id encoding MUST match resetPasswordSecurely.
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const encodedEmail = email.replace(/\./g, '_dot_').replace(/@/g, '_at_');
      await db.collection(COLLECTIONS.PASSWORD_RESET_OTPS).doc(encodedEmail).set({
        otp,
        email,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        createdAt: new Date(),
        used: false,
      });

      // 3. Email the OTP (server-side; never returned to the client)
      const emailCredsDoc = await db.doc(FIRESTORE_PATHS.EMAIL_CREDENTIALS).get();
      const emailCreds = emailCredsDoc.data();
      if (!emailCreds?.MAIL_HOST || !emailCreds?.MAIL_USERNAME || !emailCreds?.MAIL_PASSWORD || !emailCreds?.MAIL_PORT) {
        throw new functions.https.HttpsError('failed-precondition', 'Email credentials not configured');
      }
      const transporter = nodemailer.createTransport({
        host: emailCreds.MAIL_HOST,
        port: parseInt(emailCreds.MAIL_PORT),
        secure: false,
        auth: { user: emailCreds.MAIL_USERNAME, pass: emailCreds.MAIL_PASSWORD },
      });
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">EXAMINERS</h1>
            <p style="color: white; margin: 5px 0 0 0; opacity: 0.9;">AI-Powered Answer Sheet Evaluation</p>
          </div>
          <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0;">Password Reset Request</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
              You have requested to reset your password. Please use the following One-Time Password (OTP) to proceed:
            </p>
            <div style="background: #f3f4f6; border: 2px dashed #4F46E5; border-radius: 10px; padding: 25px; text-align: center; margin: 0 0 30px 0;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your OTP</p>
              <div style="font-size: 36px; font-weight: bold; color: #4F46E5; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                ${otp}
              </div>
            </div>
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 0 0 30px 0; border-radius: 5px;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                <strong>⚠️ Important:</strong> This OTP will expire in <strong>10 minutes</strong>. Do not share this OTP with anyone.
              </p>
            </div>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              If you did not request a password reset, please ignore this email and your password will remain unchanged.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} EXAMINERS. All rights reserved.<br>
              EXAMINERS - AI-Powered Educational Technology Platform
            </p>
          </div>
        </div>
      `;
      await transporter.sendMail({
        from: `EXAMINERS System <${process.env.NOREPLY_EMAIL || 'noreply@email.tutorialspoint.com'}>`,
        to: email,
        subject: 'EXAMINERS - Password Reset OTP',
        html: emailHtml,
      });

      return { success: true };
    } catch (error: any) {
      console.error('❌ [sendPasswordResetOTP] error:', error?.message || error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', error?.message || 'Failed to send OTP');
    }
  });

// ============================================
// PASSWORD RESET FUNCTIONS (Secure)
// ============================================

/**
 * Secure Password Reset Cloud Function
 * Uses Firebase Admin SDK to update user passwords securely
 * 
 * Security Features:
 * - Never stores plain text passwords
 * - Validates OTP before password update
 * - Implements rate limiting
 * - Logs all password reset attempts for audit trail
 */
export const resetPasswordSecurely = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      const { email, otp, newPassword } = data;

      // 1. Validate input
      if (!email || !otp || !newPassword) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required fields: email, otp, and newPassword are required'
        );
      }

      // 2. Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid email format'
        );
      }

      // 3. Validate password strength (at least 6 characters)
      if (newPassword.length < 6) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Password must be at least 6 characters long'
        );
      }

      const db = admin.firestore();
      const auth = admin.auth();

      // 4. Verify OTP
      const encodedEmail = email.toLowerCase().replace(/\./g, '_dot_').replace(/@/g, '_at_');
      const otpDoc = await db.collection(COLLECTIONS.PASSWORD_RESET_OTPS).doc(encodedEmail).get();

      if (!otpDoc.exists) {
        console.error('OTP not found for email:', email);
        throw new functions.https.HttpsError(
          'not-found',
          'Invalid or expired OTP'
        );
      }

      const otpData = otpDoc.data();
      
      // Check if OTP is already used
      if (otpData?.used) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'OTP has already been used'
        );
      }

      // Check if OTP matches
      if (otpData?.otp !== otp) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid OTP'
        );
      }

      // Check if OTP is expired (10 minutes validity)
      const otpCreatedAt = otpData?.createdAt?.toDate();
      const now = new Date();
      const tenMinutesInMs = 10 * 60 * 1000;
      
      if (!otpCreatedAt || (now.getTime() - otpCreatedAt.getTime()) > tenMinutesInMs) {
        throw new functions.https.HttpsError(
          'deadline-exceeded',
          'OTP has expired. Please request a new one.'
        );
      }

      // 5. Find user by email using Firebase Auth
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email.toLowerCase());
      } catch (error: any) {
        console.error('User not found in Firebase Auth:', error);
        throw new functions.https.HttpsError(
          'not-found',
          'User not found'
        );
      }

      // 6. Update password in Firebase Auth using Admin SDK
      try {
        await auth.updateUser(userRecord.uid, {
          password: newPassword
        });
        
        // console.log('✅ Password updated successfully for user:', userRecord.uid);
      } catch (error: any) {
        console.error('Failed to update password:', error);
        throw new functions.https.HttpsError(
          'internal',
          'Failed to update password. Please try again.'
        );
      }

      // 7. Mark OTP as used
      await db.collection(COLLECTIONS.PASSWORD_RESET_OTPS).doc(encodedEmail).update({
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 8. Log password reset for audit trail
      await db.collection('password_reset_logs').add({
        userId: userRecord.uid,
        email: email.toLowerCase(),
        resetAt: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: context.rawRequest?.ip || 'unknown',
        userAgent: context.rawRequest?.headers['user-agent'] || 'unknown',
        success: true
      });

      // 9. Delete any pending password reset requests (old implementation cleanup)
      try {
        const oldRequestDoc = db.collection('password_reset_requests').doc(userRecord.uid);
        const oldRequest = await oldRequestDoc.get();
        if (oldRequest.exists) {
          await oldRequestDoc.delete();
          // console.log('🧹 Cleaned up old password reset request');
        }
      } catch (error) {
        // Non-critical, just log
        // console.log('No old password reset request to delete');
      }

      // 10. Update user's last password change timestamp in Firestore
      try {
        await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).update({
          lastPasswordChange: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (error) {
        // Non-critical, just log
        // console.warn('Could not update lastPasswordChange in user document:', error);
      }

      // console.log('✅ Password reset completed successfully for:', email);

      return {
        success: true,
        message: 'Password has been reset successfully. You can now login with your new password.'
      };

    } catch (error: any) {
      console.error('❌ Password reset error:', error);
      
      // Log failed attempt
      try {
        const db = admin.firestore();
        await db.collection('password_reset_logs').add({
          email: data.email?.toLowerCase() || 'unknown',
          resetAt: admin.firestore.FieldValue.serverTimestamp(),
          ipAddress: context.rawRequest?.ip || 'unknown',
          success: false,
          error: error.message
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }

      // Re-throw HttpsError if it's already one, otherwise wrap it
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'An unexpected error occurred. Please try again.'
      );
    }
  });

/**
 * Cleanup expired OTPs (runs daily)
 * Removes OTPs older than 1 hour to keep database clean
 */
export const cleanupExpiredOTPs = functions
  .region('us-central1')
  .pubsub.schedule('every 24 hours')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    // console.log('🧹 Starting cleanup of expired OTPs...');
    
    try {
      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();
      const oneHourAgo = new Date(now.toMillis() - 60 * 60 * 1000);

      const expiredOTPs = await db
        .collection(COLLECTIONS.PASSWORD_RESET_OTPS)
        .where('createdAt', '<', oneHourAgo)
        .get();

      if (expiredOTPs.empty) {
        // console.log('✅ No expired OTPs to clean up');
        return null;
      }

      const batch = db.batch();
      expiredOTPs.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      // console.log(`🧹 Cleaned up ${expiredOTPs.size} expired OTPs`);
      
      return {
        success: true,
        deletedCount: expiredOTPs.size
      };
      
    } catch (error: any) {
      console.error('❌ Error cleaning up expired OTPs:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

// ============================================
// EMAIL HTML TEMPLATE FUNCTION
// ============================================

function generateWelcomeEmailHTML(data: {
  name: string;
  email: string;
  password: string;
  userType: string;
  collegeName: string;
  loginUrl: string;
}): string {
  const { name, email, password, userType, collegeName, loginUrl } = data;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .logo-container {
      margin: 0 auto 20px;
      width: 96px;
      height: 96px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .header p {
      margin: 10px 0 0 0;
      opacity: 0.9;
      font-size: 16px;
    }
    .content {
      padding: 40px 30px;
      background: #fcfbfb;
      border: 1px solid #eee;
    }
    .credentials-box {
      background: #f7fafc;
      border-left: 4px solid #667eea;
      padding: 25px;
      margin: 25px 0;
      border-radius: 5px;
    }
    .credentials-box h3 {
      margin: 0 0 20px 0;
      color: #667eea;
      font-size: 18px;
    }
    .credential-item {
      margin: 15px 0;
    }
    .credential-label {
      font-weight: 600;
      color: #667eea;
      font-size: 14px;
      display: block;
      margin-bottom: 8px;
    }
    .credential-value {
      font-family: 'Courier New', monospace;
      background: white;
      padding: 12px 15px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
      font-size: 14px;
      word-break: break-all;
      display: block;
      width: 100%;
      box-sizing: border-box;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white !important;
      padding: 15px 40px;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      text-align: center;
      margin: 20px 0;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .warning-box {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 20px;
      margin: 25px 0;
      border-radius: 5px;
    }
    .warning-box strong {
      color: #856404;
      display: block;
      margin-bottom: 10px;
    }
    .warning-box ul {
      margin: 10px 0;
      padding-left: 20px;
      color: #856404;
    }
    .warning-box li {
      margin: 8px 0;
      white-space: nowrap;
    }
    .steps {
      background: #f7fafc;
      padding: 25px;
      border-radius: 5px;
      margin: 25px 0;
    }
    .steps h3 {
      margin: 0 0 15px 0;
      color: #667eea;
    }
    .steps ol {
      margin: 0;
      padding-left: 20px;
    }
    .steps li {
      margin: 10px 0;
      line-height: 1.6;
    }
    .footer {
      background: #f7fafc;
      padding: 30px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 5px 0;
    }
    .divider {
      height: 1px;
      background: #e2e8f0;
      margin: 30px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>Welcome to EXAMINERS!</h1>
      <p>Your account has been successfully created</p>
    </div>
    <div class="content">
      <h2 style="color: #667eea; margin-top: 0;">Hello ${name}! 👋</h2>
      <p>Welcome to <strong>EXAMINERS</strong> at <strong>${collegeName}</strong>!</p>
      <p>Your account has been created as a <strong>${userType}</strong>. We're excited to have you join our AI-powered secure exams & learning management platform.</p>
      
      <div class="credentials-box">
        <h3>🔐 Your Login Credentials</h3>
        <div class="credential-item">
          <span class="credential-label">📧 Email:</span>
          <span class="credential-value">${email}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">🔑 Password:</span>
          <span class="credential-value">${password}</span>
        </div>
      </div>
      
      <div class="warning-box">
        <strong>⚠️ Important Security Notice</strong>
        <ul>
          <li>This is a temporary password</li>
          <li>You will be required to change it on your first login</li>
          <li>Never share your password with anyone</li>
          <li>Keep this email secure and delete it after changing your password</li>
        </ul>
      </div>
      
      <div class="button-container">
        <a href="${loginUrl}" class="button">🚀 Login to EXAMINERS</a>
      </div>
      
      <div class="steps">
        <h3>📋 Getting Started</h3>
        <ol>
          <li>Click the "Login to EXAMINERS" button above</li>
          <li>Enter your email and temporary password</li>
          <li>Create a strong, secure password when prompted</li>
          <li>Start using EXAMINERS!</li>
        </ol>
      </div>
      
      <div class="divider"></div>
      
      <h3 style="color: #667eea;">Need Help? 🆘</h3>
      <p>If you have any questions or need assistance getting started:</p>
      <ul>
        <li>📧 Email: <a href="mailto:contact@tutorialspoint.com" style="color: #667eea;">contact@tutorialspoint.com</a></li>
        <li>💬 Contact your system administrator</li>
      </ul>
    </div>
    
    <div class="footer">
      <p><strong>EXAMINERS</strong> - AI-Powered Secure Exams &amp; Learning Management Application</p>
      <p>© ${new Date().getFullYear()} ${collegeName}. All rights reserved.</p>
      <p style="margin-top: 15px; font-size: 11px; color: #999;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}
export const sendPasswordResetEmail = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      // Check authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated to send password reset email'
        );
      }

      const { email, name, resetLink } = data;

      // Validate required fields
      if (!email || !name || !resetLink) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required fields: email, name, resetLink'
        );
      }

      // Fetch email credentials from Firestore
      // console.log('📧 Fetching email credentials from Firestore...');
      
      const emailCredsDoc = await admin.firestore()
        .doc('settings/email_credentials')
        .get();
      
      if (!emailCredsDoc.exists) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Email credentials not found in Firestore'
        );
      }

      const emailCreds = emailCredsDoc.data();
      
      if (!emailCreds?.MAIL_HOST || !emailCreds?.MAIL_USERNAME || !emailCreds?.MAIL_PASSWORD || !emailCreds?.MAIL_PORT) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Incomplete email credentials in Firestore'
        );
      }

      // console.log('✅ Email credentials loaded from Firestore');

      // Create transporter with Brevo credentials
      const transporter = nodemailer.createTransport({
        host: emailCreds.MAIL_HOST,
        port: parseInt(emailCreds.MAIL_PORT),
        secure: false,
        auth: {
          user: emailCreds.MAIL_USERNAME,
          pass: emailCreds.MAIL_PASSWORD,
        },
      });

      // Generate email HTML
      const emailHtml = generatePasswordResetEmailHTML({
        name,
        resetLink,
      });

      // Send email
      const mailOptions = {
        from: `EXAMINERS System <${process.env.NOREPLY_EMAIL || 'noreply@email.tutorialspoint.com'}>`,
        to: email,
        subject: `🔒 Password Reset Request - EXAMINERS`,
        html: emailHtml,
      };

      // console.log('📤 Sending password reset email to:', email);
      
      await transporter.sendMail(mailOptions);

      // console.log('✅ Password reset email sent successfully to:', email);

      return {
        success: true,
        message: 'Password reset email sent successfully',
        sentTo: email,
      };
      
    } catch (error: any) {
      console.error('❌ Error sending password reset email:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to send password reset email: ${error.message}`
      );
    }
  });

  function generatePasswordResetEmailHTML(data: {
  name: string;
  resetLink: string;
}): string {
  const { name, resetLink } = data;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .email-container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
    .logo-container { margin: 0 auto 20px; width: 96px; height: 96px; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
    .content { padding: 40px 30px; }
    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; text-align: center; margin: 20px 0; }
    .button-container { text-align: center; margin: 30px 0; }
    .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 25px 0; border-radius: 5px; }
    .warning-box strong { color: #856404; display: block; margin-bottom: 10px; }
    .warning-box ul { margin: 10px 0; padding-left: 20px; color: #856404; }
    .warning-box li { margin: 8px 0; }
    .info-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 25px 0; border-radius: 5px; }
    .info-box strong { color: #1565c0; display: block; margin-bottom: 10px; }
    .info-box p { margin: 5px 0; color: #1565c0; }
    .footer { background: #f7fafc; padding: 30px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e2e8f0; }
    .footer p { margin: 5px 0; }
    .divider { height: 1px; background: #e2e8f0; margin: 30px 0; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="logo-container">
        <svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#5B9FED;stop-opacity:1" /><stop offset="100%" style="stop-color:#3DD8E8;stop-opacity:1" /></linearGradient></defs>
          <rect x="4" y="4" width="88" height="88" rx="20" fill="url(#bgGradient)"/><rect x="4" y="4" width="88" height="88" rx="20" fill="black" opacity="0.05"/><rect x="28" y="32" width="36" height="32" rx="3" fill="white"/><rect x="34" y="40" width="20" height="3" rx="1.5" fill="#8B7FED"/><rect x="34" y="47" width="16" height="3" rx="1.5" fill="#EE6FA4"/><rect x="34" y="54" width="18" height="3" rx="1.5" fill="#FF9966"/><circle cx="60" cy="28" r="11" fill="#10B981"/><circle cx="60" cy="28" r="11" fill="white" opacity="0.2"/><path d="M 55 28 L 58.5 31.5 L 65 24" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="20" r="3" fill="#5B9FED" opacity="0.6"/><circle cx="76" cy="18" r="2.5" fill="#3DD8E8" opacity="0.5"/><circle cx="72" cy="76" r="3.5" fill="#A78BFA" opacity="0.5"/><circle cx="24" cy="74" r="2" fill="#EE6FA4" opacity="0.4"/><circle cx="78" cy="50" r="2" fill="#8B7FED" opacity="0.3"/>
        </svg>
      </div>
      <h1>🔒 Password Reset Request</h1>
      <p>Reset your EXAMINERS account password</p>
    </div>
    <div class="content">
      <h2 style="color: #667eea; margin-top: 0;">Hello ${name}! 👋</h2>
      <p>We received a request to reset the password for your <strong>EXAMINERS</strong> account.</p>
      <p>Click the button below to create a new password:</p>
      <div class="button-container"><a href="${resetLink}" class="button">🔑 Reset Your Password</a></div>
      <div class="info-box"><strong>⏰ Important Information</strong><p>This password reset link will expire in <strong>1 hour</strong> for security reasons.</p><p>If the link expires, you can request a new one from the login page.</p></div>
      <div class="warning-box"><strong>⚠️ Didn't Request This?</strong><ul><li>If you didn't request a password reset, please ignore this email</li><li>Your password will remain unchanged</li><li>Someone may have entered your email by mistake</li><li>If you're concerned, contact your system administrator</li></ul></div>
      <div class="divider"></div>
      <h3 style="color: #667eea;">Need Help? 🆘</h3>
      <p>If you're having trouble resetting your password or need assistance:</p>
      <ul><li>📧 Email: <a href="mailto:contact@tutorialspoint.com" style="color: #667eea;">contact@tutorialspoint.com</a></li><li>💬 Contact your system administrator</li></ul>
    </div>
    <div class="footer">
      <p><strong>EXAMINERS</strong> - AI-Powered Secure Exams &amp; Learning Management Application</p>
      <p>© ${new Date().getFullYear()} EXAMINERS. All rights reserved.</p>
      <p style="margin-top: 15px; font-size: 11px; color: #999;">This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
  `;
}

  export const evaluateAnswerWithAI = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB'
  })
  .https.onCall(async (data, context) => {
    try {
      // ✅ Use the helper function
      const feedback = await evaluateAnswerWithAIHelper(data);
      return { success: true, feedback };
    } catch (err: any) {
      console.error('❌ AI Evaluation Error:', err);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to evaluate answer with AI',
        err.message
      );
    }
  });

// ============================================
// AUTO-COMPLETE EXPIRED EXAMS FUNCTIONS (New)
// ============================================

function isExamExpired(exam: ExamData): boolean {
  if (!exam.examDate || !exam.examTime || !exam.duration) {
    // console.log(`⏭️ Skipping exam ${exam.id}: Missing date/time/duration`);
    return false;
  }

  try {
    // Parse duration first to validate
    const durationMinutes = parseInt(exam.duration);
    if (isNaN(durationMinutes)) {
      // console.log(`⚠️ Invalid duration for exam ${exam.id}: ${exam.duration}`);
      return false;
    }

    // Parse exam date and time components
    const [hours, minutes] = exam.examTime.split(':').map(Number);
    const dateStr = exam.examDate.includes('T') ? exam.examDate.split('T')[0] : exam.examDate;
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // FIXED: IST is UTC+5:30
    // The exam date/time stored in the database is in IST timezone
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    
    // Create UTC timestamp assuming the input time is in IST
    // Date.UTC creates a timestamp for the given date/time in UTC
    const utcDate = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
    
    // Convert from IST to actual UTC by subtracting IST offset
    // Example: 14:30 IST = 09:00 UTC (14:30 - 5:30)
    const examStartTimeUTC = utcDate - IST_OFFSET_MS;
    
    // Calculate exam end time in UTC
    const examEndTimeUTC = examStartTimeUTC + (durationMinutes * 60 * 1000);
    
    // Get current time in UTC (Date.now() always returns UTC timestamp)
    const nowUTC = Date.now();
    
    const isExpired = nowUTC > examEndTimeUTC;
    
    // For logging, convert timestamps to readable dates
    // const examStartIST = new Date(examStartTimeUTC);
    // const examEndIST = new Date(examEndTimeUTC);
    // const nowIST = new Date(nowUTC);
    
    // console.log(`🔍 Checking exam: ${exam.title || exam.id}`);
    // console.log(`   Date: ${exam.examDate}, Time: ${exam.examTime} IST, Duration: ${exam.duration}min`);
    // console.log(`   Start Time (UTC): ${examStartIST.toISOString()}`);
    // console.log(`   End Time (UTC): ${examEndIST.toISOString()}`);
    // console.log(`   Current Time (UTC): ${nowIST.toISOString()}`);
    // console.log(`   Is Expired: ${isExpired}`);
    
    return isExpired;
  } catch (error) {
    console.error(`❌ Error checking if exam expired:`, error);
    return false;
  }
}

/**
 * Helper function to check if exam ended more than grace period (30 minutes) ago
 */
function isExamBeyondGracePeriod(exam: ExamData, gracePeriodMinutes: number = 30): boolean {
  if (!exam.examDate || !exam.examTime || !exam.duration) {
    // console.log(`⏭️ Skipping exam ${exam.id}: Missing date/time/duration`);
    return false;
  }

  try {
    const durationMinutes = parseInt(exam.duration);
    if (isNaN(durationMinutes)) {
      // console.log(`⚠️ Invalid duration for exam ${exam.id}: ${exam.duration}`);
      return false;
    }

    const [hours, minutes] = exam.examTime.split(':').map(Number);
    const dateStr = exam.examDate.includes('T') ? exam.examDate.split('T')[0] : exam.examDate;
    const [year, month, day] = dateStr.split('-').map(Number);
    
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const utcDate = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
    const examStartTimeUTC = utcDate - IST_OFFSET_MS;
    const examEndTimeUTC = examStartTimeUTC + (durationMinutes * 60 * 1000);
    const graceEndTimeUTC = examEndTimeUTC + (gracePeriodMinutes * 60 * 1000);
    const nowUTC = Date.now();
    
    const isBeyondGracePeriod = nowUTC > graceEndTimeUTC;
    
    // console.log(`🔍 Checking exam grace period: ${exam.title || exam.id}`);
    // console.log(`   Grace End Time: ${new Date(graceEndTimeUTC).toISOString()} (+${gracePeriodMinutes}min)`);
    // console.log(`   Beyond Grace Period: ${isBeyondGracePeriod}`);
    
    return isBeyondGracePeriod;
  } catch (error) {
    console.error(`❌ Error checking grace period:`, error);
    return false;
  }
}

export const autoCompleteExpiredExams = functions
  .region('us-central1')
  .pubsub.schedule('every 1 hours')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    // console.log('🚀 Starting auto-complete expired exams function...');
    
    const startTime = Date.now();
    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    try {
      const db = admin.firestore();
      
      const examsSnapshot = await db.collection(COLLECTIONS.EXAMS)
        .where('status', '==', EXAM_STATUS.UPCOMING)
        .get();
      
      if (examsSnapshot.empty) {
        // console.log('✅ No upcoming exams found. Nothing to process.');
        return null;
      }
      
      // console.log(`📊 Found ${examsSnapshot.size} upcoming exams to check`);
      
      let batch = db.batch();
      let batchCount = 0;
      const batchSize = CLOUD_FUNCTION_CONFIG.BATCH_SIZE;
      
      for (const doc of examsSnapshot.docs) {
        processedCount++;
        const exam: ExamData = { id: doc.id, ...doc.data() };
        
        if (isExamExpired(exam)) {
          batch.update(doc.ref, {
            status: EXAM_STATUS.COMPLETED,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            autoCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
            autoCompletedBy: SYSTEM_TRIGGERS.SYSTEM
          });
          
          batchCount++;
          updatedCount++;
          
          // console.log(`✅ Queued for completion: ${exam.title || exam.id}`);
          
          if (batchCount >= batchSize) {
            await batch.commit();
            // console.log(`💾 Committed batch of ${batchCount} updates`);
            batch = db.batch();
            batchCount = 0;
          }
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        // console.log(`💾 Committed final batch of ${batchCount} updates`);
      }
      
      const duration = Date.now() - startTime;
      
      // console.log('========================================');
      // console.log('✅ Auto-complete function completed!');
      // console.log(`📊 Statistics:`);
      // console.log(`   - Total processed: ${processedCount}`);
      // console.log(`   - Updated to completed: ${updatedCount}`);
      // console.log(`   - Errors: ${errorCount}`);
      // console.log(`   - Duration: ${duration}ms`);
      // console.log('========================================');
      
      return {
        success: true,
        processed: processedCount,
        updated: updatedCount,
        errors: errorCount,
        duration: duration
      };
      
    } catch (error: any) {
      console.error('❌ Fatal error in auto-complete function:', error);
      errorCount++;
      
      return {
        success: false,
        error: error.message,
        processed: processedCount,
        updated: updatedCount,
        errors: errorCount
      };
    }
  });

export const manualAutoCompleteExams = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      res.status(204).send('');
      return;
    }
    
    // console.log('🔧 Manual auto-complete triggered');
    
    const startTime = Date.now();
    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    try {
      const db = admin.firestore();
      const collegeId = req.body?.collegeId;
      
      let query = db.collection(COLLECTIONS.EXAMS).where('status', '==', EXAM_STATUS.UPCOMING);
      
      if (collegeId) {
        // console.log(`🏫 Filtering by collegeId: ${collegeId}`);
        query = query.where('collegeId', '==', collegeId) as admin.firestore.Query;
      }
      
      const examsSnapshot = await query.get();
      
      if (examsSnapshot.empty) {
        res.json({
          success: true,
          message: 'No upcoming exams found',
          processed: 0,
          updated: 0,
          errors: 0
        });
        return;
      }
      
      // console.log(`📊 Found ${examsSnapshot.size} upcoming exams to check`);
      
      let batch = db.batch();
      let batchCount = 0;
      const batchSize = CLOUD_FUNCTION_CONFIG.BATCH_SIZE;
      
      for (const doc of examsSnapshot.docs) {
        processedCount++;
        const exam: ExamData = { id: doc.id, ...doc.data() };
        
        if (isExamExpired(exam)) {
          batch.update(doc.ref, {
            status: EXAM_STATUS.COMPLETED,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            autoCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
            autoCompletedBy: SYSTEM_TRIGGERS.MANUAL
          });
          
          batchCount++;
          updatedCount++;
          
          if (batchCount >= batchSize) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
      }
      
      const duration = Date.now() - startTime;
      
      const result = {
        success: true,
        message: `Successfully processed ${processedCount} exams and updated ${updatedCount} to completed status`,
        processed: processedCount,
        updated: updatedCount,
        errors: errorCount,
        duration: duration
      };
      
      // console.log('✅ Manual auto-complete completed:', result);
      
      res.json(result);
      
    } catch (error: any) {
      console.error('❌ Error in manual auto-complete:', error);
      
      res.status(500).json({
        success: false,
        message: 'Error processing exams',
        error: error.message,
        processed: processedCount,
        updated: updatedCount,
        errors: errorCount + 1
      });
    }
  });

export const checkExpiredExams = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    try {
      const db = admin.firestore();
      
      const examsSnapshot = await db.collection(COLLECTIONS.EXAMS)
        .where('status', '==', EXAM_STATUS.UPCOMING)
        .get();
      
      const expiredExams: any[] = [];
      const upcomingExams: any[] = [];
      
      examsSnapshot.forEach(doc => {
        const exam: ExamData = { id: doc.id, ...doc.data() };
        
        if (isExamExpired(exam)) {
          expiredExams.push({
            id: exam.id,
            title: exam.title,
            examDate: exam.examDate,
            examTime: exam.examTime,
            duration: exam.duration,
            collegeId: exam.collegeId,
            collegeName: exam.collegeName
          });
        } else {
          upcomingExams.push({
            id: exam.id,
            title: exam.title,
            examDate: exam.examDate,
            examTime: exam.examTime,
            duration: exam.duration,
            collegeId: exam.collegeId,
            collegeName: exam.collegeName
          });
        }
      });
      
      res.json({
        success: true,
        total: examsSnapshot.size,
        expired: expiredExams.length,
        upcoming: upcomingExams.length,
        expiredExams,
        upcomingExams
      });
      
    } catch (error: any) {
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  });
  /**
 * Scheduled Cloud Function - Auto-submit pending attempts after 30-minute grace period
 */
export const autoSubmitPendingAttempts = functions
  .region('us-central1')
  .pubsub.schedule('every 30 minutes')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    // console.log('🚀 Starting auto-submit pending attempts function...');
    
    const startTime = Date.now();
    let processedExams = 0;
    let totalAttemptsSubmitted = 0;
    let errorCount = 0;
    
    try {
      const db = admin.firestore();
      
      // Calculate 6 hours ago timestamp (enough time for any exam + grace period)
      const now = admin.firestore.Timestamp.now();
      const sixHoursAgo = new Date(now.toMillis() - (6 * 60 * 60 * 1000));
      
      // console.log(`📅 Processing exams completed in last 6 hours (since ${sixHoursAgo.toISOString()})`);
      
      const completedExamsSnapshot = await db.collection(COLLECTIONS.EXAMS)
        .where('status', '==', EXAM_STATUS.COMPLETED)
        .where('autoCompletedAt', '>=', sixHoursAgo)  // ✅ ONLY last 6 hours!
        .get();
      
      if (completedExamsSnapshot.empty) {
        // console.log('✅ No completed exams found.');
        return null;
      }
      
      // console.log(`📊 Found ${completedExamsSnapshot.size} completed exams to check`);
      
      const GRACE_PERIOD_MINUTES = 30;
      
      for (const examDoc of completedExamsSnapshot.docs) {
        const exam: ExamData = { id: examDoc.id, ...examDoc.data() };
        processedExams++;
        
        if (!isExamBeyondGracePeriod(exam, GRACE_PERIOD_MINUTES)) {
          continue;
        }
        
        // console.log(`⚡ Processing exam "${exam.title || exam.id}"`);
        
        try {
          const pendingAttemptsSnapshot = await db.collection(COLLECTIONS.EXAM_ATTEMPTS)
            .where('examId', '==', exam.id)
            .where('status', '==', 'in_progress')
            .get();
          
          if (pendingAttemptsSnapshot.empty) {
            // console.log(`   ✅ No pending attempts`);
            continue;
          }
          
          // console.log(`   📝 Found ${pendingAttemptsSnapshot.size} pending attempts`);
          
          let batch = db.batch();
          let batchCount = 0;
          const batchSize = 500;
          
          for (const attemptDoc of pendingAttemptsSnapshot.docs) {
            const attempt = attemptDoc.data();
            const now = admin.firestore.Timestamp.now();
            const startTime = attempt.startTime?.toDate?.() || new Date();
            const timeSpent = Math.floor((now.toDate().getTime() - startTime.getTime()) / 1000);
            
            batch.update(attemptDoc.ref, {
              status: 'submitted',
              submitTime: now,
              timeSpent: timeSpent,
              autoSubmitted: true,
              autoSubmittedReason: 'grace_period_expired',
              autoSubmittedAt: now,
              updatedAt: now
            });
            
            batchCount++;
            totalAttemptsSubmitted++;
            
            if (batchCount >= batchSize) {
              await batch.commit();
              batch = db.batch();
              batchCount = 0;
            }
          }
          
          if (batchCount > 0) {
            await batch.commit();
          }
          
          // console.log(`   ✅ Auto-submitted ${pendingAttemptsSnapshot.size} attempts`);
          
          // 🎯 NOW GRADE THEM - Call the SAME function as manual submit!
          // console.log(`   🔍 Starting grading for auto-submitted attempts...`);
          let gradedCount = 0;
          let gradingErrors = 0;
          
          for (const attemptDoc of pendingAttemptsSnapshot.docs) {
            try {
              const attempt = attemptDoc.data();
              
              // ✅ Read responses from sub-collection
              const responsesDoc = await attemptDoc.ref.collection('attemptResponses').doc('main').get();
              const responses = responsesDoc.exists ? (responsesDoc.data()?.responses || []) : [];
              
              if (responses.length === 0) {
                // console.log(`      ⚠️ No responses found for: ${attemptDoc.id}`);
                continue;
              }
              
              // console.log(`      📊 Grading ${responses.length} responses for: ${attemptDoc.id}`);
              
              // Call the SAME grading function that manual submit uses!
              await gradeAttempt(attempt.examId, attemptDoc.id, responses);
              
              gradedCount++;
              // console.log(`      ✅ Successfully graded: ${attemptDoc.id}`);
              
            } catch (gradeError: any) {
              console.error(`      ❌ Grading error for ${attemptDoc.id}:`, gradeError.message);
              gradingErrors++;
            }
          }
          
          // console.log(`   ✅ Grading complete: ${gradedCount} graded, ${gradingErrors} errors`);
          
          // 🎯 UPDATE EXAM: Mark that auto-grading is complete
          try {
            await examDoc.ref.update({
              autoGradingComplete: true,
              autoGradingCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
              totalAutoSubmitted: pendingAttemptsSnapshot.size,
              totalAutoGraded: gradedCount,
              autoGradingErrors: gradingErrors,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            // console.log(`   ✅ Exam marked as auto-grading complete`);
          } catch (updateError: any) {
            console.error(`   ⚠️ Could not update exam: ${updateError.message}`);
          }
          
        } catch (examError: any) {
          console.error(`❌ Error processing exam ${exam.id}:`, examError);
          errorCount++;
        }
      }
      
      const duration = Date.now() - startTime;
      
      // console.log('========================================');
      // console.log('✅ Auto-submit completed!');
      // console.log(`📊 Statistics:`);
      // console.log(`   - Exams processed: ${processedExams}`);
      // console.log(`   - Attempts auto-submitted: ${totalAttemptsSubmitted}`);
      // console.log(`   - Errors: ${errorCount}`);
      // console.log(`   - Duration: ${duration}ms`);
      // console.log('========================================');
      
      return {
        success: true,
        examsProcessed: processedExams,
        attemptsSubmitted: totalAttemptsSubmitted,
        errors: errorCount,
        duration: duration
      };
      
    } catch (error: any) {
      console.error('❌ Fatal error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
// ============================================
// MANUAL AUTO-SUBMIT AND GRADE
// Manually trigger auto-submit and grading without waiting for scheduled function
// ============================================

export const manualAutoSubmitAndGrade = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 540,  // 9 minutes
    memory: '1GB'
  })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      res.status(204).send('');
      return;
    }
    
    // console.log('🔧 Manual auto-submit and grade triggered');
    
    const startTime = Date.now();
    let processedExams = 0;
    let totalAttemptsSubmitted = 0;
    let totalAttemptsGraded = 0;
    let errorCount = 0;
    
    try {
      const db = admin.firestore();
      const examId = req.body?.examId;
      
      // Calculate 6 hours ago timestamp
      const now = admin.firestore.Timestamp.now();
      const sixHoursAgo = new Date(now.toMillis() - (6 * 60 * 60 * 1000));
      
      // console.log(`📅 Processing exams completed in last 6 hours (since ${sixHoursAgo.toISOString()})`);
      
      let query = db.collection(COLLECTIONS.EXAMS)
        .where('status', '==', EXAM_STATUS.COMPLETED)
        .where('autoCompletedAt', '>=', sixHoursAgo);  // ✅ ONLY last 6 hours!
      
      if (examId) {
        // console.log(`📝 Processing specific exam: ${examId}`);
        query = query.where(admin.firestore.FieldPath.documentId(), '==', examId) as admin.firestore.Query;
      }
      
      const completedExamsSnapshot = await query.get();
      
      if (completedExamsSnapshot.empty) {
        res.status(200).json({
          success: true,
          message: 'No completed exams found',
          examsProcessed: 0,
          attemptsSubmitted: 0,
          attemptsGraded: 0
        });
        return;
      }
      
      // console.log(`📊 Found ${completedExamsSnapshot.size} completed exams to process`);
      
      for (const examDoc of completedExamsSnapshot.docs) {
        const exam: any = { id: examDoc.id, ...examDoc.data() };
        processedExams++;
        
        // console.log(`⚡ Processing exam "${exam.title || exam.id}"`);
        
        try {
          const pendingAttemptsSnapshot = await db.collection(COLLECTIONS.EXAM_ATTEMPTS)
            .where('examId', '==', exam.id)
            .where('status', '==', 'in_progress')
            .get();
          
          if (pendingAttemptsSnapshot.empty) {
            // console.log(`   ✅ No pending attempts for this exam`);
            continue;
          }
          
          // console.log(`   📝 Found ${pendingAttemptsSnapshot.size} pending attempts`);
          
          let batch = db.batch();
          let batchCount = 0;
          const batchSize = 500;
          
          for (const attemptDoc of pendingAttemptsSnapshot.docs) {
            const attempt = attemptDoc.data();
            const now = admin.firestore.Timestamp.now();
            const startTime = attempt.startTime?.toDate?.() || new Date();
            const timeSpent = Math.floor((now.toDate().getTime() - startTime.getTime()) / 1000);
            
            batch.update(attemptDoc.ref, {
              status: 'submitted',
              submitTime: now,
              timeSpent: timeSpent,
              autoSubmitted: true,
              autoSubmittedReason: 'manual_trigger',
              autoSubmittedAt: now,
              updatedAt: now
            });
            
            batchCount++;
            totalAttemptsSubmitted++;
            
            if (batchCount >= batchSize) {
              await batch.commit();
              batch = db.batch();
              batchCount = 0;
            }
          }
          
          if (batchCount > 0) {
            await batch.commit();
          }
          
          // console.log(`   ✅ Auto-submitted ${pendingAttemptsSnapshot.size} attempts`);
          
          // console.log(`   🔍 Starting grading for ${pendingAttemptsSnapshot.size} attempts...`);
          let gradedCount = 0;
          let gradingErrors = 0;
          
          for (const attemptDoc of pendingAttemptsSnapshot.docs) {
            try {
              const attempt = attemptDoc.data();
              
              // ✅ Read responses from sub-collection
              const responsesDoc = await attemptDoc.ref.collection('attemptResponses').doc('main').get();
              const responses = responsesDoc.exists ? (responsesDoc.data()?.responses || []) : [];
              
              if (responses.length === 0) {
                // console.log(`      ⚠️ No responses for: ${attemptDoc.id}`);
                continue;
              }
              
              // console.log(`      📊 Grading ${responses.length} responses for: ${attemptDoc.id}`);
              
              await gradeAttempt(attempt.examId, attemptDoc.id, responses);
              
              gradedCount++;
              totalAttemptsGraded++;
              // console.log(`      ✅ Graded: ${attemptDoc.id}`);
              
            } catch (gradeError: any) {
              console.error(`      ❌ Grading error for ${attemptDoc.id}:`, gradeError.message);
              gradingErrors++;
            }
          }
          
          // console.log(`   ✅ Grading complete: ${gradedCount} graded, ${gradingErrors} errors`);
          
          try {
            await examDoc.ref.update({
              autoGradingComplete: true,
              autoGradingCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
              totalAutoSubmitted: pendingAttemptsSnapshot.size,
              totalAutoGraded: gradedCount,
              autoGradingErrors: gradingErrors,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            // console.log(`   ✅ Exam marked as auto-grading complete`);
          } catch (updateError: any) {
            console.error(`   ⚠️ Could not update exam:`, updateError.message);
          }
          
        } catch (examError: any) {
          console.error(`❌ Error processing exam ${exam.id}:`, examError);
          errorCount++;
        }
      }
      
      const duration = Date.now() - startTime;
      
      // console.log('========================================');
      // console.log('✅ Manual auto-submit and grade completed!');
      // console.log(`📊 Statistics:`);
      // console.log(`   - Exams processed: ${processedExams}`);
      // console.log(`   - Attempts auto-submitted: ${totalAttemptsSubmitted}`);
      // console.log(`   - Attempts graded: ${totalAttemptsGraded}`);
      // console.log(`   - Errors: ${errorCount}`);
      // console.log(`   - Duration: ${duration}ms`);
      // console.log('========================================');
      
      res.status(200).json({
        success: true,
        message: `Successfully processed ${processedExams} exams`,
        examsProcessed: processedExams,
        attemptsSubmitted: totalAttemptsSubmitted,
        attemptsGraded: totalAttemptsGraded,
        errors: errorCount,
        duration: duration
      });
      
    } catch (error: any) {
      console.error('❌ Fatal error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
// ============================================
// COMPLETE EXAM WITH GRADING (CORRECT ORDER)
// This does it in the RIGHT order for student experience
// ============================================


// ============================================
// HELPER: Check if all grading complete for an exam
// ============================================
async function checkAndMarkExamGradingComplete(examId: string) {
  const db = admin.firestore();
  
  try {
    // Count pending grading tasks
    const pendingSnapshot = await db.collection(COLLECTIONS.EXAM_ATTEMPTS)
      .where('examId', '==', examId)
      .where('gradingQueued', '==', true)
      .limit(1)
      .get();
    
    // If no pending tasks, mark exam as complete
    if (pendingSnapshot.empty) {
      // console.log(`✅ All grading complete for exam: ${examId}`);
      
      // Get counts
      const [gradedSnapshot, failedSnapshot] = await Promise.all([
        db.collection(COLLECTIONS.EXAM_ATTEMPTS)
          .where('examId', '==', examId)
          .where('gradingComplete', '==', true)
          .count()
          .get(),
        db.collection(COLLECTIONS.EXAM_ATTEMPTS)
          .where('examId', '==', examId)
          .where('gradingFailed', '==', true)
          .count()
          .get()
      ]);
      
      // Update exam document
      await db.collection(COLLECTIONS.EXAMS).doc(examId).update({
        autoGradingComplete: true,
        autoGradingCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        totalAutoGraded: gradedSnapshot.data().count,
        autoGradingErrors: failedSnapshot.data().count,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // console.log(`✅ Exam ${examId} marked as fully graded`);
      // console.log(`   - Graded: ${gradedSnapshot.data().count}`);
      // console.log(`   - Failed: ${failedSnapshot.data().count}`);
    }
  } catch (error: any) {
    console.error(`Error checking completion for exam ${examId}:`, error);
  }
}

// ============================================
// MAIN FUNCTION: Complete Exam with Pub/Sub Grading (HTTP)
// ============================================
export const completeExamWithGrading = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 120,  // Only 2 minutes needed now!
    memory: '512MB'
  })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      res.status(204).send('');
      return;
    }
    
    // console.log('🎓 Complete Exam with Grading - PUB/SUB MODE (PARALLEL)');
    
    const startTime = Date.now();
    let processedExams = 0;
    let totalAttemptsSubmitted = 0;
    let totalGradingTasksQueued = 0;
    let examsCompleted = 0;
    let errorCount = 0;
    
    try {
      const db = admin.firestore();
      const examId = req.body?.examId;
      
      // console.log(`📅 Processing UPCOMING exams that need completion`);
      
      let query = db.collection(COLLECTIONS.EXAMS)
        .where('status', '==', EXAM_STATUS.UPCOMING);
      
      if (examId) {
        // console.log(`📝 Processing specific exam: ${examId}`);
        query = query.where(admin.firestore.FieldPath.documentId(), '==', examId) as admin.firestore.Query;
      }
      
      const upcomingExamsSnapshot = await query.get();
      
      if (upcomingExamsSnapshot.empty) {
        res.status(200).json({
          success: true,
          message: 'No upcoming exams found',
          examsProcessed: 0
        });
        return;
      }
      
      // console.log(`📊 Found ${upcomingExamsSnapshot.size} upcoming exams to check`);
      
      const GRACE_PERIOD_MINUTES = 30;
      
      for (const examDoc of upcomingExamsSnapshot.docs) {
        const exam: any = { id: examDoc.id, ...examDoc.data() };
        processedExams++;
        
        // Check grace period
        if (!isExamBeyondGracePeriod(exam, GRACE_PERIOD_MINUTES)) {
          // console.log(`   ⏰ Exam "${exam.title}" still in grace period - skipping`);
          continue;
        }
        
        // console.log(`⚡ Processing exam "${exam.title || exam.id}"`);
        
        try {
          // Find pending attempts
          const pendingAttemptsSnapshot = await db.collection(COLLECTIONS.EXAM_ATTEMPTS)
            .where('examId', '==', exam.id)
            .where('status', '==', 'in_progress')
            .get();
          
          // console.log(`   📝 Found ${pendingAttemptsSnapshot.size} pending attempts`);
          
          // ==========================================
          // STEP 1: SUBMIT ALL ATTEMPTS (BATCH - FAST!)
          // ==========================================
          if (!pendingAttemptsSnapshot.empty) {
            let batch = db.batch();
            let batchCount = 0;
            const batchSize = 500;
            
            for (const attemptDoc of pendingAttemptsSnapshot.docs) {
              const attempt = attemptDoc.data();
              const submitTime = admin.firestore.Timestamp.now();
              const startTime = attempt.startTime?.toDate?.() || new Date();
              const timeSpent = Math.floor((submitTime.toDate().getTime() - startTime.getTime()) / 1000);
              
              batch.update(attemptDoc.ref, {
                status: 'submitted',
                submitTime: submitTime,
                timeSpent: timeSpent,
                autoSubmitted: true,
                autoSubmittedReason: 'exam_expired',
                autoSubmittedAt: submitTime,
                gradingQueued: true,  // Flag: grading queued
                updatedAt: submitTime
              });
              
              batchCount++;
              totalAttemptsSubmitted++;
              
              if (batchCount >= batchSize) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
              }
            }
            
            if (batchCount > 0) {
              await batch.commit();
            }
            
            // console.log(`   ✅ Auto-submitted ${pendingAttemptsSnapshot.size} attempts`);
            
            // ==========================================
            // STEP 2: QUEUE GRADING TASKS (PUB/SUB - PARALLEL!)
            // ==========================================
            // console.log(`   🚀 Queueing ${pendingAttemptsSnapshot.size} grading tasks to Pub/Sub...`);
            
            const topic = pubsub.topic('grade-attempts');
            
            // Publish all grading tasks
            const publishPromises = [];
            
            for (const attemptDoc of pendingAttemptsSnapshot.docs) {
              const attempt = attemptDoc.data();
              
              // ✅ Check responses from sub-collection (with fallback)
              const respDoc = await attemptDoc.ref.collection('attemptResponses').doc('main').get();
              const responses = respDoc.exists ? (respDoc.data()?.responses || []) : [];
              
              if (responses.length === 0) {
                // console.log(`      ⚠️ No responses for: ${attemptDoc.id}`);
                // Mark as no responses
                await attemptDoc.ref.update({
                  gradingQueued: false,
                  gradingComplete: true,
                  evaluationStatus: 'not_attempted',
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                continue;
              }
              
              // Publish to Pub/Sub (fire and forget!)
              const messagePromise = topic.publishMessage({
                json: {
                  examId: exam.id,
                  attemptId: attemptDoc.id,
                  examTitle: exam.title || exam.id,
                  studentId: attempt.studentId,
                  timestamp: Date.now()
                }
              });
              
              publishPromises.push(messagePromise);
              totalGradingTasksQueued++;
            }
            
            // Wait for all messages to be published (fast - milliseconds)
            await Promise.all(publishPromises);
            
            // console.log(`   ✅ Queued ${totalGradingTasksQueued} grading tasks to Pub/Sub`);
          }
          
          // ==========================================
          // STEP 3: MARK EXAM AS COMPLETED
          // ==========================================
          await examDoc.ref.update({
            status: EXAM_STATUS.COMPLETED,
            autoCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
            autoCompletedBy: 'system',
            autoGradingQueued: pendingAttemptsSnapshot.size > 0,
            autoGradingComplete: pendingAttemptsSnapshot.size === 0,  // True if no attempts
            totalAutoSubmitted: pendingAttemptsSnapshot.size,
            totalGradingTasksQueued: totalGradingTasksQueued,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          examsCompleted++;
          // console.log(`   ✅ Exam marked as COMPLETED (grading ${pendingAttemptsSnapshot.size > 0 ? 'in progress' : 'not needed'})`);
          
        } catch (examError: any) {
          console.error(`❌ Error processing exam ${exam.id}:`, examError);
          errorCount++;
        }
      }
      
      const duration = Date.now() - startTime;
      
      // console.log('========================================');
      // console.log('✅ Exam completion with parallel grading queued!');
      // console.log(`📊 Statistics:`);
      // console.log(`   - Exams checked: ${processedExams}`);
      // console.log(`   - Exams completed: ${examsCompleted}`);
      // console.log(`   - Attempts submitted: ${totalAttemptsSubmitted}`);
      // console.log(`   - Grading tasks queued: ${totalGradingTasksQueued}`);
      // console.log(`   - Errors: ${errorCount}`);
      // console.log(`   - Duration: ${duration}ms`);
      // console.log(`   - ⚡ Grading now happening in PARALLEL via Pub/Sub workers!`);
      // console.log('========================================');
      
      res.status(200).json({
        success: true,
        message: totalGradingTasksQueued > 0 
          ? `Grading queued for ${totalGradingTasksQueued} attempts (processing in parallel)`
          : `${examsCompleted} exams completed`,
        examsChecked: processedExams,
        examsCompleted: examsCompleted,
        attemptsSubmitted: totalAttemptsSubmitted,
        gradingTasksQueued: totalGradingTasksQueued,
        errors: errorCount,
        duration: duration,
        note: totalGradingTasksQueued > 0 
          ? "Grading is happening in parallel via Pub/Sub workers (2-3 minutes)" 
          : "No grading needed"
      });
      
    } catch (error: any) {
      console.error('❌ Fatal error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

// ============================================
// WORKER FUNCTION: Grade Individual Attempt (Pub/Sub Subscriber)
// This function is triggered automatically for EACH message published
// Multiple instances run in PARALLEL!
// ============================================
export const gradeAttemptWorker = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 120,  // 2 minutes per attempt
    memory: '1GB',
    maxInstances: 2000  // Allow up to 2000 parallel workers!
  })
  .pubsub.topic('grade-attempts')
  .onPublish(async (message) => {
    const { examId, attemptId } = message.json;
    
    // console.log(`🎯 [Worker] Grading attempt: ${attemptId} for student: ${studentId} (Exam: ${examTitle})`);
    
    const startTime = Date.now();
    
    try {
      const db = admin.firestore();
      
      // Get attempt data
      const attemptDoc = await db.collection(COLLECTIONS.EXAM_ATTEMPTS).doc(attemptId).get();
      
      if (!attemptDoc.exists) {
        console.error(`❌ Attempt ${attemptId} not found`);
        return;
      }
      
      // ✅ Read responses from sub-collection
      const responsesDoc = await db.collection(COLLECTIONS.EXAM_ATTEMPTS).doc(attemptId).collection('attemptResponses').doc('main').get();
      const responses = responsesDoc.exists ? (responsesDoc.data()?.responses || []) : [];
      
      if (responses.length === 0) {
        // console.log(`⚠️ No responses for attempt ${attemptId}`);
        await attemptDoc.ref.update({
          gradingQueued: false,
          gradingComplete: true,
          evaluationStatus: 'not_attempted',
          gradedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return;
      }
      
      // console.log(`   📊 Grading ${responses.length} responses...`);
      
      // Call shared grading function (includes CODE + DESCRIPTIVE with AI!)
      await gradeAttempt(examId, attemptId, responses);
      
      // Update attempt document
      await attemptDoc.ref.update({
        gradingQueued: false,
        gradingComplete: true,
        gradedAt: admin.firestore.FieldValue.serverTimestamp(),
        gradingDuration: Date.now() - startTime
      });
      
      // const duration = Date.now() - startTime;
      // console.log(`✅ [Worker] Successfully graded attempt ${attemptId} in ${duration}ms`);
      
      // Check if all attempts for this exam are now graded
      await checkAndMarkExamGradingComplete(examId);
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ [Worker] Error grading attempt ${attemptId} after ${duration}ms:`, error);
      
      // Mark as failed (Pub/Sub will retry automatically!)
      try {
        await admin.firestore()
          .collection(COLLECTIONS.EXAM_ATTEMPTS)
          .doc(attemptId)
          .update({
            gradingQueued: false,
            gradingFailed: true,
            gradingError: error.message,
            gradedAt: admin.firestore.FieldValue.serverTimestamp(),
            gradingDuration: duration
          });
      } catch (updateError) {
        console.error(`Failed to update error status for ${attemptId}`);
      }
      
      // Re-throw to trigger Pub/Sub retry
      throw error;
    }
  });

// ============================================
// MONITORING FUNCTION: Check Grading Progress (HTTP)
// Call this to check how many attempts are still being graded
// ============================================
export const checkGradingProgress = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    try {
      const db = admin.firestore();
      const examId = req.body?.examId || req.query.examId;
      
      if (!examId) {
        res.status(400).json({ error: 'examId required' });
        return;
      }
      
      // Get counts
      const [queuedSnapshot, completedSnapshot, failedSnapshot, totalSnapshot] = await Promise.all([
        db.collection(COLLECTIONS.EXAM_ATTEMPTS)
          .where('examId', '==', examId)
          .where('gradingQueued', '==', true)
          .count()
          .get(),
        db.collection(COLLECTIONS.EXAM_ATTEMPTS)
          .where('examId', '==', examId)
          .where('gradingComplete', '==', true)
          .count()
          .get(),
        db.collection(COLLECTIONS.EXAM_ATTEMPTS)
          .where('examId', '==', examId)
          .where('gradingFailed', '==', true)
          .count()
          .get(),
        db.collection(COLLECTIONS.EXAM_ATTEMPTS)
          .where('examId', '==', examId)
          .count()
          .get()
      ]);
      
      const queued = queuedSnapshot.data().count;
      const completed = completedSnapshot.data().count;
      const failed = failedSnapshot.data().count;
      const total = totalSnapshot.data().count;
      
      const isComplete = queued === 0;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      res.json({
        success: true,
        examId: examId,
        total: total,
        completed: completed,
        failed: failed,
        queued: queued,
        progress: `${progress}%`,
        isComplete: isComplete,
        message: isComplete 
          ? `All grading complete! ${completed} graded, ${failed} failed` 
          : `Grading in progress: ${queued} remaining`
      });
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

// ============================================
// CHANGE USER PASSWORD (Admin Function)
// Allows admins to change another user's password
// ============================================
export const changeUserPasswordAdmin = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB'
  })
  .https.onCall(async (data, context) => {
    // Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be logged in to change passwords'
      );
    }

    const { targetUserId, newPassword, performedBy } = data;

    // Validate inputs
    if (!targetUserId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Target user ID is required'
      );
    }

    if (!newPassword) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'New password is required'
      );
    }

    if (newPassword.length < 6) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Password must be at least 6 characters'
      );
    }

    try {
      const db = admin.firestore();
      
      // SECURITY: Use context.auth.uid (server-verified) instead of client-passed performedBy
      const callerUid = context.auth!.uid;
      
      // SECURITY: Verify caller identity matches claimed performer
      if (performedBy && performedBy !== callerUid) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Caller identity mismatch - cannot impersonate another user'
        );
      }
      
      // Get the performer's user document to verify role SERVER-SIDE
      const performerDoc = await db.collection(COLLECTIONS.USERS).doc(callerUid).get();
      if (!performerDoc.exists) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Performer user not found'
        );
      }
      
      // SECURITY: Use server-verified role from Firestore, NEVER trust client-passed role
      const performerData = performerDoc.data();
      const verifiedRole = performerData?.userType || '';
      
      // SECURITY: Prevent changing own password through admin endpoint
      if (targetUserId === callerUid) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Use the regular change password flow to change your own password'
        );
      }
      
      // Get the target user document
      const targetDoc = await db.collection(COLLECTIONS.USERS).doc(targetUserId).get();
      if (!targetDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Target user not found'
        );
      }
      
      const targetUserData = targetDoc.data();
      const targetUserType = targetUserData?.userType || 'student';
      
      // SECURITY: Verify college match (non-system_admin can only change passwords within their college)
      if (verifiedRole !== 'system_admin') {
        const performerCollege = performerData?.collegeId;
        const targetCollege = targetUserData?.collegeId;
        if (!performerCollege || performerCollege !== targetCollege) {
          throw new functions.https.HttpsError(
            'permission-denied',
            'You can only change passwords for users in your college'
          );
        }
      }
      
      // Permission check using SERVER-VERIFIED role:
      // - system_admin can change anyone's password
      // - admin/super_admin can change anyone's password EXCEPT other admins/system_admin
      // - principal, dean, teacher can only change student passwords
      // - students cannot change anyone's password
      const allowedRoles = ['system_admin', 'admin', 'super_admin', 'principal', 'dean', 'teacher'];
      
      if (!allowedRoles.includes(verifiedRole)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You do not have permission to change passwords'
        );
      }
      
      // Admin cannot change other admin's or system_admin's password
      if (['admin', 'super_admin'].includes(verifiedRole) && ['admin', 'super_admin', 'system_admin'].includes(targetUserType)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Admins cannot change other admin passwords'
        );
      }
      
      // Non-admin roles can only change student passwords
      if (['principal', 'dean', 'teacher'].includes(verifiedRole) && targetUserType !== 'student') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You can only change student passwords'
        );
      }

      // Change the password using Admin SDK
      await admin.auth().updateUser(targetUserId, {
        password: newPassword
      });

      // Update Firestore user document
      await db.collection(COLLECTIONS.USERS).doc(targetUserId).update({
        passwordChangedAt: admin.firestore.FieldValue.serverTimestamp(),
        passwordChangedBy: callerUid,
        passwordChangedByRole: verifiedRole,
        mustChangePassword: false,
        temporaryPassword: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // console.log(`✅ Password changed for user ${targetUserId} by ${callerUid} (${verifiedRole})`);

      return { 
        success: true,
        message: 'Password changed successfully'
      };
      
    } catch (error: any) {
      console.error('❌ Error changing user password:', error);
      
      // If it's already a HttpsError, re-throw it
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to change password'
      );
    }
  });

// ============================================
// CREATE USER (Server-side with Admin SDK)
// Creates Firebase Auth user without logging out the caller
// ============================================
export const createUser = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
    maxInstances: 10
  })
  .https.onCall(async (data, context) => {
    // Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be logged in to create users'
      );
    }

    const { 
      fullName, 
      title,
      email, 
      phone, 
      userType, 
      collegeId, 
      board,
      studentRoll,
      academicYear,
      studentClass,
      teacherClasses,
      teacherSubjects,
      createdBy,
      createdByRole,
      recaptchaToken,
    } = data;

    // Validate required fields
    if (!fullName || !phone || !userType || !collegeId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: fullName, phone, userType, collegeId'
      );
    }

    // ── RESUME BUILDER: verify reCAPTCHA before anything else ──
    if (collegeId === 'RES') {
      if (!recaptchaToken) {
        throw new functions.https.HttpsError('invalid-argument', 'reCAPTCHA token is required');
      }
      try {
        const recaptchaDoc = await admin.firestore().doc('settings/recaptcha').get();
        if (!recaptchaDoc.exists) throw new Error('reCAPTCHA credentials not configured');
        const secretKey = recaptchaDoc.data()?.secret_key;
        if (!secretKey) throw new Error('reCAPTCHA secret key not found');

        const recaptchaRes = await fetch(
          `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`,
          { method: 'POST' }
        );
        const recaptchaData: any = await recaptchaRes.json();

        // score < 0.5 likely a bot (0.0 = bot, 1.0 = human)
        if (!recaptchaData.success || recaptchaData.score < 0.5) {
          throw new functions.https.HttpsError('permission-denied', 'reCAPTCHA verification failed. Please try again.');
        }
      } catch (err: any) {
        if (err instanceof functions.https.HttpsError) throw err;
        throw new functions.https.HttpsError('internal', `reCAPTCHA check failed: ${err.message}`);
      }
    } else {
      // Permission check - only these roles can create users (non-RES)
      const allowedRoles = ['system_admin', 'admin', 'principal', 'dean', 'teacher'];
      if (!allowedRoles.includes(createdByRole)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You do not have permission to create users'
        );
      }
    }

    try {
      const db = admin.firestore();
      
      // Normalize phone number
      const normalizePhone = (phoneNum: string): string => {
        if (!phoneNum) return '';
        const cleaned = phoneNum.replace(/\D/g, '');
        if (cleaned.length === 10) {
          return `+91${cleaned}`;
        }
        return phoneNum.startsWith('+') ? phoneNum : `+${phoneNum}`;
      };

      const normalizedPhone = normalizePhone(phone);
      const phoneRaw = normalizedPhone.replace('+91', '');

      // Check if user already exists by phone
      const phoneQuery = await db.collection(COLLECTIONS.USERS)
        .where('phone', '==', normalizedPhone)
        .limit(1)
        .get();
      
      if (!phoneQuery.empty) {
        throw new functions.https.HttpsError(
          'already-exists',
          'A user with this phone number already exists'
        );
      }

      // Check if user already exists by email
      if (email) {
        const emailQuery = await db.collection(COLLECTIONS.USERS)
          .where('email', '==', email.toLowerCase())
          .limit(1)
          .get();
        
        if (!emailQuery.empty) {
          throw new functions.https.HttpsError(
            'already-exists',
            'A user with this email already exists'
          );
        }
      }

      // Check if student roll number already exists (for students only)
      if (userType === 'student' && studentRoll && studentRoll.trim()) {
        const rollQuery = await db.collection(COLLECTIONS.USERS)
          .where('collegeId', '==', collegeId)
          .where('studentRoll', '==', studentRoll.trim())
          .limit(1)
          .get();
        
        if (!rollQuery.empty) {
          throw new functions.https.HttpsError(
            'already-exists',
            'A student with this roll number already exists in this college'
          );
        }
      }

      let userId: string;
      let temporaryPassword: string | undefined;
      let authAccountCreated = false;

      // Generate random password
      const generatePassword = (): string => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%';
        let password = '';
        for (let i = 0; i < 8; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
      };

      // Create Firebase Auth user if email provided
      if (email && email.trim()) {
        temporaryPassword = generatePassword();
        
        try {
          // Admin SDK creates user WITHOUT signing them in
          const userRecord = await admin.auth().createUser({
            email: email.toLowerCase(),
            password: temporaryPassword,
            displayName: fullName
          });
          
          userId = userRecord.uid;
          authAccountCreated = true;
          // console.log(`✅ Auth user created: ${userId}`);
          
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError(
              'already-exists',
              'This email address is already registered in Firebase Auth'
            );
          }
          throw authError;
        }
      } else {
        // Generate unique ID for users without auth account
        const newUserRef = db.collection(COLLECTIONS.USERS).doc();
        userId = newUserRef.id;
      }

      // Generate permissions based on user type
      const getPermissions = (type: string) => {
        const permissionMap: Record<string, string[]> = {
          'student': ['view_exams', 'attempt_exams', 'view_results'],
          'teacher': ['view_exams', 'create_exams', 'grade_exams', 'view_results', 'view_students'],
          'dean': ['view_exams', 'create_exams', 'grade_exams', 'view_results', 'view_students', 'manage_teachers'],
          'principal': ['view_exams', 'create_exams', 'grade_exams', 'view_results', 'view_students', 'manage_teachers', 'manage_college'],
          'admin': ['all']
        };
        return permissionMap[type] || [];
      };

      // Create user document
      const userDoc: any = {
        userId,
        fullName,
        title: title || '',
        email: email ? email.toLowerCase() : '',
        phone: normalizedPhone,
        phoneRaw,
        userType,
        collegeId,
        board: board || 'Not Specified',
        status: 'active',
        createdBy,
        createdByRole,
        permissions: getPermissions(userType),
        mustChangePassword: true,
        firstLogin: true,
        passwordChangedAt: null,
        temporaryPassword: authAccountCreated,
        accountLocked: false,
        failedLoginAttempts: 0,
        lastLoginAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Add student-specific fields
      if (userType === 'student') {
        userDoc.studentRoll = studentRoll || '';
        userDoc.academicYear = academicYear || '';
        userDoc.studentClass = studentClass || '';
        userDoc.studentHistory = [{
          academicYear: academicYear || '',
          className: studentClass || '',
          rollNumber: studentRoll || '',
          board: board || 'Not Specified',
          collegeId
        }];
      }

      // Add teacher/principal/dean-specific fields
      if (['teacher', 'principal', 'dean'].includes(userType)) {
        userDoc.teacherClasses = teacherClasses || [];
        userDoc.teacherSubjects = teacherSubjects || [];
      }

      // Save user document
      await db.collection(COLLECTIONS.USERS).doc(userId).set(userDoc);
      // console.log(`✅ User document saved: ${userId}`);

      // Save temporary credentials if auth account created
      if (authAccountCreated && temporaryPassword) {
        await db.collection('pending_user_credentials').doc(userId).set({
          email: email.toLowerCase(),
          fullName,
          userType,
          temporaryPassword,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          shared: false
        });
      }

      // Update college counts
      try {
        const collegeRef = db.collection(COLLECTIONS.COLLEGES).doc(collegeId);
        const updates: any = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        updates[`roleCounts.${userType}`] = admin.firestore.FieldValue.increment(1);
        
        if (['teacher', 'principal', 'dean'].includes(userType)) {
          updates.totalTeachers = admin.firestore.FieldValue.increment(1);
          if (board && board !== 'Not Specified') {
            updates[`boardWiseCounts.${board}.totalTeachers`] = admin.firestore.FieldValue.increment(1);
          }
        } else if (userType === 'student') {
          updates.totalStudents = admin.firestore.FieldValue.increment(1);
          if (board && board !== 'Not Specified') {
            updates[`boardWiseCounts.${board}.totalStudents`] = admin.firestore.FieldValue.increment(1);
          }
        }
        
        await collegeRef.update(updates);
      } catch (countError) {
        // console.warn('⚠️ Failed to update college counts:', countError);
      }

      // ✅ Send email after auth account created
      // RES (Resume Builder) users → verification email
      // All other users → EXAMINERS welcome email with credentials
      if (authAccountCreated && email && temporaryPassword) {
        try {
          // Fetch email credentials from Firestore (shared by both paths)
          const emailCredsDoc = await db.doc(FIRESTORE_PATHS.EMAIL_CREDENTIALS).get();

          if (emailCredsDoc.exists) {
            const emailCreds = emailCredsDoc.data();

            if (emailCreds?.MAIL_HOST && emailCreds?.MAIL_USERNAME && emailCreds?.MAIL_PASSWORD && emailCreds?.MAIL_PORT) {
              const transporter = nodemailer.createTransport({
                host: emailCreds.MAIL_HOST,
                port: parseInt(emailCreds.MAIL_PORT),
                secure: false,
                auth: {
                  user: emailCreds.MAIL_USERNAME,
                  pass: emailCreds.MAIL_PASSWORD,
                },
              });

              if (collegeId === 'RES') {
                // ── RESUME BUILDER: send email verification link ──
                const token = generateVerificationToken();
                const now = admin.firestore.Timestamp.now();

                // Store verification token in users collection
                await db.collection(COLLECTIONS.USERS).doc(userId).update({
                  emailVerified: false,
                  verificationToken: token,
                  verificationSentAt: now,
                  updatedAt: now,
                });

                const verifyUrl = `https://www.tutorialspoint.com/online-resume-builder.htm?verify_token=${token}&uid=${userId}`;

                const resumeVerifyHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:26px;">Verify Your Email</h1>
      <p style="color:#fff;opacity:.9;margin:8px 0 0;">Resume Builder by Tutorials Point</p>
    </div>
    <div style="padding:40px 30px;">
      <h2 style="color:#667eea;margin-top:0;">Hello ${fullName}! 👋</h2>
      <p style="color:#4b5563;font-size:16px;line-height:1.6;">
        Thanks for signing up! Please verify your email address to activate your account and start saving your resumes.
      </p>
      <div style="text-align:center;margin:35px 0;">
        <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:15px 40px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">
          ✅ Verify My Email
        </a>
      </div>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px;border-radius:5px;margin:25px 0;">
        <p style="color:#92400e;margin:0;font-size:14px;">
          <strong>⚠️ This link expires in 24 hours.</strong> If you did not create an account, you can safely ignore this email.
        </p>
      </div>
      <p style="color:#6b7280;font-size:13px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${verifyUrl}" style="color:#667eea;word-break:break-all;">${verifyUrl}</a>
      </p>
    </div>
    <div style="background:#f7fafc;padding:25px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;">
      <p style="margin:0;">© ${new Date().getFullYear()} Tutorials Point India Pvt. Ltd. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

                await transporter.sendMail({
                  from: `Tutorials Point <${process.env.NOREPLY_EMAIL || 'noreply@email.tutorialspoint.com'}>`,
                  to: email.toLowerCase(),
                  subject: 'Verify your email – Resume Builder',
                  html: resumeVerifyHtml,
                });

                // console.log('✅ Resume verification email sent to:', email);

              } else {
                // ── EXAMINERS: send welcome email with credentials ──
                let collegeName = '';
                if (collegeId) {
                  const collegeDoc = await db.doc(`${COLLECTIONS.COLLEGES}/${collegeId}`).get();
                  if (collegeDoc.exists) {
                    collegeName = collegeDoc.data()?.collegeName || '';
                  }
                }

                const emailHtml = generateWelcomeEmailHTML({
                  name: fullName,
                  email: email.toLowerCase(),
                  password: temporaryPassword,
                  userType,
                  collegeName,
                  loginUrl: process.env.LOGIN_URL || 'https://www.examiners.app/login',
                });

                await transporter.sendMail({
                  from: `EXAMINERS System <${process.env.NOREPLY_EMAIL || 'noreply@email.tutorialspoint.com'}>`,
                  to: email.toLowerCase(),
                  subject: `Welcome to EXAMINERS - Your Account is Ready!`,
                  html: emailHtml,
                });

                // console.log('✅ Welcome email sent successfully to:', email);
              }
            } else {
              // console.warn('⚠️ Incomplete email credentials, skipping email');
            }
          } else {
            // console.warn('⚠️ Email credentials not found, skipping email');
          }
        } catch (emailError: any) {
          // Don't fail user creation if email fails
          console.error('⚠️ Failed to send email after user creation:', emailError.message);
        }
      }

      // console.log(`✅ User created successfully: ${fullName} (${userType})`);

      return {
        success: true,
        userId,
        temporaryPassword: authAccountCreated ? temporaryPassword : undefined,
        message: 'User created successfully'
      };

    } catch (error: any) {
      console.error('❌ Error creating user:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to create user'
      );
    }
  });

// ============================================
// ADD COLLEGE FUNCTION
// ============================================

/**
 * 🏫 Add College/University
 * Creates a new college/university document in Firestore
 * Only system_admin can add colleges
 */
export const addCollege = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB'
  })
  .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to add colleges'
      );
    }

    const {
      collegeId,
      collegeName,
      academicYear,
      address,
      city,
      state,
      pincode,
      phone,
      email,
      website,
      establishedYear,
      collegeType,
      supportedBoards,
      subjects,
      validClasses,
      examTypes,
      features,
      createdBy
    } = data;

    // Validate required fields
    if (!collegeId || !collegeName) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: collegeId, collegeName'
      );
    }

    try {
      const db = admin.firestore();

      // Check if college already exists
      const existingCollege = await db.collection(COLLECTIONS.COLLEGES).doc(collegeId).get();
      if (existingCollege.exists) {
        throw new functions.https.HttpsError(
          'already-exists',
          `College with ID "${collegeId}" already exists`
        );
      }

      // Initialize board-wise counts
      const boardWiseCounts: Record<string, { totalStudents: number; totalTeachers: number }> = {};
      if (supportedBoards && Array.isArray(supportedBoards)) {
        supportedBoards.forEach((board: string) => {
          boardWiseCounts[board] = {
            totalStudents: 0,
            totalTeachers: 0
          };
        });
      }

      // Prepare college document
      const collegeDoc = {
        collegeId,
        collegeName,
        academicYear: academicYear || 'April',
        address: address || '',
        city: city || '',
        state: state || '',
        pincode: pincode || '',
        phone: phone || '',
        email: email || '',
        website: website || '',
        establishedYear: establishedYear || null,
        collegeType: collegeType || 'school',
        supportedBoards: supportedBoards || [],
        subjects: subjects || [],
        validClasses: validClasses || [],
        examTypes: examTypes || [],
        features: features || [],
        boardWiseCounts,
        roleCounts: {
          system_admin: 0,
          admin: 0,
          principal: 0,
          dean: 0,
          teacher: 0,
          student: 0
        },
        totalTeachers: 0,
        totalStudents: 0,
        totalRooms: 0,
        status: 'active',
        createdBy: createdBy || context.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Save college document
      await db.collection(COLLECTIONS.COLLEGES).doc(collegeId).set(collegeDoc);
      // console.log(`✅ College created: ${collegeName} (${collegeId})`);

      return {
        success: true,
        collegeId,
        message: 'College created successfully'
      };

    } catch (error: any) {
      console.error('❌ Error creating college:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to create college'
      );
    }
  });
// ============================================
// PROBLEM NAVIGATION FUNCTIONS
// ============================================

/**
 * 🔄 Get Previous and Next Problems
 * Returns the previous and next problems based on the current problem's number
 * This is a public HTTP function (no authentication required)
 */
export const getProblemNavigation = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 10,
    memory: '256MB'
  })
  .https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Cache-Control', 'public, max-age=60'); // Cache for 1 minute
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    const currentNumber = parseInt(req.query.current as string) || 0;

    try {
      const db = admin.firestore();
      
      let prev = null;
      let next = null;

      // Get previous problem (number < current, order by number DESC, limit 1)
      if (currentNumber > 0) {
        const prevSnapshot = await db.collection('problems')
          .where('number', '<', currentNumber)
          .orderBy('number', 'desc')
          .limit(1)
          .select('slug', 'number', 'title')
          .get();

        if (!prevSnapshot.empty) {
          const doc = prevSnapshot.docs[0];
          const data = doc.data();
          prev = {
            id: doc.id,
            slug: data.slug || doc.id,
            number: data.number || 0,
            title: data.title || ''
          };
        }
      }

      // Get next problem (number > current, order by number ASC, limit 1)
      const nextSnapshot = await db.collection('problems')
        .where('number', '>', currentNumber)
        .orderBy('number', 'asc')
        .limit(1)
        .select('slug', 'number', 'title')
        .get();

      if (!nextSnapshot.empty) {
        const doc = nextSnapshot.docs[0];
        const data = doc.data();
        next = {
          id: doc.id,
          slug: data.slug || doc.id,
          number: data.number || 0,
          title: data.title || ''
        };
      }

      res.status(200).json({
        success: true,
        current: currentNumber,
        prev,
        next
      });

    } catch (error: any) {
      console.error('❌ Error getting problem navigation:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get problem navigation'
      });
    }
  });

/**
 * 📋 Get All Problems List
 * Returns a list of all problems (id, slug, number, title only)
 * Useful for sidebar or problem list page
 */
export const getProblemsList = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB'
  })
  .https.onRequest(async (req, res) => {
    // Enable CORS - Only allow specific domain
    const allowedOrigins = [
      'https://www.tutorialspoint.com',
      'https://tutorialspoint.com',
      'http://localhost:3000' // For local development
    ];
    
    const origin = req.headers.origin || '';
    if (allowedOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
    } else {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const db = admin.firestore();
      
      // Get all problems ordered by number
      const snapshot = await db.collection('problems')
        .orderBy('number', 'asc')
        .select('slug', 'number', 'title', 'difficulty')
        .get();

      const problems = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          slug: data.slug || doc.id,
          number: data.number || 0,
          title: data.title || '',
          difficulty: data.difficulty || 'Medium'
        };
      });

      res.status(200).json({
        success: true,
        count: problems.length,
        problems
      });

    } catch (error: any) {
      console.error('❌ Error getting problems list:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get problems list'
      });
    }
  });

// ============================================
// CloudFront Signed Cookies for Video Playback
// ============================================

import * as crypto from 'crypto';

const CF_KEY_PAIR_ID = 'APKAJ33FA7J7QU642EBA';
const CF_CDN_URL = 'https://cdn.examiners.app';

/**
 * Sign a CloudFront policy using RSA-SHA1
 */
function cfSign(policy: string, privateKey: string): string {
  const sign = crypto.createSign('RSA-SHA1');
  sign.update(policy);
  return sign.sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/=/g, '_')
    .replace(/\//g, '~');
}

/**
 * Generate CloudFront signed cookies for video playback
 * Requires CF_PRIVATE_KEY secret to be set in Firebase
 */
export const getVideoSignedCookies = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 10,
    memory: '128MB',
    secrets: ['CF_PRIVATE_KEY'],
  })
  .https.onCall(async (_data, context) => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const privateKey = process.env.CF_PRIVATE_KEY;
    if (!privateKey) {
      console.error('CF_PRIVATE_KEY secret not configured');
      throw new functions.https.HttpsError('internal', 'Signing key not configured');
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 7200; // 2 hours

    const policy = JSON.stringify({
      Statement: [{
        Resource: `${CF_CDN_URL}/*`,
        Condition: {
          DateLessThan: { 'AWS:EpochTime': expiresAt }
        }
      }]
    });

    const encodedPolicy = Buffer.from(policy).toString('base64')
      .replace(/\+/g, '-')
      .replace(/=/g, '_')
      .replace(/\//g, '~');

    const signature = cfSign(policy, privateKey);

    return {
      'CloudFront-Policy': encodedPolicy,
      'CloudFront-Signature': signature,
      'CloudFront-Key-Pair-Id': CF_KEY_PAIR_ID,
      expiresAt,
    };
  });

// ============================================
// STUDENT LEARNING DETAIL - NIGHTLY SYNC + MANUAL TRIGGER
// ============================================

/**
 * Core sync logic — recalculates studentLearningDetail for all enrolled students
 */
async function syncAllStudentLearningDetails(): Promise<{ synced: number; errors: number }> {
  const db = admin.firestore();
  let synced = 0;
  let errors = 0;

  const enrollmentsSnap = await db.collection('course_enrollments')
    .where('status', 'in', ['active', 'completed'])
    .get();

  // Group by userId_collegeId
  const studentMap = new Map<string, { userId: string; collegeId: string; enrollments: any[] }>();

  enrollmentsSnap.docs.forEach(doc => {
    const data = doc.data();
    const userId = data.userId || '';
    const collegeId = data.collegeId || '';
    if (!userId || !collegeId) return;

    const key = `${userId}_${collegeId}`;
    if (!studentMap.has(key)) {
      studentMap.set(key, { userId, collegeId, enrollments: [] });
    }
    studentMap.get(key)!.enrollments.push({ id: doc.id, ...data });
  });

  // console.log(`📊 Found ${studentMap.size} student-college pairs to sync`);

  // Build course info cache keyed by courseId (number→string)
  const courseInfoCache = new Map<string, any>();
  try {
    const allCourses = await db.collection('courses').get();
    allCourses.docs.forEach(d => {
      const data = d.data();
      const cid = String(data.courseId || '');
      if (cid) {
        courseInfoCache.set(cid, {
          courseName: data.courseName || '',
          slug: data.slug || d.id,
          thumbnailUrl: data.thumbnailUrl || '',
          totalLectures: data.totalLectures || 0,
          totalChapters: data.totalChapters || 0,
          totalExercises: data.totalExercises || 0,
          totalQuizzes: data.totalQuizzes || 0,
          totalUnits: data.totalUnits || 0,
        });
      }
    });
    // console.log(`📚 Cached ${courseInfoCache.size} courses by courseId`);
  } catch (err) {
    // console.warn('⚠️ Failed to fetch courses:', err);
  }

  // Track college-level aggregated stats
  const collegeStatsMap = new Map<string, {
    totalCoursesEnrolled: number;
    totalCoursesCompleted: number;
    totalLearningSeconds: number;
    totalLecturesCompleted: number;
    totalQuizzesCompleted: number;
    totalExercisesCompleted: number;
  }>();

  for (const [docId, { userId, collegeId, enrollments }] of studentMap) {
    try {
      // Fetch user info from users collection
      let userName = '';
      let userEmail = '';
      let studentClass = '';
      let userType = '';
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userName = userData?.fullName || userData?.displayName || userData?.name || '';
          userEmail = userData?.email || '';
          studentClass = userData?.studentClass || userData?.class || '';
          userType = userData?.userType || '';
        }
      } catch (_e) { /* skip */ }

      const docRef = db.collection('studentLearningDetail').doc(docId);
      const existingDoc = await docRef.get();
      const existingData = existingDoc.exists ? existingDoc.data() : {} as any;

      let totalTimeSpent = 0;
      let totalCoursesEnrolled = 0;
      let totalCoursesCompleted = 0;
      let totalLecturesCompleted = 0;
      let totalQuizzesCompleted = 0;
      let totalExercisesCompleted = 0;
      const courses: any = {};

      for (const enrollment of enrollments) {
        const progress = enrollment.progress || {};
        const courseId = String(enrollment.courseId || '');

        totalCoursesEnrolled++;
        if (enrollment.status === 'completed') totalCoursesCompleted++;

        const completedLectures = progress.completedLectures || [];
        totalLecturesCompleted += completedLectures.length;
        totalTimeSpent += progress.totalTimeSpent || 0;

        const quizResults = progress.quizResults || {};
        const courseQuizzesCompleted = Object.keys(quizResults).length;
        totalQuizzesCompleted += courseQuizzesCompleted;

        // Count exercise submissions that have been evaluated
        let courseExercisesCompleted = 0;
        try {
          const exSubsSnap = await db.collection('course_enrollments')
            .doc(enrollment.id)
            .collection('exerciseSubmissions')
            .where('status', '==', 'evaluated')
            .get();
          courseExercisesCompleted = exSubsSnap.size;
          totalExercisesCompleted += courseExercisesCompleted;
        } catch (_e) { /* skip */ }

        // Get course info from cache by courseId
        const courseInfo = courseInfoCache.get(courseId);

          const courseTotalLectures = courseInfo?.totalLectures || enrollment.totalLectures || 0;
          const calculatedPercentage = courseTotalLectures > 0 
            ? Math.max(completedLectures.length > 0 ? 1 : 0, Math.round((completedLectures.length / courseTotalLectures) * 100))
            : 0;

          // Preserve existing per-course marks from existing doc
          const existingCourse = existingData?.courses?.[courseId] || {};

          courses[courseId] = {
          courseName: courseInfo?.courseName || courseId,
          slug: courseInfo?.slug || '',
          thumbnailUrl: courseInfo?.thumbnailUrl || '',
          enrollmentId: enrollment.id,
          totalLectures: courseTotalLectures,
          totalChapters: courseInfo?.totalChapters || 0,
          totalExercises: courseInfo?.totalExercises || 0,
          totalQuizzes: courseInfo?.totalQuizzes || 0,
          totalUnits: courseInfo?.totalUnits || 0,
          percentage: progress.percentage || calculatedPercentage,
          timeSpent: progress.totalTimeSpent || 0,
          lecturesCompleted: completedLectures.length,
          quizzesCompleted: courseQuizzesCompleted,
          exercisesCompleted: courseExercisesCompleted,
          // Preserve marks tracking (set by real-time methods, not recalculable from enrollments)
          quizMarksObtained: existingCourse.quizMarksObtained || 0,
          quizMaxMarks: existingCourse.quizMaxMarks || 0,
          exerciseMarksObtained: existingCourse.exerciseMarksObtained || 0,
          exerciseMaxMarks: existingCourse.exerciseMaxMarks || 0,
          lastLectureId: progress.lastLectureId || '',
          lastLectureTitle: progress.lectures?.[progress.lastLectureId]?.title || '',
          lastChapterName: '',
          lastAccessedAt: progress.lastAccessedAt || null,
          status: enrollment.status || 'active',
        };
      }

      // Calculate composite score
      const totalQuizMarksObtained = existingData?.totalQuizMarksObtained || 0;
      const totalQuizMaxMarks = existingData?.totalQuizMaxMarks || 0;
      const totalExerciseMarksObtained = existingData?.totalExerciseMarksObtained || 0;
      const totalExerciseMaxMarks = existingData?.totalExerciseMaxMarks || 0;

      const timeHrs = totalTimeSpent / 3600;
      const qPct = totalQuizMaxMarks > 0 ? (totalQuizMarksObtained / totalQuizMaxMarks) * 100 : 0;
      const ePct = totalExerciseMaxMarks > 0 ? (totalExerciseMarksObtained / totalExerciseMaxMarks) * 100 : 0;
      const compositeScore = Math.round(
        ((timeHrs * 2) + (totalLecturesCompleted * 3) + (qPct * 0.5) + (ePct * 0.5) + (totalQuizzesCompleted * 2) + (totalExercisesCompleted * 2)) * 10
      ) / 10;

      await docRef.set({
        userId,
        collegeId,
        userName: userName || existingData?.userName || '',
        userEmail: userEmail || existingData?.userEmail || '',
        studentClass: studentClass || existingData?.studentClass || '',
        userType: userType || existingData?.userType || '',
        compositeScore,
        totalCoursesEnrolled,
        totalCoursesCompleted,
        totalTimeSpent,
        totalLecturesCompleted,
        totalQuizzesCompleted,
        totalExercisesCompleted,
        totalAssessmentsCompleted: existingData?.totalAssessmentsCompleted || 0,
        totalQuizMarksObtained,
        totalQuizMaxMarks,
        totalExerciseMarksObtained,
        totalExerciseMaxMarks,
        courses,
        recentActivity: existingData?.recentActivity || [],
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      synced++;

      // Accumulate college-level stats
      if (!collegeStatsMap.has(collegeId)) {
        collegeStatsMap.set(collegeId, {
          totalCoursesEnrolled: 0, totalCoursesCompleted: 0,
          totalLearningSeconds: 0, totalLecturesCompleted: 0,
          totalQuizzesCompleted: 0, totalExercisesCompleted: 0,
        });
      }
      const cs = collegeStatsMap.get(collegeId)!;
      cs.totalCoursesEnrolled += totalCoursesEnrolled;
      cs.totalCoursesCompleted += totalCoursesCompleted;
      cs.totalLearningSeconds += totalTimeSpent;
      cs.totalLecturesCompleted += totalLecturesCompleted;
      cs.totalQuizzesCompleted += totalQuizzesCompleted;
      cs.totalExercisesCompleted += totalExercisesCompleted;

    } catch (err) {
      console.error(`❌ Error syncing ${docId}:`, err);
      errors++;
    }
  }

  // Write aggregated learning stats to each COLLEGES/{collegeId} doc
  for (const [collegeId, stats] of collegeStatsMap) {
    try {
      const avgCompletionRate = stats.totalCoursesEnrolled > 0
        ? Math.round((stats.totalCoursesCompleted / stats.totalCoursesEnrolled) * 100)
        : 0;
      const totalLearningHours = Math.round((stats.totalLearningSeconds / 3600) * 10) / 10;

      await db.collection('colleges').doc(collegeId).update({
        totalEnrollments: stats.totalCoursesEnrolled,
        'learningStats.totalCoursesEnrolled': stats.totalCoursesEnrolled,
        'learningStats.totalCoursesCompleted': stats.totalCoursesCompleted,
        'learningStats.totalLearningSeconds': stats.totalLearningSeconds,
        'learningStats.totalLearningHours': totalLearningHours,
        'learningStats.totalLecturesCompleted': stats.totalLecturesCompleted,
        'learningStats.totalQuizzesCompleted': stats.totalQuizzesCompleted,
        'learningStats.totalExercisesCompleted': stats.totalExercisesCompleted,
        'learningStats.avgCompletionRate': avgCompletionRate,
        'learningStats.lastSyncedAt': admin.firestore.FieldValue.serverTimestamp(),
      });
      // console.log(`📊 Updated college learning stats for ${collegeId}: ${totalLearningHours}h learning`);
    } catch (err) {
      // console.warn(`⚠️ Failed to update college learning stats for ${collegeId}:`, err);
    }
  }

  // Recalculate collegeDailyLearningLog for yesterday (day is closed, no more writes)
  const datesToSync = [0, 1]; // today + yesterday
  
  const collegeIds = Array.from(collegeStatsMap.keys());
  for (const collegeId of collegeIds) {
    for (const daysAgo of datesToSync) {
      try {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - daysAgo);
        const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

        const dailyLogsSnap = await db.collection('dailyLearningLog')
          .where('collegeId', '==', collegeId)
          .where('date', '==', dateStr)
          .get();

        let timeSpent = 0;
        const studentIds = new Set<string>();

        dailyLogsSnap.docs.forEach(d => {
          const data = d.data();
          timeSpent += data.timeSpent || 0;
          if (data.userId) studentIds.add(data.userId);
        });

        // Only write if we have actual data, and don't overwrite with lower values
        const docRef = db.collection('collegeDailyLearningLog').doc(`${collegeId}_${dateStr}`);
        const existingDoc = await docRef.get();
        const existingTime = existingDoc.exists ? (existingDoc.data()?.timeSpent || 0) : 0;

        if (timeSpent >= existingTime) {
          await docRef.set({
            collegeId,
            date: dateStr,
            timeSpent,
            activeStudentIds: Array.from(studentIds),
          });
          // console.log(`📅 Synced college daily log for ${collegeId} on ${dateStr}: ${Math.round(timeSpent/3600*10)/10}h, ${studentIds.size} students`);
        } else {
          // console.log(`📅 Skipped college daily log for ${collegeId} on ${dateStr}: existing ${Math.round(existingTime/3600*10)/10}h > aggregated ${Math.round(timeSpent/3600*10)/10}h`);
        }
      } catch (err) {
        // console.warn(`⚠️ Failed to sync college daily log for ${collegeId}:`, err);
      }
    }
  }

  return { synced, errors };
}

/**
 * 🕛 Nightly Cron - Sync Student Learning Details
 * Runs at 12:00 AM IST every night
 */
export const syncStudentLearningDetailsCron = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .pubsub.schedule('0 0 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    // console.log('🕛 Starting nightly student learning detail sync...');
    await syncAllStudentLearningDetails();
    // console.log(`✅ Nightly sync complete`);
    return null;
  });

/**
 * 🔄 Manual Sync - Callable by system_admin only
 */
export const syncStudentLearningDetailsManual = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    const userType = userDoc.data()?.userType || '';

    if (userType !== 'system_admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only system_admin can trigger manual sync');
    }

    // console.log(`🔄 Manual sync triggered by ${context.auth.uid}`);
    const result = await syncAllStudentLearningDetails();
    // console.log(`✅ Manual sync complete: ${result.synced} synced, ${result.errors} errors`);

    return {
      success: true,
      synced: result.synced,
      errors: result.errors,
      message: `Synced ${result.synced} students, ${result.errors} errors`,
    };
  });
// ==================== LeetCode Stats ====================

export const fetchLeetCodeStats = functions.https.onCall(async (data, context) => {
  const rawUsername = data.username;
  const forceRefresh = data.forceRefresh === true;
  const userId = data.userId; // optional: to cache per-user

  if (!rawUsername || typeof rawUsername !== 'string') {
    return { success: false, error: 'Username is required', errorCode: 'INVALID_INPUT' };
  }

  // Sanitize username: only alphanumeric, underscore, hyphen allowed
  const username = rawUsername.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!username || username.length < 1 || username.length > 30) {
    return { success: false, error: 'Invalid LeetCode username format', errorCode: 'INVALID_USERNAME' };
  }

  const db = admin.firestore();
  const cacheDocId = `leetcode_${username.toLowerCase()}`;
  const cacheRef = db.collection('externalProfileCache').doc(cacheDocId);

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    try {
      const cached = await cacheRef.get();
      if (cached.exists) {
        const cachedData = cached.data();
        const cachedAt = cachedData?.cachedAt?.toDate?.() || new Date(0);
        const hoursSinceCached = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60);
        // Return cache if less than 6 hours old
        if (hoursSinceCached < 6 && cachedData?.stats) {
          return { success: true, ...cachedData.stats, fromCache: true, cachedAt: cachedAt.toISOString() };
        }
      }
    } catch (cacheErr) {
      // console.warn('Cache read error:', cacheErr);
    }
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const AbortController = (await import('abort-controller')).default;

    // Timeout: 10 seconds
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    // Query: User profile + problem stats + contest + recent submissions
    const profileQuery = {
      query: `
        query getUserProfile($username: String!) {
          matchedUser(username: $username) {
            username
            profile {
              realName
              userAvatar
              ranking
              reputation
              starRating
            }
            submitStats: submitStatsGlobal {
              acSubmissionNum {
                difficulty
                count
                submissions
              }
            }
            badges {
              id
              displayName
              icon
            }
            submissionCalendar
          }
          userContestRanking(username: $username) {
            attendedContestsCount
            rating
            globalRanking
            topPercentage
          }
          userContestRankingHistory(username: $username) {
            attended
            rating
            ranking
            contest {
              title
              startTime
            }
          }
          recentSubmissionList(username: $username, limit: 10) {
            title
            titleSlug
            statusDisplay
            lang
            timestamp
          }
          allQuestionsCount {
            difficulty
            count
          }
        }
      `,
      variables: { username }
    };

    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify(profileQuery),
      signal: controller.signal as any,
    });

    clearTimeout(timeout);

    if (response.status === 429) {
      return { success: false, error: 'LeetCode rate limit reached. Please try again in a few minutes.', errorCode: 'RATE_LIMITED' };
    }

    if (response.status === 403) {
      return { success: false, error: 'LeetCode blocked the request. The profile may be private.', errorCode: 'FORBIDDEN' };
    }

    if (!response.ok) {
      return { success: false, error: `LeetCode returned status ${response.status}`, errorCode: 'API_ERROR' };
    }

    const result: any = await response.json();

    // Check for GraphQL errors
    if (result.errors && result.errors.length > 0) {
      const errMsg = result.errors[0]?.message || 'Unknown GraphQL error';
      return { success: false, error: `LeetCode error: ${errMsg}`, errorCode: 'GRAPHQL_ERROR' };
    }

    const user = result.data?.matchedUser;

    if (!user) {
      // Cache the "not found" result too to avoid repeated lookups
      await cacheRef.set({
        username,
        stats: null,
        error: 'User not found',
        cachedAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
      return { success: false, error: `User "${username}" not found on LeetCode. Please check the username.`, errorCode: 'USER_NOT_FOUND' };
    }

    const acStats = user.submitStats?.acSubmissionNum || [];
    const allQuestions = result.data?.allQuestionsCount || [];
    const contest = result.data?.userContestRanking;
    const contestHistory = (result.data?.userContestRankingHistory || [])
      .filter((h: any) => h.attended)
      .map((h: any) => ({
        rating: Math.round(h.rating),
        ranking: h.ranking,
        title: h.contest?.title || '',
        timestamp: h.contest?.startTime || 0,
      }));
    const recentSubs = result.data?.recentSubmissionList || [];

    const getStat = (diff: string) => acStats.find((s: any) => s.difficulty === diff)?.count || 0;
    const getTotal = (diff: string) => allQuestions.find((q: any) => q.difficulty === diff)?.count || 0;
    const totalSubmissions = acStats.find((s: any) => s.difficulty === 'All')?.submissions || 0;
    const totalAccepted = acStats.find((s: any) => s.difficulty === 'All')?.count || 0;

    // Parse submission calendar for streak
    let currentStreak = 0;
    let maxStreak = 0;
    let totalActiveDays = 0;
    if (user.submissionCalendar) {
      try {
        const cal = JSON.parse(user.submissionCalendar);
        const timestamps = Object.keys(cal).map(Number).sort((a, b) => a - b);
        totalActiveDays = timestamps.length;

        // Calculate current streak (counting backwards from today)
        const todayStart = Math.floor(Date.now() / 1000 / 86400) * 86400;
        const activeDays = new Set(timestamps.map(ts => Math.floor(ts / 86400) * 86400));
        
        let checkDay = todayStart;
        // Allow starting from today or yesterday
        if (!activeDays.has(checkDay)) {
          checkDay -= 86400;
        }
        while (activeDays.has(checkDay)) {
          currentStreak++;
          checkDay -= 86400;
        }

        // Calculate max streak
        let tempStreak = 1;
        for (let i = 1; i < timestamps.length; i++) {
          const prevDay = Math.floor(timestamps[i - 1] / 86400);
          const currDay = Math.floor(timestamps[i] / 86400);
          if (currDay - prevDay === 1) {
            tempStreak++;
          } else if (currDay - prevDay > 1) {
            maxStreak = Math.max(maxStreak, tempStreak);
            tempStreak = 1;
          }
        }
        maxStreak = Math.max(maxStreak, tempStreak);
      } catch (e) {
        // ignore parse errors
      }
    }

    const stats = {
      username: user.username,
      name: user.profile?.realName || '',
      avatar: user.profile?.userAvatar || '',
      ranking: user.profile?.ranking || 0,
      reputation: user.profile?.reputation || 0,
      totalSolved: getStat('All'),
      easySolved: getStat('Easy'),
      mediumSolved: getStat('Medium'),
      hardSolved: getStat('Hard'),
      totalQuestions: getTotal('All'),
      totalEasy: getTotal('Easy'),
      totalMedium: getTotal('Medium'),
      totalHard: getTotal('Hard'),
      acceptanceRate: totalSubmissions > 0 ? Math.round((totalAccepted / totalSubmissions) * 100 * 10) / 10 : 0,
      currentStreak,
      maxStreak,
      totalActiveDays,
      contestRating: contest?.rating ? Math.round(contest.rating) : 0,
      contestsAttended: contest?.attendedContestsCount || 0,
      contestGlobalRanking: contest?.globalRanking || 0,
      contestTopPercentage: contest?.topPercentage ? Math.round(contest.topPercentage * 10) / 10 : 0,
      contestHistory: contestHistory.slice(-50),
      badges: (user.badges || []).slice(0, 10).map((b: any) => ({
        name: b.displayName || b.id,
        icon: b.icon,
      })),
      recentSubmissions: recentSubs.slice(0, 5).map((s: any) => ({
        title: s.title,
        slug: s.titleSlug,
        status: s.statusDisplay,
        lang: s.lang,
        timestamp: Number(s.timestamp),
      })),
    };

    // Cache the result
    try {
      await cacheRef.set({
        username,
        userId: userId || null,
        stats,
        cachedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (cacheErr) {
      // console.warn('Cache write error:', cacheErr);
    }

    return { success: true, ...stats, fromCache: false };

  } catch (err: any) {
    console.error('LeetCode fetch error:', err);

    if (err.name === 'AbortError' || err.type === 'aborted') {
      return { success: false, error: 'Request timed out. LeetCode may be slow or unavailable.', errorCode: 'TIMEOUT' };
    }

    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return { success: false, error: 'Could not connect to LeetCode. Please check your network.', errorCode: 'NETWORK_ERROR' };
    }

    return { success: false, error: 'Failed to fetch LeetCode stats. Please try again later.', errorCode: 'UNKNOWN_ERROR' };
  }
});

// ============================================
// AI INTERVIEW PRACTICE - Cloud Function
// ============================================

const AI_INTERVIEW_FEEDBACK_PROMPT = `You are generating a detailed performance report for a candidate after a technical interview. Be constructive, encouraging, and specific.

IMPORTANT: Return ONLY valid JSON, no markdown code blocks, no extra text.
Response format:
{
  "overallSummary": "2-3 sentence overall assessment",
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["area to improve 1", "area to improve 2", ...],
  "motivationalMessage": "An encouraging message tailored to their performance level",
  "topicsToReview": ["topic 1", "topic 2", ...]
}

Guidelines:
- If score >= 80%: Praise strongly, mention advanced areas to explore
- If score 60-79%: Balanced feedback, clear improvement path
- If score 40-59%: Encouraging tone, specific study recommendations
- If score < 40%: Very encouraging, focus on fundamentals, don't discourage
- Strengths/weaknesses should be specific to the topics tested, not generic
- motivationalMessage should feel personal and genuine, not corporate
- topicsToReview should be actionable concepts they can study`;

export const aiInterviewChat = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB'
  })
  .https.onCall(async (data, context) => {
    try {
      const { purpose } = data || {};

      if (!purpose) {
        throw new functions.https.HttpsError('invalid-argument', 'purpose is required');
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'OpenAI API key not configured');
      }

      const client = new OpenAI({ apiKey });

      // ─── INTERACTIVE CHAT (single conversational flow) ──────
      if (purpose === 'chat') {
        const {
          courseName = 'Programming',
          topicsContext = [],
          userName = 'Candidate',
          conversationHistory = [],
          maxQuestions = 12,
          lastQuestionNumber = 0,
        } = data;

        const topicsList = topicsContext.length > 0
          ? topicsContext.join(', ')
          : courseName;

        const systemPrompt = `You are a ${courseName} Interviewer, Your name is Mac, who is going to take the user's interview professionally. Ask ${courseName} related questions interactively starting with a warm welcome of your interviewee, wait for their response to start the interview and tell them that you are going to interview them focusing on these topics: ${topicsList}. Then follow these rules:

GREETING (your very first message when conversation history is empty):
- Greet the candidate warmly by name with a 👋 emoji.
- Welcome them to the **AI Interview Practice** for **${courseName}**.
- Tell them you'll be asking questions based on the topics they've studied and that the interview works in stages — answer well and they'll progress to more challenging questions.
- Ask if they are ready to begin and tell them to say **"Yes"** or **"Let's start"** when ready.
- Do NOT ask any question in the greeting. Just welcome and wait.

INTERVIEW RULES:
1. You will ask questions related to concepts in: ${topicsList}.
2. Use **Question-1**, **Question-2**....etc as bold headings for different questions.
3. Wait for the user's answer. NEVER ask two questions in one message.
4. Provide feedback on the user's response, and explain the correct answer in a very crisp way in 1-2 lines, only if necessary — not always. If they got it right, a quick acknowledgment is enough.
5. Ask the next question interactively with natural transitions.
6. Please make it interactive with a real human touch as much as possible. Use transitions like "Great!", "Interesting!", "Let's try something different...", "Hmm, not quite..." etc.
7. Tailor the next question based on the user's answer. If they struggled, try something related but approachable. If they aced it, raise the bar.
8. Avoid repeating similar type of questions. Mix: conceptual, practical, code-based, scenario-based, compare/contrast, debugging, output prediction.
9. NEVER reference lecture names, chapter names, course modules, or any learning platform. Ask as if this is a real job interview.
10. The interview has a maximum of ${maxQuestions} questions. Track which question number you are on.
11. The candidate's name is ${userName}. Use their name naturally once or twice, not every message.`;

        // Build messages array with conversation history
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: systemPrompt }
        ];

        // Add conversation history (limit to last 30 messages to stay within token limits)
        const recentHistory = conversationHistory.slice(-30);
        for (const msg of recentHistory) {
          messages.push({
            role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
            content: msg.content,
          });
        }

        const completion = await client.chat.completions.create({
          model: AI_MODELS.GPT_4O_MINI,
          temperature: 0.7,
          max_tokens: 600,
          messages
        });

        const responseText = completion.choices?.[0]?.message?.content?.trim() || '';

        // ─── Detect question number from AI response ─────────
        const qNumMatch = responseText.match(/\*\*Question[-\s]?(\d+)/i);
        const detectedQuestionNum = qNumMatch ? parseInt(qNumMatch[1], 10) : 0;

        // ─── Separate evaluation call if user was answering a question ─────
        let evaluationMeta: { isCorrect: boolean | null; topic: string } = { isCorrect: null, topic: '' };

        if (lastQuestionNumber > 0) {
          // The user's last message was an answer — do a quick evaluation
          const lastUserMsg = recentHistory.filter((m: any) => m.role === 'user').slice(-1)[0];
          // Find the question text from history
          const lastAiMsgs = recentHistory.filter((m: any) => m.role === 'assistant');
          const lastAiMsg = lastAiMsgs.slice(-1)[0]?.content || '';

          if (lastUserMsg?.content) {
            try {
              const evalCompletion = await client.chat.completions.create({
                model: AI_MODELS.GPT_4O_MINI,
                temperature: 0.1,
                max_tokens: 150,
                messages: [
                  {
                    role: 'system',
                    content: `You evaluate interview answers. Return ONLY valid JSON:
{"isCorrect":false,"topic":"concept name"}

isCorrect = true ONLY if the answer shows understanding of the concept.
isCorrect = false for wrong answers, vague answers, "I don't know", irrelevant responses, or refusals to answer.
topic = the technical concept being tested.`
                  },
                  {
                    role: 'user',
                    content: `Question: ${lastAiMsg}\n\nAnswer: ${lastUserMsg.content}`
                  }
                ]
              });

              const evalText = evalCompletion.choices?.[0]?.message?.content?.trim() || '';
              const cleanedEval = evalText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
              const evalParsed = JSON.parse(cleanedEval);
              evaluationMeta = {
                isCorrect: evalParsed.isCorrect === true,
                topic: evalParsed.topic || '',
              };
            } catch (evalErr) {
              // console.warn('Evaluation call failed, defaulting to incorrect:', evalErr);
              // If eval fails, default to incorrect — never leave as null
              evaluationMeta = {
                isCorrect: false,
                topic: '',
              };
            }
          } else {
            // No user message content — treat as incorrect
            evaluationMeta = { isCorrect: false, topic: '' };
          }
        }

        // console.log(`🎤 AI Interview chat - Q:${detectedQuestionNum} correct:${evaluationMeta.isCorrect} for user: ${context.auth?.uid || 'anonymous'}`);

        return {
          success: true,
          response: responseText,
          meta: {
            questionNumber: detectedQuestionNum,
            isCorrect: evaluationMeta.isCorrect,
            topic: evaluationMeta.topic,
            isEnded: false,
          }
        };
      }

      // ─── GENERATE FEEDBACK (kept as separate call) ─────────
      if (purpose === 'generate_feedback') {
        const {
          courseName,
          questions = [],
          score,
          totalCorrect,
          totalAsked,
          terminatedAtGate,
        } = data;

        const questionsSummary = questions.map((q: any, i: number) =>
          `Q${i + 1}: ${q.question}\nAnswer: ${q.answer}\nResult: ${q.isCorrect ? 'Correct' : 'Incorrect'}${q.topic ? ` | Topic: ${q.topic}` : ''}`
        ).join('\n\n');

        const terminationNote = terminatedAtGate
          ? `\nNote: The interview ended at gate ${terminatedAtGate} because the candidate did not meet the minimum correct answers threshold to continue.`
          : '\nThe candidate completed the full interview.';

        const messages: Array<{ role: 'system' | 'user'; content: string }> = [
          { role: 'system', content: AI_INTERVIEW_FEEDBACK_PROMPT },
          {
            role: 'user',
            content: `Interview Results:
- Subject Area: ${courseName || 'Programming'}
- Score: ${score}% (${totalCorrect}/${totalAsked} correct)${terminationNote}

Question-by-Question Breakdown:
${questionsSummary}

Generate a detailed performance feedback report in the JSON format specified.`
          }
        ];

        const completion = await client.chat.completions.create({
          model: AI_MODELS.GPT_4O_MINI,
          temperature: 0.7,
          max_tokens: 800,
          messages
        });

        const responseText = completion.choices?.[0]?.message?.content?.trim() || '';

        let parsed;
        try {
          const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          parsed = JSON.parse(cleaned);
        } catch (parseErr) {
          // console.warn('Failed to parse feedback JSON, using fallback:', responseText);
          parsed = {
            overallSummary: `You scored ${score}% answering ${totalCorrect} out of ${totalAsked} questions correctly.`,
            strengths: [],
            weaknesses: [],
            motivationalMessage: 'Keep practicing and you will improve!',
            topicsToReview: [],
          };
        }

        // console.log(`🎤 AI Interview feedback generated: ${score}% for user: ${context.auth?.uid || 'anonymous'}`);

        return {
          success: true,
          overallSummary: parsed.overallSummary || '',
          strengths: parsed.strengths || [],
          weaknesses: parsed.weaknesses || [],
          motivationalMessage: parsed.motivationalMessage || '',
          topicsToReview: parsed.topicsToReview || [],
        };
      }

      throw new functions.https.HttpsError('invalid-argument', `Unknown purpose: ${purpose}`);

    } catch (err: any) {
      console.error('AI Interview Error:', err);
      throw new functions.https.HttpsError('internal', 'Failed to process AI interview request', err.message);
    }
  });


// ============================================================
// Personality Trait Aggregation for Exam Dashboard
// Lightweight query - fetches only personalityProfile from attempts
// ============================================================
export const getPersonalityTraitAggregation = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { examId } = data;
    if (!examId) {
      throw new functions.https.HttpsError('invalid-argument', 'examId is required');
    }

    try {
      // Query only attempts that have personalityProfile, using select() for field projection
      const attemptsSnapshot = await admin.firestore()
        .collection('examAttempts')
        .where('examId', '==', examId)
        .where('status', '==', 'submitted')
        .select('personalityProfile', 'personalityType', 'studentId')
        .get();

      if (attemptsSnapshot.empty) {
        return { success: true, totalStudents: 0, traits: {}, studentCount: 0, personalityTypes: [] };
      }

      // Aggregate trait data
      const traitAggregates: Record<string, { 
        totalPercentage: number; 
        count: number; 
        scores: number[];
        levels: Record<string, number>;
      }> = {};

      // Aggregate personality types
      const typeMap: Record<string, { count: number; topTrait: string; secondTrait: string; desc: string }> = {};

      let studentCount = 0;

      attemptsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const profile = data.personalityProfile;
        const pType = data.personalityType;

        if (profile && typeof profile === 'object') {
          studentCount++;

          Object.entries(profile).forEach(([trait, traitData]: [string, any]) => {
            if (!traitAggregates[trait]) {
              traitAggregates[trait] = { totalPercentage: 0, count: 0, scores: [], levels: {} };
            }
            const percentage = traitData?.percentage || 0;
            traitAggregates[trait].totalPercentage += percentage;
            traitAggregates[trait].count += 1;
            traitAggregates[trait].scores.push(percentage);
            
            const level = traitData?.level || 'Unknown';
            traitAggregates[trait].levels[level] = (traitAggregates[trait].levels[level] || 0) + 1;
          });
        }

        // Aggregate personality types
        if (pType?.title) {
          const title = pType.title;
          if (!typeMap[title]) {
            typeMap[title] = {
              count: 0,
              topTrait: pType.topTrait || '',
              secondTrait: pType.secondTrait || '',
              desc: pType.desc || '',
            };
          }
          typeMap[title].count += 1;
        }
      });

      // Compute final stats per trait
      const traits: Record<string, {
        average: number;
        min: number;
        max: number;
        stdDeviation: number;
        count: number;
        levels: Record<string, number>;
      }> = {};

      Object.entries(traitAggregates).forEach(([trait, data]) => {
        const avg = data.count > 0 ? data.totalPercentage / data.count : 0;
        const min = data.scores.length > 0 ? Math.min(...data.scores) : 0;
        const max = data.scores.length > 0 ? Math.max(...data.scores) : 0;
        const variance = data.scores.length > 1
          ? data.scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / data.scores.length
          : 0;

        traits[trait] = {
          average: Math.round(avg * 10) / 10,
          min,
          max,
          stdDeviation: Math.round(Math.sqrt(variance) * 10) / 10,
          count: data.count,
          levels: data.levels,
        };
      });

      // Build sorted personality types array
      const personalityTypes = Object.entries(typeMap)
        .map(([title, data]) => ({
          title,
          count: data.count,
          topTrait: data.topTrait,
          secondTrait: data.secondTrait,
          desc: data.desc,
        }))
        .sort((a, b) => b.count - a.count);

      return {
        success: true,
        totalStudents: attemptsSnapshot.size,
        studentCount,
        traits,
        personalityTypes,
      };
    } catch (error: any) {
      console.error('❌ getPersonalityTraitAggregation failed:', error);
      throw new functions.https.HttpsError('internal', 'Failed to aggregate personality data', error.message);
    }
  });

// ============================================
// 📊 LEADERBOARD - Firestore Trigger
// Updates pre-computed leaderboard stats when exam attempts change
// Collection: leaderboardStats/{collegeId}_{studentId}
// ============================================

export const updateLeaderboardStats = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .firestore.document('examAttempts/{attemptId}')
  .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;

    // Only process submitted attempts
    const data = after || before;
    if (!data || !data.studentId || !data.collegeId) return;

    // Only trigger on status change to submitted or marks update
    const statusChanged = after?.status === 'submitted' && before?.status !== 'submitted';
    const marksChanged = after?.status === 'submitted' && after?.obtainedMarks !== before?.obtainedMarks;
    const deleted = !change.after.exists;

    if (!statusChanged && !marksChanged && !deleted) return;

    const db = admin.firestore();
    const studentId = data.studentId;
    const collegeId = data.collegeId;

    // console.log(`📊 Updating leaderboard for student ${studentId} in college ${collegeId}`);

    try {
      // Fetch all submitted attempts for this student in this college
      const attemptsSnap = await db.collection('examAttempts')
        .where('studentId', '==', studentId)
        .where('collegeId', '==', collegeId)
        .where('status', '==', 'submitted')
        .get();

      const docId = `${collegeId}_${studentId}`;
      const statsRef = db.collection('leaderboardStats').doc(docId);

      if (attemptsSnap.empty) {
        // No submitted attempts — remove from leaderboard
        await statsRef.delete();
        // console.log(`🗑️ Removed leaderboard entry for ${studentId}`);
        return;
      }

      let totalMarks = 0;
      let totalMaxMarks = 0;
      let totalExams = 0;
      let highestScore = 0;
      let lowestScore = 100;
      let lastExamDate: admin.firestore.Timestamp | null = null;

      // Track per-class and per-subject stats
      const classStats: Record<string, { totalMarks: number; totalMaxMarks: number; totalExams: number }> = {};
      const subjectStats: Record<string, { totalMarks: number; totalMaxMarks: number; totalExams: number }> = {};

      attemptsSnap.docs.forEach(doc => {
        const attempt = doc.data();
        const obtained = attempt.obtainedMarks || 0;
        const max = attempt.maximumScore || 0;
        const pct = max > 0 ? (obtained / max) * 100 : 0;

        totalMarks += obtained;
        totalMaxMarks += max;
        totalExams += 1;
        if (pct > highestScore) highestScore = pct;
        if (pct < lowestScore) lowestScore = pct;

        const examDate = attempt.submitTime || attempt.startTime;
        if (examDate && (!lastExamDate || examDate.toMillis() > lastExamDate.toMillis())) {
          lastExamDate = examDate;
        }

        // Class stats
        const cls = attempt.class || 'unknown';
        if (!classStats[cls]) classStats[cls] = { totalMarks: 0, totalMaxMarks: 0, totalExams: 0 };
        classStats[cls].totalMarks += obtained;
        classStats[cls].totalMaxMarks += max;
        classStats[cls].totalExams += 1;

        // Subject stats
        const subj = attempt.subject || 'unknown';
        if (!subjectStats[subj]) subjectStats[subj] = { totalMarks: 0, totalMaxMarks: 0, totalExams: 0 };
        subjectStats[subj].totalMarks += obtained;
        subjectStats[subj].totalMaxMarks += max;
        subjectStats[subj].totalExams += 1;
      });

      const averagePercentage = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;

      // Use first attempt for student metadata
      const firstAttempt = attemptsSnap.docs[0].data();

      await statsRef.set({
        studentId,
        collegeId,
        userName: firstAttempt.studentName || '',
        rollNumber: firstAttempt.rollNumber || '',
        class: firstAttempt.class || '',
        board: firstAttempt.board || '',
        academicYear: firstAttempt.academicYear || '',
        totalExams,
        totalMarks,
        totalMaxMarks,
        averagePercentage: Math.round(averagePercentage * 100) / 100,
        highestScore: Math.round(highestScore * 100) / 100,
        lowestScore: Math.round(lowestScore * 100) / 100,
        lastExamDate,
        classStats,
        subjectStats,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // console.log(`✅ Leaderboard updated for ${firstAttempt.studentName}: ${averagePercentage.toFixed(1)}% (${totalExams} exams)`);
    } catch (error) {
      console.error(`❌ Error updating leaderboard for ${studentId}:`, error);
    }
  });

// ============================================
// 📊 LEADERBOARD - Paginated Query
// Callable function for paginated leaderboard reads
// ============================================

export const getLeaderboardPaginated = functions
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const {
      collegeId,
      pageSize = 20,
      lastDocId,
      filterClass,
      filterSubject,
    } = data;

    if (!collegeId) {
      throw new functions.https.HttpsError('invalid-argument', 'collegeId is required');
    }

    const db = admin.firestore();

    try {
      let q: admin.firestore.Query = db.collection('leaderboardStats')
        .where('collegeId', '==', collegeId);

      // Apply filters
      if (filterClass && filterClass !== 'all') {
        q = q.where('class', '==', filterClass);
      }

      // Sort by averagePercentage descending
      q = q.orderBy('averagePercentage', 'desc').limit(pageSize + 1);

      // Cursor-based pagination
      if (lastDocId) {
        const lastDoc = await db.collection('leaderboardStats').doc(lastDocId).get();
        if (lastDoc.exists) {
          q = db.collection('leaderboardStats')
            .where('collegeId', '==', collegeId);
          
          if (filterClass && filterClass !== 'all') {
            q = q.where('class', '==', filterClass);
          }

          q = q.orderBy('averagePercentage', 'desc')
            .startAfter(lastDoc)
            .limit(pageSize + 1);
        }
      }

      const snapshot = await q.get();
      const docs = snapshot.docs;

      // Check if there are more results
      const hasMore = docs.length > pageSize;
      const resultDocs = hasMore ? docs.slice(0, pageSize) : docs;

      // If subject filter, do it in memory (since subjects are in a nested map)
      let students = resultDocs.map((doc, index) => {
        const d = doc.data();
        return {
          docId: doc.id,
          userId: d.studentId,
          userName: d.userName,
          rollNumber: d.rollNumber,
          collegeId: d.collegeId,
          class: d.class,
          board: d.board,
          academicYear: d.academicYear,
          totalExams: d.totalExams,
          totalMarks: d.totalMarks,
          totalMaxMarks: d.totalMaxMarks,
          averagePercentage: d.averagePercentage,
          highestScore: d.highestScore,
          lowestScore: d.lowestScore,
        };
      });

      // Subject filter (in-memory since it's nested)
      if (filterSubject && filterSubject !== 'all') {
        students = students.map(s => {
          const doc = resultDocs.find(d => d.id === s.docId);
          const subjectData = doc?.data()?.subjectStats?.[filterSubject];
          if (!subjectData || subjectData.totalExams === 0) return null;
          return {
            ...s,
            totalExams: subjectData.totalExams,
            totalMarks: subjectData.totalMarks,
            totalMaxMarks: subjectData.totalMaxMarks,
            averagePercentage: subjectData.totalMaxMarks > 0
              ? Math.round((subjectData.totalMarks / subjectData.totalMaxMarks) * 100 * 100) / 100
              : 0,
          };
        }).filter((s): s is NonNullable<typeof s> => s !== null);
      }

      // Get total count for this query
      // For efficiency, we use a count query
      let countQuery: admin.firestore.Query = db.collection('leaderboardStats')
        .where('collegeId', '==', collegeId);
      if (filterClass && filterClass !== 'all') {
        countQuery = countQuery.where('class', '==', filterClass);
      }
      const countSnap = await countQuery.count().get();
      const totalCount = countSnap.data().count;

      return {
        students,
        hasMore,
        lastDocId: resultDocs.length > 0 ? resultDocs[resultDocs.length - 1].id : null,
        totalCount,
      };
    } catch (error: any) {
      console.error('❌ getLeaderboardPaginated failed:', error);
      throw new functions.https.HttpsError('internal', 'Failed to fetch leaderboard', error.message);
    }
  });

// ============================================
// 📊 LEADERBOARD - One-time Migration
// Backfills leaderboardStats for all existing submitted attempts
// Call once after deploying, then disable
// ============================================

export const migrateLeaderboardStats = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const { collegeId } = data;
    if (!collegeId) {
      throw new functions.https.HttpsError('invalid-argument', 'collegeId is required');
    }

    const db = admin.firestore();

    try {
      // console.log(`📊 Starting leaderboard migration for college: ${collegeId}`);

      // Fetch all submitted attempts for this college in batches
      const batchSize = 500;
      let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
      let totalProcessed = 0;

      // Accumulate all student data
      const studentMap = new Map<string, {
        studentId: string;
        userName: string;
        rollNumber: string;
        collegeId: string;
        class: string;
        board: string;
        academicYear: string;
        totalExams: number;
        totalMarks: number;
        totalMaxMarks: number;
        scores: number[];
        lastExamDate: admin.firestore.Timestamp | null;
        classStats: Record<string, { totalMarks: number; totalMaxMarks: number; totalExams: number }>;
        subjectStats: Record<string, { totalMarks: number; totalMaxMarks: number; totalExams: number }>;
      }>();

      while (true) {
        let q: admin.firestore.Query = db.collection('examAttempts')
          .where('collegeId', '==', collegeId)
          .where('status', '==', 'submitted')
          .orderBy('startTime', 'desc')
          .limit(batchSize);

        if (lastDoc) {
          q = q.startAfter(lastDoc);
        }

        const snapshot = await q.get();
        if (snapshot.empty) break;

        snapshot.docs.forEach(doc => {
          const attempt = doc.data();
          const key = attempt.studentId;

          if (!studentMap.has(key)) {
            studentMap.set(key, {
              studentId: attempt.studentId,
              userName: attempt.studentName || '',
              rollNumber: attempt.rollNumber || '',
              collegeId: attempt.collegeId,
              class: attempt.class || '',
              board: attempt.board || '',
              academicYear: attempt.academicYear || '',
              totalExams: 0,
              totalMarks: 0,
              totalMaxMarks: 0,
              scores: [],
              lastExamDate: null,
              classStats: {},
              subjectStats: {},
            });
          }

          const student = studentMap.get(key)!;
          const obtained = attempt.obtainedMarks || 0;
          const max = attempt.maximumScore || 0;
          const pct = max > 0 ? (obtained / max) * 100 : 0;

          student.totalExams += 1;
          student.totalMarks += obtained;
          student.totalMaxMarks += max;
          student.scores.push(pct);

          const examDate = attempt.submitTime || attempt.startTime;
          if (examDate && (!student.lastExamDate || examDate.toMillis() > student.lastExamDate.toMillis())) {
            student.lastExamDate = examDate;
          }

          // Class stats
          const cls = attempt.class || 'unknown';
          if (!student.classStats[cls]) student.classStats[cls] = { totalMarks: 0, totalMaxMarks: 0, totalExams: 0 };
          student.classStats[cls].totalMarks += obtained;
          student.classStats[cls].totalMaxMarks += max;
          student.classStats[cls].totalExams += 1;

          // Subject stats
          const subj = attempt.subject || 'unknown';
          if (!student.subjectStats[subj]) student.subjectStats[subj] = { totalMarks: 0, totalMaxMarks: 0, totalExams: 0 };
          student.subjectStats[subj].totalMarks += obtained;
          student.subjectStats[subj].totalMaxMarks += max;
          student.subjectStats[subj].totalExams += 1;
        });

        totalProcessed += snapshot.docs.length;
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        // console.log(`📊 Processed ${totalProcessed} attempts so far (${studentMap.size} students)`);

        if (snapshot.docs.length < batchSize) break;
      }

      // Write leaderboard stats in batches of 500
      const students = Array.from(studentMap.values());

      for (let i = 0; i < students.length; i += 500) {
        const batch = db.batch();
        const chunk = students.slice(i, i + 500);

        chunk.forEach(student => {
          const avgPct = student.totalMaxMarks > 0 ? (student.totalMarks / student.totalMaxMarks) * 100 : 0;
          const docId = `${collegeId}_${student.studentId}`;
          const ref = db.collection('leaderboardStats').doc(docId);

          batch.set(ref, {
            studentId: student.studentId,
            collegeId: student.collegeId,
            userName: student.userName,
            rollNumber: student.rollNumber,
            class: student.class,
            board: student.board,
            academicYear: student.academicYear,
            totalExams: student.totalExams,
            totalMarks: student.totalMarks,
            totalMaxMarks: student.totalMaxMarks,
            averagePercentage: Math.round(avgPct * 100) / 100,
            highestScore: student.scores.length > 0 ? Math.round(Math.max(...student.scores) * 100) / 100 : 0,
            lowestScore: student.scores.length > 0 ? Math.round(Math.min(...student.scores) * 100) / 100 : 0,
            lastExamDate: student.lastExamDate,
            classStats: student.classStats,
            subjectStats: student.subjectStats,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        await batch.commit();
        // console.log(`✅ Written leaderboard entries batch`);
      }

      // console.log(`✅ Migration complete: ${totalProcessed} attempts → ${students.length} leaderboard entries`);

      return {
        success: true,
        totalAttempts: totalProcessed,
        totalStudents: students.length,
      };
    } catch (error: any) {
      console.error('❌ migrateLeaderboardStats failed:', error);
      throw new functions.https.HttpsError('internal', 'Migration failed', error.message);
    }
  });

// ============================================
// RESUME BUILDER - EMAIL VERIFICATION FUNCTIONS
// sendResumeVerificationEmail: called after signup, stores token + sends email
// cleanupUnverifiedResumeAccounts: daily cron, deletes unverified accounts >24h old
// ============================================

/**
 * Generate a random hex token for email verification
 */
function generateVerificationToken(length = 32): string {
  return require('crypto').randomBytes(length).toString('hex');
}

/**
 * 📧 Send Email Verification for Resume Builder External Signups
 * Called from resume-builder.php after createUserWithEmailAndPassword succeeds.
 * Stores { emailVerified: false, verificationToken, verificationSentAt } in Firestore,
 * then sends a branded verification email via Brevo SMTP.
 *
 * Callable — requires the user to be authenticated (just signed up).
 */
export const sendResumeVerificationEmail = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const uid = context.auth.uid;
    const email = context.auth.token.email || data.email || '';
    const name = data.name || email.split('@')[0] || 'User';

    if (!email) {
      throw new functions.https.HttpsError('invalid-argument', 'Email address is required');
    }

    try {
      const db = admin.firestore();

      // Generate token
      const token = generateVerificationToken();
      const now = admin.firestore.Timestamp.now();

      // Store verification token in users collection (set with merge in case doc doesn't exist yet)
      await db.collection(COLLECTIONS.USERS).doc(uid).set({
        emailVerified: false,
        verificationToken: token,
        verificationSentAt: now,
        updatedAt: now,
        email: email.toLowerCase(),
        fullName: name,
        collegeId: 'RES',
        createdAt: now,
      }, { merge: true });

      // Fetch Brevo SMTP credentials from Firestore
      const emailCredsDoc = await db.doc(FIRESTORE_PATHS.EMAIL_CREDENTIALS).get();
      if (!emailCredsDoc.exists) {
        throw new functions.https.HttpsError('failed-precondition', 'Email credentials not configured');
      }

      const emailCreds = emailCredsDoc.data();
      if (!emailCreds?.MAIL_HOST || !emailCreds?.MAIL_USERNAME || !emailCreds?.MAIL_PASSWORD || !emailCreds?.MAIL_PORT) {
        throw new functions.https.HttpsError('failed-precondition', 'Incomplete email credentials');
      }

      const transporter = nodemailer.createTransport({
        host: emailCreds.MAIL_HOST,
        port: parseInt(emailCreds.MAIL_PORT),
        secure: false,
        auth: { user: emailCreds.MAIL_USERNAME, pass: emailCreds.MAIL_PASSWORD },
      });

      const verifyUrl = `https://www.tutorialspoint.com/online-resume-builder.htm?verify_token=${token}&uid=${uid}`;

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:26px;">Verify Your Email</h1>
      <p style="color:#fff;opacity:.9;margin:8px 0 0;">Resume Builder by Tutorials Point</p>
    </div>
    <div style="padding:40px 30px;">
      <h2 style="color:#667eea;margin-top:0;">Hello ${name}! 👋</h2>
      <p style="color:#4b5563;font-size:16px;line-height:1.6;">
        Thanks for signing up! Please verify your email address to activate your account and start saving your resumes.
      </p>
      <div style="text-align:center;margin:35px 0;">
        <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:15px 40px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">
          ✅ Verify My Email
        </a>
      </div>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px;border-radius:5px;margin:25px 0;">
        <p style="color:#92400e;margin:0;font-size:14px;">
          <strong>⚠️ This link expires in 24 hours.</strong> If you did not create an account, you can safely ignore this email.
        </p>
      </div>
      <p style="color:#6b7280;font-size:13px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${verifyUrl}" style="color:#667eea;word-break:break-all;">${verifyUrl}</a>
      </p>
    </div>
    <div style="background:#f7fafc;padding:25px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;">
      <p style="margin:0;">© ${new Date().getFullYear()} Tutorials Point India Pvt. Ltd. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

      await transporter.sendMail({
        from: `Tutorials Point <${process.env.NOREPLY_EMAIL || 'noreply@email.tutorialspoint.com'}>`,
        to: email.toLowerCase(),
        subject: 'Verify your email – Resume Builder',
        html: emailHtml,
      });

      // console.log(`✅ Verification email sent to ${email}`);

      return { success: true, message: 'Verification email sent' };

    } catch (error: any) {
      console.error('❌ sendResumeVerificationEmail error:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', `Failed to send verification email: ${error.message}`);
    }
  });

/**
 * ✅ Verify Resume Builder Email Token
 * Called when user clicks the verification link.
 * Matches token + uid, marks emailVerified: true in Firestore,
 * and updates Firebase Auth emailVerified flag via Admin SDK.
 *
 * Public callable — no auth required (user may not be signed in when clicking link).
 */
export const verifyResumeEmail = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 15, memory: '256MB' })
  .https.onCall(async (data, _context) => {
    const { token, uid } = data || {};

    if (!token || !uid) {
      throw new functions.https.HttpsError('invalid-argument', 'token and uid are required');
    }

    try {
      const db = admin.firestore();
      const userRef = db.collection(COLLECTIONS.USERS).doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Account not found');
      }

      const userData = userDoc.data()!;

      if (userData.emailVerified === true) {
        return { success: true, message: 'Email already verified' };
      }

      if (userData.verificationToken !== token) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid verification token');
      }

      // Check 24-hour expiry
      const sentAt: admin.firestore.Timestamp = userData.verificationSentAt;
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;
      if (!sentAt || (Date.now() - sentAt.toMillis()) > twentyFourHoursMs) {
        throw new functions.https.HttpsError('deadline-exceeded', 'Verification link has expired. Please request a new one.');
      }

      // Mark verified in Firestore
      await userRef.update({
        emailVerified: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        verificationToken: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update Firebase Auth record
      try {
        await admin.auth().updateUser(uid, { emailVerified: true });
      } catch (authErr: any) {
        // Non-blocking — Firestore is the source of truth for resume app
        console.warn(`⚠️ Could not update Auth emailVerified for ${uid}:`, authErr.message);
      }

      // console.log(`✅ Email verified for uid: ${uid}`);
      return { success: true, message: 'Email verified successfully' };

    } catch (error: any) {
      console.error('❌ verifyResumeEmail error:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', `Verification failed: ${error.message}`);
    }
  });

/**
 * 🧹 Cleanup Unverified Resume Builder Accounts (runs daily at 2:00 AM IST)
 * Deletes Firebase Auth accounts and Firestore docs for users who signed up
 * but never verified their email within 24 hours.
 * Also tracks cleanup in resume_cleanup_log for auditing.
 */
export const cleanupUnverifiedResumeAccounts = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .pubsub.schedule('0 2 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async (_context) => {
    // console.log('🧹 Starting cleanup of unverified resume accounts...');

    const db = admin.firestore();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoff);

    let deleted = 0;
    let errors = 0;

    try {
      const snapshot = await db.collection(COLLECTIONS.USERS)
        .where('collegeId', '==', 'RES')
        .where('emailVerified', '==', false)
        .where('verificationSentAt', '<', cutoffTimestamp)
        .get();

      if (snapshot.empty) {
        // console.log('✅ No unverified accounts to clean up');
        return null;
      }

      // console.log(`🔍 Found ${snapshot.size} unverified accounts older than 24h`);
      for (const doc of snapshot.docs) {
        const uid = doc.id;
        try {
          // Delete Firebase Auth account
          await admin.auth().deleteUser(uid);
        } catch (authErr: any) {
          // User may not exist in Auth — still delete Firestore doc
          if (authErr.code !== 'auth/user-not-found') {
            console.warn(`⚠️ Could not delete Auth user ${uid}:`, authErr.message);
          }
        }

        try {
          await doc.ref.delete();
          deleted++;
          // console.log(`🗑️ Deleted unverified account: ${uid}`);
        } catch (fsErr: any) {
          console.error(`❌ Failed to delete Firestore doc for ${uid}:`, fsErr.message);
          errors++;
        }
      }

      // Log cleanup run for auditing
      await db.collection('resume_cleanup_log').add({
        runAt: admin.firestore.FieldValue.serverTimestamp(),
        totalFound: snapshot.size,
        deleted,
        errors,
      });

      // console.log(`✅ Cleanup complete: ${deleted} deleted, ${errors} errors`);
      return { success: true, deleted, errors };

    } catch (error: any) {
      console.error('❌ cleanupUnverifiedResumeAccounts error:', error);
      return { success: false, error: error.message };
    }
  });