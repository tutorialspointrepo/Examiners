interface Student {
  studentId: string;
  studentName: string;
  rollNumber: string;
  hasAttempt: boolean;
  attemptData?: any; // ✅ Changed to 'any' to accept ALL Firebase fields including responses
}

interface ExportData {
  selectedExam: any;
  brandTheme: any;
  presentStudents: Student[];
  absentStudents: Student[];
  totalStudents: number;
}

// ✅ Helper functions to calculate marks from responses array
function getObtainedMarks(attemptData: any): number {
  // Priority 1: Use pre-calculated if exists
  if (attemptData?.obtainedMarks != null) {
    return Number(attemptData.obtainedMarks);
  }
  
  // Priority 2: Calculate from responses array
  if (Array.isArray(attemptData?.responses)) {
    let totalMarks = 0;
    attemptData.responses.forEach((response: any) => {
      let questionMarks = 0;
      if (response.marksAwarded != null && response.marksAwarded !== '') {
        questionMarks = Number(response.marksAwarded);
      } else if (response.aiSuggestedMarks != null && response.aiSuggestedMarks !== '') {
        questionMarks = Number(response.aiSuggestedMarks);
      } else if (response.scoredMarks != null && response.scoredMarks !== '') {
        questionMarks = Number(response.scoredMarks);
      } else if (response.feedback?.suggestedMarks != null) {
        questionMarks = Number(response.feedback.suggestedMarks);
      }
      if (!isNaN(questionMarks)) {
        totalMarks += questionMarks;
      }
    });
    return totalMarks;
  }
  
  return 0;
}

function getTotalScore(attemptData: any, exam?: any): number {
  // ✅ Priority 1: Calculate from exam config (source of truth, includes pool questions)
  if (exam) {
    const examTotal = getExamTotalMarks(exam);
    if (examTotal > 0) return examTotal;
  }
  
  if (attemptData?.totalScore != null) {
    return Number(attemptData.totalScore);
  }
  if (attemptData?.maximumScore != null) {
    return Number(attemptData.maximumScore);
  }
  
  if (Array.isArray(attemptData?.responses)) {
    let totalMarks = 0;
    attemptData.responses.forEach((response: any) => {
      let questionMax = 0;
      if (response.maxMarks != null) {
        questionMax = Number(response.maxMarks);
      } else if (response.maximumMarks != null) {
        questionMax = Number(response.maximumMarks);
      }
      if (!isNaN(questionMax)) {
        totalMarks += questionMax;
      }
    });
    return totalMarks;
  }
  
  return 0;
}

// ✅ Calculate total marks from exam config (includes pool questions)
function getExamTotalMarks(exam: any): number {
  let total = 0;
  if (exam?.questionsList && Array.isArray(exam.questionsList) && exam.questionsList.length > 0) {
    total = exam.questionsList.reduce((sum: number, q: any) => {
      return sum + Number(q.maximumMarks || q.marks || 0);
    }, 0);
  }
  if (exam?.pickRandomCount && exam?.poolQuestionMarks) {
    total += Number(exam.pickRandomCount) * Number(exam.poolQuestionMarks);
  }
  if (total === 0 && exam?.maxMarks) {
    const marks = parseFloat(String(exam.maxMarks));
    if (!isNaN(marks) && marks > 0) return marks;
  }
  return total;
}

// ✅ Get total question count from exam config (includes pool)
function getExamTotalQuestions(exam: any): number {
  const listCount = exam?.questionsList?.length || 0;
  const poolCount = Number(exam?.pickRandomCount) || 0;
  return listCount + poolCount;
}

function getPercentage(attemptData: any, exam?: any): number {
  const obtained = getObtainedMarks(attemptData);
  const total = getTotalScore(attemptData, exam);
  return total > 0 ? (obtained / total) * 100 : 0;
}

// ✅ Get violation count from per-response violations (not global violations array)
function getViolationCount(attemptData: any): number {
  if (Array.isArray(attemptData?.responses)) {
    return attemptData.responses.reduce((sum: number, r: any) => {
      return sum + (Array.isArray(r.violations) ? r.violations.length : 0);
    }, 0);
  }
  if (typeof attemptData?.violationCount === 'number') {
    return attemptData.violationCount;
  }
  if (Array.isArray(attemptData?.violations)) {
    return attemptData.violations.length;
  }
  return 0;
}

/**
 * Exact replica of dashboard UI in Excel - Full Width Version
 */
export async function exportStyledDashboardBrowser(data: ExportData): Promise<void> {
  console.log('🔍 exportStyledDashboardBrowser called with data:', {
    hasSelectedExam: !!data.selectedExam,
    selectedExamName: data.selectedExam?.name,
    selectedExamQuestions: data.selectedExam?.questionsList?.length,
    presentStudents: data.presentStudents?.length,
    dataKeys: Object.keys(data)
  });
  let ExcelJS: any;
  try {
    ExcelJS = (await import('exceljs')).default;
  } catch (err) {
    console.error('❌ Failed to load ExcelJS library:', err);
    alert('Excel export failed to load. Please refresh the page and try again. If the issue persists, clear your browser cache.');
    return;
  }
  const { selectedExam, presentStudents, absentStudents, totalStudents, brandTheme } = data;
  
  console.log('🔍 After destructuring:');
  console.log('   selectedExam:', !!selectedExam);
  console.log('   selectedExam.questionsList:', selectedExam?.questionsList?.length);
  
  // Calculate metrics
  const submittedStudents = presentStudents.filter(s => s.hasAttempt && s.attemptData);
  const attendanceRate = totalStudents > 0 ? Math.round((presentStudents.length / totalStudents) * 100) : 0;
  const submissionCount = submittedStudents.length;
  const submissionRate = presentStudents.length > 0 ? Math.round((submissionCount / presentStudents.length) * 100) : 0;
  
  const avgScore = submittedStudents.length > 0 
    ? submittedStudents.reduce((sum, s) => sum + getPercentage(s.attemptData, selectedExam), 0) / submittedStudents.length 
    : 0;
  
  const highestScore = submittedStudents.length > 0 
    ? Math.max(...submittedStudents.map(s => getPercentage(s.attemptData, selectedExam))) 
    : 0;
  
  const passCount = submittedStudents.filter(s => getPercentage(s.attemptData, selectedExam) >= 40).length;
  const passRate = submittedStudents.length > 0 ? Math.round((passCount / submittedStudents.length) * 100) : 0;
  
  const excellent = submittedStudents.filter(s => getPercentage(s.attemptData, selectedExam) >= 90).length;
  const good = submittedStudents.filter(s => getPercentage(s.attemptData, selectedExam) >= 75 && getPercentage(s.attemptData, selectedExam) < 90).length;
  const average = submittedStudents.filter(s => getPercentage(s.attemptData, selectedExam) >= 60 && getPercentage(s.attemptData, selectedExam) < 75).length;
  const poor = submittedStudents.filter(s => getPercentage(s.attemptData, selectedExam) < 60).length;
  
  const totalViolations = submittedStudents.reduce((sum, s) => sum + getViolationCount(s.attemptData), 0);
  const studentsWithViolations = submittedStudents.filter(s => getViolationCount(s.attemptData) > 0).length;
  const cleanExams = submittedStudents.length - studentsWithViolations;
  const avgViolationsPerStudent = submittedStudents.length > 0 ? (totalViolations / submittedStudents.length).toFixed(1) : '0';
  
  const topPerformers = submittedStudents
    .sort((a, b) => getPercentage(b.attemptData, selectedExam) - getPercentage(a.attemptData, selectedExam))
    .slice(0, 5);

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Dashboard', {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  // Set column widths - FULL WIDTH (13 columns)
  worksheet.columns = [
    { width: 4 },   // A - Left padding/margin
    { width: 12 },  // B - Col 1
    { width: 12 },  // C - Col 2  
    { width: 12 },  // D - Col 3
    { width: 12 },  // E - Col 4
    { width: 12 },  // F - Col 5
    { width: 12 },  // G - Col 6
    { width: 12 },  // H - Col 7
    { width: 12 },  // I - Col 8
    { width: 12 },  // J - Col 9
    { width: 12 },  // K - Col 10
    { width: 12 },  // L - Col 11
    { width: 12 },  // M - Col 12
    { width: 4 }    // N - Right padding/margin
  ];

  // Colors
  const PRIMARY_COLOR = brandTheme?.colors?.primary?.replace('#', '') || '4A90E2';
  const GREEN = '27AE60';
  const RED = 'E74C3C';
  const ORANGE = 'F39C12';
  const BLUE = '3498DB';

  let row = 3;  // Start from row 3 for top margin

  // EXAM NAME AT TOP (CENTERED)
  worksheet.mergeCells(row, 2, row, 13);
  const examNameCell = worksheet.getCell(row, 2);
  examNameCell.value = selectedExam?.name || selectedExam?.title || 'Exam Dashboard';
  examNameCell.font = { name: 'Segoe UI', size: 28, bold: true, color: { argb: 'FF' + PRIMARY_COLOR } };
  examNameCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 45;
  row += 1;

  // SUBTITLE (Class and Subject)
  worksheet.mergeCells(row, 2, row, 13);
  const subtitleCell = worksheet.getCell(row, 2);
  subtitleCell.value = `${selectedExam?.class || ''} | ${selectedExam?.subject || ''}`;
  subtitleCell.font = { name: 'Segoe UI', size: 14, color: { argb: 'FF404040' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 25;
  row += 2;

  // Helper to create metric card
  const createCard = (startRow: number, startCol: number, icon: string, iconBg: string, value: any, label: string, detail: string, colSpan: number = 4, hasProgressBar: boolean = false) => {
    const endCol = startCol + colSpan - 1;
    
    // White background
    for (let r = startRow; r < startRow + 5; r++) {
      for (let c = startCol; c <= endCol; c++) {
        worksheet.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      }
    }

    // Icon with colored background
    worksheet.mergeCells(startRow, startCol, startRow + 1, startCol);
    const iconCell = worksheet.getCell(startRow, startCol);
    iconCell.value = icon;
    iconCell.font = { name: 'Segoe UI', size: 20 };
    iconCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + iconBg } };
    iconCell.alignment = { horizontal: 'center', vertical: 'middle' };
    iconCell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    // Large value
    worksheet.mergeCells(startRow, startCol + 1, startRow + 1, endCol);
    const valueCell = worksheet.getCell(startRow, startCol + 1);
    valueCell.value = value;
    valueCell.font = { name: 'Segoe UI', size: 48, bold: true };
    valueCell.alignment = { horizontal: 'right', vertical: 'middle' };
    valueCell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    // Label
    worksheet.mergeCells(startRow + 2, startCol, startRow + 2, endCol);
    const labelCell = worksheet.getCell(startRow + 2, startCol);
    labelCell.value = label;
    labelCell.font = { name: 'Segoe UI', size: 11, color: { argb: 'FF666666' } };
    labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
    labelCell.border = {
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    // Progress bar or empty space
    if (hasProgressBar) {
      worksheet.mergeCells(startRow + 3, startCol, startRow + 3, endCol);
      const barCell = worksheet.getCell(startRow + 3, startCol);
      barCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27AE60' } };
      barCell.border = {
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
      };
      worksheet.getRow(startRow + 3).height = 6;
    } else {
      worksheet.mergeCells(startRow + 3, startCol, startRow + 3, endCol);
      const emptyCell = worksheet.getCell(startRow + 3, startCol);
      emptyCell.border = {
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
      };
    }

    // Detail text
    worksheet.mergeCells(startRow + 4, startCol, startRow + 4, endCol);
    const detailCell = worksheet.getCell(startRow + 4, startCol);
    detailCell.value = detail;
    
    // Check if detail contains "Present" and "Absent" to color them
    if (detail.includes('Present') && detail.includes('Absent')) {
      detailCell.font = { name: 'Segoe UI', size: 10 };
      detailCell.value = { 
        richText: [
          { text: `${presentStudents.length} Present`, font: { color: { argb: 'FF27AE60' }, bold: true } },
          { text: '     ', font: { color: { argb: 'FF666666' } } },
          { text: `${absentStudents.length} Absent`, font: { color: { argb: 'FFDC3545' }, bold: true } }
        ]
      };
    } else {
      detailCell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF666666' } };
    }
    
    detailCell.alignment = { horizontal: 'center', vertical: 'middle' };
    detailCell.border = {
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    worksheet.getRow(startRow).height = 30;
    worksheet.getRow(startRow + 1).height = 30;
    worksheet.getRow(startRow + 2).height = 20;
    worksheet.getRow(startRow + 4).height = 22;
  };

  // ROW 1: Three cards (4 columns each)
  createCard(row, 2, '👥', 'E3F2FD', totalStudents, 'Total Students', `${presentStudents.length} Present | ${absentStudents.length} Absent`, 4);
  createCard(row, 6, '✓', 'C8E6C9', `${attendanceRate}%`, 'Attendance Rate', '', 4, true);
  createCard(row, 10, '📋', 'BBDEFB', submissionCount, 'Submissions', `${submissionRate}% of present`, 4);
  row += 6;

  // ROW 2: Three cards (4 columns each)
  createCard(row, 2, '🎖', 'FFF9C4', `${avgScore.toFixed(2)}%`, 'Average Score', '', 4);
  createCard(row, 6, '🏆', 'E1BEE7', `${highestScore.toFixed(2)}%`, 'Highest Score', 'Top performer', 4);
  createCard(row, 10, '✓', 'C8E6C9', `${passRate}%`, 'Pass Rate', `${passCount} of ${submittedStudents.length}`, 4);
  row += 7;

  // PERFORMANCE DISTRIBUTION
  worksheet.mergeCells(row, 2, row, 13);
  const perfHeader = worksheet.getCell(row, 2);
  perfHeader.value = 'Performance Distribution';
  perfHeader.font = { name: 'Segoe UI', size: 18, bold: true };
  perfHeader.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(row).height = 35;
  row += 1;

  const distData = [
    ['Excellent (90-100%)', excellent, GREEN],
    ['Good (75-89%)', good, BLUE],
    ['Average (60-74%)', average, ORANGE],
    ['Needs Improvement (<60%)', poor, RED]
  ];

  const totalDistCount = submittedStudents.length || 1;

  for (const [category, count, color] of distData) {
    const pct = ((count as number) / totalDistCount * 100);
    
    // Category label
    worksheet.mergeCells(row, 2, row, 8);
    worksheet.getCell(row, 2).value = category;
    worksheet.getCell(row, 2).font = { name: 'Segoe UI', size: 12 };
    worksheet.getCell(row, 2).alignment = { horizontal: 'left', vertical: 'middle' };
    
    // Count on right
    worksheet.mergeCells(row, 9, row, 13);
    worksheet.getCell(row, 9).value = `${count} students`;
    worksheet.getCell(row, 9).font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF' + color } };
    worksheet.getCell(row, 9).alignment = { horizontal: 'right', vertical: 'middle' };
    
    // Progress bar — fill each cell individually (merged cells ignore individual fills)
    const barStart = 2;
    const barEnd = 13;
    const barTotalCols = barEnd - barStart + 1;
    const barFillCols = Math.max(Math.round(barTotalCols * (pct / 100)), (count as number) > 0 ? 1 : 0);
    
    for (let c = barStart; c <= barEnd; c++) {
      const isFilled = c < barStart + barFillCols;
      worksheet.getCell(row + 1, c).fill = { 
        type: 'pattern', pattern: 'solid', 
        fgColor: { argb: isFilled ? 'FF' + color : 'FFE8E8E8' } 
      };
    }
    
    worksheet.getRow(row).height = 25;
    worksheet.getRow(row + 1).height = 6;
    row += 3;
  }
  row += 1;

  // VIOLATIONS SUMMARY
  worksheet.mergeCells(row, 2, row, 13);
  const violHeader = worksheet.getCell(row, 2);
  violHeader.value = '🛡 Violations Summary';
  violHeader.font = { name: 'Segoe UI', size: 18, bold: true };
  violHeader.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(row).height = 35;
  row += 2;

  const violations = [
    ['Total Violations', totalViolations, RED, 'FCE4EC'],
    ['Students Flagged', studentsWithViolations, ORANGE, 'FFF3E0'],
    ['Clean Exams', cleanExams, GREEN, 'E8F5E9'],
    ['Avg per Student', avgViolationsPerStudent, BLUE, 'E3F2FD']
  ];

  let violCol = 2;
  for (const [label, value, color, bgColor] of violations) {
    // Each violation takes 2.5 columns
    const endCol = violCol + 1;
    
    // Background
    for (let r = row; r < row + 3; r++) {
      for (let c = violCol; c <= endCol; c++) {
        worksheet.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgColor } };
        worksheet.getCell(r, c).border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };
      }
    }
    
    // Value
    worksheet.mergeCells(row, violCol, row, endCol);
    worksheet.getCell(row, violCol).value = value;
    worksheet.getCell(row, violCol).font = { name: 'Segoe UI', size: 36, bold: true, color: { argb: 'FF' + color } };
    worksheet.getCell(row, violCol).alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Label
    worksheet.mergeCells(row + 2, violCol, row + 2, endCol);
    worksheet.getCell(row + 2, violCol).value = label;
    worksheet.getCell(row + 2, violCol).font = { name: 'Segoe UI', size: 10, color: { argb: 'FF666666' } };
    worksheet.getCell(row + 2, violCol).alignment = { horizontal: 'center', vertical: 'middle' };
    
    violCol += 3; // Space between boxes
  }
  
  worksheet.getRow(row).height = 40;
  worksheet.getRow(row + 1).height = 10;
  worksheet.getRow(row + 2).height = 25;
  row += 5;

  // TOP PERFORMERS
  worksheet.mergeCells(row, 2, row, 13);
  const topHeader = worksheet.getCell(row, 2);
  topHeader.value = '🏆 Top Performers';
  topHeader.font = { name: 'Segoe UI', size: 18, bold: true };
  topHeader.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(row).height = 35;
  row += 2;

  if (topPerformers.length === 0) {
    worksheet.mergeCells(row, 2, row, 13);
    worksheet.getCell(row, 2).value = 'No submissions yet';
    worksheet.getCell(row, 2).font = { name: 'Segoe UI', size: 11, italic: true, color: { argb: 'FF999999' } };
    worksheet.getCell(row, 2).alignment = { horizontal: 'center' };
  } else {
    const rankBgColors = ['FFF9C4', 'E0E0E0', 'FFE0B2', 'E3F2FD', 'E3F2FD'];
    
    for (let i = 0; i < topPerformers.length; i++) {
      const student = topPerformers[i];
      
      // White background for row
      for (let c = 2; c <= 11; c++) {
        worksheet.getCell(row, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        worksheet.getCell(row + 1, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        
        // Subtle borders
        worksheet.getCell(row, c).border = {
          top: { style: 'thin', color: { argb: 'FFF0F0F0' } },
          left: c === 3 ? { style: 'thin', color: { argb: 'FFF0F0F0' } } : undefined,
          right: c === 11 ? { style: 'thin', color: { argb: 'FFF0F0F0' } } : undefined
        };
        worksheet.getCell(row + 1, c).border = {
          bottom: { style: 'thin', color: { argb: 'FFF0F0F0' } },
          left: c === 3 ? { style: 'thin', color: { argb: 'FFF0F0F0' } } : undefined,
          right: c === 11 ? { style: 'thin', color: { argb: 'FFF0F0F0' } } : undefined
        };
      }
      
      // Rank badge
      worksheet.mergeCells(row, 3, row + 1, 3);
      worksheet.getCell(row, 3).value = i + 1;
      worksheet.getCell(row, 3).font = { name: 'Segoe UI', size: 18, bold: true };
      worksheet.getCell(row, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + rankBgColors[i] } };
      worksheet.getCell(row, 3).alignment = { horizontal: 'center', vertical: 'middle' };
      
      // Student name
      worksheet.mergeCells(row, 4, row, 10);
      worksheet.getCell(row, 4).value = student.studentName;
      worksheet.getCell(row, 4).font = { name: 'Segoe UI', size: 14, bold: true };
      worksheet.getCell(row, 4).alignment = { horizontal: 'left', vertical: 'middle' };
      
      // Roll number
      worksheet.mergeCells(row + 1, 4, row + 1, 10);
      worksheet.getCell(row + 1, 4).value = `Roll: ${student.rollNumber}`;
      worksheet.getCell(row + 1, 4).font = { name: 'Segoe UI', size: 10, color: { argb: 'FF999999' } };
      worksheet.getCell(row + 1, 4).alignment = { horizontal: 'left', vertical: 'middle' };
      
      // Score
      worksheet.mergeCells(row, 11, row, 13);
      worksheet.getCell(row, 11).value = `${getPercentage(student.attemptData, selectedExam).toFixed(2)}%`;
      worksheet.getCell(row, 11).font = { name: 'Segoe UI', size: 18, bold: true, color: { argb: 'FF' + PRIMARY_COLOR } };
      worksheet.getCell(row, 11).alignment = { horizontal: 'right', vertical: 'middle' };
      
      // Marks
      worksheet.mergeCells(row + 1, 11, row + 1, 13);
      const obtained = getObtainedMarks(student.attemptData);
      const total = getTotalScore(student.attemptData, selectedExam);
      worksheet.getCell(row + 1, 11).value = `${obtained}/${total}`;
      worksheet.getCell(row + 1, 11).font = { name: 'Segoe UI', size: 10, color: { argb: 'FF999999' } };
      worksheet.getCell(row + 1, 11).alignment = { horizontal: 'right', vertical: 'middle' };
      
      worksheet.getRow(row).height = 25;
      worksheet.getRow(row + 1).height = 20;
      row += 3;
    }
  }


  // Add border around entire dashboard
  const dashboardStartRow = 3;
  const dashboardEndRow = row + 1;
  const dashboardStartCol = 2;
  const dashboardEndCol = 13;

  // Add thick border around entire dashboard
  for (let c = dashboardStartCol; c <= dashboardEndCol; c++) {
    // Top border
    const topCell = worksheet.getCell(dashboardStartRow, c);
    topCell.border = {
      ...topCell.border,
      top: { style: 'medium', color: { argb: 'FF404040' } }
    };
    
    // Bottom border
    const bottomCell = worksheet.getCell(dashboardEndRow, c);
    bottomCell.border = {
      ...bottomCell.border,
      bottom: { style: 'medium', color: { argb: 'FF404040' } }
    };
  }

  // Left and right borders
  for (let r = dashboardStartRow; r <= dashboardEndRow; r++) {
    // Left border
    const leftCell = worksheet.getCell(r, dashboardStartCol);
    leftCell.border = {
      ...leftCell.border,
      left: { style: 'medium', color: { argb: 'FF404040' } }
    };
    
    // Right border
    const rightCell = worksheet.getCell(r, dashboardEndCol);
    rightCell.border = {
      ...rightCell.border,
      right: { style: 'medium', color: { argb: 'FF404040' } }
    };
  }

  // Add Question Details sheet (Sheet 2)
  await addQuestionDetailsSheet(workbook, selectedExam, PRIMARY_COLOR);

  // Add Question-wise Performance sheet (Sheet 3)
  await addQuestionwisePerformanceSheet(workbook, selectedExam, presentStudents, PRIMARY_COLOR);

  // Add Exam Performance sheet (Sheet 4)
  addExamPerformanceSheet(workbook, selectedExam, presentStudents, absentStudents, totalStudents, PRIMARY_COLOR);

  // Add Personality Assessment sheet — only if exam has personality assessment
  if (selectedExam?.personalityAssessment && selectedExam?.likertQuestions?.length > 0) {
    addPersonalityAssessmentSheet(workbook, selectedExam, presentStudents, PRIMARY_COLOR);
  }

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${selectedExam?.name || 'Exam'}_Dashboard_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);

  console.log('Dashboard exported successfully!');
}

/**
 * Sheet 2: Question Details
 * Shows all questions with their properties
 */
async function addQuestionDetailsSheet(workbook: any, selectedExam: any, PRIMARY_COLOR: string) {
  console.log('🔍 Sheet 2: Question Details');
  console.log('   selectedExam:', selectedExam);
  console.log('   selectedExam keys:', selectedExam ? Object.keys(selectedExam) : 'null');
  console.log('   questionsList:', selectedExam?.questionsList);
  console.log('   questionsList length:', selectedExam?.questionsList?.length || 0);
  
  const worksheet = workbook.addWorksheet('Question Details', {
    views: [{ showGridLines: false }]
  });

  // Column widths
  worksheet.columns = [
    { width: 18 },  // A - Question ID
    { width: 18 },  // B - Question Type
    { width: 15 },  // C - Maximum Marks
    { width: 15 },  // D - Difficulty Level
    { width: 20 },  // E - Chapter
    { width: 55 }   // F - Question Detail
  ];

  let row = 2;

  // Header
  worksheet.mergeCells(row, 1, row, 6);
  const headerCell = worksheet.getCell(row, 1);
  headerCell.value = 'QUESTION DETAILS';
  headerCell.font = { name: 'Segoe UI', size: 20, bold: true, color: { argb: 'FF' + PRIMARY_COLOR } };
  headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 35;
  row += 2;

  // Exam info
  worksheet.mergeCells(row, 1, row, 6);
  const examInfoCell = worksheet.getCell(row, 1);
  examInfoCell.value = `Exam: ${selectedExam?.name || 'N/A'}`;
  examInfoCell.font = { name: 'Segoe UI', size: 11, color: { argb: 'FF666666' } };
  examInfoCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 22;
  row += 2;

  // Table Headers (removed Class and Subject)
  const headers = ['Question ID', 'Question Type', 'Maximum Marks', 'Difficulty Level', 'Chapter', 'Question Detail'];
  for (let i = 0; i < headers.length; i++) {
    const cell = worksheet.getCell(row, i + 1);
    cell.value = headers[i];
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PRIMARY_COLOR } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
    };
  }
  worksheet.getRow(row).height = 30;
  row++;

  // Get questions from exam
  const questions = selectedExam?.questionsList || [];
  const totalCols = 6; // Updated column count
  let questionIndex = 0;
  
  // Helper to write a question row
  const writeQuestionRow = (qData: { id: string; type: string; marks: number; difficulty: string; chapter: string; detail: string; isPool?: boolean }, rowNum: number) => {
    const bgColor = questionIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF8F9FA';
    const typeLabels: any = {
      mcq: 'Multiple Choice',
      fillInTheBlank: 'Fill in the Blank',
      jumbledQuiz: 'Jumbled Quiz',
      descriptive: 'Descriptive',
      code: 'Coding'
    };

    // Question ID (col 1)
    worksheet.getCell(rowNum, 1).value = qData.id;
    worksheet.getCell(rowNum, 1).font = { name: 'Segoe UI', size: 10, bold: true };
    worksheet.getCell(rowNum, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    worksheet.getCell(rowNum, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Question Type (col 2)
    worksheet.getCell(rowNum, 2).value = typeLabels[qData.type] || qData.type || 'N/A';
    worksheet.getCell(rowNum, 2).font = { name: 'Segoe UI', size: 10 };
    worksheet.getCell(rowNum, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    worksheet.getCell(rowNum, 2).alignment = { horizontal: 'center', vertical: 'middle' };

    // Maximum Marks (col 3)
    worksheet.getCell(rowNum, 3).value = qData.marks;
    worksheet.getCell(rowNum, 3).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + PRIMARY_COLOR } };
    worksheet.getCell(rowNum, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    worksheet.getCell(rowNum, 3).alignment = { horizontal: 'center', vertical: 'middle' };

    // Difficulty Level (col 4)
    worksheet.getCell(rowNum, 4).value = qData.difficulty;
    const difficultyColor = qData.difficulty === 'Easy' ? '27AE60' : qData.difficulty === 'Hard' ? 'E74C3C' : 'F39C12';
    worksheet.getCell(rowNum, 4).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + difficultyColor } };
    worksheet.getCell(rowNum, 4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    worksheet.getCell(rowNum, 4).alignment = { horizontal: 'center', vertical: 'middle' };

    // Chapter (col 5)
    worksheet.getCell(rowNum, 5).value = qData.chapter;
    worksheet.getCell(rowNum, 5).font = { name: 'Segoe UI', size: 10 };
    worksheet.getCell(rowNum, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    worksheet.getCell(rowNum, 5).alignment = { horizontal: 'center', vertical: 'middle' };

    // Question Detail (col 6)
    let detail = qData.detail;
    detail = detail.replace(/<[^>]*>/g, '');
    if (detail.length > 200) detail = detail.substring(0, 197) + '...';
    worksheet.getCell(rowNum, 6).value = detail;
    worksheet.getCell(rowNum, 6).font = { name: 'Segoe UI', size: 10 };
    worksheet.getCell(rowNum, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    worksheet.getCell(rowNum, 6).alignment = { horizontal: 'left', vertical: 'top', wrapText: true };

    // Add borders
    for (let col = 1; col <= totalCols; col++) {
      worksheet.getCell(rowNum, col).border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
      };
    }
    worksheet.getRow(rowNum).height = 30;
    questionIndex++;
  };
  
  if (questions.length === 0 && (!selectedExam?.questionPool || selectedExam.questionPool.length === 0)) {
    worksheet.mergeCells(row, 1, row, totalCols);
    worksheet.getCell(row, 1).value = 'No questions found for this exam';
    worksheet.getCell(row, 1).font = { name: 'Segoe UI', size: 11, italic: true, color: { argb: 'FF999999' } };
    worksheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(row).height = 30;
  } else {
    // Add regular questions from questionsList
    questions.forEach((question: any) => {
      writeQuestionRow({
        id: question.id || question.questionId || `Q${questionIndex + 1}`,
        type: question.type || 'mcq',
        marks: question.maximumMarks || question.marks || 0,
        difficulty: question.difficulty || question.difficultyLevel || 'Medium',
        chapter: question.chapter || question.topic || 'N/A',
        detail: question.questionText || question.question || 'N/A'
      }, row);
      row++;
    });

    // ✅ Add pool questions (random questions assigned per student)
    const poolQuestions = selectedExam?.questionPool || [];
    const pickCount = Number(selectedExam?.pickRandomCount) || 0;
    const poolMarks = Number(selectedExam?.poolQuestionMarks) || 0;
    
    if (poolQuestions.length > 0 && pickCount > 0) {
      // Add a separator row for pool questions
      row++;
      worksheet.mergeCells(row, 1, row, totalCols);
      const poolHeaderCell = worksheet.getCell(row, 1);
      poolHeaderCell.value = `★ Pool Questions (${pickCount} randomly assigned per student from a pool of ${poolQuestions.length}, ${poolMarks} marks each)`;
      poolHeaderCell.font = { name: 'Segoe UI', size: 10, bold: true, italic: true, color: { argb: 'FF8B5CF6' } };
      poolHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F0FF' } };
      poolHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
      poolHeaderCell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } }
      };
      worksheet.getRow(row).height = 25;
      row++;

      // List each pool question without ID
      poolQuestions.forEach((pq: any, idx: number) => {
        writeQuestionRow({
          id: `Pool Q${idx + 1}`,
          type: pq.type || 'code',
          marks: poolMarks || pq.maximumMarks || pq.marks || 0,
          difficulty: pq.difficulty || pq.difficultyLevel || 'Medium',
          chapter: pq.chapter || pq.topic || 'N/A',
          detail: `[Pool Question] ${pq.questionText || pq.question || pq.title || 'Random pool question'}`
        }, row);
        row++;
      });
    }

    // Add thick border around entire data table
    const headerRow = 6; // Row where table headers start
    const lastDataRow = row - 1;

    // Top border (thick) - on header row
    for (let col = 1; col <= 6; col++) {
      const cell = worksheet.getCell(headerRow, col);
      cell.border = {
        ...cell.border,
        top: { style: 'medium', color: { argb: 'FF000000' } }
      };
    }

    // Bottom border (thick) - on last data row
    for (let col = 1; col <= 6; col++) {
      const cell = worksheet.getCell(lastDataRow, col);
      cell.border = {
        ...cell.border,
        bottom: { style: 'medium', color: { argb: 'FF000000' } }
      };
    }

    // Left border (thick) - on first column
    for (let r = headerRow; r <= lastDataRow; r++) {
      const cell = worksheet.getCell(r, 1);
      cell.border = {
        ...cell.border,
        left: { style: 'medium', color: { argb: 'FF000000' } }
      };
    }

    // Right border (thick) - on last column
    for (let r = headerRow; r <= lastDataRow; r++) {
      const cell = worksheet.getCell(r, 6);
      cell.border = {
        ...cell.border,
        right: { style: 'medium', color: { argb: 'FF000000' } }
      };
    }

    // Summary
    row += 1;
    worksheet.mergeCells(row, 1, row, 6);
    const summaryCell = worksheet.getCell(row, 1);
    summaryCell.value = `Total Questions: ${getExamTotalQuestions(selectedExam) || questions.length}`;
    summaryCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF666666' } };
    summaryCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(row).height = 25;
  }
}

/**
 * Sheet 3: Question-wise Performance
 * Shows each student's performance on each question
 */
async function addQuestionwisePerformanceSheet(workbook: any, selectedExam: any, presentStudents: Student[], PRIMARY_COLOR: string) {
  console.log('🔍 Sheet 3: Question-wise Performance');
  console.log('   Present students:', presentStudents.length);
  console.log('   Questions:', selectedExam?.questionsList?.length || 0);
  
  if (presentStudents.length > 0) {
    const firstStudent = presentStudents[0];
    console.log('   First student:', {
      name: firstStudent.studentName,
      hasAttempt: firstStudent.hasAttempt,
      hasAttemptData: !!firstStudent.attemptData
    });
    
    if (firstStudent.attemptData) {
      const attemptData = firstStudent.attemptData as any;
      console.log('   First student attemptData has:');
      console.log('     - answers:', attemptData.answers?.length || 0);
      console.log('     - responses:', attemptData.responses?.length || 0);
      console.log('     - questionResponses:', attemptData.questionResponses?.length || 0);
      console.log('     - enterIPAddress:', attemptData.enterIPAddress || 'N/A');
      console.log('     - browser:', attemptData.browser || 'N/A');
    }
  }
  
  const worksheet = workbook.addWorksheet('Question-wise Performance', {
    views: [{ showGridLines: false }]
  });

  // Column widths (Class removed)
  worksheet.columns = [
    { width: 15 },  // A - Roll Number
    { width: 20 },  // B - Student Name
    { width: 18 },  // C - Enter IP Address
    { width: 18 },  // D - Exit IP Address
    { width: 12 },  // E - Total Activities
    { width: 12 },  // F - Enter Count
    { width: 12 },  // G - Exit Count
    { width: 15 },  // H - OS
    { width: 15 },  // I - Browser
    { width: 15 },  // J - Question ID
    { width: 18 },  // K - Question Type
    { width: 15 },  // L - Maximum Marks
    { width: 15 },  // M - Difficulty Level
    { width: 15 },  // N - Obtained Marks
    { width: 12 },  // O - Violations Count
    { width: 40 },  // P - Violation Details
    { width: 12 },  // Q - Time Spent
    { width: 15 },  // R - Revisit Count
    { width: 15 }   // S - Attempt Count
  ];

  let row = 2;

  // Header
  worksheet.mergeCells(row, 1, row, 19);
  const headerCell = worksheet.getCell(row, 1);
  headerCell.value = 'QUESTION-WISE PERFORMANCE';
  headerCell.font = { name: 'Segoe UI', size: 20, bold: true, color: { argb: 'FF' + PRIMARY_COLOR } };
  headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 35;
  row += 2;

  // Exam info
  worksheet.mergeCells(row, 1, row, 19);
  const examInfoCell = worksheet.getCell(row, 1);
  examInfoCell.value = `Exam: ${selectedExam?.name || 'N/A'}`;
  examInfoCell.font = { name: 'Segoe UI', size: 11, color: { argb: 'FF666666' } };
  examInfoCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 22;
  row += 2;

  // Table Headers
  const headers = [
    'Roll Number', 'Student Name', 'Enter IP Address', 'Exit IP Address', 
    'Total Activities', 'Enter Count', 'Exit Count', 'OS', 'Browser', 'Question ID', 'Question Type', 
    'Maximum Marks', 'Difficulty Level', 'Obtained Marks', 'Violations Count', 
    'Violation Details', 'Time Spent (sec)', 'Revisit Count', 'Attempt Count'
  ];
  
  for (let i = 0; i < headers.length; i++) {
    const cell = worksheet.getCell(row, i + 1);
    cell.value = headers[i];
    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PRIMARY_COLOR } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
    };
  }
  worksheet.getRow(row).height = 35;
  row++;

  const questions = selectedExam?.questionsList || [];
  
  if (presentStudents.length === 0 || questions.length === 0) {
    worksheet.mergeCells(row, 1, row, 19);
    worksheet.getCell(row, 1).value = 'No data available';
    worksheet.getCell(row, 1).font = { name: 'Segoe UI', size: 11, italic: true, color: { argb: 'FF999999' } };
    worksheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(row).height = 30;
  } else {
    let dataRowIndex = 0;
    
    // For each student who submitted
    for (const student of presentStudents) {
      if (!student.hasAttempt || !student.attemptData) continue;

      const attemptData = student.attemptData as any;
      
      // Student session info (same for all their questions)
      const sessionData = {
        enterIP: attemptData.enterIPAddress || attemptData.ipAddress || 'N/A',
        exitIP: attemptData.exitIPAddress || attemptData.ipAddress || 'N/A',
        totalEntries: attemptData.totalEntries || 0,
        enterCount: attemptData.enterCount || 0,  // ✅ NEW
        exitCount: attemptData.exitCount || 0,    // ✅ NEW
        os: attemptData.operatingSystem || attemptData.os || 'N/A',
        browser: attemptData.browser || 'N/A'
      };

      // ✅ FIXED: Loop through STUDENT'S ACTUAL RESPONSES instead of exam's questionsList
      // This ensures we show only what the student actually answered (including pool questions)
      const responsesArray = attemptData.responses || [];
      
      responsesArray.forEach((questionAnswer: any, qIndex: number) => {
        const bgColor = dataRowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF8F9FA';
        
        // Get questionId from the response
        const questionId = questionAnswer.questionId || `Q${qIndex + 1}`;
        
        // Try to find question details from questionsList
        let question = questions.find((q: any) => 
          (q.id === questionId) || (q.questionId === questionId)
        );
        
        // If not found in questionsList (pool question), create minimal question object from response
        if (!question) {
          question = {
            id: questionId,
            questionId: questionId,
            type: questionAnswer.questionType || 'unknown',
            maximumMarks: questionAnswer.maximumMarks || 0,
            difficulty: questionAnswer.difficulty || 'Medium'
          };
        }
        
        // Get data from response
        const obtainedMarks = questionAnswer.marksAwarded || questionAnswer.scoredMarks || 0;
        const timeSpent = questionAnswer.timeSpent || 0;
        const revisitCount = questionAnswer.revisitCount || 0;
        const attemptCount = questionAnswer.attemptCount || 0;
        const questionViolations = questionAnswer.violations || [];

        // Roll Number (Column 1)
        worksheet.getCell(row, 1).value = student.rollNumber;
        worksheet.getCell(row, 1).font = { name: 'Segoe UI', size: 9, bold: true };
        worksheet.getCell(row, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };

        // Student Name (Column 2)
        worksheet.getCell(row, 2).value = student.studentName;
        worksheet.getCell(row, 2).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 2).alignment = { horizontal: 'left', vertical: 'middle' };

        // Enter IP Address (Column 3)
        worksheet.getCell(row, 3).value = sessionData.enterIP;
        worksheet.getCell(row, 3).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 3).alignment = { horizontal: 'center', vertical: 'middle' };

        // Exit IP Address (Column 4)
        worksheet.getCell(row, 4).value = sessionData.exitIP;
        worksheet.getCell(row, 4).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 4).alignment = { horizontal: 'center', vertical: 'middle' };

        // Total Activities (Column 5)
        worksheet.getCell(row, 5).value = sessionData.totalEntries;
        worksheet.getCell(row, 5).font = { name: 'Segoe UI', size: 9, bold: sessionData.totalEntries > 0 };
        worksheet.getCell(row, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 5).alignment = { horizontal: 'center', vertical: 'middle' };

        // Enter Count (Column 6)
        const enterCount = sessionData.enterCount || 0;
        worksheet.getCell(row, 6).value = enterCount;
        worksheet.getCell(row, 6).font = { name: 'Segoe UI', size: 9, bold: enterCount > 0, color: { argb: 'FF27AE60' } };
        worksheet.getCell(row, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 6).alignment = { horizontal: 'center', vertical: 'middle' };

        // Exit Count (Column 7)
        const exitCount = sessionData.exitCount || 0;
        worksheet.getCell(row, 7).value = exitCount;
        worksheet.getCell(row, 7).font = { name: 'Segoe UI', size: 9, bold: exitCount > 0, color: { argb: 'FFE74C3C' } };
        worksheet.getCell(row, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 7).alignment = { horizontal: 'center', vertical: 'middle' };

        // OS (Column 8)
        worksheet.getCell(row, 8).value = sessionData.os;
        worksheet.getCell(row, 8).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 8).alignment = { horizontal: 'center', vertical: 'middle' };

        // Browser (Column 9)
        worksheet.getCell(row, 9).value = sessionData.browser;
        worksheet.getCell(row, 9).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 9).alignment = { horizontal: 'center', vertical: 'middle' };

        // Question ID (Column 10)
        worksheet.getCell(row, 10).value = questionId;
        worksheet.getCell(row, 10).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + PRIMARY_COLOR } };
        worksheet.getCell(row, 10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 10).alignment = { horizontal: 'center', vertical: 'middle' };

        // Question Type (Column 11)
        const typeLabels: any = {
          mcq: 'MCQ',
          fillInTheBlank: 'Fill Blank',
          jumbledQuiz: 'Jumbled',
          descriptive: 'Descriptive',
          code: 'Code'
        };
        worksheet.getCell(row, 11).value = typeLabels[question.type] || question.type || 'N/A';
        worksheet.getCell(row, 11).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 11).alignment = { horizontal: 'center', vertical: 'middle' };

        // Maximum Marks (Column 12)
        const maxMarks = question.maximumMarks || question.marks || 0;
        worksheet.getCell(row, 12).value = maxMarks;
        worksheet.getCell(row, 12).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 12).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 12).alignment = { horizontal: 'center', vertical: 'middle' };

        // Difficulty Level (Column 13)
        const difficulty = question.difficulty || question.difficultyLevel || 'Medium';
        const difficultyColor = 
          difficulty === 'Easy' ? '27AE60' :
          difficulty === 'Hard' ? 'E74C3C' : 'F39C12';
        worksheet.getCell(row, 13).value = difficulty;
        worksheet.getCell(row, 13).font = { name: 'Segoe UI', size: 9, color: { argb: 'FF' + difficultyColor } };
        worksheet.getCell(row, 13).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 13).alignment = { horizontal: 'center', vertical: 'middle' };

        // Obtained Marks (Column 14)
        worksheet.getCell(row, 14).value = obtainedMarks;
        const marksColor = obtainedMarks >= maxMarks * 0.7 ? '27AE60' : obtainedMarks >= maxMarks * 0.4 ? 'F39C12' : 'E74C3C';
        worksheet.getCell(row, 14).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + marksColor } };
        worksheet.getCell(row, 14).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 14).alignment = { horizontal: 'center', vertical: 'middle' };

        // Violations Count (Column 15)
        const violationCount = questionViolations.length;
        worksheet.getCell(row, 15).value = violationCount;
        worksheet.getCell(row, 15).font = { name: 'Segoe UI', size: 9, bold: violationCount > 0, color: { argb: violationCount > 0 ? 'FFE74C3C' : 'FF27AE60' } };
        worksheet.getCell(row, 15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 15).alignment = { horizontal: 'center', vertical: 'middle' };

        // Violation Details (Column 16)
        const violationDetails = questionViolations.map((v: any) => v.type).join(' | ');
        worksheet.getCell(row, 16).value = violationDetails || 'None';
        worksheet.getCell(row, 16).font = { name: 'Segoe UI', size: 9, color: { argb: violationCount > 0 ? 'FFE74C3C' : 'FF27AE60' } };
        worksheet.getCell(row, 16).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 16).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

        // Time Spent (Column 17)
        worksheet.getCell(row, 17).value = Math.round(timeSpent);
        worksheet.getCell(row, 17).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 17).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 17).alignment = { horizontal: 'center', vertical: 'middle' };

        // Revisit Count (Column 18)
        worksheet.getCell(row, 18).value = revisitCount;
        worksheet.getCell(row, 18).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 18).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 18).alignment = { horizontal: 'center', vertical: 'middle' };

        // Attempt Count (Column 19)
        worksheet.getCell(row, 19).value = attemptCount;
        worksheet.getCell(row, 19).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 19).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 19).alignment = { horizontal: 'center', vertical: 'middle' };

        // Add borders to all cells in this row
        for (let col = 1; col <= 19; col++) {
          const cell = worksheet.getCell(row, col);
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
          };
        }

        worksheet.getRow(row).height = 20;
        row++;
        dataRowIndex++;
      });
    }

    // Add thick border around entire data table
    const headerRow = 6; // Row where table headers start
    const lastDataRow = row - 1;

    // Top border (thick) - on header row
    for (let col = 1; col <= 19; col++) {
      const cell = worksheet.getCell(headerRow, col);
      cell.border = {
        ...cell.border,
        top: { style: 'medium', color: { argb: 'FF000000' } }
      };
    }

    // Bottom border (thick) - on last data row
    for (let col = 1; col <= 19; col++) {
      const cell = worksheet.getCell(lastDataRow, col);
      cell.border = {
        ...cell.border,
        bottom: { style: 'medium', color: { argb: 'FF000000' } }
      };
    }

    // Left border (thick) - on first column
    for (let r = headerRow; r <= lastDataRow; r++) {
      const cell = worksheet.getCell(r, 1);
      cell.border = {
        ...cell.border,
        left: { style: 'medium', color: { argb: 'FF000000' } }
      };
    }

    // Right border (thick) - on last column
    for (let r = headerRow; r <= lastDataRow; r++) {
      const cell = worksheet.getCell(r, 19);
      cell.border = {
        ...cell.border,
        right: { style: 'medium', color: { argb: 'FF000000' } }
      };
    }

    // Summary
    row += 1;
    worksheet.mergeCells(row, 1, row, 19);
    const summaryCell = worksheet.getCell(row, 1);
    summaryCell.value = `Total Records: ${dataRowIndex} (${presentStudents.filter(s => s.hasAttempt).length} students × ${questions.length} questions)`;
    summaryCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF666666' } };
    summaryCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(row).height = 25;
  }
}

/**
 * Sheet 4: Personality Assessment
 * One row per student with trait percentages, response style, and personality type
 */
/**
 * Sheet 4: Exam Performance — Student-level summary with exam statistics header
 */
function addExamPerformanceSheet(
  workbook: any, selectedExam: any, presentStudents: Student[], 
  absentStudents: Student[], totalStudents: number, PRIMARY_COLOR: string
) {
  const worksheet = workbook.addWorksheet('Exam Performance', {
    views: [{ showGridLines: false }]
  });

  const totalCols = 16;
  worksheet.columns = [
    { width: 6 },   // A - S.N
    { width: 15 },  // B - Roll Number
    { width: 22 },  // C - Student Name
    { width: 22 },  // D - Email
    { width: 14 },  // E - Class
    { width: 15 },  // F - Phone
    { width: 18 },  // G - IP Address
    { width: 12 },  // H - Enter Count
    { width: 12 },  // I - Exit Count
    { width: 14 },  // J - Total Violations
    { width: 15 },  // K - OS
    { width: 15 },  // L - Browser
    { width: 14 },  // M - Total Marks
    { width: 10 },  // N - % Score
    { width: 14 },  // O - Time Spent
    { width: 10 },  // P - Status
  ];

  let row = 2;

  // ── Title ──
  worksheet.mergeCells(row, 1, row, totalCols);
  const titleCell = worksheet.getCell(row, 1);
  titleCell.value = 'EXAM PERFORMANCE';
  titleCell.font = { name: 'Segoe UI', size: 20, bold: true, color: { argb: 'FF' + PRIMARY_COLOR } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 35;
  row += 2;

  // ── Exam Statistics Header ──
  const submittedStudents = presentStudents.filter(s => s.hasAttempt && s.attemptData);
  const examTotalMarks = getExamTotalMarks(selectedExam) || 0;
  const examTotalQuestions = getExamTotalQuestions(selectedExam) || 0;
  const presentCount = presentStudents.length;
  const absentCount = absentStudents.length;
  const avgScore = submittedStudents.length > 0
    ? submittedStudents.reduce((sum, s) => sum + getPercentage(s.attemptData, selectedExam), 0) / submittedStudents.length
    : 0;
  const highestScore = submittedStudents.length > 0
    ? Math.max(...submittedStudents.map(s => getPercentage(s.attemptData, selectedExam)))
    : 0;
  const lowestScore = submittedStudents.length > 0
    ? Math.min(...submittedStudents.map(s => getPercentage(s.attemptData, selectedExam)))
    : 0;
  const passCount = submittedStudents.filter(s => getPercentage(s.attemptData, selectedExam) >= 40).length;
  const passRate = submittedStudents.length > 0 ? Math.round((passCount / submittedStudents.length) * 100) : 0;
  const totalViolations = submittedStudents.reduce((sum, s) => sum + getViolationCount(s.attemptData), 0);

  // Stat cards - 2 rows of stats
  const statBg = 'FFF0F4FF';
  const statBorder = { style: 'thin' as const, color: { argb: 'FFD0D5E0' } };
  const allBorders = { top: statBorder, bottom: statBorder, left: statBorder, right: statBorder };

  const writeStatCell = (r: number, c: number, label: string, value: string | number, color: string = '333333') => {
    // Value
    const vCell = worksheet.getCell(r, c);
    vCell.value = value;
    vCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF' + color } };
    vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statBg } };
    vCell.alignment = { horizontal: 'center', vertical: 'bottom' };
    vCell.border = allBorders;
    // Label
    const lCell = worksheet.getCell(r + 1, c);
    lCell.value = label;
    lCell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF888888' } };
    lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statBg } };
    lCell.alignment = { horizontal: 'center', vertical: 'top' };
    lCell.border = allBorders;
  };

  // Exam name
  worksheet.mergeCells(row, 1, row, totalCols);
  const examNameCell = worksheet.getCell(row, 1);
  examNameCell.value = selectedExam?.name || 'N/A';
  examNameCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF333333' } };
  examNameCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 28;
  row++;

  // Exam date/time/duration
  const examDate = selectedExam?.examDate ? new Date(selectedExam.examDate.seconds ? selectedExam.examDate.seconds * 1000 : selectedExam.examDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
  worksheet.mergeCells(row, 1, row, totalCols);
  const dateCell = worksheet.getCell(row, 1);
  dateCell.value = `Date: ${examDate}  |  Duration: ${selectedExam?.duration || 'N/A'} min  |  Subject: ${selectedExam?.subject || 'N/A'}`;
  dateCell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF666666' } };
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 22;
  row += 2;

  // Row 1 of stats: Total Questions, Total Marks, Total Students, Present, Absent
  worksheet.mergeCells(row, 1, row, 2);
  worksheet.mergeCells(row + 1, 1, row + 1, 2);
  writeStatCell(row, 1, 'Total Questions', examTotalQuestions, PRIMARY_COLOR);

  worksheet.mergeCells(row, 3, row, 4);
  worksheet.mergeCells(row + 1, 3, row + 1, 4);
  writeStatCell(row, 3, 'Total Marks', examTotalMarks, PRIMARY_COLOR);

  worksheet.mergeCells(row, 5, row, 6);
  worksheet.mergeCells(row + 1, 5, row + 1, 6);
  writeStatCell(row, 5, 'Total Students', totalStudents, '333333');

  worksheet.mergeCells(row, 7, row, 8);
  worksheet.mergeCells(row + 1, 7, row + 1, 8);
  writeStatCell(row, 7, 'Present', presentCount, '27AE60');

  worksheet.mergeCells(row, 9, row, 10);
  worksheet.mergeCells(row + 1, 9, row + 1, 10);
  writeStatCell(row, 9, 'Absent', absentCount, 'E74C3C');

  worksheet.mergeCells(row, 11, row, 13);
  worksheet.mergeCells(row + 1, 11, row + 1, 13);
  writeStatCell(row, 11, 'Submissions', submittedStudents.length, '333333');

  worksheet.getRow(row).height = 28;
  worksheet.getRow(row + 1).height = 18;
  row += 3;

  // Row 2 of stats: Avg Score, Highest, Lowest, Pass Rate, Violations
  worksheet.mergeCells(row, 1, row, 2);
  worksheet.mergeCells(row + 1, 1, row + 1, 2);
  writeStatCell(row, 1, 'Average Score', `${avgScore.toFixed(1)}%`, PRIMARY_COLOR);

  worksheet.mergeCells(row, 3, row, 4);
  worksheet.mergeCells(row + 1, 3, row + 1, 4);
  writeStatCell(row, 3, 'Highest Score', `${highestScore.toFixed(1)}%`, '27AE60');

  worksheet.mergeCells(row, 5, row, 6);
  worksheet.mergeCells(row + 1, 5, row + 1, 6);
  writeStatCell(row, 5, 'Lowest Score', `${lowestScore.toFixed(1)}%`, 'E74C3C');

  worksheet.mergeCells(row, 7, row, 8);
  worksheet.mergeCells(row + 1, 7, row + 1, 8);
  writeStatCell(row, 7, 'Pass Rate (≥40%)', `${passRate}%`, passRate >= 50 ? '27AE60' : 'E74C3C');

  worksheet.mergeCells(row, 9, row, 10);
  worksheet.mergeCells(row + 1, 9, row + 1, 10);
  writeStatCell(row, 9, 'Total Violations', totalViolations, totalViolations > 0 ? 'E74C3C' : '27AE60');

  worksheet.mergeCells(row, 11, row, 13);
  worksheet.mergeCells(row + 1, 11, row + 1, 13);
  const cleanExams = submittedStudents.length - submittedStudents.filter(s => getViolationCount(s.attemptData) > 0).length;
  writeStatCell(row, 11, 'Clean Exams', cleanExams, '27AE60');

  worksheet.getRow(row).height = 28;
  worksheet.getRow(row + 1).height = 18;
  row += 3;

  // ── Table Headers ──
  const headers = [
    'S.N', 'Roll Number', 'Student Name', 'Email', 'Class', 'Phone',
    'IP Address', 'Enter Count', 'Exit Count', 'Total Violations', 
    'OS', 'Browser', 'Total Marks', '% Score', 'Time Spent', 'Status'
  ];

  for (let i = 0; i < headers.length; i++) {
    const cell = worksheet.getCell(row, i + 1);
    cell.value = headers[i];
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PRIMARY_COLOR } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF333333' } },
      bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
    };
  }
  worksheet.getRow(row).height = 30;
  const headerRowNum = row;
  row++;

  // ── Student Data Rows ──
  // Sort: submitted students by percentage desc, then present without attempt, then absent
  const sortedStudents: { student: Student; status: string }[] = [];

  // Submitted (sorted by score desc)
  const sorted = [...submittedStudents].sort((a, b) => getPercentage(b.attemptData, selectedExam) - getPercentage(a.attemptData, selectedExam));
  sorted.forEach(s => sortedStudents.push({ student: s, status: 'submitted' }));

  // Present but not submitted
  presentStudents.filter(s => !s.hasAttempt || !s.attemptData).forEach(s => sortedStudents.push({ student: s, status: 'present' }));

  // Absent
  absentStudents.forEach(s => sortedStudents.push({ student: s, status: 'absent' }));

  let sn = 1;
  for (const { student, status } of sortedStudents) {
    const bgColor = status === 'absent' ? 'FFFFF0F0' : (sn % 2 === 0 ? 'FFF8F9FA' : 'FFFFFFFF');
    const attemptData = student.attemptData as any;

    // S.N (col 1)
    worksheet.getCell(row, 1).value = sn;
    worksheet.getCell(row, 1).font = { name: 'Segoe UI', size: 9, color: { argb: 'FF666666' } };

    // Roll Number (col 2)
    worksheet.getCell(row, 2).value = student.rollNumber || 'N/A';
    worksheet.getCell(row, 2).font = { name: 'Segoe UI', size: 9, bold: true };

    // Student Name (col 3)
    worksheet.getCell(row, 3).value = student.studentName || 'Unknown';
    worksheet.getCell(row, 3).font = { name: 'Segoe UI', size: 9 };
    worksheet.getCell(row, 3).alignment = { horizontal: 'left', vertical: 'middle' };

    // Email (col 4)
    const email = (student as any).studentEmail || attemptData?.studentEmail || '';
    worksheet.getCell(row, 4).value = email || 'N/A';
    worksheet.getCell(row, 4).font = { name: 'Segoe UI', size: 8, color: { argb: 'FF555555' } };
    worksheet.getCell(row, 4).alignment = { horizontal: 'left', vertical: 'middle' };

    // Class (col 5)
    worksheet.getCell(row, 5).value = attemptData?.studentClass || attemptData?.class || selectedExam?.class || 'N/A';
    worksheet.getCell(row, 5).font = { name: 'Segoe UI', size: 9 };

    // Phone (col 6)
    worksheet.getCell(row, 6).value = attemptData?.studentPhone || 'N/A';
    worksheet.getCell(row, 6).font = { name: 'Segoe UI', size: 9 };

    if (status === 'absent') {
      // Absent student
      for (let c = 7; c <= 15; c++) {
        worksheet.getCell(row, c).value = '-';
        worksheet.getCell(row, c).font = { name: 'Segoe UI', size: 9, color: { argb: 'FFCCCCCC' } };
      }
      worksheet.getCell(row, 16).value = 'ABSENT';
      worksheet.getCell(row, 16).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFE74C3C' } };
    } else if (!attemptData) {
      // Present but no submission
      for (let c = 7; c <= 15; c++) {
        worksheet.getCell(row, c).value = '-';
        worksheet.getCell(row, c).font = { name: 'Segoe UI', size: 9, color: { argb: 'FFCCCCCC' } };
      }
      worksheet.getCell(row, 16).value = 'No Submission';
      worksheet.getCell(row, 16).font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF999999' } };
    } else {
      // IP Address (col 7)
      worksheet.getCell(row, 7).value = attemptData.enterIPAddress || attemptData.ipAddress || 'N/A';
      worksheet.getCell(row, 7).font = { name: 'Segoe UI', size: 8 };

      // Enter Count (col 8)
      const enterCount = attemptData.enterCount || 0;
      worksheet.getCell(row, 8).value = enterCount;
      worksheet.getCell(row, 8).font = { name: 'Segoe UI', size: 9, color: { argb: 'FF27AE60' } };

      // Exit Count (col 9)
      const exitCount = attemptData.exitCount || 0;
      worksheet.getCell(row, 9).value = exitCount;
      worksheet.getCell(row, 9).font = { name: 'Segoe UI', size: 9, color: { argb: exitCount > 0 ? 'FFE74C3C' : 'FF27AE60' } };

      // Total Violations (col 10)
      const violations = getViolationCount(attemptData);
      worksheet.getCell(row, 10).value = violations;
      worksheet.getCell(row, 10).font = { name: 'Segoe UI', size: 9, bold: violations > 0, color: { argb: violations > 0 ? 'FFE74C3C' : 'FF27AE60' } };

      // OS (col 11)
      worksheet.getCell(row, 11).value = attemptData.operatingSystem || attemptData.os || 'N/A';
      worksheet.getCell(row, 11).font = { name: 'Segoe UI', size: 9 };

      // Browser (col 12)
      worksheet.getCell(row, 12).value = attemptData.browser || 'N/A';
      worksheet.getCell(row, 12).font = { name: 'Segoe UI', size: 9 };

      // Total Marks (col 13) — obtained / max
      const obtained = getObtainedMarks(attemptData);
      worksheet.getCell(row, 13).value = `${obtained} / ${examTotalMarks}`;
      const marksColor = examTotalMarks > 0 && (obtained / examTotalMarks) >= 0.7 ? '27AE60' : (obtained / examTotalMarks) >= 0.4 ? 'F39C12' : 'E74C3C';
      worksheet.getCell(row, 13).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + marksColor } };

      // % Score (col 14)
      const pct = getPercentage(attemptData, selectedExam);
      worksheet.getCell(row, 14).value = `${pct.toFixed(1)}%`;
      const pctColor = pct >= 75 ? '27AE60' : pct >= 60 ? '2196F3' : pct >= 40 ? 'F39C12' : 'E74C3C';
      worksheet.getCell(row, 14).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + pctColor } };

      // Time Spent (col 15)
      let timeSpent = attemptData.timeSpent || 0;
      const examDurationSec = (parseInt(selectedExam?.duration) || 0) * 60;
      if (examDurationSec > 0 && timeSpent > examDurationSec) timeSpent = examDurationSec;
      const mins = Math.floor(timeSpent / 60);
      const secs = timeSpent % 60;
      worksheet.getCell(row, 15).value = `${mins}m ${secs}s`;
      worksheet.getCell(row, 15).font = { name: 'Segoe UI', size: 9 };

      // Status (col 16)
      const attemptStatus = attemptData.status || 'submitted';
      worksheet.getCell(row, 16).value = attemptStatus === 'submitted' ? 'Submitted' : attemptStatus;
      worksheet.getCell(row, 16).font = { name: 'Segoe UI', size: 9, color: { argb: 'FF27AE60' } };
    }

    // Apply background and alignment to all cells, add borders
    for (let c = 1; c <= totalCols; c++) {
      const cell = worksheet.getCell(row, c);
      if (!cell.fill || !cell.fill.fgColor) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      }
      if (!cell.alignment) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
      };
    }

    worksheet.getRow(row).height = 22;
    row++;
    sn++;
  }

  // ── Bottom border ──
  const lastDataRow = row - 1;
  for (let c = 1; c <= totalCols; c++) {
    worksheet.getCell(lastDataRow, c).border = {
      ...worksheet.getCell(lastDataRow, c).border,
      bottom: { style: 'medium', color: { argb: 'FF333333' } }
    };
  }
  // Left/right borders
  for (let r = headerRowNum; r <= lastDataRow; r++) {
    worksheet.getCell(r, 1).border = { ...worksheet.getCell(r, 1).border, left: { style: 'medium', color: { argb: 'FF333333' } } };
    worksheet.getCell(r, totalCols).border = { ...worksheet.getCell(r, totalCols).border, right: { style: 'medium', color: { argb: 'FF333333' } } };
  }

  // Summary row
  row++;
  worksheet.mergeCells(row, 1, row, totalCols);
  const summCell = worksheet.getCell(row, 1);
  summCell.value = `Total: ${sortedStudents.length} students (${presentCount} present, ${absentCount} absent) | Average: ${avgScore.toFixed(1)}% | Pass Rate: ${passRate}%`;
  summCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF666666' } };
  summCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 25;
}

function addPersonalityAssessmentSheet(workbook: any, selectedExam: any, presentStudents: Student[], _PRIMARY_COLOR: string) {
  const worksheet = workbook.addWorksheet('Personality Assessment', {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  const submittedStudents = presentStudents.filter(s => s.hasAttempt && s.attemptData?.personalityProfile);

  // Collect all trait names from all students
  const allTraits = Array.from(new Set(
    submittedStudents.flatMap(s => Object.keys(s.attemptData?.personalityProfile || {}))
  ));

  const TRAIT_COLORS: Record<string, string> = {
    'Openness': '3B82F6', 'Conscientiousness': '10B981', 'Extraversion': 'F59E0B',
    'Agreeableness': 'EF4444', 'Emotional Stability': '8B5CF6', 'Leadership': 'F97316',
    'Problem Solving': '06B6D4', 'Communication': 'EC4899',
  };

  // Fixed columns: S.No, Name, Roll, Style, Type + dynamic trait columns + Level columns
  const fixedCols = 5; // S.No, Name, Roll, Style, Type
  const totalCols = fixedCols + allTraits.length * 2; // each trait has % and Level

  // Set column widths
  worksheet.getColumn(1).width = 6;   // S.No
  worksheet.getColumn(2).width = 22;  // Name
  worksheet.getColumn(3).width = 12;  // Roll
  worksheet.getColumn(4).width = 16;  // Response Style
  worksheet.getColumn(5).width = 28;  // Personality Type
  for (let i = 0; i < allTraits.length; i++) {
    worksheet.getColumn(fixedCols + i * 2 + 1).width = 10; // trait %
    worksheet.getColumn(fixedCols + i * 2 + 2).width = 12; // trait level
  }

  let row = 1;

  // ── Title Row ──
  worksheet.mergeCells(row, 1, row, totalCols);
  const titleCell = worksheet.getCell(row, 1);
  titleCell.value = `${selectedExam?.name || 'Exam'} — Personality Assessment Report`;
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF333333' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 40;
  row++;

  // ── Subtitle Row ──
  worksheet.mergeCells(row, 1, row, totalCols);
  const subtitleCell = worksheet.getCell(row, 1);
  const examDate = selectedExam?.examDate || selectedExam?.startDate || '';
  subtitleCell.value = `Date: ${examDate ? new Date(examDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}  |  ${submittedStudents.length} Students  |  ${allTraits.length} Traits (Big-${allTraits.length} Personality Model)`;
  subtitleCell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF666666' } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 25;
  row++;

  // ── Spacer ──
  worksheet.getRow(row).height = 8;
  row++;

  // ── Header Row ──
  const headerRow = row;
  const headers = ['#', 'Student Name', 'Roll No', 'Response Style', 'Personality Type'];
  allTraits.forEach(trait => {
    headers.push(`${trait} %`);
    headers.push(`${trait} Level`);
  });

  headers.forEach((header, i) => {
    const cell = worksheet.getCell(headerRow, i + 1);
    cell.value = header;
    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF555555' } },
      right: { style: 'thin', color: { argb: 'FF555555' } }
    };
  });
  worksheet.getRow(headerRow).height = 30;

  // Color code trait header columns
  allTraits.forEach((trait, i) => {
    const color = TRAIT_COLORS[trait] || '6366F1';
    const pctCol = fixedCols + i * 2 + 1;
    const lvlCol = fixedCols + i * 2 + 2;
    worksheet.getCell(headerRow, pctCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } };
    worksheet.getCell(headerRow, lvlCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } };
  });

  row++;

  // ── Data Rows ──
  submittedStudents.forEach((student, idx) => {
    const attempt = student.attemptData;
    const profile = attempt?.personalityProfile || {};
    const responseStyle = attempt?.responseStyle || 'Genuine';
    const pType = attempt?.personalityType?.title || '';
    const isEven = idx % 2 === 0;
    const bgColor = isEven ? 'FFFFFFFF' : 'FFF8F9FA';

    const rowData: any[] = [
      idx + 1,
      student.studentName || 'Unknown',
      student.rollNumber || 'N/A',
      responseStyle,
      pType
    ];

    allTraits.forEach(trait => {
      const d = profile[trait];
      if (d) {
        rowData.push(d.percentage != null ? Math.round(d.percentage) : 0);
        rowData.push(d.level || '');
      } else {
        rowData.push('');
        rowData.push('');
      }
    });

    rowData.forEach((val, i) => {
      const cell = worksheet.getCell(row, i + 1);
      cell.value = typeof val === 'number' && i >= fixedCols ? val : val;
      cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF333333' } };
      cell.alignment = { horizontal: i <= 1 ? 'left' : 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
    });

    // Style response style cell with color
    const styleCell = worksheet.getCell(row, 4);
    if (responseStyle === 'Genuine') {
      styleCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF166534' } };
      styleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    } else if (responseStyle === 'Central Tendency') {
      styleCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF854D0E' } };
      styleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
    } else {
      styleCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF991B1B' } };
      styleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    }

    // Style personality type cell
    const typeCell = worksheet.getCell(row, 5);
    typeCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF4F46E5' } };

    // Color-code trait % cells by level
    allTraits.forEach((trait, i) => {
      const d = profile[trait];
      if (!d) return;
      const pctCol = fixedCols + i * 2 + 1;
      const lvlCol = fixedCols + i * 2 + 2;
      const pctCell = worksheet.getCell(row, pctCol);
      const lvlCell = worksheet.getCell(row, lvlCol);

      pctCell.font = { name: 'Segoe UI', size: 9, bold: true };

      if (d.level === 'Very High' || d.level === 'High') {
        pctCell.font = { ...pctCell.font, color: { argb: 'FF166534' } };
        pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        lvlCell.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF166534' } };
        lvlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      } else if (d.level === 'Moderate') {
        pctCell.font = { ...pctCell.font, color: { argb: 'FF854D0E' } };
        pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
        lvlCell.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF854D0E' } };
        lvlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
      } else {
        pctCell.font = { ...pctCell.font, color: { argb: 'FF991B1B' } };
        pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        lvlCell.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF991B1B' } };
        lvlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      }
    });

    worksheet.getRow(row).height = 22;
    row++;
  });

  // ── Bottom border ──
  if (submittedStudents.length > 0) {
    const lastRow = row - 1;
    for (let c = 1; c <= totalCols; c++) {
      const cell = worksheet.getCell(lastRow, c);
      cell.border = { ...cell.border, bottom: { style: 'medium', color: { argb: 'FF333333' } } };
    }
  }

  // ── Summary ──
  worksheet.mergeCells(row, 1, row, totalCols);
  const summCell = worksheet.getCell(row, 1);
  summCell.value = `Total: ${submittedStudents.length} students assessed across ${allTraits.length} personality traits`;
  summCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF666666' } };
  summCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 25;
}