// setup_all_reports.js
// Run this script to create/update ALL report templates
// Includes: Exam Results Report + Exams Attendance Report

const admin = require('firebase-admin');
const readline = require('readline');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask Y/N questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase());
    });
  });
}

async function checkExistingReport(reportId, reportName) {
  try {
    const docRef = db.collection('reportTemplates').doc(reportId);
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {  // Admin SDK uses .exists (property), not .exists() (method)
      console.log('');
      console.log(`⚠️  Report "${reportName}" already exists!`);
      console.log(`   ID: ${reportId}`);
      console.log('');
      
      const answer = await askQuestion('   Do you want to overwrite it? (Y/N): ');
      
      if (answer === 'y' || answer === 'yes') {
        console.log('   ✅ Will overwrite existing report');
        return true;
      } else {
        console.log('   ⏭️  Skipping this report');
        return false;
      }
    }
    
    return true; // Report doesn't exist, proceed
  } catch (error) {
    console.error(`❌ Error checking existing report: ${error.message}`);
    return false;
  }
}

async function setupAllReports() {
  try {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('📋 REPORT TEMPLATES SETUP');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('This script will create/update the following reports:');
    console.log('');
    console.log('1️⃣  Exam Results Report - Mon YYYY');
    console.log('    Purpose: Track exam scores, grades, and percentages');
    console.log('    Filters: Academic Year, Class, Subject, Exam Type, Exam Month');
    console.log('');
    console.log('2️⃣  Exams Attendance Report - Mon YYYY');
    console.log('    Purpose: Track student attendance for exams');
    console.log('    Filters: Academic Year, Class, Subject, Exam Type, Exam Month, Status');
    console.log('');
    
    const proceed = await askQuestion('Do you want to proceed? (Y/N): ');
    
    if (proceed !== 'y' && proceed !== 'yes') {
      console.log('');
      console.log('❌ Setup cancelled by user');
      rl.close();
      process.exit(0);
    }
    
    console.log('');
    console.log('📋 Starting setup...');
    console.log('');
    
    // Generate academic years from 2025-26 to 2030-31
    const academicYears = [];
    for (let year = 2025; year <= 2030; year++) {
      const nextYear = (year + 1).toString().slice(-2);
      academicYears.push({
        value: `${year}-${nextYear}`,
        label: `${year}-${nextYear}`
      });
    }
    
    // Generate exam months (Jan 2025 to Dec 2025)
    const examMonths = [
      { value: '01', label: 'January 2025' },
      { value: '02', label: 'February 2025' },
      { value: '03', label: 'March 2025' },
      { value: '04', label: 'April 2025' },
      { value: '05', label: 'May 2025' },
      { value: '06', label: 'June 2025' },
      { value: '07', label: 'July 2025' },
      { value: '08', label: 'August 2025' },
      { value: '09', label: 'September 2025' },
      { value: '10', label: 'October 2025' },
      { value: '11', label: 'November 2025' },
      { value: '12', label: 'December 2025' }
    ];
    
    // Status options for attendance
    const statusOptions = [
      { value: 'Present', label: 'Present' },
      { value: 'Absent', label: 'Absent' }
    ];
    
    // =================================================================
    // REPORT 1: EXAM RESULTS REPORT
    // =================================================================
    
    console.log('📊 Report 1: Exam Results Report');
    
    const shouldCreateExamResults = await checkExistingReport(
      'template-exam-results-academic-year',
      'Exam Results Report'
    );
    
    if (shouldCreateExamResults) {
    const examResultsReport = {
      id: 'template-exam-results-academic-year',
      name: 'Exam Results Report',
      description: 'Comprehensive exam results report with scores, grades, and percentages for a specific date range',
      type: 'examResults',
      category: 'academic',
      icon: 'faChartBar',
      
      // Filters Configuration
      filters: [
        {
          id: 'class',
          field: 'class',
          label: 'Class',
          type: 'select',
          required: true,
          dynamicOptions: {
            source: 'college',
            field: 'validClasses'
          },
          placeholder: 'Select Class',
          description: 'Select the class to filter results'
        },
        {
          id: 'subject',
          field: 'subject',
          label: 'Subject',
          type: 'select',
          required: true,
          dynamicOptions: {
            source: 'college',
            field: 'subjects'
          },
          placeholder: 'Select Subject',
          description: 'Select the subject for exam results'
        },
        {
          id: 'examType',
          field: 'examType',
          label: 'Exam Type',
          type: 'select',
          required: true,
          dynamicOptions: {
            source: 'college',
            field: 'examTypes'
          },
          placeholder: 'Select Exam Type',
          description: 'Select the type of exam'
        },
        {
          id: 'startDate',
          field: 'startDate',
          label: 'Start Date',
          type: 'date',
          required: true,
          placeholder: 'Select start date',
          description: 'Select the start date for the report period'
        },
        {
          id: 'endDate',
          field: 'endDate',
          label: 'End Date',
          type: 'date',
          required: true,
          placeholder: 'Select end date',
          description: 'Select the end date for the report period'
        }
        // NOTE: Using date range (startDate, endDate) instead of examMonth
        // to allow flexible date filtering on createdAt field
      ],
      
      // Data Source Configuration
      dataSource: {
        collection: 'examAttempts',
        fields: [
          {
            id: 'studentName',
            label: 'Student Name',
            field: 'studentName',
            type: 'text',
            width: 150
          },
          {
            id: 'rollNumber',
            label: 'Roll Number',
            field: 'studentRollNumber',
            type: 'text',
            width: 120
          },
          {
            id: 'class',
            label: 'Class',
            field: 'class',
            type: 'text',
            width: 100
          },
          {
            id: 'subject',
            label: 'Subject',
            field: 'subject',
            type: 'text',
            width: 120
          },
          {
            id: 'examType',
            label: 'Exam Type',
            field: 'examType',
            type: 'text',
            width: 120
          },
          {
            id: 'examTitle',
            label: 'Exam Title',
            field: 'examTitle',
            type: 'text',
            width: 200
          },
          {
            id: 'examDate',
            label: 'Exam Date',
            field: 'createdAt',
            type: 'datetime',
            width: 150,
            format: 'dd MMM yyyy'
          },
          {
            id: 'maximumScore',
            label: 'Maximum Score',
            field: 'maximumScore',
            type: 'number',
            width: 120
          },
          {
            id: 'obtainedMarks',
            label: 'Obtained Marks',
            field: 'obtainedMarks',
            type: 'number',
            width: 120
          },
          {
            id: 'percentage',
            label: 'Percentage',
            field: 'percentage',
            type: 'percentage',
            width: 100,
            formula: '=(obtainedMarks/maximumScore)*100'
          },
          {
            id: 'grade',
            label: 'Grade',
            field: 'grade',
            type: 'text',
            width: 80,
            formula: 'GRADE(percentage)'
          }
        ]
      },
      
      // Report Settings
      settings: {
        sortBy: 'studentRollNumber',
        sortOrder: 'asc',
        groupBy: 'class',
        includeTimestamp: true,
        includeGeneratedBy: true,
        format: 'xlsx',
        orientation: 'landscape'
      },
      
      // Metadata
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true,
      version: '1.0'
    };
    
    // Save Exam Results Report
    await db.collection('reportTemplates')
      .doc(examResultsReport.id)
      .set(examResultsReport, { merge: true });
    
    console.log('   ✅ Exam Results Report created!');
    console.log('      ID:', examResultsReport.id);
    console.log('      Filters:', examResultsReport.filters.length);
    }
    
    console.log('');
    
    // =================================================================
    // REPORT 2: EXAMS ATTENDANCE REPORT
    // =================================================================
    
    console.log('📊 Report 2: Exams Attendance Report');
    
    const shouldCreateAttendance = await checkExistingReport(
      'template-exams-attendance-report',
      'Exams Attendance Report'
    );
    
    if (shouldCreateAttendance) {
    const attendanceReport = {
      id: 'template-exams-attendance-report',
      name: 'Exams Attendance Report',
      description: 'Complete attendance report for all students in a class for a specific exam',
      type: 'attendance',
      category: 'academic',
      icon: 'faClipboardUser',
      
      // Special flag to indicate this report needs custom data processing
      customDataProcessor: 'attendance',
      
      // Filters Configuration
      filters: [
        {
          id: 'academicYear',
          field: 'academicYear',
          label: 'Academic Year',
          type: 'select',
          required: true,
          options: academicYears,
          placeholder: 'Select Academic Year',
          description: 'Select the academic year for the report'
        },
        {
          id: 'class',
          field: 'class',
          label: 'Class',
          type: 'select',
          required: true,
          dynamicOptions: {
            source: 'college',
            field: 'validClasses'
          },
          placeholder: 'Select Class',
          description: 'Select the class'
        },
        {
          id: 'subject',
          field: 'subject',
          label: 'Subject',
          type: 'select',
          required: true,
          dynamicOptions: {
            source: 'college',
            field: 'subjects'
          },
          placeholder: 'Select Subject',
          description: 'Select the subject'
        },
        {
          id: 'month',
          field: 'month',
          label: 'Month',
          type: 'select',
          required: true,
          options: [
            { value: '01', label: 'January' },
            { value: '02', label: 'February' },
            { value: '03', label: 'March' },
            { value: '04', label: 'April' },
            { value: '05', label: 'May' },
            { value: '06', label: 'June' },
            { value: '07', label: 'July' },
            { value: '08', label: 'August' },
            { value: '09', label: 'September' },
            { value: '10', label: 'October' },
            { value: '11', label: 'November' },
            { value: '12', label: 'December' }
          ],
          placeholder: 'Select Month',
          description: 'Select the month to list exams'
        },
        {
          id: 'examId',
          field: 'examId',
          label: 'Exam',
          type: 'select',
          required: true,
          dynamicOptions: {
            source: 'exams',
            dependsOn: ['academicYear', 'class', 'subject', 'month'],
            placeholder: 'Select exam from the chosen month'
          },
          placeholder: 'Select Exam',
          description: 'Select the specific exam'
        }
      ],
      
      // Data Source Configuration
      // NOTE: This report pulls data from TWO sources:
      // 1. Users table - all students for the class
      // 2. Attendance table - present students for the exam
      dataSource: {
        collection: 'users',
        type: 'attendance-report', // Special type for attendance processing
        
        // Fields to include in the report
        fields: [
          {
            id: 'studentName',
            label: 'Student Name',
            field: 'fullName',
            source: 'user',
            type: 'text',
            width: 200
          },
          {
            id: 'rollNumber',
            label: 'Roll Number',
            field: 'rollNumber',
            source: 'user',
            type: 'text',
            width: 120
          },
          {
            id: 'class',
            label: 'Class',
            field: 'class',
            source: 'user',
            type: 'text',
            width: 100
          },
          {
            id: 'subject',
            label: 'Subject',
            field: 'subject',
            source: 'filter', // From filter parameters
            type: 'text',
            width: 120
          },
          {
            id: 'examTitle',
            label: 'Exam Title',
            field: 'examTitle',
            source: 'exam',
            type: 'text',
            width: 200
          },
          {
            id: 'examDate',
            label: 'Exam Date',
            field: 'examDate',
            source: 'exam',
            type: 'text',
            width: 150
          },
          {
            id: 'examDuration',
            label: 'Exam Duration',
            field: 'duration',
            source: 'exam',
            type: 'text',
            width: 150,
            format: 'duration' // Special format indicator
          },
          {
            id: 'maximumMarks',
            label: 'Maximum Marks',
            field: 'maxMarks',
            source: 'exam',
            type: 'number',
            width: 150
          },
          {
            id: 'examiner',
            label: 'Examiner',
            field: 'createdByName',
            source: 'exam',
            type: 'text',
            width: 200
          },
          {
            id: 'attendanceStatus',
            label: 'Attendance Status',
            field: 'status',
            source: 'attendance', // From attendance table
            type: 'text',
            width: 150,
            defaultValue: 'Absent'
          },
          {
            id: 'markedAt',
            label: 'Marked At',
            field: 'markedAt',
            source: 'attendance',
            type: 'datetime',
            width: 150,
            format: 'dd MMM yyyy HH:mm'
          }
        ]
      },
      
      // Report Settings
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    try {
      await db.collection('reportTemplates').doc(attendanceReport.id).set(attendanceReport);
      console.log('✅ Exams Attendance Report created successfully');
    } catch (error) {
      console.error('❌ Error creating Exams Attendance Report:', error);
    }
    } else {
      console.log('⏭️  Exams Attendance Report already exists, skipping...');
    }
      
    
    console.log('');
    
    // =================================================================
    // REPORT 3: STUDENT PERFORMANCE ANALYTICS
    // =================================================================
    
    console.log('📊 Report 3: Student Performance Analytics');
    
    const shouldCreatePerformance = await checkExistingReport(
      'template-student-performance-analytics',
      'Student Performance Analytics'
    );
    
    if (shouldCreatePerformance) {
    const performanceReport = {
      id: 'template-student-performance-analytics',
      name: 'Student Performance Analytics',
      description: 'Comprehensive performance report showing attendance, scores, grades, and rankings for all students in a class',
      type: 'performance',
      category: 'academic',
      icon: 'faChartLine',
      
      // Special flag for custom processing
      customDataProcessor: 'performance',
      
      // Filters Configuration
      filters: [
        {
          id: 'academicYear',
          field: 'academicYear',
          label: 'Academic Year',
          type: 'select',
          required: true,
          options: academicYears,
          placeholder: 'Select Academic Year',
          description: 'Select the academic year for the report'
        },
        {
          id: 'class',
          field: 'class',
          label: 'Class',
          type: 'select',
          required: true,
          dynamicOptions: {
            source: 'college',
            field: 'validClasses'
          },
          placeholder: 'Select Class',
          description: 'Select the class'
        }
      ],
      
      // Data Source Configuration
      dataSource: {
        collection: 'users',
        type: 'performance-report',
        
        // Fields to include in the report
        fields: [
          {
            id: 'serialNumber',
            label: '#',
            type: 'number',
            width: 50
          },
          {
            id: 'studentName',
            label: 'Student Name',
            type: 'text',
            width: 200
          },
          {
            id: 'rollNumber',
            label: 'Roll Number',
            type: 'text',
            width: 120
          },
          {
            id: 'totalExams',
            label: 'Total Exams',
            type: 'number',
            width: 120
          },
          {
            id: 'examsAttended',
            label: 'Attended',
            type: 'number',
            width: 100
          },
          {
            id: 'examsAbsent',
            label: 'Absent',
            type: 'number',
            width: 100
          },
          {
            id: 'attendanceRate',
            label: 'Attend %',
            type: 'percentage',
            width: 100
          },
          {
            id: 'totalObtained',
            label: 'Total Obtained',
            type: 'number',
            width: 130
          },
          {
            id: 'totalMaximum',
            label: 'Total Max',
            type: 'number',
            width: 120
          },
          {
            id: 'overallPercentage',
            label: 'Overall %',
            type: 'percentage',
            width: 100
          },
          {
            id: 'grade',
            label: 'Grade',
            type: 'text',
            width: 80
          },
          {
            id: 'rank',
            label: 'Rank',
            type: 'number',
            width: 80
          },
          {
            id: 'highestScore',
            label: 'Highest %',
            type: 'percentage',
            width: 100
          },
          {
            id: 'lowestScore',
            label: 'Lowest %',
            type: 'percentage',
            width: 100
          }
        ]
      },
      
      // Report Settings
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    try {
      await db.collection('reportTemplates').doc(performanceReport.id).set(performanceReport);
      console.log('✅ Student Performance Analytics created successfully');
    } catch (error) {
      console.error('❌ Error creating Student Performance Analytics:', error);
    }
    } else {
      console.log('⏭️  Student Performance Analytics already exists, skipping...');
    }
    
    console.log('');
    
    // =================================================================
    // REPORT 4: EXAM-WISE VIOLATIONS SUMMARY
    // =================================================================
    
    console.log('📊 Report 4: Exam-wise Violations Summary');
    
    const shouldCreateViolations = await checkExistingReport(
      'template-exam-violations-summary',
      'Exam-wise Violations Summary'
    );
    
    if (shouldCreateViolations) {
    const violationsReport = {
      id: 'template-exam-violations-summary',
      name: 'Exam-wise Violations Summary',
      description: 'Comprehensive violations report showing all security violations detected during exams',
      type: 'violations',
      category: 'security',
      icon: 'faShieldAlt',
      
      // Special flag for custom processing
      customDataProcessor: 'violations',
      
      // Filters Configuration
      filters: [
        {
          id: 'startDate',
          field: 'startDate',
          label: 'Start Date',
          type: 'date',
          required: true,
          placeholder: 'Select Start Date',
          description: 'Start date of the report period'
        },
        {
          id: 'endDate',
          field: 'endDate',
          label: 'End Date',
          type: 'date',
          required: true,
          placeholder: 'Select End Date',
          description: 'End date of the report period'
        },
        {
          id: 'class',
          field: 'class',
          label: 'Class',
          type: 'select',
          required: true,
          dynamicOptions: {
            source: 'college',
            field: 'validClasses'
          },
          placeholder: 'Select Class',
          description: 'Select the class'
        }
      ],
      
      // Data Source Configuration
      dataSource: {
        collection: 'exams',
        type: 'violations-report',
        
        // Fields to include in the report
        fields: [
          {
            id: 'serialNumber',
            label: '#',
            type: 'number',
            width: 50
          },
          {
            id: 'examTitle',
            label: 'Exam Title',
            type: 'text',
            width: 250
          },
          {
            id: 'subject',
            label: 'Subject',
            type: 'text',
            width: 150
          },
          {
            id: 'examDate',
            label: 'Exam Date',
            type: 'text',
            width: 120
          },
          {
            id: 'examTime',
            label: 'Exam Time',
            type: 'text',
            width: 100
          },
          {
            id: 'studentsAttended',
            label: 'Students Attended',
            type: 'number',
            width: 150
          },
          {
            id: 'totalViolations',
            label: 'Total Violations',
            type: 'number',
            width: 150
          },
          {
            id: 'fullscreenExit',
            label: 'Fullscreen Exit',
            type: 'number',
            width: 130
          },
          {
            id: 'tabSwitch',
            label: 'Tab Switch',
            type: 'number',
            width: 120
          },
          {
            id: 'windowBlur',
            label: 'Window Blur',
            type: 'number',
            width: 120
          },
          {
            id: 'copyAttempt',
            label: 'Copy Attempt',
            type: 'number',
            width: 130
          },
          {
            id: 'rightClick',
            label: 'Right Click',
            type: 'number',
            width: 110
          },
          {
            id: 'consoleOpen',
            label: 'Console Open',
            type: 'number',
            width: 130
          },
          {
            id: 'highRiskStudents',
            label: 'High Risk Students',
            type: 'number',
            width: 150
          },
          {
            id: 'riskLevel',
            label: 'Risk Level',
            type: 'text',
            width: 120
          }
        ]
      },
      
      // Report Settings
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    try {
      await db.collection('reportTemplates').doc(violationsReport.id).set(violationsReport);
      console.log('✅ Exam-wise Violations Summary created successfully');
    } catch (error) {
      console.error('❌ Error creating Exam-wise Violations Summary:', error);
    }
    } else {
      console.log('⏭️  Exam-wise Violations Summary already exists, skipping...');
    }
    
    console.log('');
    
    // =================================================================
    // REPORT 5: TOP PERFORMERS LEADERBOARD
    // =================================================================
    
    console.log('📊 Report 5: Top Performers Leaderboard');
    
    const shouldCreateLeaderboard = await checkExistingReport(
      'template-top-performers-leaderboard',
      'Top Performers Leaderboard'
    );
    
    if (shouldCreateLeaderboard) {
    const leaderboardReport = {
      id: 'template-top-performers-leaderboard',
      name: 'Top Performers Leaderboard',
      description: 'Ranking of top performing students based on exam scores and attendance',
      type: 'leaderboard',
      category: 'academic',
      icon: 'faTrophy',
      
      // Special flag for custom processing
      customDataProcessor: 'leaderboard',
      
      // Filters Configuration
      filters: [
        {
          id: 'startDate',
          field: 'startDate',
          label: 'Start Date',
          type: 'date',
          required: true,
          placeholder: 'Select Start Date',
          description: 'Start date of the report period'
        },
        {
          id: 'endDate',
          field: 'endDate',
          label: 'End Date',
          type: 'date',
          required: true,
          placeholder: 'Select End Date',
          description: 'End date of the report period'
        },
        {
          id: 'class',
          field: 'class',
          label: 'Class (Optional)',
          type: 'select',
          required: false, // Optional - if not provided, shows top performers across all classes
          dynamicOptions: {
            source: 'college',
            field: 'validClasses'
          },
          placeholder: 'Select Class (Leave empty for all classes)',
          description: 'Leave empty to show top performers across all classes, or select a specific class'
        },
        {
          id: 'topN',
          field: 'topN',
          label: 'Top N Students',
          type: 'number',
          required: false,
          defaultValue: 100,
          placeholder: '100',
          description: 'Number of top students to show (default: 100)'
        }
      ],
      
      // Data Source Configuration
      dataSource: {
        collection: 'users',
        type: 'leaderboard-report',
        
        // Fields to include in the report
        fields: [
          {
            id: 'rank',
            label: 'Rank',
            type: 'number',
            width: 80
          },
          {
            id: 'studentName',
            label: 'Student Name',
            type: 'text',
            width: 200
          },
          {
            id: 'rollNumber',
            label: 'Roll No',
            type: 'text',
            width: 120
          },
          {
            id: 'class',
            label: 'Class',
            type: 'text',
            width: 100
          },
          {
            id: 'examsAttempted',
            label: 'Exams Attempted',
            type: 'number',
            width: 150
          },
          {
            id: 'examsAttended',
            label: 'Exams Attended',
            type: 'number',
            width: 150
          },
          {
            id: 'attendanceRate',
            label: 'Attendance %',
            type: 'percentage',
            width: 120
          },
          {
            id: 'totalObtained',
            label: 'Total Obtained',
            type: 'number',
            width: 130
          },
          {
            id: 'totalMaximum',
            label: 'Total Max',
            type: 'number',
            width: 120
          },
          {
            id: 'overallPercentage',
            label: 'Overall %',
            type: 'percentage',
            width: 110
          },
          {
            id: 'grade',
            label: 'Grade',
            type: 'text',
            width: 80
          },
          {
            id: 'highestScore',
            label: 'Highest %',
            type: 'percentage',
            width: 110
          },
          {
            id: 'lowestScore',
            label: 'Lowest %',
            type: 'percentage',
            width: 110
          },
          {
            id: 'averageScore',
            label: 'Average %',
            type: 'percentage',
            width: 110
          },
          {
            id: 'consistency',
            label: 'Consistency',
            type: 'text',
            width: 120
          }
        ]
      },
      
      // Report Settings
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    try {
      await db.collection('reportTemplates').doc(leaderboardReport.id).set(leaderboardReport);
      console.log('✅ Top Performers Leaderboard created successfully');
    } catch (error) {
      console.error('❌ Error creating Top Performers Leaderboard:', error);
    }
    } else {
      console.log('⏭️  Top Performers Leaderboard already exists, skipping...');
    }
    
    console.log('');
    
    // =================================================================
    // SUMMARY
    // =================================================================
    
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ SETUP COMPLETE!');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('📊 Reports Summary:');
    console.log('');
    
    if (shouldCreateExamResults) {
      console.log('✅ Exam Results Report - Mon YYYY');
      console.log('   ID: template-exam-results-academic-year');
      console.log('   Type: examResults');
      console.log('   Filters: 5 (Academic Year, Class, Subject, Exam Type, Exam Month)');
      console.log('   Output: 10 fields (includes Percentage & Grade)');
      console.log('');
    }
    
    if (shouldCreateAttendance) {
      console.log('✅ Exams Attendance Report - Mon YYYY');
      console.log('   ID: template-exams-attendance-report');
      console.log('   Type: attendance');
      console.log('   Filters: 6 (Academic Year, Class, Subject, Exam Type, Exam Month, Status)');
      console.log('   Output: 10 fields (includes Status & Duration)');
      console.log('');
    }
    
    if (!shouldCreateExamResults && !shouldCreateAttendance) {
      console.log('ℹ️  No reports were created (all were skipped)');
      console.log('');
    }
    
    console.log('🎯 Next Steps:');
    console.log('1. Verify templates appear in Firestore:');
    if (shouldCreateExamResults) {
      console.log('   - reportTemplates/template-exam-results-academic-year');
    }
    if (shouldCreateAttendance) {
      console.log('   - reportTemplates/template-exams-attendance-report');
    }
    console.log('');
    console.log('2. Ensure college document has required arrays:');
    console.log('   - validClasses');
    console.log('   - subjects');
    console.log('   - examTypes');
    console.log('   Run: node update_college_document.js (if needed)');
    console.log('');
    console.log('3. Test reports in your app:');
    console.log('   - Go to Reports page');
    console.log('   - Templates should appear');
    console.log('   - All filters should work');
    console.log('   - Generate test reports');
    console.log('');
    console.log('🎉 Setup complete!');
    
    // Close readline interface
    rl.close();
    
  } catch (error) {
    console.error('');
    console.error('❌ Error setting up reports:', error);
    rl.close();
    throw error;
  }
}

// Run the setup
setupAllReports()
  .then(() => {
    console.log('');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  });