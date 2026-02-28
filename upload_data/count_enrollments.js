/**
 * count_enrollments.js - Count students enrolled in an exam
 * 
 * Queries exam_enrollments collection for a given exam ID
 * and counts active enrollments.
 *
 * Usage: node count_enrollments.js <examId>
 * Example: node count_enrollments.js LPU-26-QJGNBM
 */

const https = require('https');

const FIREBASE_PROJECT_ID = 'examiners-app';
const FIREBASE_API_KEY = 'AIzaSyAgBlBnFUJsu_GlPK4xbJ1lDtCv8lvm1-U';

function httpRequest(url, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const options = {
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            method,
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });
}

async function firestoreQuery(query) {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;
    const res = await httpRequest(url, 'POST', query);
    if (res.status !== 200) {
        console.error(`Firestore query error: HTTP ${res.status}`);
        console.error(res.body.substring(0, 500));
        return [];
    }
    return JSON.parse(res.body);
}

async function main() {
    const examId = process.argv[2];
    if (!examId) {
        console.error('Usage: node count_enrollments.js <examId>');
        process.exit(1);
    }

    console.log(`\nCounting enrollments for exam: ${examId}\n`);

    // 1. Count ALL enrollments for this exam (any status)
    const allQuery = {
        structuredQuery: {
            from: [{ collectionId: 'exam_enrollments' }],
            where: {
                fieldFilter: {
                    field: { fieldPath: 'examId' },
                    op: 'EQUAL',
                    value: { stringValue: examId }
                }
            },
            limit: 1000
        }
    };

    const allResults = await firestoreQuery(allQuery);
    const allDocs = allResults.filter(r => r.document);
    
    // 2. Count ACTIVE enrollments
    const activeQuery = {
        structuredQuery: {
            from: [{ collectionId: 'exam_enrollments' }],
            where: {
                compositeFilter: {
                    op: 'AND',
                    filters: [
                        {
                            fieldFilter: {
                                field: { fieldPath: 'examId' },
                                op: 'EQUAL',
                                value: { stringValue: examId }
                            }
                        },
                        {
                            fieldFilter: {
                                field: { fieldPath: 'status' },
                                op: 'EQUAL',
                                value: { stringValue: 'active' }
                            }
                        }
                    ]
                }
            },
            limit: 1000
        }
    };

    const activeResults = await firestoreQuery(activeQuery);
    const activeDocs = activeResults.filter(r => r.document);

    // 3. Count exam_attempts for this exam
    const attemptsQuery = {
        structuredQuery: {
            from: [{ collectionId: 'exam_attempts' }],
            where: {
                fieldFilter: {
                    field: { fieldPath: 'examId' },
                    op: 'EQUAL',
                    value: { stringValue: examId }
                }
            },
            limit: 1000
        }
    };

    const attemptsResults = await firestoreQuery(attemptsQuery);
    const attemptsDocs = attemptsResults.filter(r => r.document);

    // 4. Get exam document to see stored totalStudents
    const examQuery = {
        structuredQuery: {
            from: [{ collectionId: 'exams' }],
            where: {
                fieldFilter: {
                    field: { fieldPath: 'examId' },
                    op: 'EQUAL',
                    value: { stringValue: examId }
                }
            },
            limit: 1
        }
    };

    const examResults = await firestoreQuery(examQuery);
    const examDoc = examResults.find(r => r.document);
    const storedTotal = examDoc?.document?.fields?.totalStudents?.integerValue || 'N/A';

    // Print status breakdown
    const statusCounts = {};
    allDocs.forEach(r => {
        const status = r.document.fields?.status?.stringValue || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('=== RESULTS ===');
    console.log(`Exam doc totalStudents field: ${storedTotal}`);
    console.log(`Total enrollments (all statuses): ${allDocs.length}`);
    console.log(`Active enrollments: ${activeDocs.length}`);
    console.log(`Exam attempts: ${attemptsDocs.length}`);
    console.log(`\nEnrollment status breakdown:`);
    Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
    });
    
    console.log(`\n=== ANALYSIS ===`);
    console.log(`Students who attempted but are NOT actively enrolled: ${attemptsDocs.length - activeDocs.length > 0 ? attemptsDocs.length + ' attempts - check overlap' : 'Need cross-check'}`);
    
    // Cross-check: find attempters not in active enrollments
    const activeStudentIds = new Set();
    activeDocs.forEach(r => {
        const sid = r.document.fields?.studentId?.stringValue;
        if (sid) activeStudentIds.add(sid);
    });

    const attemptStudentIds = new Set();
    attemptsDocs.forEach(r => {
        const sid = r.document.fields?.studentId?.stringValue;
        if (sid) attemptStudentIds.add(sid);
    });

    let enrolledAndAttempted = 0;
    let attemptedButNotEnrolled = 0;
    attemptStudentIds.forEach(sid => {
        if (activeStudentIds.has(sid)) {
            enrolledAndAttempted++;
        } else {
            attemptedButNotEnrolled++;
        }
    });

    let enrolledButNotAttempted = 0;
    activeStudentIds.forEach(sid => {
        if (!attemptStudentIds.has(sid)) {
            enrolledButNotAttempted++;
        }
    });

    console.log(`\nUnique students who attempted: ${attemptStudentIds.size}`);
    console.log(`Enrolled AND attempted (present): ${enrolledAndAttempted}`);
    console.log(`Attempted but NOT enrolled: ${attemptedButNotEnrolled}`);
    console.log(`Enrolled but NOT attempted (absent): ${enrolledButNotAttempted}`);
    console.log(`\nCorrect total should be: ${activeDocs.length} (active enrollments)`);
    console.log(`Correct present should be: ${enrolledAndAttempted}`);
    console.log(`Correct absent should be: ${enrolledButNotAttempted}`);
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
