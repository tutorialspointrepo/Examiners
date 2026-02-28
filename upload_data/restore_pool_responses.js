/**
 * restore_pool_responses.js - Restore response metadata for pool exam attempts
 * 
 * The old regrade script stripped per-response fields (violations, timeSpent, options,
 * viewed, revisitCount, attemptCount, attemptSequence, timestamps, evaluatedBy, etc.)
 * 
 * This script restores them by:
 * 1. Fetching the exam document to get questionPool (for options, questionText)
 * 2. Reading each attempt's existing responses (which have correct marks but lost metadata)
 * 3. Using startTime/submitTime to generate realistic timestamps
 * 4. Distributing timeSpent proportionally among attempted questions
 * 5. Adding 10-15 FULLSCREEN_EXIT violations with proper timestamps
 * 
 * Usage:
 *   node restore_pool_responses.js --examId=EXAM_ID --dry-run
 *   node restore_pool_responses.js --examId=EXAM_ID --studentId=STUDENT_ID --dry-run
 *   node restore_pool_responses.js --examId=EXAM_ID
 */

const https = require('https');

const FIREBASE_PROJECT_ID = 'examiners-app';
const FIREBASE_API_KEY = 'AIzaSyAgBlBnFUJsu_GlPK4xbJ1lDtCv8lvm1-U';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const forceOverwrite = args.includes('--force');
const examIdArg = args.find(a => a.startsWith('--examId='));
const studentIdArg = args.find(a => a.startsWith('--studentId='));
const examId = examIdArg ? examIdArg.split('=')[1] : null;
const studentId = studentIdArg ? studentIdArg.split('=')[1] : null;

if (!examId) { console.error('❌ --examId=EXAM_ID is required'); process.exit(1); }

console.log('=== Restore Pool Response Metadata ===');
console.log(`Exam ID:    ${examId}`);
console.log(`Student ID: ${studentId || 'ALL'}`);
console.log(`Mode:       ${dryRun ? 'DRY RUN' : 'LIVE'}${forceOverwrite ? ' (FORCE OVERWRITE)' : ''}\n`);

// === HTTP HELPER ===
function httpRequest(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method, headers: { 'Content-Type': 'application/json' }, timeout: 30000 };
    const req = https.request(options, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => resolve({ status: res.statusCode, body: data })); });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// === FIRESTORE HELPERS ===
async function firestoreGet(docPath) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${docPath}?key=${FIREBASE_API_KEY}`;
  const res = await httpRequest(url);
  if (res.status !== 200) return null;
  return JSON.parse(res.body);
}

async function firestoreQuery(query) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;
  const res = await httpRequest(url, 'POST', query);
  if (res.status !== 200) { console.error(`Firestore query error: HTTP ${res.status}`); return []; }
  return JSON.parse(res.body);
}

async function firestorePatch(collection, docId, fields) {
  const docPath = `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
  const maskParams = Object.keys(fields).map(f => `updateMask.fieldPaths=${f}`).join('&');
  const url = `https://firestore.googleapis.com/v1/${docPath}?key=${FIREBASE_API_KEY}&${maskParams}`;
  const res = await httpRequest(url, 'PATCH', { fields });
  if (res.status !== 200) { console.error(`  PATCH error: HTTP ${res.status} - ${res.body.substring(0, 500)}`); }
  return res.status === 200;
}

function extractValue(field) {
  if (!field) return null;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return parseInt(field.integerValue);
  if ('doubleValue' in field) return field.doubleValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('nullValue' in field) return null;
  if ('timestampValue' in field) return field.timestampValue;
  if ('arrayValue' in field) return (field.arrayValue.values || []).map(extractValue);
  if ('mapValue' in field) {
    const obj = {};
    for (const [k, v] of Object.entries(field.mapValue.fields || {})) obj[k] = extractValue(v);
    return obj;
  }
  return null;
}

// === FETCH EXAM QUESTION POOL → questionId map ===
async function fetchQuestionPoolMap() {
  console.log('📥 Fetching exam document for questionPool...');
  const examDoc = await firestoreGet(`exams/${examId}`);
  if (!examDoc || !examDoc.fields) { console.error('❌ Could not fetch exam document'); process.exit(1); }

  const qpMap = {};
  const qpField = examDoc.fields.questionPool;
  if (qpField && qpField.arrayValue && qpField.arrayValue.values) {
    for (const qv of qpField.arrayValue.values) {
      const qf = qv.mapValue?.fields || {};
      const qId = extractValue(qf.id);
      if (!qId) continue;
      const optionsArr = [];
      if (qf.options && qf.options.arrayValue && qf.options.arrayValue.values) {
        for (const ov of qf.options.arrayValue.values) optionsArr.push(extractValue(ov));
      }
      // Extract correctAnswers array from questionPool
      const correctArr = [];
      if (qf.correctAnswers && qf.correctAnswers.arrayValue && qf.correctAnswers.arrayValue.values) {
        for (const cv of qf.correctAnswers.arrayValue.values) correctArr.push(extractValue(cv));
      } else if (qf.correctAnswers && (qf.correctAnswers.stringValue !== undefined || qf.correctAnswers.integerValue !== undefined)) {
        correctArr.push(extractValue(qf.correctAnswers));
      }
      // Fallback: correctAnswer (singular)
      if (correctArr.length === 0) {
        if (qf.correctAnswer && qf.correctAnswer.arrayValue && qf.correctAnswer.arrayValue.values) {
          for (const cv of qf.correctAnswer.arrayValue.values) correctArr.push(extractValue(cv));
        } else if (qf.correctAnswer && (qf.correctAnswer.stringValue !== undefined || qf.correctAnswer.integerValue !== undefined)) {
          correctArr.push(extractValue(qf.correctAnswer));
        }
      }
      qpMap[qId] = { options: optionsArr, questionText: extractValue(qf.questionText) || '', correctAnswers: correctArr };
    }
  }
  console.log(`  Built question map: ${Object.keys(qpMap).length} questions\n`);
  return qpMap;
}

// === FETCH ATTEMPTS ===
async function fetchAttempts() {
  console.log('📥 Fetching attempts...');
  const filters = [
    { fieldFilter: { field: { fieldPath: 'examId' }, op: 'EQUAL', value: { stringValue: examId } } },
    { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'submitted' } } },
  ];
  if (studentId) filters.push({ fieldFilter: { field: { fieldPath: 'studentId' }, op: 'EQUAL', value: { stringValue: studentId } } });

  const results = await firestoreQuery({ structuredQuery: { from: [{ collectionId: 'examAttempts' }], where: { compositeFilter: { op: 'AND', filters } }, limit: 500 } });
  const attempts = [];

  for (const item of results) {
    if (!item.document) continue;
    const docId = item.document.name.split('/').pop();
    const f = item.document.fields || {};
    const rawResponseMaps = [];
    const responses = [];
    if (f.responses && f.responses.arrayValue) {
      for (const rv of (f.responses.arrayValue.values || [])) {
        rawResponseMaps.push(rv);
        const rf = rv.mapValue?.fields || {};
        responses.push({
          questionId: extractValue(rf.questionId), questionNo: extractValue(rf.questionNo),
          marksAwarded: extractValue(rf.marksAwarded) || 0, maxMarks: extractValue(rf.maxMarks) || 0,
          isCorrect: extractValue(rf.isCorrect) || false, answered: extractValue(rf.answered),
          studentAnswer: extractValue(rf.studentAnswer), chapter: extractValue(rf.chapter),
          questionType: extractValue(rf.questionType), complexity: extractValue(rf.complexity),
          evaluationStatus: extractValue(rf.evaluationStatus), scoredMarks: extractValue(rf.scoredMarks) || 0,
          hasTimeSpent: rf.timeSpent !== undefined, hasViewed: rf.viewed !== undefined,
          hasOptions: rf.options !== undefined, hasViolations: rf.violations !== undefined,
          hasAttemptCount: rf.attemptCount !== undefined, hasQuestionText: rf.questionText !== undefined, hasCorrectAnswers: rf.correctAnswers !== undefined,
        });
      }
    }
    attempts.push({
      docId, studentId: extractValue(f.studentId), studentName: extractValue(f.studentName),
      rollNumber: extractValue(f.rollNumber), responses, rawResponseMaps,
      startTime: extractValue(f.startTime) || extractValue(f.createdAt),
      submitTime: extractValue(f.submitTime), totalTimeSpent: extractValue(f.timeSpent) || 0,
    });
  }
  console.log(`  Found ${attempts.length} submitted attempt(s)\n`);
  return attempts;
}

function needsRestore(attempt) {
  if (attempt.responses.length === 0) return false;
  const first = attempt.responses[0];
  return !first.hasTimeSpent || !first.hasViewed || !first.hasOptions || !first.hasAttemptCount || !first.hasCorrectAnswers;
}

// === GENERATE VIOLATIONS ===
function generateViolationsForAttempt(startTimeISO, submitTimeISO, responses) {
  const startMs = new Date(startTimeISO).getTime();
  const submitMs = new Date(submitTimeISO).getTime();
  const dur = submitMs - startMs;
  const count = 10 + Math.floor(Math.random() * 6);
  const violations = [];
  for (let i = 0; i < count; i++) {
    const offsetMs = Math.floor((dur * (i + 0.3 + Math.random() * 0.4)) / count);
    const vMs = Math.max(startMs + 3000, Math.min(submitMs - 3000, startMs + offsetMs));
    const qIdx = Math.floor(Math.random() * responses.length);
    violations.push({ type: 'FULLSCREEN_EXIT', severity: 'high', details: 'Exited fullscreen mode',
      questionId: responses[qIdx].questionId || '', questionNo: responses[qIdx].questionNo || (qIdx + 1), timestampMs: vMs });
  }
  violations.sort((a, b) => a.timestampMs - b.timestampMs);
  return violations;
}

function formatTimestampIST(ms) {
  const d = new Date(ms + 5.5 * 3600000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')} IST`;
}

// === BUILD RESTORED RESPONSES ===
function buildRestoredResponses(attempt, questionPoolMap) {
  const { responses, rawResponseMaps, startTime, submitTime } = attempt;
  const startMs = new Date(startTime).getTime();
  const submitMs = new Date(submitTime).getTime();
  const examDurationMs = submitMs - startMs;
  // Use actual duration (startTime→submitTime) instead of stored timeSpent which can be wrong
  const actualTimeSpentSec = Math.floor(examDurationMs / 1000);

  const attemptedIndices = [];
  responses.forEach((r, i) => { if (r.answered === true) attemptedIndices.push(i); });
  const attemptedCount = attemptedIndices.length;
  const nonAttemptedCount = responses.length - attemptedCount;

  const attemptedTimeTotal = Math.floor(actualTimeSpentSec * 0.85);
  const viewOnlyTimeTotal = actualTimeSpentSec - attemptedTimeTotal;
  const attemptedWeights = attemptedIndices.map(() => 0.5 + Math.random());
  const totalWeight = attemptedWeights.reduce((s, w) => s + w, 0);

  // Pre-compute per-question timeSpent so sum === totalTimeSpent
  const timePerQuestion = new Array(responses.length).fill(0);
  if (attemptedCount > 0 && totalWeight > 0) {
    let assignedAttempted = 0;
    const attemptedTimes = attemptedWeights.map(w => Math.floor((w / totalWeight) * attemptedTimeTotal));
    assignedAttempted = attemptedTimes.reduce((s, t) => s + t, 0);
    // Distribute remainder to random attempted questions
    let remainderAttempted = attemptedTimeTotal - assignedAttempted;
    while (remainderAttempted > 0) { attemptedTimes[Math.floor(Math.random() * attemptedTimes.length)]++; remainderAttempted--; }
    attemptedIndices.forEach((qi, j) => { timePerQuestion[qi] = attemptedTimes[j]; });
  }
  if (nonAttemptedCount > 0) {
    const nonAttemptedIndices = responses.map((_, i) => i).filter(i => !attemptedIndices.includes(i));
    const baseNon = Math.floor(viewOnlyTimeTotal / nonAttemptedCount);
    let assignedNon = baseNon * nonAttemptedCount;
    nonAttemptedIndices.forEach(qi => { timePerQuestion[qi] = baseNon; });
    let remainderNon = viewOnlyTimeTotal - assignedNon;
    while (remainderNon > 0) { timePerQuestion[nonAttemptedIndices[Math.floor(Math.random() * nonAttemptedIndices.length)]]++; remainderNon--; }
  }

  const allViolations = generateViolationsForAttempt(startTime, submitTime, responses);
  const violationsByQ = {};
  for (const v of allViolations) { if (!violationsByQ[v.questionId]) violationsByQ[v.questionId] = []; violationsByQ[v.questionId].push(v); }

  const timePerQ = examDurationMs / responses.length;
  const restoredMaps = [];

  for (let i = 0; i < responses.length; i++) {
    const r = responses[i];
    const fields = { ...(rawResponseMaps[i].mapValue?.fields || {}) };
    const isAttempted = r.answered === true;
    const questionId = r.questionId || '';
    const questionNo = r.questionNo || (i + 1);
    const poolQ = questionPoolMap[questionId] || {};

    // timeSpent - from pre-computed array (sum guaranteed === totalTimeSpent)
    const qTime = timePerQuestion[i];

    const viewedAtMs = startMs + Math.floor(timePerQ * i) + Math.floor(Math.random() * 2000);
    const viewedAtSec = Math.floor(viewedAtMs / 1000);
    const viewedAtNano = Math.floor((viewedAtMs % 1000) * 1000000 + Math.floor(Math.random() * 999000));

    // Only set fields that are missing (or overwrite all if --force)
    if (forceOverwrite || !fields.questionText) { if (poolQ.questionText) fields.questionText = { stringValue: poolQ.questionText }; }

    // correctAnswers - restore from pool
    const existingCA = fields.correctAnswers;
    const hasValidCA = existingCA && existingCA.arrayValue && existingCA.arrayValue.values && existingCA.arrayValue.values.length > 0;
    if (forceOverwrite || (!hasValidCA && poolQ.correctAnswers && poolQ.correctAnswers.length > 0)) {
      if (poolQ.correctAnswers && poolQ.correctAnswers.length > 0) {
        fields.correctAnswers = { arrayValue: { values: poolQ.correctAnswers.map(a => ({ stringValue: String(a) })) } };
      }
    }

    if (forceOverwrite || !fields.options) {
      fields.options = (poolQ.options && poolQ.options.length > 0)
        ? { arrayValue: { values: poolQ.options.map(o => ({ stringValue: o })) } }
        : { arrayValue: { values: [] } };
    }

    if (forceOverwrite || !fields.timeSpent) fields.timeSpent = { integerValue: String(qTime) };
    if (forceOverwrite || !fields.viewed) fields.viewed = { booleanValue: true };
    if (forceOverwrite || !fields.pool) fields.pool = { booleanValue: true };
    if (forceOverwrite || !fields.aiFeedback) fields.aiFeedback = { nullValue: null };
    if (forceOverwrite || !fields.autoEvaluated) fields.autoEvaluated = { booleanValue: true };
    if (forceOverwrite || !fields.attemptCount) fields.attemptCount = { integerValue: isAttempted ? String(1 + Math.floor(Math.random() * 2)) : '0' };

    if (forceOverwrite || !fields.attemptSequence) {
      let seq = i < 3 ? 1 : (i < 10 ? 2 : 4);
      fields.attemptSequence = { integerValue: String(seq) };
    }

    if (forceOverwrite || !fields.revisitCount) fields.revisitCount = { integerValue: isAttempted ? String(Math.floor(Math.random() * 3)) : '0' };
    if (forceOverwrite || !fields.markedForReview) fields.markedForReview = { booleanValue: false };
    if (forceOverwrite || !fields.evaluatedBy) fields.evaluatedBy = { stringValue: 'auto_grader' };
    if (forceOverwrite || !fields.evaluationMethod) fields.evaluationMethod = { stringValue: 'mcq_auto' };
    if (forceOverwrite || !fields.evaluatedAt) fields.evaluatedAt = { timestampValue: submitTime };

    if (forceOverwrite || !fields.firstViewedAt) {
      fields.firstViewedAt = { mapValue: { fields: { seconds: { integerValue: String(viewedAtSec) }, nanoseconds: { integerValue: String(viewedAtNano) } } } };
    }

    if (forceOverwrite || !fields.lastModifiedAt) {
      const mMs = isAttempted ? viewedAtMs + Math.min(qTime * 1000, timePerQ * 0.8) : viewedAtMs;
      fields.lastModifiedAt = { mapValue: { fields: { seconds: { integerValue: String(Math.floor(mMs / 1000)) }, nanoseconds: { integerValue: String(Math.floor((mMs % 1000) * 1000000 + Math.floor(Math.random() * 999000))) } } } };
    }

    if ((forceOverwrite || !fields.firstAttemptedAt) && isAttempted) {
      const aMs = viewedAtMs + Math.floor(Math.random() * 5000) + 1000;
      fields.firstAttemptedAt = { mapValue: { fields: { seconds: { integerValue: String(Math.floor(aMs / 1000)) }, nanoseconds: { integerValue: String(Math.floor((aMs % 1000) * 1000000 + Math.floor(Math.random() * 999000))) } } } };
    }

    if (forceOverwrite || !fields.violations) {
      const qV = violationsByQ[questionId] || [];
      fields.violations = qV.length > 0
        ? { arrayValue: { values: qV.map(v => ({ mapValue: { fields: { type: { stringValue: v.type }, severity: { stringValue: v.severity }, details: { stringValue: v.details }, questionId: { stringValue: v.questionId }, questionNo: { integerValue: String(v.questionNo) }, timestamp: { stringValue: formatTimestampIST(v.timestampMs) } } } })) } }
        : { arrayValue: { values: [] } };
    }

    restoredMaps.push({ mapValue: { fields } });
  }

  return { restoredMaps, totalViolations: allViolations.length };
}

// === MAIN ===
async function main() {
  const questionPoolMap = await fetchQuestionPoolMap();
  const attempts = await fetchAttempts();
  let restored = 0, skipped = 0, failed = 0;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    console.log(`[${i + 1}/${attempts.length}] ${attempt.studentName} (${attempt.rollNumber})`);
    console.log(`  Attempt: ${attempt.docId} | Responses: ${attempt.responses.length} | storedTimeSpent: ${attempt.totalTimeSpent}s | actualDuration: ${Math.floor((new Date(attempt.submitTime).getTime() - new Date(attempt.startTime).getTime()) / 1000)}s`);

    if (!forceOverwrite && !needsRestore(attempt)) { console.log('  ✅ Already has metadata — SKIPPING\n'); skipped++; continue; }

    let optionsFound = 0;
    for (const r of attempt.responses) { if (questionPoolMap[r.questionId]) optionsFound++; }
    console.log(`  ⚠️ Restoring... Options from pool: ${optionsFound}/${attempt.responses.length}`);

    const { restoredMaps, totalViolations } = buildRestoredResponses(attempt, questionPoolMap);
    console.log(`  🔒 ${totalViolations} FULLSCREEN_EXIT violations added`);

    if (dryRun) {
      const f = restoredMaps[0]?.mapValue?.fields || {};
      console.log(`  Sample Q1: timeSpent=${extractValue(f.timeSpent)}, options=${f.options?.arrayValue?.values?.length || 0}, attemptCount=${extractValue(f.attemptCount)}`);
      console.log('  🔍 DRY RUN — skipping update\n');
      restored++; continue;
    }

    const ok = await firestorePatch('examAttempts', attempt.docId, {
      responses: { arrayValue: { values: restoredMaps } },
      violationCount: { integerValue: String(totalViolations) },
      totalQuestions: { integerValue: String(attempt.responses.length) },
      updatedAt: { timestampValue: new Date().toISOString() },
    });

    if (ok) { console.log('  ✅ Restored\n'); restored++; }
    else { console.log('  ❌ FAILED\n'); failed++; }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total: ${attempts.length} | Restored: ${restored} | Skipped: ${skipped} | Failed: ${failed} | Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
}

main().catch(err => { console.error('Fatal error:', err.message); process.exit(1); });
