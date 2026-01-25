const admin = require('firebase-admin');
const XLSX = require('xlsx');
const readlineSync = require('readline-sync');
const fs = require('fs');
const path = require('path');

// Note: Boards and valid classes now come from Excel file, not hardcoded

// Valid academic year format: YYYY-YY (e.g., 2024-25)
function isValidAcademicYear(year) {
  if (!year) return false;
  const pattern = /^\d{4}-\d{2}$/;
  return pattern.test(year);
}

// Note: Board and class validation removed - these come from Excel per college

// Initialize Firebase
console.log('🔐 Initializing Firebase...');
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({ 
  credential: admin.credential.cert(serviceAccount) 
});

const db = admin.firestore();
const auth = admin.auth();

// Normalize phone number to consistent format
function normalizePhoneNumber(phone) {
  if (!phone) {
    throw new Error('Phone number is required');
  }
  
  let cleaned = phone.toString().trim().replace(/[\s\-\(\)]/g, '');
  cleaned = cleaned.replace(/^\+/, '');
  
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  }
  
  if (cleaned.length !== 10 || !/^\d{10}$/.test(cleaned)) {
    throw new Error(`Invalid phone number: ${phone}. Must be 10 digits (got ${cleaned.length} digits: ${cleaned})`);
  }
  
  return {
    cleaned: cleaned,
    withCountryCode: `91${cleaned}`,
    withPlus: `+91${cleaned}`
  };
}

// Generate secure random password
function generateSecurePassword(length = 12) {
  const crypto = require('crypto');
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  // Ensure at least one of each type
  password += uppercase[crypto.randomInt(0, uppercase.length)];
  password += lowercase[crypto.randomInt(0, lowercase.length)];
  password += numbers[crypto.randomInt(0, numbers.length)];
  password += symbols[crypto.randomInt(0, symbols.length)];
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += allChars[crypto.randomInt(0, allChars.length)];
  }
  
  // Shuffle the password to randomize positions
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Read Excel file
function readExcel(filePath) {
  console.log(`📖 Reading Excel file: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  
  const collegesSheet = workbook.Sheets['Colleges'];
  const usersSheet = workbook.Sheets['Users'];
  const roomsSheet = workbook.Sheets['Rooms'];
  
  if (!collegesSheet) {
    throw new Error('❌ "Colleges" sheet not found in Excel file!');
  }
  if (!usersSheet) {
    throw new Error('❌ "Users" sheet not found in Excel file!');
  }
  
  const result = {
    colleges: XLSX.utils.sheet_to_json(collegesSheet),
    users: XLSX.utils.sheet_to_json(usersSheet),
    rooms: []
  };
  
  // Rooms sheet is optional
  if (roomsSheet) {
    result.rooms = XLSX.utils.sheet_to_json(roomsSheet);
  }
  
  return result;
}

// Check if college exists
async function findExistingCollege(collegeName, collegeId) {
  if (collegeId) {
    const doc = await db.collection('colleges').doc(collegeId).get();
    if (doc.exists) {
      return { exists: true, id: collegeId, method: 'id' };
    }
  }
  
  const snapshot = await db.collection('colleges')
    .where('collegeName', '==', collegeName)
    .limit(1)
    .get();
  
  if (!snapshot.empty) {
    return { exists: true, id: snapshot.docs[0].id, method: 'name' };
  }
  
  return { exists: false };
}

// Add or Update College
async function addOrUpdateCollege(data) {
  const inputId = data.college_id || data.college_name.toLowerCase().replace(/\s+/g, '_');
  const existing = await findExistingCollege(data.college_name, inputId);
  const collegeId = existing.exists ? existing.id : inputId;
  
  // Parse supported boards (comma-separated from Excel)
  const supportedBoards = data.supported_boards 
    ? data.supported_boards.split(',').map(b => b.trim()).filter(b => b.length > 0)
    : [];
  
  // Parse subjects (comma-separated)
  const subjects = data.subjects
    ? data.subjects.split(',').map(s => s.trim()).filter(s => s.length > 0)
    : [];
  
  // Parse valid classes (comma-separated)
  const validClasses = data.valid_classes
    ? data.valid_classes.split(',').map(c => c.trim()).filter(c => c.length > 0)
    : [];
  
  // Parse exam types (comma-separated)
  const examTypes = data.exam_types
    ? data.exam_types.split(',').map(e => e.trim()).filter(e => e.length > 0)
    : [];
  
  // Parse features (comma-separated)
  const features = data.features
    ? data.features.split(',').map(f => f.trim()).filter(f => f.length > 0)
    : [];
  
  // Initialize board-wise counts
  const boardWiseCounts = {};
  supportedBoards.forEach(board => {
    boardWiseCounts[board] = {
      totalStudents: 0,
      totalTeachers: 0
    };
  });
  
  const college = {
    collegeId: collegeId,
    collegeName: data.college_name,
    address: data.address || '',
    city: data.city || '',
    state: data.state || '',
    pincode: data.pincode || '',
    phone: data.phone || '',
    email: data.email || '',
    website: data.website || '',
    establishedYear: data.established_year || null,
    collegeType: data.college_type || 'school',
    supportedBoards: supportedBoards,
    subjects: subjects,
    validClasses: validClasses,
    examTypes: examTypes,
    features: features,
    boardWiseCounts: existing.exists ? undefined : boardWiseCounts, // Only set on creation
    status: 'active',
    createdBy: data.created_by || '',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  // Remove undefined fields
  Object.keys(college).forEach(key => college[key] === undefined && delete college[key]);
  
  if (existing.exists) {
    // Preserve existing boardWiseCounts on update
    await db.collection('colleges').doc(collegeId).update(college);
    console.log(`   🔄 Updated college: ${data.college_name} (${collegeId})`);
    console.log(`      📚 Boards: ${supportedBoards.join(', ')}`);
    console.log(`      📖 Subjects: ${subjects.length > 0 ? subjects.join(', ') : 'None'}`);
    console.log(`      🎓 Valid Classes: ${validClasses.length > 0 ? validClasses.join(', ') : 'None'}`);
    console.log(`      📝 Exam Types: ${examTypes.length > 0 ? examTypes.join(', ') : 'None'}`);
    console.log(`      ⭐ Features: ${features.length > 0 ? features.join(', ') : 'None'}`);
  } else {
    // Initialize role-based counts for new colleges
    college.roleCounts = {
      system_admin: 0,
      admin: 0,
      principal: 0,
      dean: 0,
      teacher: 0,
      student: 0
    };
    college.totalTeachers = 0;
    college.totalStudents = 0;
    college.totalRooms = 0; // Initialize room count
    college.createdAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('colleges').doc(collegeId).set(college);
    console.log(`   ✅ Added college: ${data.college_name} (${collegeId})`);
    console.log(`      📚 Boards: ${supportedBoards.join(', ')}`);
    console.log(`      📖 Subjects: ${subjects.length > 0 ? subjects.join(', ') : 'None'}`);
    console.log(`      🎓 Valid Classes: ${validClasses.length > 0 ? validClasses.join(', ') : 'None'}`);
    console.log(`      📝 Exam Types: ${examTypes.length > 0 ? examTypes.join(', ') : 'None'}`);
    console.log(`      ⭐ Features: ${features.length > 0 ? features.join(', ') : 'None'}`);
  }
  
  return { collegeId, supportedBoards, validClasses, subjects };
}

// Check if room exists
async function findExistingRoom(roomId, collegeId) {
  if (!roomId || !collegeId) {
    return { exists: false };
  }
  
  // Try by roomId first
  const doc = await db.collection('rooms').doc(roomId).get();
  if (doc.exists) {
    return { exists: true, id: roomId, method: 'id' };
  }
  
  // Search by roomId and collegeId combination
  const snapshot = await db.collection('rooms')
    .where('collegeId', '==', collegeId)
    .where('roomId', '==', roomId)
    .limit(1)
    .get();
  
  if (!snapshot.empty) {
    return { exists: true, id: snapshot.docs[0].id, method: 'query' };
  }
  
  return { exists: false };
}

// Add or Update Room
async function addOrUpdateRoom(data) {
  try {
    const collegeId = data.college_id;
    if (!collegeId) {
      throw new Error('college_id is required for room');
    }
    
    // Verify college exists
    const collegeDoc = await db.collection('colleges').doc(collegeId).get();
    if (!collegeDoc.exists) {
      throw new Error(`College not found: ${collegeId}`);
    }
    
    // Generate room document ID (using college_id + room_id)
    const roomId = data.room_id || `room_${Date.now()}`;
    const roomDocId = `${collegeId}_${roomId}`.replace(/\s+/g, '_').toLowerCase();
    
    const existing = await findExistingRoom(roomDocId, collegeId);
    const finalRoomDocId = existing.exists ? existing.id : roomDocId;
    
    // Handle the trailing space in "Incharge " column name
    const inchargeField = data['Incharge '] || data['Incharge'] || data['incharge'];
    
    const room = {
      roomId: roomId,
      roomName: roomId, // Using roomId as name, can be customized
      collegeId: collegeId,
      collegeName: collegeDoc.data().collegeName,
      address: data.Address || data.address || '',
      capacity: parseInt(data.Capacity || data.capacity || 0),
      inchargeUserId: inchargeField || '',
      status: 'active',
      isAvailable: true,
      createdBy: data.created_by || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (existing.exists) {
      await db.collection('rooms').doc(finalRoomDocId).update(room);
      console.log(`   🔄 Updated room: ${roomId} (${finalRoomDocId})`);
      console.log(`      🏢 College: ${collegeDoc.data().collegeName}`);
      console.log(`      📍 Address: ${room.address}`);
      console.log(`      👥 Capacity: ${room.capacity}`);
      return { roomId: finalRoomDocId, isNew: false };
    } else {
      room.createdAt = admin.firestore.FieldValue.serverTimestamp();
      await db.collection('rooms').doc(finalRoomDocId).set(room);
      
      // Increment college's totalRooms count
      await db.collection('colleges').doc(collegeId).update({
        totalRooms: admin.firestore.FieldValue.increment(1)
      });
      
      console.log(`   ✅ Added room: ${roomId} (${finalRoomDocId})`);
      console.log(`      🏢 College: ${collegeDoc.data().collegeName}`);
      console.log(`      📍 Address: ${room.address}`);
      console.log(`      👥 Capacity: ${room.capacity}`);
      return { roomId: finalRoomDocId, isNew: true };
    }
  } catch (error) {
    console.error(`   ❌ Error processing room ${data.room_id}: ${error.message}`);
    return { success: false, error: error.message, roomId: data.room_id };
  }
}

// Get permissions based on user type
function getPermissions(userType) {
  const permissions = {
    system_admin: {
      canEvaluate: true,
      canViewReports: true,
      canManageUsers: true,
      canManageColleges: true,
      canManageRooms: true,
      canManageClasses: true,
      canManageSubjects: true,
      canManageBoards: true,
      canManageExamTypes: true,
      canManageSystem: true,
      canAccessAllColleges: true,
      level: 'system'
    },
    admin: {
      canEvaluate: true,
      canViewReports: true,
      canManageUsers: true,
      canManageColleges: false,
      canManageRooms: true,
      canManageClasses: true,
      canManageSubjects: true,
      canManageBoards: true,
      canManageExamTypes: true,
      canManageSystem: false,
      canAccessAllColleges: false,
      level: 'college'
    },
    principal: {
      canEvaluate: true,
      canViewReports: true,
      canManageUsers: true,
      canManageColleges: false,
      canManageRooms: true,
      canManageClasses: true,
      canManageSubjects: true,
      canManageBoards: false,
      canManageExamTypes: true,
      canManageSystem: false,
      canAccessAllColleges: false,
      level: 'college'
    },
    dean: {
      canEvaluate: true,
      canViewReports: true,
      canManageUsers: true,
      canManageColleges: false,
      canManageRooms: true,
      canManageClasses: false,
      canManageSubjects: true,
      canManageExamTypes: false,
      canManageSystem: false,
      canAccessAllColleges: false,
      level: 'department'
    },
    teacher: {
      canEvaluate: true,
      canViewReports: true,
      canManageUsers: false,
      canManageColleges: false,
      canManageRooms: false,
      canManageClasses: false,
      canManageSubjects: false,
      canManageBoards: false,
      canManageExamTypes: false,
      canManageSystem: false,
      canAccessAllColleges: false,
      level: 'class'
    },
    student: {
      canEvaluate: false,
      canViewReports: true,
      canManageUsers: false,
      canManageColleges: false,
      canManageRooms: false,
      canManageClasses: false,
      canManageSubjects: false,
      canManageBoards: false,
      canManageExamTypes: false,
      canManageSystem: false,
      canAccessAllColleges: false,
      level: 'personal'
    }
  };
  
  return permissions[userType] || permissions.student;
}

// Check if user exists by phone
async function findUserByPhone(phone) {
  try {
    const user = await auth.getUserByPhoneNumber(phone);
    return { exists: true, uid: user.uid };
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return { exists: false };
    }
    throw error;
  }
}

// Add or Update User
async function addOrUpdateUser(data, index, collegeConfig) {
  try {
    const phoneNormalized = normalizePhoneNumber(data.phone);
    // Normalize user_type: convert to lowercase and replace spaces with underscores
    const userType = (data.user_type || 'student').toLowerCase().replace(/\s+/g, '_');
    
    // Validate user type
    const validUserTypes = ['system_admin', 'admin', 'principal', 'dean', 'teacher', 'student'];
    if (!validUserTypes.includes(userType)) {
      throw new Error(`Invalid user_type: ${userType}. Must be one of: ${validUserTypes.join(', ')}`);
    }
    
    // Check if user exists
    const existingUser = await findUserByPhone(phoneNormalized.withPlus);
    const isUpdate = existingUser.exists;
    let userId = existingUser.exists ? existingUser.uid : null;
    
    // For non-system_admin users, require college_id
    if (userType !== 'system_admin' && !data.college_id) {
      throw new Error('college_id is required for non-system_admin users');
    }
    
    // Validate college_id if provided
    let collegeId = null;
    if (data.college_id) {
      collegeId = data.college_id;
      const collegeDoc = await db.collection('colleges').doc(collegeId).get();
      if (!collegeDoc.exists) {
        throw new Error(`College not found: ${collegeId}`);
      }
      
      // Validate board against college's supported boards
      // Skip validation for system_admin, admin, principal, dean, and teacher (they can work across boards)
      if (data.board && collegeConfig[collegeId] && userType === 'student') {
        const supportedBoards = collegeConfig[collegeId].supportedBoards;
        
        // Handle comma-separated boards (e.g., "CBSE, ICSE")
        const userBoards = data.board.includes(',') 
          ? data.board.split(',').map(b => b.trim())
          : [data.board];
        
        // Check if all user boards are supported
        const unsupportedBoards = userBoards.filter(b => !supportedBoards.includes(b));
        
        if (supportedBoards.length > 0 && unsupportedBoards.length > 0) {
          throw new Error(`Board(s) '${unsupportedBoards.join(', ')}' not supported by college. Supported boards: ${supportedBoards.join(', ')}`);
        }
      }
      
      // Validate student class against college's valid classes
      if (data.student_class && collegeConfig[collegeId]) {
        const validClasses = collegeConfig[collegeId].validClasses;
        if (validClasses.length > 0 && !validClasses.includes(data.student_class)) {
          throw new Error(`Class '${data.student_class}' not valid for college. Valid classes: ${validClasses.join(', ')}`);
        }
      }
    }
    
    // For students, require additional fields
    if (userType === 'student') {
      if (!data.student_roll) throw new Error('student_roll is required for students');
      if (!data.academic_year) throw new Error('academic_year is required for students');
      if (!data.student_class) throw new Error('student_class is required for students');
      if (!isValidAcademicYear(data.academic_year)) {
        throw new Error(`Invalid academic_year format: ${data.academic_year}. Must be YYYY-YY (e.g., 2024-25)`);
      }
    }
    
    // Parse teacher classes and subjects (comma-separated)
    let teacherClasses = [];
    let teacherSubjects = [];
    if (userType === 'teacher') {
      teacherClasses = data.teacher_classes 
        ? data.teacher_classes.split(',').map(c => c.trim()).filter(c => c.length > 0)
        : [];
      teacherSubjects = data.teacher_subjects
        ? data.teacher_subjects.split(',').map(s => s.trim()).filter(s => s.length > 0)
        : [];
    }
    
    const board = data.board || 'Not Specified';
    
    // Create or update Firebase Auth user
    if (!isUpdate) {
      const tempPassword = generateSecurePassword(12);
      const userRecord = await auth.createUser({
        phoneNumber: phoneNormalized.withPlus,
        password: tempPassword,
        displayName: data.full_name,
        email: data.email || undefined
      });
      userId = userRecord.uid;
      console.log(`   📱 Created Auth user`);
      console.log(`   🔑 Temp password: ${tempPassword}`);
      console.log(`   ⚠️  User must change password on first login`);
    }
    
    // Prepare Firestore user document
    const userDoc = {
      userId: userId,
      fullName: data.full_name,
      title: data.title || '',
      email: data.email || '',
      phone: phoneNormalized.withPlus,
      phoneRaw: phoneNormalized.cleaned,
      userType: userType,
      permissions: getPermissions(userType),
      status: 'active',
      board: board,
      createdBy: data.created_by || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Add security fields only for new users
    if (!isUpdate) {
      userDoc.mustChangePassword = true;      // Force password change on first login
      userDoc.firstLogin = true;              // Track first login
      userDoc.passwordChangedAt = null;       // Track password changes
      userDoc.temporaryPassword = true;       // Flag for temporary password
      userDoc.accountLocked = false;          // For security lockout
      userDoc.failedLoginAttempts = 0;        // Track failed attempts
      userDoc.lastLoginAt = null;             // Track last login
    }
    
    // Add college-specific fields
    if (collegeId) {
      userDoc.collegeId = collegeId;
    }
    
    // Add student-specific fields
    if (userType === 'student') {
      userDoc.studentRoll = data.student_roll;
      userDoc.academicYear = data.academic_year;
      userDoc.studentClass = data.student_class;
      userDoc.parentPhone = data.parent_phone || '';
      
      // Initialize or update student history
      if (!isUpdate) {
        userDoc.studentHistory = [{
          academicYear: data.academic_year,
          class: data.student_class,
          rollNumber: data.student_roll,
          board: board,
          collegeId: collegeId
        }];
      } else {
        // For updates, preserve existing history (will be merged)
        const existingDoc = await db.collection('users').doc(userId).get();
        if (existingDoc.exists) {
          const existingData = existingDoc.data();
          userDoc.studentHistory = existingData.studentHistory || [];
          
          // Check if this academic year already exists
          const existingYearIndex = userDoc.studentHistory.findIndex(
            h => h.academicYear === data.academic_year
          );
          
          if (existingYearIndex >= 0) {
            // Update existing year
            userDoc.studentHistory[existingYearIndex] = {
              academicYear: data.academic_year,
              class: data.student_class,
              rollNumber: data.student_roll,
              board: board,
              collegeId: collegeId
            };
          } else {
            // Add new year
            userDoc.studentHistory.push({
              academicYear: data.academic_year,
              class: data.student_class,
              rollNumber: data.student_roll,
              board: board,
              collegeId: collegeId
            });
          }
        }
      }
    }
    
    // Add teacher-specific fields
    if (userType === 'teacher') {
      userDoc.teacherClasses = teacherClasses;
      userDoc.teacherSubjects = teacherSubjects;
    }
    
    // Add creation timestamp for new users
    if (!isUpdate) {
      userDoc.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }
    
    // Remove undefined fields to avoid Firestore error
    Object.keys(userDoc).forEach(key => {
      if (userDoc[key] === undefined) {
        delete userDoc[key];
      }
    });
    
    // Update college counts if it's a new user or role changed
    if (collegeId) {
      const increment = admin.firestore.FieldValue.increment(1);
      
      if (!isUpdate) {
        // New user - increment counts
        const updates = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        // Update role-specific count
        updates[`roleCounts.${userType}`] = increment;
        
        // Update teacher/student totals
        if (userType === 'teacher') {
          updates.totalTeachers = increment;
          // Handle multiple boards for teachers (e.g., "CBSE, ICSE")
          if (board !== 'Not Specified') {
            const teacherBoards = board.includes(',') 
              ? board.split(',').map(b => b.trim())
              : [board];
            
            // Increment count for each board the teacher handles
            teacherBoards.forEach(b => {
              if (b && b !== 'Not Specified') {
                updates[`boardWiseCounts.${b}.totalTeachers`] = increment;
              }
            });
          }
        } else if (userType === 'student') {
          updates.totalStudents = increment;
          // Students should only have one board
          if (board !== 'Not Specified') {
            updates[`boardWiseCounts.${board}.totalStudents`] = increment;
          }
        }
        
        await db.collection('colleges').doc(collegeId).update(updates);
      }
      
      // Add college name to user doc
      const collegeDoc = await db.collection('colleges').doc(collegeId).get();
      if (collegeDoc.exists) {
        userDoc.collegeName = collegeDoc.data().collegeName;
      }
    }
    
    await db.collection('users').doc(userId).set(userDoc, { merge: true });
    
    return { 
      success: true, 
      userId, 
      phone: phoneNormalized.withPlus, 
      userType,
      board: board || 'All Boards',
      isUpdate 
    };
  } catch (error) {
    console.error(`   ❌ Error processing ${data.full_name}: ${error.message}`);
    return { success: false, error: error.message, name: data.full_name };
  }
}

// Main import function
async function importData(excelFilePath) {
  try {
    console.log('\n🚀 Starting import process...\n');
    
    const { colleges, users, rooms } = readExcel(excelFilePath);
    
    console.log(`📊 Found ${colleges.length} colleges, ${users.length} users, and ${rooms.length} rooms\n`);
    
    // STEP 1: Import Colleges
    console.log('🏫 Importing Colleges...');
    console.log('─'.repeat(60));
    
    // Store college configuration for validation (boards, valid classes, etc.)
    const collegeConfig = {};
    
    for (let i = 0; i < colleges.length; i++) {
      console.log(`[${i + 1}/${colleges.length}] Processing: ${colleges[i].college_name}`);
      const result = await addOrUpdateCollege(colleges[i]);
      collegeConfig[result.collegeId] = {
        supportedBoards: result.supportedBoards,
        validClasses: result.validClasses,
        subjects: result.subjects
      };
    }
    console.log(`✅ Colleges processed: ${colleges.length}\n`);
    
    // STEP 2: Import Users
    console.log('👥 Importing Users...');
    console.log('─'.repeat(60));
    
    const userResults = {
      system_admin: { added: [], updated: [], failed: [] },
      admin: { added: [], updated: [], failed: [] },
      principal: { added: [], updated: [], failed: [] },
      dean: { added: [], updated: [], failed: [] },
      teacher: { added: [], updated: [], failed: [] },
      student: { added: [], updated: [], failed: [] }
    };
    
    const systemAdminUsers = users.filter(u => (u.user_type || '').toLowerCase().replace(/\s+/g, '_') === 'system_admin');
    const adminUsers = users.filter(u => (u.user_type || '').toLowerCase().replace(/\s+/g, '_') === 'admin');
    const principalUsers = users.filter(u => (u.user_type || '').toLowerCase().replace(/\s+/g, '_') === 'principal');
    const deanUsers = users.filter(u => (u.user_type || '').toLowerCase().replace(/\s+/g, '_') === 'dean');
    const teacherUsers = users.filter(u => (u.user_type || '').toLowerCase().replace(/\s+/g, '_') === 'teacher');
    const studentUsers = users.filter(u => (u.user_type || '').toLowerCase().replace(/\s+/g, '_') === 'student');
    
    const sortedUsers = [...systemAdminUsers, ...adminUsers, ...principalUsers, ...deanUsers, ...teacherUsers, ...studentUsers];
    
    for (let i = 0; i < sortedUsers.length; i++) {
      const user = sortedUsers[i];
      const userType = (user.user_type || 'student').toLowerCase().replace(/\s+/g, '_');
      const board = user.board ? ` [${user.board}]` : '';
      console.log(`[${i + 1}/${sortedUsers.length}] Processing: ${user.full_name} (${userType}${board})`);
      
      const result = await addOrUpdateUser(user, i, collegeConfig);
      
      if (result.success) {
        const list = result.isUpdate ? userResults[userType].updated : userResults[userType].added;
        list.push({
          name: user.full_name,
          phone: result.phone,
          board: result.board,
          type: userType
        });
      } else {
        userResults[userType].failed.push({
          name: result.name,
          error: result.error
        });
      }
    }
    console.log(`✅ Users processed: ${sortedUsers.length}\n`);
    
    // STEP 3: Import Rooms
    let roomResults = {
      added: 0,
      updated: 0,
      failed: 0,
      errors: []
    };
    
    if (rooms.length > 0) {
      console.log('🏢 Importing Rooms...');
      console.log('─'.repeat(60));
      
      for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        console.log(`[${i + 1}/${rooms.length}] Processing: ${room.room_id} (${room.college_id})`);
        
        const result = await addOrUpdateRoom(room);
        
        if (result.success === false) {
          roomResults.failed++;
          roomResults.errors.push({
            roomId: result.roomId,
            error: result.error
          });
        } else if (result.isNew) {
          roomResults.added++;
        } else {
          roomResults.updated++;
        }
      }
      console.log(`✅ Rooms processed: ${rooms.length}\n`);
    } else {
      console.log('ℹ️  No rooms sheet found or no rooms to import\n');
    }
    
    // STEP 4: Print Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📋 IMPORT SUMMARY');
    console.log('═'.repeat(60));
    console.log(`🏫 Colleges processed: ${colleges.length}`);
    console.log('');
    console.log('👥 Users processed:');
    
    let totalAdded = 0, totalUpdated = 0, totalFailed = 0;
    
    for (const type of ['system_admin', 'admin', 'principal', 'dean', 'teacher', 'student']) {
      const added = userResults[type].added.length;
      const updated = userResults[type].updated.length;
      const failed = userResults[type].failed.length;
      
      totalAdded += added;
      totalUpdated += updated;
      totalFailed += failed;
      
      const displayName = type.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      
      console.log(`   ${displayName.padEnd(13)}: ` +
                  `${added} added, ${updated} updated, ${failed} failed`);
    }
    
    console.log('');
    console.log(`📊 Total Users: ${totalAdded} added, ${totalUpdated} updated, ${totalFailed} failed`);
    
    if (rooms.length > 0) {
      console.log('');
      console.log('🏢 Rooms processed:');
      console.log(`   ${roomResults.added} added, ${roomResults.updated} updated, ${roomResults.failed} failed`);
    }
    
    const allFailed = [
      ...userResults.system_admin.failed,
      ...userResults.admin.failed, 
      ...userResults.principal.failed,
      ...userResults.dean.failed,
      ...userResults.teacher.failed, 
      ...userResults.student.failed
    ];
    
    if (allFailed.length > 0) {
      console.log('\n⚠️  Failed Users:');
      allFailed.forEach(user => {
        console.log(`   ❌ ${user.name}: ${user.error}`);
      });
    }
    
    if (roomResults.errors.length > 0) {
      console.log('\n⚠️  Failed Rooms:');
      roomResults.errors.forEach(room => {
        console.log(`   ❌ ${room.roomId}: ${room.error}`);
      });
    }
    
    console.log('\n✅ Import completed!\n');
    console.log('💡 Features enabled:');
    console.log('   👥 User Hierarchy: System Admin → Admin → Principal → Dean → Teacher → Student');
    console.log('   🔢 Multiple users per role supported');
    console.log('   📚 Multi-board support (Excel-driven, no hardcoded boards)');
    console.log('   📅 Academic year tracking');
    console.log('   📊 Role-wise counting and analytics');
    console.log('   🔄 Board-specific student/teacher counts');
    console.log('   📱 Smart phone normalization');
    console.log('   📖 Student history preservation');
    console.log('   📖 Subjects tracking (comma-separated)');
    console.log('   🎓 Valid classes tracking (comma-separated)');
    console.log('   📝 Exam types tracking (comma-separated)');
    console.log('   ⭐ Features tracking (comma-separated)');
    console.log('   🏢 Room management with college association\n');
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

// ==========================
// MAIN EXECUTION STARTS HERE
// ==========================

// Look for Excel file in current directory
const currentDir = __dirname;
const excelFileName = 'lpu_data.xlsx';
const excelFilePath = path.join(currentDir, excelFileName);

console.log('📂 Current directory:', currentDir);
console.log('🔍 Looking for Excel file:', excelFileName);

// Check if files exist
if (!fs.existsSync(excelFilePath)) {
  console.error(`\n❌ Error: Excel file '${excelFileName}' not found in current directory!\n`);
  console.log('📝 Please ensure the file exists at:');
  console.log(`   ${excelFilePath}\n`);
  console.log('💡 File should be named: import_data.xlsx');
  console.log('💡 Or run with custom file: node bulk_import.js <filename.xlsx>\n');
  process.exit(1);
}

if (!fs.existsSync(serviceAccountPath)) {
  console.error('\n❌ Error: serviceAccountKey.json not found in current directory!\n');
  console.log('📝 Please ensure the file exists at:');
  console.log(`   ${serviceAccountPath}\n`);
  console.log('💡 Download from: Firebase Console → Project Settings → Service Accounts\n');
  process.exit(1);
}

console.log('✅ Excel file found:', excelFilePath);
console.log('✅ Service account key found\n');

console.log('⚠️  This script will add/update data in Firebase!\n');
console.log(`📁 Excel file: ${excelFileName}`);
console.log(`🔥 Firebase project: ${serviceAccount.project_id}\n`);
console.log('✅ Features:');
console.log('   👥 User Hierarchy: System Admin → Admin → Principal → Dean → Teacher → Student');
console.log('   🔢 Multiple users per role supported');
console.log('   📚 Multi-board support (Excel-driven)');
console.log('   📅 Academic year tracking');
console.log('   📊 Role-based counting and analytics');
console.log('   🔄 Student history preservation');
console.log('   📱 Phone normalization');
console.log('   📖 Subjects tracking (comma-separated)');
console.log('   🎓 Valid classes tracking (comma-separated)');
console.log('   📝 Exam types tracking (comma-separated)');
console.log('   ⭐ Features tracking (comma-separated)');
console.log('   🏢 Room management with college association\n');

console.log('👥 User Roles:');
console.log('   🔹 System Admin: Manages entire system, all colleges');
console.log('   🔹 Admin: College-level administrator');
console.log('   🔹 Principal: College principal (can have multiple)');
console.log('   🔹 Dean: Department dean (can have multiple)');
console.log('   🔹 Teacher: Faculty member');
console.log('   🔹 Student: Student\n');

console.log('📚 Board & Class Configuration:');
console.log('   ✓ Boards: Defined per college in Excel (supported_boards column)');
console.log('   ✓ Classes: Defined per college in Excel (valid_classes column)');
console.log('   ✓ Subjects: Defined per college in Excel (subjects column)');
console.log('   ✓ Exam Types: Defined per college in Excel (exam_types column)');
console.log('   ✓ Features: Defined per college in Excel (features column)');
console.log('');

console.log('🏢 Room Management:');
console.log('   ✓ Rooms: Defined per college in Excel (Rooms sheet)');
console.log('   ✓ Fields: room_id, college_id, Address, Capacity, Incharge');
console.log('   ✓ Automatic college association and room count tracking');
console.log('');

const proceed = readlineSync.keyInYN('Continue with import?');

if (proceed) {
  importData(excelFilePath);
} else {
  console.log('❌ Import cancelled.\n');
  process.exit(0);
}