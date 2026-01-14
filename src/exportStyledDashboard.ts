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

function getTotalScore(attemptData: any): number {
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

function getPercentage(attemptData: any): number {
  if (attemptData?.percentage != null) {
    return attemptData.percentage;
  }
  const obtained = getObtainedMarks(attemptData);
  const total = getTotalScore(attemptData);
  return total > 0 ? (obtained / total) * 100 : 0;
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
  const ExcelJS = (await import('exceljs')).default;
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
    ? submittedStudents.reduce((sum, s) => sum + getPercentage(s.attemptData), 0) / submittedStudents.length 
    : 0;
  
  const highestScore = submittedStudents.length > 0 
    ? Math.max(...submittedStudents.map(s => getPercentage(s.attemptData))) 
    : 0;
  
  const passCount = submittedStudents.filter(s => getPercentage(s.attemptData) >= 40).length;
  const passRate = submittedStudents.length > 0 ? Math.round((passCount / submittedStudents.length) * 100) : 0;
  
  const excellent = submittedStudents.filter(s => getPercentage(s.attemptData) >= 90).length;
  const good = submittedStudents.filter(s => getPercentage(s.attemptData) >= 75 && getPercentage(s.attemptData) < 90).length;
  const average = submittedStudents.filter(s => getPercentage(s.attemptData) >= 60 && getPercentage(s.attemptData) < 75).length;
  const poor = submittedStudents.filter(s => getPercentage(s.attemptData) < 60).length;
  
  const totalViolations = submittedStudents.reduce((sum, s) => sum + (s.attemptData?.violationCount || 0), 0);
  const studentsWithViolations = submittedStudents.filter(s => (s.attemptData?.violationCount || 0) > 0).length;
  const cleanExams = submittedStudents.length - studentsWithViolations;
  const avgViolationsPerStudent = submittedStudents.length > 0 ? (totalViolations / submittedStudents.length).toFixed(1) : '0';
  
  const topPerformers = submittedStudents
    .sort((a, b) => getPercentage(b.attemptData) - getPercentage(a.attemptData))
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
    worksheet.mergeCells(row, 2, row, 4);
    worksheet.getCell(row, 2).value = category;
    worksheet.getCell(row, 2).font = { name: 'Segoe UI', size: 12 };
    worksheet.getCell(row, 2).alignment = { horizontal: 'left', vertical: 'middle' };
    
    // Count on right
    worksheet.getCell(row, 13).value = `${count} students`;
    worksheet.getCell(row, 11).font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF' + color } };
    worksheet.getCell(row, 11).alignment = { horizontal: 'right', vertical: 'middle' };
    
    // Progress bar full width
    const barStart = 2;
    const barEnd = 13;
    const barFillCols = Math.round((barEnd - barStart + 1) * (pct / 100));
    
    worksheet.mergeCells(row + 1, barStart, row + 1, barEnd);
    
    // Filled portion
    for (let c = barStart; c < barStart + barFillCols && c <= barEnd; c++) {
      worksheet.getCell(row + 1, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color } };
    }
    // Gray portion
    for (let c = barStart + barFillCols; c <= barEnd; c++) {
      worksheet.getCell(row + 1, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    }
    
    worksheet.getRow(row).height = 25;
    worksheet.getRow(row + 1).height = 8;
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
      worksheet.getCell(row, 11).value = `${getPercentage(student.attemptData).toFixed(2)}%`;
      worksheet.getCell(row, 11).font = { name: 'Segoe UI', size: 18, bold: true, color: { argb: 'FF' + PRIMARY_COLOR } };
      worksheet.getCell(row, 11).alignment = { horizontal: 'right', vertical: 'middle' };
      
      // Marks
      worksheet.mergeCells(row + 1, 11, row + 1, 13);
      const obtained = getObtainedMarks(student.attemptData);
      const total = getTotalScore(student.attemptData);
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
    { width: 12 },  // A - Class
    { width: 15 },  // B - Question ID
    { width: 18 },  // C - Question Type
    { width: 15 },  // D - Maximum Marks
    { width: 15 },  // E - Difficulty Level
    { width: 20 },  // F - Chapter
    { width: 18 },  // G - Subject
    { width: 50 }   // H - Question Detail
  ];

  let row = 2;

  // Header
  worksheet.mergeCells(row, 1, row, 8);
  const headerCell = worksheet.getCell(row, 1);
  headerCell.value = 'QUESTION DETAILS';
  headerCell.font = { name: 'Segoe UI', size: 20, bold: true, color: { argb: 'FF' + PRIMARY_COLOR } };
  headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 35;
  row += 2;

  // Exam info
  worksheet.mergeCells(row, 1, row, 8);
  const examInfoCell = worksheet.getCell(row, 1);
  examInfoCell.value = `Exam: ${selectedExam?.name || 'N/A'} | Class: ${selectedExam?.class || 'N/A'} | Subject: ${selectedExam?.subject || 'N/A'}`;
  examInfoCell.font = { name: 'Segoe UI', size: 11, color: { argb: 'FF666666' } };
  examInfoCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 22;
  row += 2;

  // Table Headers
  const headers = ['Class', 'Question ID', 'Question Type', 'Maximum Marks', 'Difficulty Level', 'Chapter', 'Subject', 'Question Detail'];
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
  
  if (questions.length === 0) {
    worksheet.mergeCells(row, 1, row, 8);
    worksheet.getCell(row, 1).value = 'No questions found for this exam';
    worksheet.getCell(row, 1).font = { name: 'Segoe UI', size: 11, italic: true, color: { argb: 'FF999999' } };
    worksheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(row).height = 30;
  } else {
    // Add question data
    questions.forEach((question: any, index: number) => {
      const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF8F9FA';

      // Class
      worksheet.getCell(row, 1).value = selectedExam?.class || 'N/A';
      worksheet.getCell(row, 1).font = { name: 'Segoe UI', size: 10 };
      worksheet.getCell(row, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      worksheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };

      // Question ID
      worksheet.getCell(row, 2).value = question.id || question.questionId || `Q${index + 1}`;
      worksheet.getCell(row, 2).font = { name: 'Segoe UI', size: 10, bold: true };
      worksheet.getCell(row, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      worksheet.getCell(row, 3).alignment = { horizontal: 'center', vertical: 'middle' };

      // Question Type
      const typeLabels: any = {
        mcq: 'Multiple Choice',
        fillInTheBlank: 'Fill in the Blank',
        jumbledQuiz: 'Jumbled Quiz',
        descriptive: 'Descriptive',
        code: 'Coding'
      };
      worksheet.getCell(row, 3).value = typeLabels[question.type] || question.type || 'N/A';
      worksheet.getCell(row, 3).font = { name: 'Segoe UI', size: 10 };
      worksheet.getCell(row, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      worksheet.getCell(row, 3).alignment = { horizontal: 'center', vertical: 'middle' };

      // Maximum Marks
      worksheet.getCell(row, 4).value = question.maximumMarks || question.marks || 0;
      worksheet.getCell(row, 4).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + PRIMARY_COLOR } };
      worksheet.getCell(row, 4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      worksheet.getCell(row, 4).alignment = { horizontal: 'center', vertical: 'middle' };

      // Difficulty Level
      worksheet.getCell(row, 5).value = question.difficulty || question.difficultyLevel || 'Medium';
      const difficultyColor = 
        (question.difficulty === 'Easy' || question.difficultyLevel === 'Easy') ? '27AE60' :
        (question.difficulty === 'Hard' || question.difficultyLevel === 'Hard') ? 'E74C3C' : 'F39C12';
      worksheet.getCell(row, 5).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + difficultyColor } };
      worksheet.getCell(row, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      worksheet.getCell(row, 5).alignment = { horizontal: 'center', vertical: 'middle' };

      // Chapter
      worksheet.getCell(row, 6).value = question.chapter || question.topic || 'N/A';
      worksheet.getCell(row, 6).font = { name: 'Segoe UI', size: 10 };
      worksheet.getCell(row, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      worksheet.getCell(row, 6).alignment = { horizontal: 'center', vertical: 'middle' };

      // Subject
      worksheet.getCell(row, 7).value = selectedExam?.subject || question.subject || 'N/A';
      worksheet.getCell(row, 7).font = { name: 'Segoe UI', size: 10 };
      worksheet.getCell(row, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      worksheet.getCell(row, 7).alignment = { horizontal: 'center', vertical: 'middle' };

      // Question Detail (text only, strip HTML)
      let questionText = question.questionText || question.question || 'N/A';
      // Remove HTML tags
      questionText = questionText.replace(/<[^>]*>/g, '');
      // Limit length
      if (questionText.length > 200) {
        questionText = questionText.substring(0, 197) + '...';
      }
      worksheet.getCell(row, 8).value = questionText;
      worksheet.getCell(row, 8).font = { name: 'Segoe UI', size: 10 };
      worksheet.getCell(row, 8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      worksheet.getCell(row, 8).alignment = { horizontal: 'left', vertical: 'top', wrapText: true };

      // Add borders to all cells in this row (gridlines)
      for (let col = 1; col <= 8; col++) {
        const cell = worksheet.getCell(row, col);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
        };
      }

      worksheet.getRow(row).height = 30;
      row++;
    });

    // Add thick border around entire data table
    const headerRow = 6; // Row where table headers start
    const lastDataRow = row - 1;

    // Top border (thick) - on header row
    for (let col = 1; col <= 8; col++) {
      const cell = worksheet.getCell(headerRow, col);
      cell.border = {
        ...cell.border,
        top: { style: 'medium', color: { argb: 'FF000000' } }
      };
    }

    // Bottom border (thick) - on last data row
    for (let col = 1; col <= 8; col++) {
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
      const cell = worksheet.getCell(r, 8);
      cell.border = {
        ...cell.border,
        right: { style: 'medium', color: { argb: 'FF000000' } }
      };
    }

    // Summary
    row += 1;
    worksheet.mergeCells(row, 1, row, 8);
    const summaryCell = worksheet.getCell(row, 1);
    summaryCell.value = `Total Questions: ${questions.length}`;
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

  // Column widths
  worksheet.columns = [
    { width: 12 },  // A - Class
    { width: 15 },  // B - Roll Number
    { width: 20 },  // C - Student Name
    { width: 18 },  // D - Enter IP Address
    { width: 18 },  // E - Exit IP Address
    { width: 12 },  // F - Total Entries
    { width: 15 },  // G - OS
    { width: 15 },  // H - Browser
    { width: 15 },  // I - Question ID
    { width: 18 },  // J - Question Type
    { width: 15 },  // K - Maximum Marks
    { width: 15 },  // L - Difficulty Level
    { width: 15 },  // M - Obtained Marks
    { width: 12 },  // N - Violations Count
    { width: 40 },  // O - Violation Details (NEW!)
    { width: 12 },  // P - Time Spent
    { width: 15 },  // Q - Revisit Count
    { width: 15 }   // R - Attempt Count
  ];

  let row = 2;

  // Header
  worksheet.mergeCells(row, 1, row, 20);
  const headerCell = worksheet.getCell(row, 1);
  headerCell.value = 'QUESTION-WISE PERFORMANCE';
  headerCell.font = { name: 'Segoe UI', size: 20, bold: true, color: { argb: 'FF' + PRIMARY_COLOR } };
  headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 35;
  row += 2;

  // Exam info
  worksheet.mergeCells(row, 1, row, 20);
  const examInfoCell = worksheet.getCell(row, 1);
  examInfoCell.value = `Exam: ${selectedExam?.name || 'N/A'} | Class: ${selectedExam?.class || 'N/A'}`;
  examInfoCell.font = { name: 'Segoe UI', size: 11, color: { argb: 'FF666666' } };
  examInfoCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 22;
  row += 2;

  // Table Headers
  const headers = [
    'Class', 'Roll Number', 'Student Name', 'Enter IP Address', 'Exit IP Address', 
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
    worksheet.mergeCells(row, 1, row, 20);
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

        // Class
        worksheet.getCell(row, 1).value = selectedExam?.class || 'N/A';
        worksheet.getCell(row, 1).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };

        // Roll Number (Column 2)
        worksheet.getCell(row, 2).value = student.rollNumber;
        worksheet.getCell(row, 2).font = { name: 'Segoe UI', size: 9, bold: true };
        worksheet.getCell(row, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 2).alignment = { horizontal: 'center', vertical: 'middle' };

        // Student Name (Column 3) - ✅ FIX: Corrected to use column 3 consistently
        worksheet.getCell(row, 3).value = student.studentName;
        worksheet.getCell(row, 3).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 3).alignment = { horizontal: 'left', vertical: 'middle' };

        // Enter IP Address (Column 4)
        worksheet.getCell(row, 4).value = sessionData.enterIP;
        worksheet.getCell(row, 4).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 4).alignment = { horizontal: 'center', vertical: 'middle' };

        // Exit IP Address
        worksheet.getCell(row, 5).value = sessionData.exitIP;
        worksheet.getCell(row, 5).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 5).alignment = { horizontal: 'center', vertical: 'middle' };

        // Total Entries (Column 6)
        worksheet.getCell(row, 6).value = sessionData.totalEntries;
        worksheet.getCell(row, 6).font = { name: 'Segoe UI', size: 9, bold: sessionData.totalEntries > 0 };
        worksheet.getCell(row, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 6).alignment = { horizontal: 'center', vertical: 'middle' };

        // ✅ NEW: Enter Count (Column 7)
        const enterCount = sessionData.enterCount || 0;
        worksheet.getCell(row, 7).value = enterCount;
        worksheet.getCell(row, 7).font = { name: 'Segoe UI', size: 9, bold: enterCount > 0, color: { argb: 'FF27AE60' } };
        worksheet.getCell(row, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 7).alignment = { horizontal: 'center', vertical: 'middle' };

        // ✅ NEW: Exit Count (Column 8)
        const exitCount = sessionData.exitCount || 0;
        worksheet.getCell(row, 8).value = exitCount;
        worksheet.getCell(row, 8).font = { name: 'Segoe UI', size: 9, bold: exitCount > 0, color: { argb: 'FFE74C3C' } };
        worksheet.getCell(row, 8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 8).alignment = { horizontal: 'center', vertical: 'middle' };

        // OS (Column 9 - shifted from 7)
        worksheet.getCell(row, 9).value = sessionData.os;
        worksheet.getCell(row, 9).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 9).alignment = { horizontal: 'center', vertical: 'middle' };

        // Browser (Column 10 - shifted from 8)
        worksheet.getCell(row, 10).value = sessionData.browser;
        worksheet.getCell(row, 10).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 10).alignment = { horizontal: 'center', vertical: 'middle' };

        // Question ID (Column 11 - shifted from 9)
        worksheet.getCell(row, 11).value = questionId;
        worksheet.getCell(row, 11).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + PRIMARY_COLOR } };
        worksheet.getCell(row, 11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 11).alignment = { horizontal: 'center', vertical: 'middle' };

        // Question Type (Column 12 - shifted from 10)
        const typeLabels: any = {
          mcq: 'MCQ',
          fillInTheBlank: 'Fill Blank',
          jumbledQuiz: 'Jumbled',
          descriptive: 'Descriptive',
          code: 'Code'
        };
        worksheet.getCell(row, 12).value = typeLabels[question.type] || question.type || 'N/A';
        worksheet.getCell(row, 12).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 12).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 12).alignment = { horizontal: 'center', vertical: 'middle' };

        // Maximum Marks (Column 13 - shifted from 11)
        const maxMarks = question.maximumMarks || question.marks || 0;
        worksheet.getCell(row, 13).value = maxMarks;
        worksheet.getCell(row, 13).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 13).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 13).alignment = { horizontal: 'center', vertical: 'middle' };

        // Difficulty Level (Column 14 - shifted from 12)
        const difficulty = question.difficulty || question.difficultyLevel || 'Medium';
        const difficultyColor = 
          difficulty === 'Easy' ? '27AE60' :
          difficulty === 'Hard' ? 'E74C3C' : 'F39C12';
        worksheet.getCell(row, 14).value = difficulty;
        worksheet.getCell(row, 14).font = { name: 'Segoe UI', size: 9, color: { argb: 'FF' + difficultyColor } };
        worksheet.getCell(row, 14).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 14).alignment = { horizontal: 'center', vertical: 'middle' };

        // Obtained Marks (Column 15 - shifted from 13)
        worksheet.getCell(row, 15).value = obtainedMarks;
        const marksColor = obtainedMarks >= maxMarks * 0.7 ? '27AE60' : obtainedMarks >= maxMarks * 0.4 ? 'F39C12' : 'E74C3C';
        worksheet.getCell(row, 15).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + marksColor } };
        worksheet.getCell(row, 15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 15).alignment = { horizontal: 'center', vertical: 'middle' };

        // Violations Count (Column 16 - shifted from 14)
        const violationCount = questionViolations.length;
        
        worksheet.getCell(row, 16).value = violationCount;
        worksheet.getCell(row, 16).font = { name: 'Segoe UI', size: 9, bold: violationCount > 0, color: { argb: violationCount > 0 ? 'FFE74C3C' : 'FF27AE60' } };
        worksheet.getCell(row, 16).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 16).alignment = { horizontal: 'center', vertical: 'middle' };

        // Violation Details (Column 17 - shifted from 15)
        const violationDetails = questionViolations.map((v: any) => v.type).join(' | ');
        worksheet.getCell(row, 17).value = violationDetails || 'None';
        worksheet.getCell(row, 17).font = { name: 'Segoe UI', size: 9, color: { argb: violationCount > 0 ? 'FFE74C3C' : 'FF27AE60' } };
        worksheet.getCell(row, 17).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 17).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

        // Time Spent (Column 18 - shifted from 16)
        worksheet.getCell(row, 18).value = Math.round(timeSpent);
        worksheet.getCell(row, 18).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 18).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 18).alignment = { horizontal: 'center', vertical: 'middle' };

        // Revisit Count (Column 19 - shifted from 17)
        worksheet.getCell(row, 19).value = revisitCount;
        worksheet.getCell(row, 19).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 19).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 19).alignment = { horizontal: 'center', vertical: 'middle' };

        // Attempt Count (Column 20 - shifted from 18)
        worksheet.getCell(row, 20).value = attemptCount;
        worksheet.getCell(row, 20).font = { name: 'Segoe UI', size: 9 };
        worksheet.getCell(row, 20).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        worksheet.getCell(row, 20).alignment = { horizontal: 'center', vertical: 'middle' };

        // Add borders to all cells in this row (gridlines) - NOW 20 columns
        for (let col = 1; col <= 20; col++) {
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
    for (let col = 1; col <= 20; col++) {
      const cell = worksheet.getCell(headerRow, col);
      cell.border = {
        ...cell.border,
        top: { style: 'medium', color: { argb: 'FF000000' } }
      };
    }

    // Bottom border (thick) - on last data row
    for (let col = 1; col <= 20; col++) {
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
      const cell = worksheet.getCell(r, 20);
      cell.border = {
        ...cell.border,
        right: { style: 'medium', color: { argb: 'FF000000' } }
      };
    }

    // Summary
    row += 1;
    worksheet.mergeCells(row, 1, row, 20);
    const summaryCell = worksheet.getCell(row, 1);
    summaryCell.value = `Total Records: ${dataRowIndex} (${presentStudents.filter(s => s.hasAttempt).length} students × ${questions.length} questions)`;
    summaryCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF666666' } };
    summaryCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(row).height = 25;
  }
}