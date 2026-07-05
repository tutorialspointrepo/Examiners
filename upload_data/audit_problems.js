/**
 * Problem Document Auditor
 * Reads all problems from Firebase and reports:
 *   - Missing top-level fields
 *   - Empty/null fields that should have content
 *   - Invalid or incomplete nested structures
 *   - Invalid JSON sub-structures
 *
 * Usage:
 *   node audit_problems.js              — audit ALL problems in the collection
 *   node audit_problems.js --problem knight-dialer  — audit single problem by slug
 *   node audit_problems.js --verbose    — show full details per field
 *   node audit_problems.js --type coding — filter by problemType (coding or sql)
 */

const admin = require('firebase-admin');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'problems';

// ==================== INITIALIZE ====================
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  projectId: FIREBASE_PROJECT_ID,
});
const db = admin.firestore();

// ==================== FIELD DEFINITIONS ====================

// Fields every document must have (coding + sql)
const COMMON_REQUIRED_FIELDS = [
  'id', 'problem_id', 'slug', 'number', 'title',
  'description', 'descriptionText',
  'difficulty', 'level', 'category',
  'tags', 'topics', 'related',
  'problemType',
  'analogy', 'approaches', 'examples', 'testCases',
  'constraints', 'defaultCode', 'solutionSummary', 'visualize',
  'companies', 'stats', 'seo',
  'createdAt', 'updatedAt',
];

// Fields only for coding problems
const CODING_ONLY_FIELDS = ['paramOrder'];

// Fields only for SQL problems
const SQL_ONLY_FIELDS = ['tableSchema'];

// Fields that must not be empty/null/[] for a complete document
const MUST_HAVE_CONTENT = {
  title:           v => typeof v === 'string' && v.trim().length > 0,
  description:     v => typeof v === 'string' && v.trim().length > 0,
  descriptionText: v => typeof v === 'string' && v.trim().length > 0,
  difficulty:      v => typeof v === 'string' && v.trim().length > 0,
  tags:            v => Array.isArray(v) && v.length > 0,
  examples:        v => Array.isArray(v) && v.length > 0,
  testCases:       v => Array.isArray(v), // can be empty for SQL, just must exist
  constraints:     v => Array.isArray(v) && v.length > 0,
  approaches:      v => v && typeof v === 'object' && Object.keys(v).length > 0,
  defaultCode:     v => v && typeof v === 'object' && Object.keys(v).length > 0,
  solutionSummary: v => typeof v === 'string' && v.trim().length > 0,
  analogy:         v => v && typeof v === 'object',
  visualize:       v => v && typeof v === 'object',
  seo:             v => v && typeof v === 'object' && v.title && v.canonical,
  stats:           v => v && typeof v === 'object' && v.acceptance,
};

// ==================== APPROACH VALIDATOR ====================

const CODING_LANGUAGES = ['python', 'javascript', 'java', 'cpp', 'go', 'c'];

function auditApproaches(approaches, isSQL) {
  const issues = [];

  if (!approaches || typeof approaches !== 'object') {
    return ['approaches is missing or not an object'];
  }

  const keys = Object.keys(approaches);
  if (keys.length === 0) {
    return ['approaches is empty — no approaches defined'];
  }

  // Check for brute force — accept common key variants
  const hasBruteForce = keys.some(k =>
    k === 'brute-force' || k === 'brute_force' || k === 'bruteforce' ||
    k.startsWith('brute') || k.includes('naive') || k.includes('recursive-brute')
  );
  if (!hasBruteForce) {
    issues.push('approaches: missing brute-force key (expected key starting with "brute" or containing "naive")');
  }

  for (const key of keys) {
    const ap = approaches[key];
    const prefix = `approaches["${key}"]`;

    // Required fields per approach
    const apRequired = ['title', 'icon', 'summary', 'description', 'steps', 'pros', 'cons', 'complexity', 'code', 'visualization'];
    for (const f of apRequired) {
      if (ap[f] === undefined || ap[f] === null) {
        issues.push(`${prefix}: missing field "${f}"`);
      }
    }

    // Complexity
    if (ap.complexity) {
      for (const cf of ['time', 'timeExplain', 'space', 'spaceExplain']) {
        if (!ap.complexity[cf]) {
          issues.push(`${prefix}.complexity: missing "${cf}"`);
        }
      }
    }

    // Code languages
    if (ap.code) {
      if (isSQL) {
        if (!ap.code.sql) issues.push(`${prefix}.code: missing "sql"`);
      } else {
        for (const lang of CODING_LANGUAGES) {
          if (!ap.code[lang]) issues.push(`${prefix}.code: missing "${lang}"`);
        }
      }
    }

    // Visualization
    if (ap.visualization) {
      if (!ap.visualization.svg || !ap.visualization.svg.trim().startsWith('<svg')) {
        issues.push(`${prefix}.visualization.svg: missing or invalid SVG`);
      }
    }
  }

  return issues;
}

// ==================== MAIN AUDIT FUNCTION ====================

function auditDocument(slug, doc) {
  const issues = [];
  const missingFields = [];
  const emptyFields = [];
  const isSQL = doc.problemType === 'sql';

  // 1. Check common required fields exist
  for (const field of COMMON_REQUIRED_FIELDS) {
    if (!(field in doc)) {
      missingFields.push(field);
    }
  }

  // 2. Check type-specific fields
  const typeFields = isSQL ? SQL_ONLY_FIELDS : CODING_ONLY_FIELDS;
  for (const field of typeFields) {
    if (!(field in doc)) {
      missingFields.push(field);
    }
  }

  // 3. Check fields that must have real content
  for (const [field, validator] of Object.entries(MUST_HAVE_CONTENT)) {
    if (field in doc) {
      try {
        if (!validator(doc[field])) {
          emptyFields.push(field);
        }
      } catch {
        issues.push(`${field}: validator threw error — value may be malformed`);
      }
    }
  }

  // 4. Deep audit approaches
  if ('approaches' in doc) {
    const approachIssues = auditApproaches(doc.approaches, isSQL);
    issues.push(...approachIssues);
  }

  // 5. Validate visualize SVG
  if (doc.visualize) {
    if (!doc.visualize.svg || !doc.visualize.svg.trim().startsWith('<svg')) {
      issues.push('visualize.svg: missing or does not start with <svg>');
    }
  }

  // 6. Validate analogy structure
  if (doc.analogy && typeof doc.analogy === 'object') {
    if (!doc.analogy.title) issues.push('analogy: missing "title"');
    if (!doc.analogy.description) issues.push('analogy: missing "description"');
    if (!Array.isArray(doc.analogy.approaches) || doc.analogy.approaches.length === 0) {
      issues.push('analogy: missing or empty "approaches" array');
    }
  }

  // 7. Validate defaultCode has correct languages
  if (doc.defaultCode && typeof doc.defaultCode === 'object') {
    if (isSQL) {
      if (!doc.defaultCode.sql) issues.push('defaultCode: missing "sql"');
    } else {
      for (const lang of CODING_LANGUAGES) {
        if (!doc.defaultCode[lang]) issues.push(`defaultCode: missing "${lang}"`);
      }
    }
  }

  // 8. Validate examples structure
  if (Array.isArray(doc.examples) && doc.examples.length > 0) {
    doc.examples.forEach((ex, i) => {
      if (!ex.input) issues.push(`examples[${i}]: missing "input"`);
      if (!ex.output && ex.output !== 0 && ex.output !== false) issues.push(`examples[${i}]: missing "output"`);
    });
  }

  // 9. Validate testCases for coding problems
  if (!isSQL && Array.isArray(doc.testCases)) {
    if (doc.testCases.length < 3) {
      issues.push(`testCases: only ${doc.testCases.length} test case(s) — expected at least 3`);
    }
    doc.testCases.forEach((tc, i) => {
      if (!tc.input) issues.push(`testCases[${i}]: missing "input"`);
      if (tc.expected === undefined) issues.push(`testCases[${i}]: missing "expected"`);
    });
  }

  // 10. Validate paramOrder for coding problems
  if (!isSQL && 'paramOrder' in doc) {
    if (!Array.isArray(doc.paramOrder) || doc.paramOrder.length === 0) {
      issues.push('paramOrder: empty or not an array');
    }
  }

  return { missingFields, emptyFields, issues };
}

// ==================== REPORT PRINTER ====================

function printReport(results, verbose) {
  const clean = [];
  const withIssues = [];

  for (const r of results) {
    const total = r.missingFields.length + r.emptyFields.length + r.issues.length;
    if (total === 0) {
      clean.push(r.slug);
    } else {
      withIssues.push(r);
    }
  }

  console.log('\n========================================');
  console.log('📋 AUDIT REPORT');
  console.log('========================================');
  console.log(`✅ Clean:      ${clean.length}`);
  console.log(`⚠️  With Issues: ${withIssues.length}`);
  console.log(`❌ Not Found:  ${results.filter(r => r.notFound).length}`);
  console.log('========================================\n');

  if (withIssues.length > 0) {
    console.log('── PROBLEMS WITH ISSUES ──────────────────\n');
    for (const r of withIssues) {
      if (r.notFound) {
        console.log(`❌ [NOT FOUND] ${r.slug}`);
        continue;
      }

      const totalIssues = r.missingFields.length + r.emptyFields.length + r.issues.length;
      console.log(`⚠️  ${r.slug}  (${r.problemType || '?'})  —  ${totalIssues} issue(s)`);

      if (r.missingFields.length > 0) {
        console.log(`   🔴 Missing fields:  ${r.missingFields.join(', ')}`);
      }
      if (r.emptyFields.length > 0) {
        console.log(`   🟡 Empty/null fields: ${r.emptyFields.join(', ')}`);
      }
      if (r.issues.length > 0 && verbose) {
        for (const issue of r.issues) {
          console.log(`   🔸 ${issue}`);
        }
      } else if (r.issues.length > 0) {
        console.log(`   🔸 Deep issues (${r.issues.length}): ${r.issues.slice(0, 3).join(' | ')}${r.issues.length > 3 ? ` ... +${r.issues.length - 3} more` : ''}`);
      }
      console.log();
    }
  }

  if (verbose && clean.length > 0) {
    console.log('── CLEAN PROBLEMS ────────────────────────');
    console.log(clean.map(s => `   ✅ ${s}`).join('\n'));
    console.log();
  }

  // Summary table by issue type
  const missingFieldCounts = {};
  const emptyFieldCounts = {};
  for (const r of withIssues) {
    for (const f of r.missingFields) missingFieldCounts[f] = (missingFieldCounts[f] || 0) + 1;
    for (const f of r.emptyFields)   emptyFieldCounts[f]   = (emptyFieldCounts[f]   || 0) + 1;
  }

  if (Object.keys(missingFieldCounts).length > 0) {
    console.log('── MISSING FIELD FREQUENCY ───────────────');
    Object.entries(missingFieldCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([f, count]) => console.log(`   ${String(count).padStart(3)}x  ${f}`));
    console.log();
  }

  if (Object.keys(emptyFieldCounts).length > 0) {
    console.log('── EMPTY/NULL FIELD FREQUENCY ────────────');
    Object.entries(emptyFieldCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([f, count]) => console.log(`   ${String(count).padStart(3)}x  ${f}`));
    console.log();
  }
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const problemIdx = args.indexOf('--problem');
  const singleProblem = problemIdx !== -1 ? args[problemIdx + 1] : null;
  const typeIdx = args.indexOf('--type');
  const filterType = typeIdx !== -1 ? args[typeIdx + 1] : null; // 'coding' or 'sql'

  if (problemIdx !== -1 && !singleProblem) {
    console.error('❌ --problem flag requires a problem ID. Example: --problem knight-dialer');
    process.exit(1);
  }
  if (typeIdx !== -1 && !['coding', 'sql'].includes(filterType)) {
    console.error('❌ --type must be "coding" or "sql"');
    process.exit(1);
  }

  console.log('========================================');
  console.log('🔍 Problem Document Auditor');
  if (singleProblem) console.log(`🎯 Mode: Single — ${singleProblem}`);
  else if (filterType) console.log(`🔎 Mode: All ${filterType.toUpperCase()} problems`);
  else console.log('🌐 Mode: Full collection scan');
  if (verbose) console.log('📣 Verbose mode ON');
  console.log('========================================\n');

  const results = [];

  if (singleProblem) {
    // ── Single problem mode ──
    process.stdout.write(`Fetching: ${singleProblem} ... `);
    try {
      const docSnap = await db.collection(COLLECTION_NAME).doc(singleProblem).get();
      if (!docSnap.exists) {
        console.log('❌ NOT FOUND');
        results.push({ slug: singleProblem, notFound: true, missingFields: [], emptyFields: [], issues: [] });
      } else {
        const doc = docSnap.data();
        const { missingFields, emptyFields, issues } = auditDocument(singleProblem, doc);
        const total = missingFields.length + emptyFields.length + issues.length;
        console.log(total === 0 ? '✅ OK' : `⚠️  ${total} issue(s)`);
        results.push({ slug: singleProblem, problemType: doc.problemType, notFound: false, missingFields, emptyFields, issues });
      }
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
      results.push({ slug: singleProblem, notFound: false, missingFields: [], emptyFields: [], issues: [`fetch error: ${err.message}`] });
    }

  } else {
    // ── Full collection scan ──
    console.log('📖 Fetching all documents from collection...');

    let query = db.collection(COLLECTION_NAME).orderBy('slug');
    if (filterType) {
      query = query.where('problemType', '==', filterType);
    }

    const snapshot = await query.get();
    const total = snapshot.size;
    console.log(`📊 Found ${total} document(s)\n`);

    let i = 0;
    for (const docSnap of snapshot.docs) {
      i++;
      const slug = docSnap.id;
      const doc = docSnap.data();

      process.stdout.write(`[${String(i).padStart(4)}/${total}] ${slug.padEnd(60)} `);

      try {
        const { missingFields, emptyFields, issues } = auditDocument(slug, doc);
        const totalIssues = missingFields.length + emptyFields.length + issues.length;

        if (totalIssues === 0) {
          console.log('✅ OK');
        } else {
          console.log(`⚠️  ${totalIssues} issue(s)`);
        }

        results.push({ slug, problemType: doc.problemType, notFound: false, missingFields, emptyFields, issues });
      } catch (err) {
        console.log(`❌ ERROR: ${err.message}`);
        results.push({ slug, notFound: false, missingFields: [], emptyFields: [], issues: [`audit error: ${err.message}`] });
      }
    }
  }

  printReport(results, verbose);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
