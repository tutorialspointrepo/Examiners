// =============================================================================
// aiInterview.ts — AI Interview (Gemini Live) backend for EXAMINERS
// Firebase Functions v1 (region us-central1). Standalone, additive module.
//
// Wire up in index.ts:   export * from './aiInterview';
// Requires Firestore:    settings/GEMINI_API_KEY (field GEMINI_API_KEY),
//                        optional settings/GEMINI_LIVE_MODEL (field GEMINI_LIVE_MODEL),
//                        optional settings/JUDGE0_BASE_URL (field JUDGE0_BASE_URL).
// Stores per-user under: users/{uid}/ai_interviews and users/{uid}/ai_interview_transcripts
// Auth: required — uses context.auth.uid.
// Exports 4 callables: aiInterviewStartVoiceSession, aiInterviewSaveResult,
//                      aiInterviewListPast, aiInterviewGetTranscript.
// =============================================================================

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// NOTE: admin is initialised once by the host index.ts (this module is imported into it).
// Do NOT call admin.initializeApp() here — doing so causes app/duplicate-app on deploy.
const REGION = 'us-central1';

// ⚠️ VERIFY ON FIRST DEPLOY: this is the only Gemini-Live model name in the repo.
// Override without redeploy via Firestore Settings.GEMINI_LIVE_MODEL.
const INTERVIEW_LIVE_MODEL_DEFAULT = 'gemini-3.1-flash-live-preview';

// Persona → Gemini Live prebuilt voice. Default is a clear, neutral interviewer voice.
const INTERVIEW_VOICE_MAP: Record<string, string> = {
  default: 'Charon',
  male: 'Charon',
  female: 'Aoede',
  warm: 'Aoede',
  crisp: 'Kore',
  deep: 'Fenrir',
};

// Compact language map for interviews. International first (pro courses target
// US / UK / Australia / global), then Indian. Unknown codes fall back to English.
const INTERVIEW_LANGUAGES: Record<string, { label: string; prompt: string }> = {
  en:    { label: 'English (US)',        prompt: 'Conduct the interview in clear, professional American English.' },
  en_gb: { label: 'English (UK)',        prompt: 'Conduct the interview in clear, professional British English (UK spelling and idiom).' },
  en_au: { label: 'English (Australia)', prompt: 'Conduct the interview in clear, professional Australian English.' },
  es:    { label: 'Spanish',             prompt: 'Conduct the interview in clear, professional Spanish. Keep ALL technical terms in English.' },
  fr:    { label: 'French',              prompt: 'Conduct the interview in clear, professional French. Keep ALL technical terms in English.' },
  de:    { label: 'German',              prompt: 'Conduct the interview in clear, professional German. Keep ALL technical terms in English.' },
  it:    { label: 'Italian',             prompt: 'Conduct the interview in clear, professional Italian. Keep ALL technical terms in English.' },
  pt:    { label: 'Portuguese',          prompt: 'Conduct the interview in clear, professional Portuguese. Keep ALL technical terms in English.' },
  nl:    { label: 'Dutch',               prompt: 'Conduct the interview in clear, professional Dutch. Keep ALL technical terms in English.' },
  ar:    { label: 'Arabic',              prompt: 'Conduct the interview in clear, professional Modern Standard Arabic. Keep ALL technical terms in English.' },
  zh:    { label: 'Chinese (Mandarin)',  prompt: 'Conduct the interview in clear, professional Mandarin Chinese. Keep ALL technical terms in English.' },
  ja:    { label: 'Japanese',            prompt: 'Conduct the interview in clear, professional Japanese. Keep ALL technical terms in English.' },
  ko:    { label: 'Korean',              prompt: 'Conduct the interview in clear, professional Korean. Keep ALL technical terms in English.' },
  ru:    { label: 'Russian',             prompt: 'Conduct the interview in clear, professional Russian. Keep ALL technical terms in English.' },
  en_in: { label: 'English (Indian)',    prompt: 'Conduct the interview in clear, professional Indian English (the neutral, widely-understood English commonly spoken by Indian professionals).' },
  hi:    { label: 'Hinglish',            prompt: 'Conduct the interview in natural Hinglish (Hindi-English mix as Indian professionals speak). Keep ALL technical terms in English.' },
  te:    { label: 'Telugu',              prompt: 'Conduct the interview in Telugu for conversation, but keep ALL technical terms in English.' },
  ta:    { label: 'Tamil',               prompt: 'Conduct the interview in Tamil for conversation, but keep ALL technical terms in English.' },
  kn:    { label: 'Kannada',             prompt: 'Conduct the interview in Kannada for conversation, but keep ALL technical terms in English.' },
  ml:    { label: 'Malayalam',           prompt: 'Conduct the interview in Malayalam for conversation, but keep ALL technical terms in English.' },
  mr:    { label: 'Marathi',             prompt: 'Conduct the interview in Marathi for conversation, but keep ALL technical terms in English.' },
  bn:    { label: 'Bengali',             prompt: 'Conduct the interview in Bengali for conversation, but keep ALL technical terms in English.' },
};

// Tool declarations — MUST stay in sync with AIInterviewPage.tsx INTERVIEW_TOOLS.
const INTERVIEW_TOOL_DECLARATIONS = [{
  functionDeclarations: [
    {
      name: 'open_code_editor',
      description: 'Open a code editor for the candidate to write and run a program. Call ONLY when a coding task is the right way to probe a skill. After calling, stay silent and wait — the candidate\'s submitted code and its execution result arrive as a user message prefixed [CODE SUBMISSION].',
      parameters: {
        type: 'object',
        properties: {
          problem: { type: 'string', description: 'Clear problem statement to show on screen.' },
          language: { type: 'string', description: 'One of: python, java, cpp, c, javascript, csharp, go, ruby, rust, php, typescript.' },
          starter_code: { type: 'string', description: 'Optional starter/skeleton code.' },
        },
        required: ['problem', 'language'],
      },
    },
    {
      name: 'open_canvas',
      description: 'Open a drawing canvas for the candidate to sketch a diagram (architecture, flow, schema, ER diagram, network topology). Use when a drawing explains better than words. After calling, wait — the drawing arrives as a user message [CANVAS SUBMISSION] with the image attached.',
      parameters: {
        type: 'object',
        properties: { prompt: { type: 'string', description: 'What to draw, shown on screen.' } },
        required: ['prompt'],
      },
    },
    {
      name: 'record_evaluation',
      description: 'Record your PRIVATE assessment of the candidate\'s LAST answer. Call after every substantive answer so difficulty can adapt and a fair scorecard is produced. Never speak the scores aloud.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          difficulty: { type: 'number', description: 'Difficulty of the question asked, 1 (basic) to 5 (expert).' },
          score: { type: 'number', description: 'Quality of the answer, 0 (no/wrong) to 5 (excellent).' },
          note: { type: 'string', description: 'One-line private note.' },
        },
        required: ['topic', 'difficulty', 'score'],
      },
    },
    {
      name: 'end_interview',
      description: 'Conclude the interview. Call when you have enough signal — strong performance across depth, OR the early-exit gate (multiple weak answers in a row), OR time is up.',
      parameters: {
        type: 'object',
        properties: {
          verdict: { type: 'string', description: 'strong_hire | hire | borderline | no_hire' },
          level: { type: 'string', description: 'Final candidate level tag — exactly one of: below_basic | basic | fair | good | strong | champion (see FINAL LEVEL TAG rubric).' },
          summary: { type: 'string', description: '2-3 sentence candidate-facing wrap-up.' },
          strengths: { type: 'string' },
          gaps: { type: 'string' },
        },
        required: ['verdict', 'level', 'summary'],
      },
    },
  ],
}];

/**
 * Build the interviewer system prompt — a state machine that opens with intros,
 * ladders difficulty adaptively, branches to code/canvas tasks, gates out weak
 * candidates early, and concludes with a scorecard.
 */
function buildInterviewerSystemPrompt(opts: {
  courseName: string;
  candidateName: string;
  curriculumBlueprint: string;
  language: string;
}): string {
  const langCode = (opts.language || 'en').toLowerCase();
  const lang = INTERVIEW_LANGUAGES[langCode] || INTERVIEW_LANGUAGES.en;

  return `# ROLE
You are an expert technical interviewer for a "${opts.courseName}" interview. You are conducting a REAL, live, voice-to-voice mock interview with a candidate named ${opts.candidateName}. Be warm but rigorous — like a senior engineer who is fair, sharp, and genuinely trying to find out what the candidate knows.

# LANGUAGE
${lang.prompt}

# VOICE-MODE RULES (CRITICAL)
- This is SPOKEN. Keep every turn short and conversational — one question at a time. Never read out long passages or lists.
- PACE — VERY IMPORTANT: Speak SLOWLY and DELIBERATELY, noticeably slower than normal conversation, like a calm senior engineer thinking aloud — never rushed, never fast. Insert a clear pause after every sentence and after commas. Keep each spoken turn to 1–2 short sentences maximum, then STOP. Do not chain multiple sentences quickly. Let the candidate breathe. A relaxed, unhurried, measured delivery is required at all times.
- After asking a question, stop completely and wait in silence — do NOT add filler, do NOT keep talking.
- No markdown, no code blocks, no symbols read aloud. Speak naturally.
- Wait for the candidate to finish. Never talk over them.
- Never speak scores, difficulty numbers, or your private assessment out loud.

# CURRICULUM (your question bank — cover breadth across these as the candidate proves depth)
${opts.curriculumBlueprint}

# INTERVIEW FLOW (state machine)
1. INTRO — Greet ${opts.candidateName} warmly, introduce yourself as their interviewer for ${opts.courseName}, and ask them for a brief self-introduction.
2. WARMUP — Start with 1-2 BASIC questions from the curriculum to settle them in.
3. LADDER — If they answer well, increase depth and specificity step by step (difficulty 1→5). Probe follow-ups: "why", "what happens if", "how would you optimize". Move across different curriculum areas so you test breadth AND depth.
4. CODE / DIAGRAM — When a skill is best tested by writing code, call open_code_editor with a focused problem. When a concept is best shown by a diagram (architecture, schema, flow), call open_canvas. Use these sparingly and only when they add signal. After calling, stay quiet until the submission arrives.
5. EARLY-EXIT GATE — If the candidate gives weak/wrong/empty answers, or repeatedly refuses or is unable to engage, across 3-4 questions in a row, they are not ready. Move to CLOSING.
6. CANDIDATE QUESTIONS — Before closing a normal interview, ask warmly if they have any questions for you. Answer up to 3-4 of their questions concisely. After answering (or if they have none), move to CLOSING.
7. CLOSING — When you have enough signal (strong across depth, gate reached, candidate disengaged, or ~20-25 minutes elapsed): speak ONE short, warm closing line (thank them, wish them well) AND, in that SAME turn, call end_interview with your verdict, level tag, and summary.

# ENDING THE INTERVIEW (CRITICAL — NEVER SKIP)
- The interview ONLY ends when you call the end_interview tool. A spoken goodbye — "thank you for your time", "have a good day", "best of luck", "this might not be the right fit" — WITHOUT calling end_interview leaves the candidate stranded on a dead call. That is a failure.
- RULE: Every time you say any closing or farewell line, you MUST call end_interview in the SAME turn. The spoken farewell and the end_interview tool call always happen together, every time, no exceptions.
- Never end the conversation by speaking alone. If you have decided the interview is over, the end_interview call is mandatory in that turn.

# ADAPTIVE DIFFICULTY
- Strong answers → go deeper and harder, ask senior-level / edge-case / system-design questions.
- Shaky answers → stay at the current level, give one chance to recover, then decide.
- Calibrate to the candidate, not a fixed script.

# DIFFICULTY LEVELS & HOW TO PROGRESS (you decide the timing — follow these rules)
Questions ladder through 5 difficulty levels:
  L1 Basic — definitions, recall, "what is…".
  L2 Intermediate — apply a single concept to a simple, familiar situation.
  L3 Proficient — explain WHY / HOW, compare options, handle a small twist.
  L4 Advanced — edge cases, trade-offs, debugging, "what happens if…", optimization.
  L5 Expert — design, scale, ambiguity, senior-level reasoning with no single right answer.
Movement rules:
- START at L1. ADVANCE one level only after a solid, correct answer at the current level (one clearly strong answer, or two adequate ones). Do NOT skip levels upward.
- HOLD at the current level after a shaky/partial answer — give exactly ONE chance to recover with a hint or a rephrase, then decide.
- DROP one level after a wrong or empty answer, to confirm where the candidate's floor is.
- As you climb, spread across different curriculum topics so you test breadth as well as depth.

# MANDATORY TOOL USAGE
- After EVERY substantive answer, call record_evaluation (topic, difficulty 1-5, score 0-5, one-line note). This is private and drives adaptation + the final scorecard. Do this silently.
- Use open_code_editor / open_canvas when warranted.
- Call end_interview exactly once, at the very end — with your verdict, level tag, and summary — ALWAYS paired with your spoken closing line in the SAME turn. A spoken goodbye without end_interview leaves the candidate stranded on a dead call.

# FINAL LEVEL TAG (assign exactly one in end_interview 'level')
Tag the candidate by the HIGHEST difficulty level they handled CONSISTENTLY well (not one lucky or unlucky answer):
- below_basic — could not answer even L1 Basic questions correctly; no working foundation shown, or the interview hit the early-exit gate before any real answer.
- basic — reliable only at L1 Basic; struggles as soon as it becomes applied.
- fair — comfortable at L1–L2; reaches L3 occasionally but inconsistently.
- good — solid through L3 Proficient; explains why/how clearly.
- strong — solid through L4 Advanced; handles edge cases and trade-offs well.
- champion — consistently strong at L5 Expert; senior-level depth and reasoning.

# SCORING NOTE
- record_evaluation 'score' is per-answer, 0 (no/wrong) to 5 (excellent). The platform aggregates these into the candidate's overall score on a 0–100 scale (average × 20) and shows the level tag above. You never compute or speak either number aloud.

# TIME
Target 15-25 minutes total. Finish earlier if the signal is clear (either direction). Respect the candidate's time.

Begin only when you receive the [BEGIN INTERVIEW] message.`;
}

/**
 * Mint a single-use Gemini Live ephemeral token with the interview setup locked in.
 * Raw REST against v1alpha/auth_tokens (no extra backend SDK dependency).
 */
async function mintInterviewLiveToken(opts: {
  apiKey: string;
  model: string;
  voice: string;
  systemPrompt: string;
  tools?: any[];
}): Promise<{ tokenName: string; expireTime: string; newSessionExpireTime: string }> {
  const now = Date.now();
  const expireTime = new Date(now + 60 * 60_000).toISOString();          // session may run up to 60 min
  const newSessionExpireTime = new Date(now + 2 * 60_000).toISOString();  // client has 2 min to open the WS

  const body = {
    uses: 2,                 // allow a 2nd connect (dev StrictMode/HMR re-connect) so the token isn't exhausted mid-session
    expireTime,
    newSessionExpireTime,
    bidiGenerateContentSetup: {
      model: `models/${opts.model}`,
      generationConfig: {
        responseModalities: ['AUDIO'],
        maxOutputTokens: 8192,
        temperature: 0.7,
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voice } },
        },
      },
      systemInstruction: { parts: [{ text: opts.systemPrompt }] },
      tools: opts.tools ?? INTERVIEW_TOOL_DECLARATIONS,
      realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=${opts.apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`❌ [AI INTERVIEW TOKEN] ${resp.status}: ${errText.slice(0, 300)}`);
    throw new functions.https.HttpsError('internal', `Gemini Live token mint failed: ${resp.status} — ${errText.slice(0, 200)}`);
  }
  const json: any = await resp.json();
  if (!json?.name) throw new functions.https.HttpsError('internal', 'Gemini Live token mint returned no token name');

  return {
    tokenName: json.name,
    expireTime: json.expireTime || expireTime,
    newSessionExpireTime: json.newSessionExpireTime || newSessionExpireTime,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Callables (Firebase Functions v1, region us-central1). Auth required.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🎤 aiInterviewStartVoiceSession
 * Mints a Gemini Live token and returns everything the frontend needs to open the session.
 * Input: { courseId?, courseName, candidateName?, curriculumBlueprint, language?, voicePersona? }
 */
export const aiInterviewStartVoiceSession = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  const uid = context.auth.uid;
  const d = data || {};
  const { courseId, courseName, candidateName, curriculumBlueprint, language, voicePersona } = d;

  if (!courseName || !curriculumBlueprint) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing courseName / curriculumBlueprint');
  }

  const db = admin.firestore();
  const [geminiKeyDoc, liveModelDoc, judge0Doc] = await Promise.all([
    db.collection('settings').doc('GEMINI_API_KEY').get(),
    db.collection('settings').doc('GEMINI_LIVE_MODEL').get(),
    db.collection('settings').doc('JUDGE0_BASE_URL').get(),
  ]);
  const geminiKey = geminiKeyDoc.data()?.GEMINI_API_KEY || '';
  if (!geminiKey) {
    throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured in Firestore settings');
  }
  const liveModel = liveModelDoc.data()?.GEMINI_LIVE_MODEL || INTERVIEW_LIVE_MODEL_DEFAULT;
  const judge0BaseUrl = judge0Doc.data()?.JUDGE0_BASE_URL || '';

  const personaKey = String(voicePersona || 'default').toLowerCase();
  const voice = INTERVIEW_VOICE_MAP[personaKey] || INTERVIEW_VOICE_MAP.default;

  let resolvedLang = String(language || 'en').toLowerCase();
  if (!INTERVIEW_LANGUAGES[resolvedLang]) resolvedLang = 'en';

  const systemPrompt = buildInterviewerSystemPrompt({
    courseName: String(courseName),
    candidateName: String(candidateName || 'Candidate'),
    curriculumBlueprint: String(curriculumBlueprint),
    language: resolvedLang,
  });

  try {
    const tokenPromise = mintInterviewLiveToken({ apiKey: geminiKey, model: liveModel, voice, systemPrompt });

    const convPromise = (async (): Promise<string | null> => {
      try {
        const ref = await db.collection('users').doc(uid).collection('ai_interviews').add({
          candidateId: uid,
          courseId: courseId || null,
          courseName: courseName || null,
          candidateName: candidateName || null,
          language: resolvedLang,
          voicePersona: personaKey,
          model: liveModel,
          status: 'active',
          evaluations: [],
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });
        return ref.id;
      } catch (e: any) {
        console.warn(`⚠️ [AI INTERVIEW] session doc create failed (non-fatal): ${e?.message || e}`);
        return null;
      }
    })();

    const [tokenInfo, conversationId] = await Promise.all([tokenPromise, convPromise]);
    const sessionId = `iv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`🎤 [AI INTERVIEW] ${sessionId} | uid=${uid} | course=${courseId} | voice=${voice} | lang=${resolvedLang} | model=${liveModel}`);

    return {
      success: true,
      sessionId,
      conversationId,
      token: tokenInfo.tokenName,
      tokenExpireTime: tokenInfo.expireTime,
      newSessionExpireTime: tokenInfo.newSessionExpireTime,
      model: liveModel,
      voice,
      voicePersona: personaKey,
      language: resolvedLang,
      systemPrompt,
      judge0BaseUrl,
    };
  } catch (err: any) {
    console.error('❌ [AI INTERVIEW] start error:', err?.message || err);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('internal', err?.message || 'Failed to start interview session');
  }
});

/**
 * 💾 aiInterviewSaveResult — saves scorecard under users/{uid}/ai_interviews/{conversationId}
 * and the transcript in its own doc users/{uid}/ai_interview_transcripts/{conversationId}.
 */
export const aiInterviewSaveResult = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  const uid = context.auth.uid;
  const d = data || {};
  const {
    conversationId, courseId, courseName,
    verdict, level, summary, strengths, gaps, evaluations,
    overallScore, durationSec, language, transcript,
  } = d;

  if (!conversationId || typeof conversationId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Missing conversationId');
  }

  const db = admin.firestore();
  const payload: any = {
    status: 'completed',
    verdict: verdict || null,
    level: level || null,
    summary: summary || null,
    strengths: Array.isArray(strengths) ? strengths : [],
    gaps: Array.isArray(gaps) ? gaps : [],
    evaluations: Array.isArray(evaluations) ? evaluations : [],
    overallScore: typeof overallScore === 'number' ? overallScore : null,
    durationSec: typeof durationSec === 'number' ? durationSec : null,
    language: language || null,
    completedAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  };
  if (courseId) payload.courseId = courseId;
  if (courseName) payload.courseName = courseName;

  try {
    await db.collection('users').doc(uid).collection('ai_interviews')
      .doc(conversationId).set(payload, { merge: true });

    if (Array.isArray(transcript) && transcript.length > 0) {
      try {
        await db.collection('users').doc(uid).collection('ai_interview_transcripts')
          .doc(conversationId).set({
            transcript,
            courseId: courseId || null,
            updatedAt: admin.firestore.Timestamp.now(),
          }, { merge: true });
      } catch (e: any) {
        console.warn('⚠️ [AI INTERVIEW] transcript save failed (non-fatal):', e?.message || e);
      }
    }

    console.log(`💾 [AI INTERVIEW] saved result ${conversationId} | uid=${uid} | course=${courseId || '-'} | verdict=${verdict || '-'}`);
    return { success: true, conversationId };
  } catch (err: any) {
    console.error('❌ [AI INTERVIEW] save error:', err?.message || err);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('internal', err?.message || 'Failed to save interview result');
  }
});

/**
 * 📜 aiInterviewListPast — lists the caller's completed interviews (optional courseId filter).
 */
export const aiInterviewListPast = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  const uid = context.auth.uid;
  const d = data || {};
  const courseId = d.courseId ? String(d.courseId) : null;
  const limit = Math.min(Math.max(Number(d.limit) || 50, 1), 100);

  const db = admin.firestore();
  try {
    const snap = await db.collection('users').doc(uid).collection('ai_interviews')
      .orderBy('completedAt', 'desc')
      .limit(limit)
      .get();

    let rows = snap.docs.map(dd => ({ id: dd.id, ...(dd.data() as any) }));
    rows = rows.filter(r => r.status === 'completed');
    if (courseId) rows = rows.filter(r => r.courseId === courseId);

    const toMillis = (t: any): number | null =>
      t?.toMillis ? t.toMillis() : (typeof t?._seconds === 'number' ? t._seconds * 1000 : null);

    const interviews = rows.map(r => ({
      id: r.id,
      courseId: r.courseId ?? null,
      courseName: r.courseName ?? null,
      verdict: r.verdict ?? null,
      level: r.level ?? null,
      overallScore: typeof r.overallScore === 'number' ? r.overallScore : null,
      summary: r.summary ?? null,
      durationSec: typeof r.durationSec === 'number' ? r.durationSec : null,
      language: r.language ?? null,
      completedAt: toMillis(r.completedAt),
    }));

    console.log(`📜 [AI INTERVIEW] listPast | uid=${uid} | course=${courseId || 'all'} | count=${interviews.length}`);
    return { success: true, interviews };
  } catch (err: any) {
    console.error('❌ [AI INTERVIEW] listPast error:', err?.message || err);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('internal', err?.message || 'Failed to list past interviews');
  }
});

/**
 * 📄 aiInterviewGetTranscript — full transcript + report detail for one past interview.
 */
export const aiInterviewGetTranscript = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  const uid = context.auth.uid;
  const conversationId = data?.conversationId ? String(data.conversationId) : '';
  if (!conversationId) throw new functions.https.HttpsError('invalid-argument', 'Missing conversationId');

  const db = admin.firestore();
  try {
    const snap = await db.collection('users').doc(uid).collection('ai_interview_transcripts')
      .doc(conversationId).get();
    const transcript = snap.exists ? (snap.data()?.transcript || []) : [];

    const mainSnap = await db.collection('users').doc(uid).collection('ai_interviews')
      .doc(conversationId).get();
    const m: any = mainSnap.exists ? (mainSnap.data() || {}) : {};
    const norm = (v: any): string | null =>
      (typeof v === 'string' && v.trim()) ? v : (Array.isArray(v) && v.length ? v.join('; ') : null);

    return {
      success: true,
      transcript: Array.isArray(transcript) ? transcript : [],
      evaluations: Array.isArray(m.evaluations) ? m.evaluations : [],
      strengths: norm(m.strengths),
      gaps: norm(m.gaps),
    };
  } catch (err: any) {
    console.error('❌ [AI INTERVIEW] getTranscript error:', err?.message || err);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('internal', err?.message || 'Failed to load transcript');
  }
});
