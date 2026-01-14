// ============================================
// REPORTS CLOUD FUNCTION
// All report processing functionality
// ============================================

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as ExcelJS from 'exceljs';

/**
 * Get college brand color
 */
async function getCollegeBrandColor(db: admin.firestore.Firestore, collegeId: string): Promise<string> {
  try {
    const collegeDoc = await db.collection('colleges').doc(collegeId).get();
    if (collegeDoc.exists) {
      const collegeData = collegeDoc.data();
      // Try different possible field names (check nested colors object first)
      const brandColor = collegeData?.colors?.primary || 
                        collegeData?.brandColor || 
                        collegeData?.primaryColor || 
                        collegeData?.themeColor ||
                        '#4F46E5'; // Default brand color
      console.log('📊 Using brand color:', brandColor);
      return brandColor;
    }
  } catch (error) {
    console.warn('⚠️ Could not fetch brand color, using default');
  }
  return '#4F46E5'; // Default fallback
}

/**
 * Add professional header to Excel worksheet
 */
function addProfessionalHeader(
  worksheet: ExcelJS.Worksheet,
  reportName: string,
  description: string,
  parameters: any,
  totalRecords: number,
  brandColor: string,
  collegeName: string,
  columnCount: number = 14 // Default to N (14 columns)
) {
  // Convert hex to ARGB (add FF for alpha)
  const argbColor = 'FF' + brandColor.replace('#', '');
  
  // Get last column letter (A=1, B=2, ... Z=26, AA=27, etc.)
  const getColumnLetter = (num: number): string => {
    let letter = '';
    while (num > 0) {
      const mod = (num - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      num = Math.floor((num - mod) / 26);
    }
    return letter;
  };
  
  const lastColumn = getColumnLetter(columnCount);
  
  // Row 1: Report Title
  worksheet.mergeCells(`A1:${lastColumn}1`);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = reportName.toUpperCase();
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: argbColor }
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 30;
  
  // Row 2: College Name
  worksheet.mergeCells(`A2:${lastColumn}2`);
  const collegeCell = worksheet.getCell('A2');
  collegeCell.value = collegeName;
  collegeCell.font = { bold: true, size: 12 };
  collegeCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 20;
  
  // Row 3: Description
  worksheet.mergeCells(`A3:${lastColumn}3`);
  const descCell = worksheet.getCell('A3');
  descCell.value = description;
  descCell.font = { italic: true, size: 10 };
  descCell.alignment = { vertical: 'middle', horizontal: 'center' };
  descCell.border = {
    bottom: { style: 'thin', color: { argb: 'FF000000' } }
  };
  worksheet.getRow(3).height = 18;
  
  // Row 4: Empty spacer
  worksheet.getRow(4).height = 5;
  
  // Row 5: Report Details Header
  worksheet.mergeCells(`A5:${lastColumn}5`);
  const detailsHeaderCell = worksheet.getCell('A5');
  detailsHeaderCell.value = 'Report Details';
  detailsHeaderCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  detailsHeaderCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: argbColor }
  };
  detailsHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(5).height = 20;
  
  // Row 6 onwards: Parameters (each in merged cells)
  let currentRow = 6;
  
  // Add filter parameters
  if (parameters.academicYear) {
    worksheet.mergeCells(`A${currentRow}:${lastColumn}${currentRow}`);
    const cell = worksheet.getCell(`A${currentRow}`);
    cell.value = `Academic Year: ${parameters.academicYear}`;
    cell.font = { size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(currentRow).height = 18;
    currentRow++;
  }
  
  if (parameters.class) {
    worksheet.mergeCells(`A${currentRow}:${lastColumn}${currentRow}`);
    const cell = worksheet.getCell(`A${currentRow}`);
    cell.value = `Class: ${parameters.class}`;
    cell.font = { size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(currentRow).height = 18;
    currentRow++;
  }
  
  if (parameters.subject) {
    worksheet.mergeCells(`A${currentRow}:${lastColumn}${currentRow}`);
    const cell = worksheet.getCell(`A${currentRow}`);
    cell.value = `Subject: ${parameters.subject}`;
    cell.font = { size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(currentRow).height = 18;
    currentRow++;
  }
  
  if (parameters.month) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const monthIndex = parseInt(parameters.month) - 1;
    worksheet.mergeCells(`A${currentRow}:${lastColumn}${currentRow}`);
    const cell = worksheet.getCell(`A${currentRow}`);
    cell.value = `Month: ${monthNames[monthIndex] || parameters.month}`;
    cell.font = { size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(currentRow).height = 18;
    currentRow++;
  }
  
  if (parameters.startDate) {
    worksheet.mergeCells(`A${currentRow}:${lastColumn}${currentRow}`);
    const cell = worksheet.getCell(`A${currentRow}`);
    cell.value = `Start Date: ${parameters.startDate}`;
    cell.font = { size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(currentRow).height = 18;
    currentRow++;
  }
  
  if (parameters.endDate) {
    worksheet.mergeCells(`A${currentRow}:${lastColumn}${currentRow}`);
    const cell = worksheet.getCell(`A${currentRow}`);
    cell.value = `End Date: ${parameters.endDate}`;
    cell.font = { size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(currentRow).height = 18;
    currentRow++;
  }
  
  if (parameters.topN) {
    worksheet.mergeCells(`A${currentRow}:${lastColumn}${currentRow}`);
    const cell = worksheet.getCell(`A${currentRow}`);
    cell.value = `Top N Students: ${parameters.topN}`;
    cell.font = { size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(currentRow).height = 18;
    currentRow++;
  }
  
  // Row: Total Records
  worksheet.mergeCells(`A${currentRow}:${lastColumn}${currentRow}`);
  const recordsCell = worksheet.getCell(`A${currentRow}`);
  recordsCell.value = `Total Records: ${totalRecords}`;
  recordsCell.font = { bold: true, size: 10, color: { argb: argbColor } };
  recordsCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  worksheet.getRow(currentRow).height = 18;
  currentRow++;
  
  // Row: Generated Date
  worksheet.mergeCells(`A${currentRow}:${lastColumn}${currentRow}`);
  const dateCell = worksheet.getCell(`A${currentRow}`);
  dateCell.value = `Generated On: ${new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`;
  dateCell.font = { size: 10 };
  dateCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  dateCell.border = {
    bottom: { style: 'thin', color: { argb: 'FF000000' } }
  };
  worksheet.getRow(currentRow).height = 18;
  currentRow++;
  
  // Row: Empty spacer
  worksheet.getRow(currentRow).height = 10;
  currentRow++;
  
  return currentRow; // Return the row number where data should start
}

/**
 * Get college name
 */
async function getCollegeName(db: admin.firestore.Firestore, collegeId: string): Promise<string> {
  try {
    const collegeDoc = await db.collection('colleges').doc(collegeId).get();
    if (collegeDoc.exists) {
      const collegeData = collegeDoc.data();
      return collegeData?.collegeName || collegeData?.name || collegeId;
    }
  } catch (error) {
    console.warn('⚠️ Could not fetch college name');
  }
  return collegeId;
}

/**
 * 📊 Process Report Instance
 * Triggers when a new report instance is created
 * Handles both generic reports and special attendance reports
 */
export const processReportInstance = functions.firestore
  .document('reportInstances/{reportId}')
  .onCreate(async (snap, context) => {
    const reportId = context.params.reportId;
    const reportData = snap.data();
    
    console.log('📊 Processing report:', reportId);
    console.log('📋 Report type:', reportData.type);
    console.log('📋 Template ID:', reportData.templateId);
    
    try {
      const db = admin.firestore();
      const storage = admin.storage();
      
      // Get the template
      const templateDoc = await db.collection('reportTemplates').doc(reportData.templateId).get();
      if (!templateDoc.exists) {
        throw new Error('Template not found');
      }
      
      const template = templateDoc.data();
      const parameters = reportData.parameters || {};
      
      console.log('📋 Template:', template?.name);
      console.log('📋 Parameters:', parameters);
      
      // ============================================
      // ATTENDANCE REPORT (Special Processing)
      // ============================================
      if (template?.customDataProcessor === 'attendance' || 
          template?.dataSource?.type === 'attendance-report' ||
          reportData.type === 'attendance') {
        
        console.log('📋 Processing ATTENDANCE REPORT with special logic');
        
        // Get college brand color and name
        const brandColor = await getCollegeBrandColor(db, reportData.collegeId);
        const collegeName = await getCollegeName(db, reportData.collegeId);
        const argbColor = 'FF' + brandColor.replace('#', '');
        
        // Step 1: Query ALL students from Users table
        console.log('📋 Step 1: Fetching all students from Users table');
        console.log('   Query filters:');
        console.log('   - collegeId:', reportData.collegeId);
        console.log('   - userType: student (lowercase)');
        console.log('   - class (studentClass):', parameters.class);
        console.log('   - academicYear:', parameters.academicYear);
        
        let usersQuery: any = db.collection('users')
          .where('collegeId', '==', reportData.collegeId)
          .where('userType', '==', 'student');  // ✅ lowercase 'student'
        
        // Add filters
        if (parameters.class) {
          usersQuery = usersQuery.where('studentClass', '==', parameters.class);
        }
        
        if (parameters.academicYear) {
          usersQuery = usersQuery.where('academicYear', '==', parameters.academicYear);
        }
        
        const usersSnapshot = await usersQuery.get();
        console.log(`📊 Found ${usersSnapshot.size} students`);
        
        // Debug: Show sample students
        if (usersSnapshot.size > 0) {
          console.log('📋 Sample students:');
          usersSnapshot.docs.slice(0, 3).forEach((doc: any, index: number) => {
            const data = doc.data();
            console.log(`   ${index + 1}. ${data.fullName} (${data.studentRoll}) - Class: ${data.studentClass}, Year: ${data.academicYear}`);
          });
        } else {
          console.log('⚠️ No students found with filters. Checking all students in college...');
          
          // Try without userType filter
          const allStudents = await db.collection('users')
            .where('collegeId', '==', reportData.collegeId)
            .limit(5)
            .get();
          console.log(`   Total users in college: ${allStudents.size}`);
          
          if (allStudents.size > 0) {
            console.log('   Sample users (without userType filter):');
            allStudents.docs.forEach((doc: any, index: number) => {
              const data = doc.data();
              console.log(`   ${index + 1}.`, JSON.stringify({
                userId: doc.id,
                fullName: data.fullName,
                userType: data.userType,
                studentClass: data.studentClass,
                academicYear: data.academicYear,
                collegeId: data.collegeId
              }));
            });
          } else {
            // Check ANY user in the collection
            console.log('   No users with collegeId filter. Checking ANY users...');
            const anyUsers = await db.collection('users').limit(5).get();
            console.log(`   Total users in collection: ${anyUsers.size}`);
            if (anyUsers.size > 0) {
              console.log('   Sample users (no filters):');
              anyUsers.docs.forEach((doc: any, index: number) => {
                const data = doc.data();
                console.log(`   ${index + 1}.`, JSON.stringify({
                  userId: doc.id,
                  fullName: data.fullName,
                  userType: data.userType,
                  studentClass: data.studentClass,
                  academicYear: data.academicYear,
                  collegeId: data.collegeId
                }));
              });
            }
          }
        }
        
        if (usersSnapshot.empty) {
          await snap.ref.update({
            status: 'available',
            totalRecords: 0,
            processedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log('⚠️ No students found');
          return;
        }
        
        // Step 2: Get exam details
        console.log('📋 Step 2: Fetching exam details');
        const examDoc = await db.collection('exams').doc(parameters.examId).get();
        if (!examDoc.exists) {
          throw new Error('Exam not found');
        }
        const examData = examDoc.data();
        console.log(`📊 Exam: ${examData?.title || examData?.examTitle}`);
        console.log(`   - Duration: ${examData?.duration} mins`);
        console.log(`   - Maximum Marks: ${examData?.maxMarks}`);
        console.log(`   - Examiner: ${examData?.createdByName}`);
        
        // Step 3: Query attendance records
        console.log('📋 Step 3: Fetching attendance records');
        const attendanceSnapshot = await db.collection('attendance')
          .where('examId', '==', parameters.examId)
          .get();
        
        console.log(`📊 Found ${attendanceSnapshot.size} attendance records (present students)`);
        
        // Create attendance map
        const attendanceMap = new Map();
        attendanceSnapshot.forEach((doc: any) => {
          const data = doc.data();
          attendanceMap.set(data.studentId, data);
        });
        
        // Step 4: Combine data
        console.log('📋 Step 4: Combining student and attendance data');
        const processedData: any[] = [];
        
        usersSnapshot.forEach((userDoc: any) => {
          const student = userDoc.data();
          const attendance = attendanceMap.get(userDoc.id);
          
          // Build row dynamically from template fields
          const row: any = {};
          
          if (template?.dataSource?.fields) {
            template.dataSource.fields.forEach((field: any) => {
              const fieldId = field.id;
              const sourceField = field.field;
              
              // Map data based on source
              if (field.source === 'user') {
                // From user document
                if (sourceField === 'fullName') {
                  row[fieldId] = student.fullName || 'N/A';
                } else if (sourceField === 'rollNumber') {
                  row[fieldId] = student.studentRoll || 'N/A';
                } else if (sourceField === 'class') {
                  row[fieldId] = student.studentClass || 'N/A';
                } else {
                  row[fieldId] = student[sourceField] || 'N/A';
                }
              } else if (field.source === 'filter') {
                // From filter parameters
                row[fieldId] = parameters[sourceField] || 'N/A';
              } else if (field.source === 'exam') {
                // From exam document
                if (sourceField === 'examTitle') {
                  row[fieldId] = examData?.title || examData?.examTitle || 'N/A';
                } else if (sourceField === 'examDate') {
                  row[fieldId] = examData?.examDate || 'N/A';
                } else if (sourceField === 'duration' && field.format === 'duration') {
                  row[fieldId] = examData?.duration ? `${examData.duration} mins` : 'N/A';
                } else {
                  row[fieldId] = examData?.[sourceField] || 'N/A';
                }
              } else if (field.source === 'attendance') {
                // From attendance document
                if (fieldId === 'attendanceStatus') {
                  row[fieldId] = attendance ? 'Present' : field.defaultValue || 'Absent';
                } else if (fieldId === 'markedAt') {
                  if (attendance && attendance[sourceField]) {
                    try {
                      let date;
                      if (attendance[sourceField].toDate && typeof attendance[sourceField].toDate === 'function') {
                        date = attendance[sourceField].toDate();
                      } else {
                        date = new Date(attendance[sourceField]);
                      }
                      
                      if (field.format === 'dd MMM yyyy HH:mm') {
                        row[fieldId] = date.toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                      } else {
                        row[fieldId] = date.toLocaleString('en-GB');
                      }
                    } catch (e) {
                      console.error('Error formatting date:', e);
                      row[fieldId] = '-';
                    }
                  } else {
                    row[fieldId] = '-';
                  }
                } else {
                  row[fieldId] = attendance?.[sourceField] || '-';
                }
              }
            });
          }
          
          processedData.push(row);
        });
        
        console.log(`📊 Generated ${processedData.length} attendance records`);
        console.log(`   - Present: ${processedData.filter(r => r.attendanceStatus === 'Present').length}`);
        console.log(`   - Absent: ${processedData.filter(r => r.attendanceStatus === 'Absent').length}`);
        
        // Generate Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance Report');
        
        // Add professional header
        const dataStartRow = addProfessionalHeader(
          worksheet,
          template?.name || 'Attendance Report',
          template?.description || 'Exam attendance tracking',
          parameters,
          processedData.length,
          brandColor,
          collegeName,
          template?.dataSource?.fields?.length || 14
        );
        
        // Add column headers at dataStartRow
        if (template?.dataSource?.fields) {
          const headerRow = worksheet.getRow(dataStartRow);
          template.dataSource.fields.forEach((field: any, index: number) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = field.label;
            cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: argbColor }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
            
            // Set column width
            worksheet.getColumn(index + 1).width = (field.width || 150) / 10;
          });
          headerRow.height = 25;
        }
        
        // Add data rows starting from dataStartRow + 1
        processedData.forEach((row: any, rowIndex: number) => {
          const excelRow = worksheet.getRow(dataStartRow + 1 + rowIndex);
          
          if (template?.dataSource?.fields) {
            template.dataSource.fields.forEach((field: any, colIndex: number) => {
              const cell = excelRow.getCell(colIndex + 1);
              cell.value = row[field.id];
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              };
            });
          }
          
          // Color code attendance status
          const statusColIndex = template?.dataSource?.fields?.findIndex((f: any) => f.id === 'attendanceStatus') + 1;
          if (statusColIndex > 0) {
            const cell = excelRow.getCell(statusColIndex);
            if (row.attendanceStatus === 'Present') {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD4EDDA' } // Light green
              };
            } else {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF8D7DA' } // Light red
              };
            }
          }
        });
        
        // Generate buffer and convert to Uint8Array
        const buffer = await workbook.xlsx.writeBuffer();
        const uint8Buffer = new Uint8Array(buffer);
        
        // Upload to Storage
        const fileName = `reports/${reportId}_${Date.now()}.xlsx`;
        const file = storage.bucket().file(fileName);
        
        await file.save(uint8Buffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          metadata: {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        });
        
        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;
        
        // Update report instance
        await snap.ref.update({
          status: 'available',
          dataUrl: publicUrl,
          totalRecords: processedData.length,
          processedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Attendance report generated successfully');
        console.log('📊 Total records:', processedData.length);
        console.log('📎 File URL:', publicUrl);
        
        return;
      }
      
      // ============================================
      // STUDENT PERFORMANCE REPORT (Special Processing)
      // ============================================
      if (template?.customDataProcessor === 'performance' || 
          template?.dataSource?.type === 'performance-report' ||
          reportData.type === 'performance') {
        
        console.log('📋 Processing STUDENT PERFORMANCE REPORT with special logic');
        
        // Get college brand color and name
        const brandColor = await getCollegeBrandColor(db, reportData.collegeId);
        const collegeName = await getCollegeName(db, reportData.collegeId);
        const argbColor = 'FF' + brandColor.replace('#', '');
        
        // Step 1: Query ALL students
        console.log('📋 Step 1: Fetching all students');
        let usersQuery: any = db.collection('users')
          .where('collegeId', '==', reportData.collegeId)
          .where('userType', '==', 'student');
        
        if (parameters.class) {
          usersQuery = usersQuery.where('studentClass', '==', parameters.class);
        }
        
        if (parameters.academicYear) {
          usersQuery = usersQuery.where('academicYear', '==', parameters.academicYear);
        }
        
        const usersSnapshot = await usersQuery.get();
        console.log(`📊 Found ${usersSnapshot.size} students`);
        
        if (usersSnapshot.empty) {
          await snap.ref.update({
            status: 'available',
            totalRecords: 0,
            processedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log('⚠️ No students found');
          return;
        }
        
        // Step 2: Query all exams for this class + academicYear
        console.log('📋 Step 2: Fetching all exams for the class');
        const examsQuery = db.collection('exams')
          .where('collegeId', '==', reportData.collegeId)
          .where('class', '==', parameters.class)
          .where('year', '==', parameters.academicYear);
        
        const examsSnapshot = await examsQuery.get();
        console.log(`📊 Found ${examsSnapshot.size} exams conducted`);
        
        if (examsSnapshot.empty) {
          await snap.ref.update({
            status: 'available',
            totalRecords: 0,
            processedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log('⚠️ No exams found for this class');
          return;
        }
        
        const examIds = examsSnapshot.docs.map((doc: any) => doc.id);
        const totalExams = examIds.length;
        
        // Step 3: Process each student
        console.log('📋 Step 3: Processing student performance data');
        const studentPerformanceData: any[] = [];
        
        for (const userDoc of usersSnapshot.docs) {
          const student = userDoc.data();
          const studentId = userDoc.id;
          
          // Query examAttempts for this student
          const attemptsQuery = db.collection('examAttempts')
            .where('studentId', '==', studentId)
            .where('examId', 'in', examIds.slice(0, 10)); // Firestore 'in' limit is 10
          
          const attemptsSnapshot = await attemptsQuery.get();
          
          // Query attendance for this student
          const attendanceQuery = db.collection('attendance')
            .where('studentId', '==', studentId)
            .where('examId', 'in', examIds.slice(0, 10));
          
          const attendanceSnapshot = await attendanceQuery.get();
          
          // Calculate metrics
          const examsAttended = attendanceSnapshot.size;
          const examsAbsent = totalExams - examsAttended;
          const attendanceRate = totalExams > 0 ? (examsAttended / totalExams) * 100 : 0;
          
          let totalObtained = 0;
          let totalMaximum = 0;
          const scores: number[] = [];
          
          attemptsSnapshot.forEach((doc: any) => {
            const attempt = doc.data();
            const obtained = parseFloat(attempt.obtainedMarks || 0);
            const maximum = parseFloat(attempt.maximumScore || 0);
            
            totalObtained += obtained;
            totalMaximum += maximum;
            
            if (maximum > 0) {
              const percentage = (obtained / maximum) * 100;
              scores.push(percentage);
            }
          });
          
          const overallPercentage = totalMaximum > 0 ? (totalObtained / totalMaximum) * 100 : 0;
          const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
          const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
          
          // Calculate grade
          let grade = 'F';
          if (overallPercentage >= 90) grade = 'A+';
          else if (overallPercentage >= 80) grade = 'A';
          else if (overallPercentage >= 70) grade = 'B+';
          else if (overallPercentage >= 60) grade = 'B';
          else if (overallPercentage >= 50) grade = 'C';
          else if (overallPercentage >= 40) grade = 'D';
          
          studentPerformanceData.push({
            studentId,
            studentName: student.fullName || 'N/A',
            rollNumber: student.studentRoll || 'N/A',
            totalExams,
            examsAttended,
            examsAbsent,
            attendanceRate: attendanceRate.toFixed(1),
            totalObtained: totalObtained.toFixed(0),
            totalMaximum,
            overallPercentage: overallPercentage.toFixed(1),
            grade,
            highestScore: highestScore.toFixed(1),
            lowestScore: lowestScore.toFixed(1),
            rawPercentage: overallPercentage // For sorting
          });
        }
        
        // Step 4: Calculate ranks (sort by overall percentage)
        console.log('📋 Step 4: Calculating ranks');
        studentPerformanceData.sort((a, b) => b.rawPercentage - a.rawPercentage);
        
        studentPerformanceData.forEach((student, index) => {
          student.rank = index + 1;
          student.serialNumber = index + 1;
          delete student.rawPercentage; // Remove temp field
        });
        
        console.log(`📊 Processed ${studentPerformanceData.length} students`);
        
        // Step 5: Generate Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Student Performance');
        
        // Add professional header
        const dataStartRow = addProfessionalHeader(
          worksheet,
          template?.name || 'Student Performance Analytics',
          template?.description || 'Comprehensive performance analysis for all students',
          parameters,
          studentPerformanceData.length,
          brandColor,
          collegeName,
          template?.dataSource?.fields?.length || 14
        );
        
        // Add column headers at dataStartRow
        if (template?.dataSource?.fields) {
          const headerRow = worksheet.getRow(dataStartRow);
          template.dataSource.fields.forEach((field: any, index: number) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = field.label;
            cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: argbColor }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
            
            // Set column width
            worksheet.getColumn(index + 1).width = (field.width || 100) / 10;
          });
          headerRow.height = 25;
        }
        
        // Add data rows with color coding
        studentPerformanceData.forEach((student: any, rowIndex: number) => {
          const excelRow = worksheet.getRow(dataStartRow + 1 + rowIndex);
          
          if (template?.dataSource?.fields) {
            template.dataSource.fields.forEach((field: any, colIndex: number) => {
              const cell = excelRow.getCell(colIndex + 1);
              cell.value = student[field.id];
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              };
            });
          }
          
          // Color code overall percentage
          const percentColIndex = template?.dataSource?.fields?.findIndex((f: any) => f.id === 'overallPercentage') + 1;
          if (percentColIndex > 0) {
            const cell = excelRow.getCell(percentColIndex);
            const percentage = parseFloat(student.overallPercentage);
            if (percentage >= 75) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD4EDDA' } // Green
              };
            } else if (percentage >= 50) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFF3CD' } // Yellow
              };
            } else {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF8D7DA' } // Red
              };
            }
          }
          
          // Color code attendance rate
          const attendColIndex = template?.dataSource?.fields?.findIndex((f: any) => f.id === 'attendanceRate') + 1;
          if (attendColIndex > 0) {
            const cell = excelRow.getCell(attendColIndex);
            const attendRate = parseFloat(student.attendanceRate);
            if (attendRate >= 75) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD4EDDA' } // Green
              };
            } else if (attendRate >= 50) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFF3CD' } // Yellow
              };
            } else {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF8D7DA' } // Red
              };
            }
          }
        });
        
        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();
        const uint8Buffer = new Uint8Array(buffer);
        
        // Upload to Storage
        const fileName = `reports/${reportId}_${Date.now()}.xlsx`;
        const file = storage.bucket().file(fileName);
        
        await file.save(uint8Buffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          metadata: {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        });
        
        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;
        
        // Update report instance
        await snap.ref.update({
          status: 'available',
          dataUrl: publicUrl,
          totalRecords: studentPerformanceData.length,
          processedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Student Performance report generated successfully');
        console.log('📊 Total students:', studentPerformanceData.length);
        console.log('📎 File URL:', publicUrl);
        
        return;
      }
      
      // ============================================
      // EXAM-WISE VIOLATIONS REPORT (Special Processing)
      // ============================================
      if (template?.customDataProcessor === 'violations' || 
          template?.dataSource?.type === 'violations-report' ||
          reportData.type === 'violations') {
        
        console.log('📋 Processing EXAM-WISE VIOLATIONS REPORT with special logic');
        
        // Get college brand color and name
        const brandColor = await getCollegeBrandColor(db, reportData.collegeId);
        const collegeName = await getCollegeName(db, reportData.collegeId);
        const argbColor = 'FF' + brandColor.replace('#', '');
        
        // Parse date range
        const startDate = new Date(parameters.startDate);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(parameters.endDate);
        endDate.setHours(23, 59, 59, 999);
        
        console.log(`📋 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
        console.log(`📋 Class: ${parameters.class}`);
        
        // Step 1: Query all exams in date range for the class
        console.log('📋 Step 1: Fetching exams in date range');
        const examsQuery = db.collection('exams')
          .where('collegeId', '==', reportData.collegeId)
          .where('class', '==', parameters.class)
          .where('securityLevel', '==', 'secure')
          .where('createdAt', '>=', startDate)
          .where('createdAt', '<=', endDate);
        
        const examsSnapshot = await examsQuery.get();
        console.log(`📊 Found ${examsSnapshot.size} exams`);
        
        if (examsSnapshot.empty) {
          await snap.ref.update({
            status: 'available',
            totalRecords: 0,
            processedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log('⚠️ No exams found in date range');
          return;
        }
        
        // Step 2: Process each exam
        console.log('📋 Step 2: Processing violations for each exam');
        const examViolationsData: any[] = [];
        
        for (const examDoc of examsSnapshot.docs) {
          const exam = examDoc.data();
          const examId = examDoc.id;
          
          // Get attendance count (students who attended)
          const attendanceSnapshot = await db.collection('attendance')
            .where('examId', '==', examId)
            .get();
          
          const studentsAttended = attendanceSnapshot.size;
          
          // Get all exam attempts for this exam
          const attemptsSnapshot = await db.collection('examAttempts')
            .where('examId', '==', examId)
            .get();
          
          // Count violations
          let totalViolations = 0;
          let fullscreenExit = 0;
          let tabSwitch = 0;
          let windowBlur = 0;
          let copyAttempt = 0;
          let rightClick = 0;
          let consoleOpen = 0;
          const studentViolationCount = new Map<string, number>();
          
          attemptsSnapshot.forEach((doc: any) => {
            const attempt = doc.data();
            const violations = attempt.violations || [];
            
            violations.forEach((violation: any) => {
              totalViolations++;
              
              // Count by type
              switch(violation.type) {
                case 'fullscreen_exit':
                case 'fullscreenExit':
                  fullscreenExit++;
                  break;
                case 'tab_switch':
                case 'tabSwitch':
                  tabSwitch++;
                  break;
                case 'window_blur':
                case 'windowBlur':
                  windowBlur++;
                  break;
                case 'copy_attempt':
                case 'copyAttempt':
                  copyAttempt++;
                  break;
                case 'right_click':
                case 'rightClick':
                  rightClick++;
                  break;
                case 'console_open':
                case 'consoleOpen':
                  consoleOpen++;
                  break;
              }
            });
            
            // Track per student
            const studentId = attempt.studentId;
            const studentViolations = violations.length;
            studentViolationCount.set(
              studentId,
              (studentViolationCount.get(studentId) || 0) + studentViolations
            );
          });
          
          // Count high-risk students (10+ violations)
          let highRiskStudents = 0;
          studentViolationCount.forEach(count => {
            if (count >= 10) {
              highRiskStudents++;
            }
          });
          
          // Determine risk level
          let riskLevel = 'Low';
          if (totalViolations >= 50) {
            riskLevel = 'High';
          } else if (totalViolations >= 20) {
            riskLevel = 'Medium';
          }
          
          examViolationsData.push({
            examId,
            examTitle: exam.title || exam.examTitle || 'N/A',
            subject: exam.subject || 'N/A',
            examDate: exam.examDate || 'N/A',
            examTime: exam.examTime || 'N/A',
            studentsAttended,
            totalViolations,
            fullscreenExit,
            tabSwitch,
            windowBlur,
            copyAttempt,
            rightClick,
            consoleOpen,
            highRiskStudents,
            riskLevel,
            createdAt: exam.createdAt
          });
        }
        
        // Step 3: Sort by date
        console.log('📋 Step 3: Sorting exams by date');
        examViolationsData.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return a.createdAt.toDate() - b.createdAt.toDate();
          }
          return 0;
        });
        
        // Add serial numbers
        examViolationsData.forEach((exam, index) => {
          exam.serialNumber = index + 1;
          delete exam.createdAt; // Remove temp field
        });
        
        console.log(`📊 Processed ${examViolationsData.length} exams with violations data`);
        
        // Step 4: Collect high-risk students data
        console.log('📋 Step 4: Collecting high-risk students details');
        const highRiskStudentsData: any[] = [];
        
        for (const examData of examViolationsData) {
          const examId = examData.examId;
          
          // Get all attempts for this exam
          const attemptsSnapshot = await db.collection('examAttempts')
            .where('examId', '==', examId)
            .get();
          
          // Count violations per student
          const studentViolations = new Map<string, any>();
          
          attemptsSnapshot.forEach((doc: any) => {
            const attempt = doc.data();
            const studentId = attempt.studentId;
            const violations = attempt.violations || [];
            
            if (!studentViolations.has(studentId)) {
              studentViolations.set(studentId, {
                studentId,
                studentName: attempt.studentName || 'N/A',
                rollNumber: attempt.rollNumber || 'N/A',
                totalViolations: 0,
                fullscreenExit: 0,
                tabSwitch: 0,
                windowBlur: 0,
                copyAttempt: 0,
                rightClick: 0,
                consoleOpen: 0
              });
            }
            
            const studentData = studentViolations.get(studentId);
            studentData.totalViolations += violations.length;
            
            violations.forEach((violation: any) => {
              switch(violation.type) {
                case 'fullscreen_exit':
                case 'fullscreenExit':
                  studentData.fullscreenExit++;
                  break;
                case 'tab_switch':
                case 'tabSwitch':
                  studentData.tabSwitch++;
                  break;
                case 'window_blur':
                case 'windowBlur':
                  studentData.windowBlur++;
                  break;
                case 'copy_attempt':
                case 'copyAttempt':
                  studentData.copyAttempt++;
                  break;
                case 'right_click':
                case 'rightClick':
                  studentData.rightClick++;
                  break;
                case 'console_open':
                case 'consoleOpen':
                  studentData.consoleOpen++;
                  break;
              }
            });
          });
          
          // Filter high-risk students (10+ violations)
          studentViolations.forEach(student => {
            if (student.totalViolations >= 10) {
              highRiskStudentsData.push({
                examTitle: examData.examTitle,
                examDate: examData.examDate,
                subject: examData.subject,
                ...student
              });
            }
          });
        }
        
        console.log(`📊 Found ${highRiskStudentsData.length} high-risk student records`);
        
        // Step 5: Generate Excel with two sheets
        const workbook = new ExcelJS.Workbook();
        
        // ============================================
        // SHEET 1: EXAM-WISE VIOLATIONS SUMMARY
        // ============================================
        const worksheet1 = workbook.addWorksheet('Exam Violations Summary');
        
        // Add professional header
        const dataStartRow = addProfessionalHeader(
          worksheet1,
          template?.name || 'Exam-wise Violations Summary',
          template?.description || 'Security violations detected during exams',
          parameters,
          examViolationsData.length,
          brandColor,
          collegeName,
          template?.dataSource?.fields?.length || 15 // 15 columns (A to O)
        );
        
        // Add column headers at dataStartRow
        if (template?.dataSource?.fields) {
          const headerRow = worksheet1.getRow(dataStartRow);
          template.dataSource.fields.forEach((field: any, index: number) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = field.label;
            cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: argbColor }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
            
            // Set column width
            worksheet1.getColumn(index + 1).width = (field.width || 100) / 10;
          });
          headerRow.height = 25;
        }
        
        // Add data rows with color coding
        examViolationsData.forEach((exam: any, rowIndex: number) => {
          const excelRow = worksheet1.getRow(dataStartRow + 1 + rowIndex);
          
          if (template?.dataSource?.fields) {
            template.dataSource.fields.forEach((field: any, colIndex: number) => {
              const cell = excelRow.getCell(colIndex + 1);
              cell.value = exam[field.id];
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              };
            });
          }
          
          // Color code risk level
          const riskColIndex = template?.dataSource?.fields?.findIndex((f: any) => f.id === 'riskLevel') + 1;
          if (riskColIndex > 0) {
            const cell = excelRow.getCell(riskColIndex);
            if (exam.riskLevel === 'High') {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF8D7DA' } // Red
              };
              cell.font = { bold: true, color: { argb: 'FF721C24' } };
            } else if (exam.riskLevel === 'Medium') {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFF3CD' } // Yellow
              };
              cell.font = { bold: true, color: { argb: 'FF856404' } };
            } else {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD4EDDA' } // Green
              };
              cell.font = { bold: true, color: { argb: 'FF155724' } };
            }
          }
          
          // Color code total violations
          const violationsColIndex = template?.dataSource?.fields?.findIndex((f: any) => f.id === 'totalViolations') + 1;
          if (violationsColIndex > 0) {
            const cell = excelRow.getCell(violationsColIndex);
            const violations = exam.totalViolations;
            if (violations >= 50) {
              cell.font = { bold: true, color: { argb: 'FFDC3545' } };
            } else if (violations >= 20) {
              cell.font = { bold: true, color: { argb: 'FFFFC107' } };
            }
          }
        });
        
        // ============================================
        // SHEET 2: HIGH-RISK STUDENTS BY EXAM
        // ============================================
        const worksheet2 = workbook.addWorksheet('High-Risk Students');
        
        // Add professional header
        const dataStartRow2 = addProfessionalHeader(
          worksheet2,
          'High-Risk Students by Exam',
          'Students with 10+ violations per exam (detailed breakdown)',
          parameters,
          highRiskStudentsData.length,
          brandColor,
          collegeName,
          12 // 12 columns (A to L)
        );
        
        // Define columns for high-risk students sheet
        const highRiskColumns = [
          { header: 'Exam Title', key: 'examTitle', width: 25 },
          { header: 'Exam Date', key: 'examDate', width: 12 },
          { header: 'Subject', key: 'subject', width: 15 },
          { header: 'Student Name', key: 'studentName', width: 20 },
          { header: 'Roll Number', key: 'rollNumber', width: 12 },
          { header: 'Total Violations', key: 'totalViolations', width: 15 },
          { header: 'Fullscreen Exit', key: 'fullscreenExit', width: 13 },
          { header: 'Tab Switch', key: 'tabSwitch', width: 12 },
          { header: 'Window Blur', key: 'windowBlur', width: 12 },
          { header: 'Copy Attempt', key: 'copyAttempt', width: 13 },
          { header: 'Right Click', key: 'rightClick', width: 11 },
          { header: 'Console Open', key: 'consoleOpen', width: 13 }
        ];
        
        // Add column headers
        const headerRow2 = worksheet2.getRow(dataStartRow2);
        highRiskColumns.forEach((col, index) => {
          const cell = headerRow2.getCell(index + 1);
          cell.value = col.header;
          cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: argbColor }
          };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          worksheet2.getColumn(index + 1).width = col.width;
        });
        headerRow2.height = 25;
        
        // Add data rows
        highRiskStudentsData.forEach((student: any, rowIndex: number) => {
          const excelRow = worksheet2.getRow(dataStartRow2 + 1 + rowIndex);
          
          highRiskColumns.forEach((col, colIndex) => {
            const cell = excelRow.getCell(colIndex + 1);
            cell.value = student[col.key];
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
            
            // Color code total violations
            if (col.key === 'totalViolations') {
              const violations = student.totalViolations;
              if (violations >= 20) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFF8D7DA' } // Red
                };
                cell.font = { bold: true, color: { argb: 'FF721C24' } };
              } else if (violations >= 15) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFFF3CD' } // Yellow
                };
                cell.font = { bold: true, color: { argb: 'FF856404' } };
              } else {
                cell.font = { bold: true };
              }
            }
          });
        });
        
        // Add note if no high-risk students found
        if (highRiskStudentsData.length === 0) {
          worksheet2.mergeCells(`A${dataStartRow2 + 1}:L${dataStartRow2 + 1}`);
          const noteCell = worksheet2.getCell(`A${dataStartRow2 + 1}`);
          noteCell.value = '✅ No high-risk students found (all students had fewer than 10 violations per exam)';
          noteCell.font = { italic: true, size: 11, color: { argb: 'FF28A745' } };
          noteCell.alignment = { vertical: 'middle', horizontal: 'center' };
          worksheet2.getRow(dataStartRow2 + 1).height = 25;
        }
        
        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();
        const uint8Buffer = new Uint8Array(buffer);
        
        // Upload to Storage
        const fileName = `reports/${reportId}_${Date.now()}.xlsx`;
        const file = storage.bucket().file(fileName);
        
        await file.save(uint8Buffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          metadata: {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        });
        
        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;
        
        // Update report instance
        await snap.ref.update({
          status: 'available',
          dataUrl: publicUrl,
          totalRecords: examViolationsData.length,
          processedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Exam-wise Violations report generated successfully');
        console.log('📊 Sheet 1: Exam Violations Summary -', examViolationsData.length, 'exams');
        console.log('📊 Sheet 2: High-Risk Students -', highRiskStudentsData.length, 'student records');
        console.log('📎 File URL:', publicUrl);
        
        return;
      }
      
      // ============================================
      // TOP PERFORMERS LEADERBOARD (Special Processing)
      // ============================================
      if (template?.customDataProcessor === 'leaderboard' || 
          template?.dataSource?.type === 'leaderboard-report' ||
          reportData.type === 'leaderboard') {
        
        console.log('📋 Processing TOP PERFORMERS LEADERBOARD with special logic');
        
        // Get college brand color and name
        const brandColor = await getCollegeBrandColor(db, reportData.collegeId);
        const collegeName = await getCollegeName(db, reportData.collegeId);
        const argbColor = 'FF' + brandColor.replace('#', '');
        
        // Parse date range
        const startDate = new Date(parameters.startDate);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(parameters.endDate);
        endDate.setHours(23, 59, 59, 999);
        
        const topN = parseInt(parameters.topN) || 100;
        
        console.log(`📋 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
        console.log(`📋 Class: ${parameters.class || 'ALL CLASSES'}`);
        console.log(`📋 Top N: ${topN}`);
        
        // Step 1: Query students
        console.log('📋 Step 1: Fetching students');
        let usersQuery: any = db.collection('users')
          .where('collegeId', '==', reportData.collegeId)
          .where('userType', '==', 'student');
        
        // Add class filter if provided (optional)
        if (parameters.class) {
          usersQuery = usersQuery.where('studentClass', '==', parameters.class);
          console.log('   - Filtering by class:', parameters.class);
        } else {
          console.log('   - No class filter (ALL CLASSES)');
        }
        
        const usersSnapshot = await usersQuery.get();
        console.log(`📊 Found ${usersSnapshot.size} students`);
        
        if (usersSnapshot.empty) {
          await snap.ref.update({
            status: 'available',
            totalRecords: 0,
            processedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log('⚠️ No students found');
          return;
        }
        
        // Step 2: Query all exams in date range
        console.log('📋 Step 2: Fetching exams in date range');
        let examsQuery: any = db.collection('exams')
          .where('collegeId', '==', reportData.collegeId)
          .where('createdAt', '>=', startDate)
          .where('createdAt', '<=', endDate);
        
        // If class is specified, filter exams by class too
        if (parameters.class) {
          examsQuery = examsQuery.where('class', '==', parameters.class);
        }
        
        const examsSnapshot = await examsQuery.get();
        console.log(`📊 Found ${examsSnapshot.size} exams`);
        
        if (examsSnapshot.empty) {
          await snap.ref.update({
            status: 'available',
            totalRecords: 0,
            processedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log('⚠️ No exams found in date range');
          return;
        }
        
        const examIds = examsSnapshot.docs.map((doc: any) => doc.id);
        const totalExams = examIds.length;
        
        // Step 3: Process each student's performance
        console.log('📋 Step 3: Calculating student performance');
        const studentPerformanceData: any[] = [];
        
        for (const userDoc of usersSnapshot.docs) {
          const student = userDoc.data();
          const studentId = userDoc.id;
          
          // Query attendance for this student in the date range
          const attendanceQuery = db.collection('attendance')
            .where('studentId', '==', studentId);
          
          const attendanceSnapshot = await attendanceQuery.get();
          
          // Count attendance in exam IDs
          let examsAttended = 0;
          attendanceSnapshot.forEach((doc: any) => {
            const data = doc.data();
            if (examIds.includes(data.examId)) {
              examsAttended++;
            }
          });
          
          // Query examAttempts for this student
          const attemptsQuery = db.collection('examAttempts')
            .where('studentId', '==', studentId);
          
          const attemptsSnapshot = await attemptsQuery.get();
          
          // Filter attempts within date range and matching exam IDs
          let totalObtained = 0;
          let totalMaximum = 0;
          const scores: number[] = [];
          let examsAttempted = 0;
          
          attemptsSnapshot.forEach((doc: any) => {
            const attempt = doc.data();
            
            // Check if this attempt is for an exam in our date range
            if (examIds.includes(attempt.examId)) {
              examsAttempted++;
              
              const obtained = parseFloat(attempt.obtainedMarks || 0);
              const maximum = parseFloat(attempt.maximumScore || 0);
              
              totalObtained += obtained;
              totalMaximum += maximum;
              
              if (maximum > 0) {
                const percentage = (obtained / maximum) * 100;
                scores.push(percentage);
              }
            }
          });
          
          // Skip students who didn't attempt any exams
          if (examsAttempted === 0) {
            continue;
          }
          
          const attendanceRate = totalExams > 0 ? (examsAttended / totalExams) * 100 : 0;
          const overallPercentage = totalMaximum > 0 ? (totalObtained / totalMaximum) * 100 : 0;
          const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
          const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
          const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          
          // Calculate consistency (standard deviation)
          let consistency = 'N/A';
          if (scores.length > 1) {
            const mean = averageScore;
            const squareDiffs = scores.map(score => Math.pow(score - mean, 2));
            const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / scores.length;
            const stdDev = Math.sqrt(avgSquareDiff);
            
            if (stdDev < 5) consistency = 'Excellent';
            else if (stdDev < 10) consistency = 'Very Good';
            else if (stdDev < 15) consistency = 'Good';
            else consistency = 'Variable';
          }
          
          // Calculate grade
          let grade = 'F';
          if (overallPercentage >= 90) grade = 'A+';
          else if (overallPercentage >= 80) grade = 'A';
          else if (overallPercentage >= 70) grade = 'B+';
          else if (overallPercentage >= 60) grade = 'B';
          else if (overallPercentage >= 50) grade = 'C';
          else if (overallPercentage >= 40) grade = 'D';
          
          studentPerformanceData.push({
            studentId,
            studentName: student.fullName || 'N/A',
            rollNumber: student.studentRoll || 'N/A',
            class: student.studentClass || 'N/A',
            examsAttempted,
            examsAttended,
            attendanceRate: attendanceRate.toFixed(1),
            totalObtained: totalObtained.toFixed(0),
            totalMaximum,
            overallPercentage: overallPercentage.toFixed(1),
            grade,
            highestScore: highestScore.toFixed(1),
            lowestScore: lowestScore.toFixed(1),
            averageScore: averageScore.toFixed(1),
            consistency,
            rawPercentage: overallPercentage // For sorting
          });
        }
        
        console.log(`📊 Processed ${studentPerformanceData.length} students with performance data`);
        
        // Step 4: Sort by overall percentage and get top N
        console.log(`📋 Step 4: Ranking and selecting top ${topN} students`);
        studentPerformanceData.sort((a, b) => b.rawPercentage - a.rawPercentage);
        
        // Take top N students
        const topStudents = studentPerformanceData.slice(0, topN);
        
        // Add ranks
        topStudents.forEach((student, index) => {
          student.rank = index + 1;
          delete student.rawPercentage; // Remove temp field
        });
        
        console.log(`📊 Selected top ${topStudents.length} students`);
        
        // Step 5: Generate Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Top Performers Leaderboard');
        
        // Modify parameters for header display
        const headerParams = { ...parameters };
        if (!parameters.class) {
          headerParams.class = 'All Classes';
        }
        headerParams.topN = topN;
        
        // Add professional header
        const dataStartRow = addProfessionalHeader(
          worksheet,
          template?.name || 'Top Performers Leaderboard',
          template?.description || 'Ranking of top performing students',
          headerParams,
          topStudents.length,
          brandColor,
          collegeName,
          template?.dataSource?.fields?.length || 15
        );
        
        // Add column headers at dataStartRow
        if (template?.dataSource?.fields) {
          const headerRow = worksheet.getRow(dataStartRow);
          template.dataSource.fields.forEach((field: any, index: number) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = field.label;
            cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: argbColor }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
            
            // Set column width
            worksheet.getColumn(index + 1).width = (field.width || 100) / 10;
          });
          headerRow.height = 25;
        }
        
        // Add data rows with special formatting for top 3
        topStudents.forEach((student: any, rowIndex: number) => {
          const excelRow = worksheet.getRow(dataStartRow + 1 + rowIndex);
          
          if (template?.dataSource?.fields) {
            template.dataSource.fields.forEach((field: any, colIndex: number) => {
              const cell = excelRow.getCell(colIndex + 1);
              cell.value = student[field.id];
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              };
            });
          }
          
          // Special formatting for top 3
          if (student.rank <= 3) {
            excelRow.font = { bold: true };
            
            // Gold, Silver, Bronze backgrounds
            let medalColor = '';
            if (student.rank === 1) medalColor = 'FFFFD700'; // Gold
            else if (student.rank === 2) medalColor = 'FFC0C0C0'; // Silver
            else if (student.rank === 3) medalColor = 'FFCD7F32'; // Bronze
            
            const rankCell = excelRow.getCell(1); // Rank column
            rankCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: medalColor }
            };
          }
          
          // Color code overall percentage
          const percentColIndex = template?.dataSource?.fields?.findIndex((f: any) => f.id === 'overallPercentage') + 1;
          if (percentColIndex > 0) {
            const cell = excelRow.getCell(percentColIndex);
            const percentage = parseFloat(student.overallPercentage);
            
            if (percentage >= 90) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD4EDDA' } // Green
              };
              cell.font = { bold: true, color: { argb: 'FF155724' } };
            } else if (percentage >= 80) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD1ECF1' } // Light blue
              };
              cell.font = { bold: true, color: { argb: 'FF0C5460' } };
            } else if (percentage >= 70) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFF3CD' } // Yellow
              };
            }
          }
        });
        
        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();
        const uint8Buffer = new Uint8Array(buffer);
        
        // Upload to Storage
        const fileName = `reports/${reportId}_${Date.now()}.xlsx`;
        const file = storage.bucket().file(fileName);
        
        await file.save(uint8Buffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          metadata: {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        });
        
        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;
        
        // Update report instance
        await snap.ref.update({
          status: 'available',
          dataUrl: publicUrl,
          totalRecords: topStudents.length,
          processedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Top Performers Leaderboard generated successfully');
        console.log('📊 Total students in leaderboard:', topStudents.length);
        console.log('📎 File URL:', publicUrl);
        
        return;
      }
      
      // ============================================
      // GENERIC REPORT PROCESSING
      // ============================================
      console.log('📋 Processing GENERIC REPORT');
      
      // Get college brand color and name
      const brandColor = await getCollegeBrandColor(db, reportData.collegeId);
      const collegeName = await getCollegeName(db, reportData.collegeId);
      const argbColor = 'FF' + brandColor.replace('#', '');
      
      const dataSource = template?.dataSource || { collection: 'examAttempts' };
      let query: any = db.collection(dataSource.collection);
      
      // Apply filters from template
      if (template?.filters) {
        template.filters.forEach((filter: any) => {
          const paramValue = parameters[filter.id];
          if (paramValue) {
            if (filter.id === 'startDate' || filter.id === 'endDate') {
              return;
            }
            const dbField = filter.field || filter.id;
            console.log(`📋 Adding filter: ${dbField} == ${paramValue}`);
            query = query.where(dbField, '==', paramValue);
          }
        });
      }
      
      // Handle date range
      if (parameters.startDate && parameters.endDate) {
        const startDate = new Date(parameters.startDate);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(parameters.endDate);
        endDate.setHours(23, 59, 59, 999);
        
        console.log(`📋 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
        query = query.where('createdAt', '>=', startDate);
        query = query.where('createdAt', '<=', endDate);
      }
      
      // Execute query
      const snapshot = await query.get();
      console.log('📊 Found', snapshot.size, 'records');
      
      if (snapshot.empty) {
        await snap.ref.update({
          status: 'available',
          totalRecords: 0,
          processedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('⚠️ No data found');
        return;
      }
      
      // Process data
      const rawData: any[] = [];
      const studentMap = new Map<string, any>();
      
      for (const doc of snapshot.docs) {
        const record = doc.data();
        rawData.push({ id: doc.id, ...record });
        
        if (record.studentId && !studentMap.has(record.studentId)) {
          const studentDoc = await db.collection('users').doc(record.studentId).get();
          if (studentDoc.exists) {
            studentMap.set(record.studentId, studentDoc.data());
          }
        }
      }
      
      // Map fields
      const processedData = rawData.map((record: any) => {
        const student = studentMap.get(record.studentId) || {};
        const row: any = {};
        
        template?.dataSource?.fields?.forEach((field: any) => {
          const fieldId = field.id || field.name;
          const sourceField = field.field || field.id || field.name;
          
          if (field.source) {
            if (field.source.startsWith('student.')) {
              const studentField = field.source.replace('student.', '');
              row[fieldId] = student[studentField] || 'N/A';
            } else {
              row[fieldId] = record[field.source] || 'N/A';
            }
          } else {
            row[fieldId] = record[sourceField] || 'N/A';
          }
          
          // Format datetime
          if (field.type === 'datetime' && row[fieldId] && row[fieldId] !== 'N/A') {
            try {
              let date;
              if (row[fieldId].toDate && typeof row[fieldId].toDate === 'function') {
                date = row[fieldId].toDate();
              } else {
                date = new Date(row[fieldId]);
              }
              
              if (field.format === 'dd MMM yyyy') {
                row[fieldId] = date.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });
              } else {
                row[fieldId] = date.toLocaleString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
              }
            } catch (e) {
              // Keep original value
            }
          }
        });
        
        return row;
      });
      
      // Generate Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Report');
      
      // Add professional header
      const dataStartRow = addProfessionalHeader(
        worksheet,
        template?.name || 'Report',
        template?.description || 'Data report',
        parameters,
        processedData.length,
        brandColor,
        collegeName,
        template?.dataSource?.fields?.length || 14
      );
      
      // Add column headers at dataStartRow
      if (template?.dataSource?.fields) {
        const headerRow = worksheet.getRow(dataStartRow);
        template.dataSource.fields.forEach((field: any, index: number) => {
          const cell = headerRow.getCell(index + 1);
          cell.value = field.label || field.id;
          cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: argbColor }
          };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          
          // Set column width
          worksheet.getColumn(index + 1).width = (field.width || 150) / 10;
        });
        headerRow.height = 25;
      }
      
      // Add data rows
      processedData.forEach((row: any, rowIndex: number) => {
        const excelRow = worksheet.getRow(dataStartRow + 1 + rowIndex);
        
        if (template?.dataSource?.fields) {
          template.dataSource.fields.forEach((field: any, colIndex: number) => {
            const cell = excelRow.getCell(colIndex + 1);
            cell.value = row[field.id || field.name];
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          });
        }
      });
      
      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const uint8Buffer = new Uint8Array(buffer);
      
      // Upload
      const fileName = `reports/${reportId}_${Date.now()}.xlsx`;
      const file = storage.bucket().file(fileName);
      
      await file.save(uint8Buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        metadata: {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      });
      
      await file.makePublic();
      const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;
      
      await snap.ref.update({
        status: 'available',
        dataUrl: publicUrl,
        totalRecords: processedData.length,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✅ Report generated successfully');
      console.log('📊 Total records:', processedData.length);
      console.log('📎 File URL:', publicUrl);
      
    } catch (error: any) {
      console.error('❌ Error processing report:', error);
      await snap.ref.update({
        status: 'failed',
        error: error.message,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  });