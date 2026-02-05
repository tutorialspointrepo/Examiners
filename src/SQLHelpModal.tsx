import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faDatabase, 
  faXmark, 
  faCopy, 
  faCheck,
  faChevronRight,
  faLightbulb,
  faGraduationCap,
  faRocket,
  faCode
} from '@fortawesome/sharp-light-svg-icons';

interface SQLHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQLHelpModal: React.FC<SQLHelpModalProps> = ({ isOpen, onClose }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const steps = [
    {
      id: 1,
      title: "Create Your First Table",
      emoji: "🏗️",
      color: "from-emerald-500 to-teal-500",
      bgLight: "bg-emerald-50",
      borderColor: "border-emerald-200",
      description: "Tables are like spreadsheets - they store your data in rows and columns.",
      code: `CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  age INTEGER,
  grade VARCHAR(2),
  enrolled_date DATE DEFAULT CURRENT_DATE
);`,
      tip: "💡 SERIAL auto-generates IDs, VARCHAR stores text, INTEGER stores numbers"
    },
    {
      id: 2,
      title: "Add Data to Your Table",
      emoji: "➕",
      color: "from-blue-500 to-indigo-500",
      bgLight: "bg-blue-50",
      borderColor: "border-blue-200",
      description: "INSERT adds new records (rows) to your table.",
      code: `INSERT INTO students (name, email, age, grade) VALUES
  ('Alice Johnson', 'alice@school.com', 20, 'A'),
  ('Bob Smith', 'bob@school.com', 22, 'B'),
  ('Carol White', 'carol@school.com', 19, 'A'),
  ('David Brown', 'david@school.com', 21, 'C'),
  ('Emma Davis', 'emma@school.com', 20, 'A');`,
      tip: "💡 You can insert multiple rows in one statement!"
    },
    {
      id: 3,
      title: "Retrieve Data with SELECT",
      emoji: "🔍",
      color: "from-purple-500 to-pink-500",
      bgLight: "bg-purple-50",
      borderColor: "border-purple-200",
      description: "SELECT is the most used SQL command - it fetches data from tables.",
      code: `-- Get all students
SELECT * FROM students;

-- Get specific columns
SELECT name, grade FROM students;

-- Filter with WHERE
SELECT * FROM students WHERE grade = 'A';

-- Sort results
SELECT * FROM students ORDER BY age DESC;

-- Get top 3 students
SELECT * FROM students LIMIT 3;`,
      tip: "💡 Use * to select all columns, or list specific column names"
    },
    {
      id: 4,
      title: "Filter with Conditions",
      emoji: "🎯",
      color: "from-orange-500 to-amber-500",
      bgLight: "bg-orange-50",
      borderColor: "border-orange-200",
      description: "WHERE clause filters rows based on conditions.",
      code: `-- Multiple conditions with AND
SELECT * FROM students 
WHERE grade = 'A' AND age >= 20;

-- Either condition with OR
SELECT * FROM students 
WHERE grade = 'A' OR grade = 'B';

-- Range of values
SELECT * FROM students 
WHERE age BETWEEN 19 AND 21;

-- Pattern matching
SELECT * FROM students 
WHERE name LIKE 'A%';  -- starts with A

-- Check for multiple values
SELECT * FROM students 
WHERE grade IN ('A', 'B');`,
      tip: "💡 LIKE uses % as wildcard - 'A%' means starts with A, '%son' ends with son"
    },
    {
      id: 5,
      title: "Calculate with Aggregates",
      emoji: "📊",
      color: "from-cyan-500 to-blue-500",
      bgLight: "bg-cyan-50",
      borderColor: "border-cyan-200",
      description: "Aggregate functions perform calculations on multiple rows.",
      code: `-- Count total students
SELECT COUNT(*) as total FROM students;

-- Average age
SELECT AVG(age) as average_age FROM students;

-- Youngest and oldest
SELECT MIN(age) as youngest, MAX(age) as oldest 
FROM students;

-- Count by grade
SELECT grade, COUNT(*) as count
FROM students
GROUP BY grade
ORDER BY count DESC;`,
      tip: "💡 GROUP BY groups rows with same values, then aggregates calculate per group"
    },
    {
      id: 6,
      title: "Update Existing Data",
      emoji: "✏️",
      color: "from-yellow-500 to-orange-500",
      bgLight: "bg-yellow-50",
      borderColor: "border-yellow-200",
      description: "UPDATE modifies existing records in your table.",
      code: `-- Update one student's grade
UPDATE students 
SET grade = 'A' 
WHERE name = 'Bob Smith';

-- Update multiple columns
UPDATE students 
SET grade = 'B', age = 23 
WHERE name = 'David Brown';

-- Update multiple rows
UPDATE students 
SET grade = 'A+' 
WHERE grade = 'A';`,
      tip: "⚠️ Always use WHERE clause! Without it, ALL rows will be updated"
    },
    {
      id: 7,
      title: "Delete Data",
      emoji: "🗑️",
      color: "from-red-500 to-pink-500",
      bgLight: "bg-red-50",
      borderColor: "border-red-200",
      description: "DELETE removes records from your table.",
      code: `-- Delete specific student
DELETE FROM students 
WHERE name = 'David Brown';

-- Delete with condition
DELETE FROM students 
WHERE grade = 'C';

-- Delete all (be careful!)
-- DELETE FROM students;`,
      tip: "⚠️ Always use WHERE clause! Without it, ALL rows will be deleted"
    },
    {
      id: 8,
      title: "Advanced: JOINs & More",
      emoji: "🚀",
      color: "from-indigo-500 to-purple-500",
      bgLight: "bg-indigo-50",
      borderColor: "border-indigo-200",
      description: "Combine tables and use powerful SQL features.",
      code: `-- Create another table
CREATE TABLE courses (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  course_name VARCHAR(100),
  score INTEGER
);

INSERT INTO courses (student_id, course_name, score) VALUES
  (1, 'Math', 95), (1, 'Science', 88),
  (2, 'Math', 78), (3, 'Science', 92);

-- JOIN tables together
SELECT s.name, c.course_name, c.score
FROM students s
INNER JOIN courses c ON s.id = c.student_id;

-- Subquery example
SELECT * FROM students
WHERE id IN (SELECT student_id FROM courses WHERE score > 90);`,
      tip: "💡 JOINs connect related data from multiple tables using a common column"
    },
    {
      id: 9,
      title: "Troubleshooting",
      emoji: "🔧",
      color: "from-gray-500 to-slate-600",
      bgLight: "bg-gray-50",
      borderColor: "border-gray-200",
      description: "Useful queries to debug and check your database state.",
      code: `-- List all tables in the database
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Alternative: List all tables
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public';

-- Check table structure (columns)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'students';

-- Count rows in a table
SELECT COUNT(*) FROM students;

-- Check if table is empty
SELECT CASE 
  WHEN COUNT(*) = 0 THEN 'Table is empty'
  ELSE 'Table has ' || COUNT(*) || ' rows'
END FROM students;`,
      tip: "💡 If SELECT returns no data, check if the table exists and has data inserted"
    },
    {
      id: 10,
      title: "String Functions",
      emoji: "🔤",
      color: "from-pink-500 to-rose-500",
      bgLight: "bg-pink-50",
      borderColor: "border-pink-200",
      description: "Manipulate and transform text data with built-in string functions.",
      code: `-- Convert to uppercase/lowercase
SELECT UPPER('hello') as uppercase;        -- HELLO
SELECT LOWER('WORLD') as lowercase;        -- world

-- Combine strings
SELECT CONCAT('Hello', ' ', 'World');      -- Hello World
SELECT 'Hello' || ' ' || 'World';          -- Hello World (alternative)

-- Get string length
SELECT LENGTH('PostgreSQL');               -- 10

-- Extract part of string
SELECT SUBSTRING('Hello World' FROM 1 FOR 5);  -- Hello
SELECT LEFT('Hello World', 5);                  -- Hello
SELECT RIGHT('Hello World', 5);                 -- World

-- Remove whitespace
SELECT TRIM('  spaces  ');                 -- spaces
SELECT LTRIM('  left');                    -- left
SELECT RTRIM('right  ');                   -- right

-- Replace text
SELECT REPLACE('Hello', 'l', 'L');         -- HeLLo

-- Find position
SELECT POSITION('World' IN 'Hello World'); -- 7`,
      tip: "💡 String functions are great for cleaning and formatting data before display"
    },
    {
      id: 11,
      title: "Date & Time Functions",
      emoji: "📅",
      color: "from-blue-500 to-cyan-500",
      bgLight: "bg-blue-50",
      borderColor: "border-blue-200",
      description: "Work with dates, times, and timestamps in your queries.",
      code: `-- Current date and time
SELECT NOW() as current_timestamp;
SELECT CURRENT_DATE as today;
SELECT CURRENT_TIME as time_now;

-- Extract parts from date
SELECT EXTRACT(YEAR FROM NOW()) as year;
SELECT EXTRACT(MONTH FROM NOW()) as month;
SELECT EXTRACT(DAY FROM NOW()) as day;
SELECT DATE_PART('hour', NOW()) as hour;

-- Calculate age/difference
SELECT AGE(NOW(), '2000-01-01') as age;
SELECT NOW() - '2024-01-01'::date as days_since;

-- Add/subtract intervals
SELECT NOW() + INTERVAL '7 days' as next_week;
SELECT NOW() - INTERVAL '1 month' as last_month;
SELECT NOW() + INTERVAL '2 hours 30 minutes';

-- Format dates
SELECT TO_CHAR(NOW(), 'YYYY-MM-DD') as formatted;
SELECT TO_CHAR(NOW(), 'Day, Month DD, YYYY');

-- Truncate to specific precision
SELECT DATE_TRUNC('month', NOW());  -- First of month
SELECT DATE_TRUNC('year', NOW());   -- First of year`,
      tip: "💡 Use INTERVAL for date math and TO_CHAR for custom formatting"
    },
    {
      id: 12,
      title: "Constraints & Keys",
      emoji: "🔐",
      color: "from-amber-500 to-orange-500",
      bgLight: "bg-amber-50",
      borderColor: "border-amber-200",
      description: "Ensure data integrity with constraints and relationships.",
      code: `-- PRIMARY KEY - Unique identifier for each row
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL
);

-- FOREIGN KEY - Reference another table
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  product VARCHAR(100)
);

-- UNIQUE - No duplicate values allowed
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  email VARCHAR(100) UNIQUE,
  ssn VARCHAR(11) UNIQUE
);

-- NOT NULL - Value required
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL
);

-- CHECK - Custom validation
CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  balance DECIMAL(10,2) CHECK (balance >= 0),
  age INTEGER CHECK (age >= 18)
);

-- DEFAULT - Automatic value if not provided
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200),
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW()
);`,
      tip: "💡 Constraints prevent bad data from entering your database - use them!"
    },
    {
      id: 13,
      title: "Indexes & Performance",
      emoji: "⚡",
      color: "from-violet-500 to-purple-500",
      bgLight: "bg-violet-50",
      borderColor: "border-violet-200",
      description: "Speed up your queries with indexes and analyze performance.",
      code: `-- Create index for faster searches
CREATE INDEX idx_students_name ON students(name);
CREATE INDEX idx_students_grade ON students(grade);

-- Create unique index
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Create composite index (multiple columns)
CREATE INDEX idx_orders_user_date 
ON orders(user_id, created_at);

-- List all indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public';

-- Drop an index
DROP INDEX idx_students_name;

-- Analyze query performance
EXPLAIN SELECT * FROM students WHERE grade = 'A';

-- Detailed analysis with timing
EXPLAIN ANALYZE 
SELECT * FROM students WHERE grade = 'A';

-- Check table statistics
SELECT relname, n_tup_ins, n_tup_upd, n_tup_del
FROM pg_stat_user_tables;`,
      tip: "⚡ Indexes speed up SELECT but slow down INSERT/UPDATE. Add them to columns you search frequently!"
    },
    {
      id: 14,
      title: "More Help & Resources",
      emoji: "📚",
      color: "from-teal-500 to-emerald-500",
      bgLight: "bg-teal-50",
      borderColor: "border-teal-200",
      description: "Continue your SQL learning journey with our comprehensive tutorials.",
      code: `/* ════════════════════════════════════════════════
   
   📚 TUTORIALS POINT - SQL LEARNING PATHS
   
   ════════════════════════════════════════════════ */


/* ─────────────────────────────────────────────────
   🐘 POSTGRESQL TUTORIAL
   ─────────────────────────────────────────────────
   
   Complete guide to PostgreSQL database
   ✓ Installation & Setup
   ✓ Data Types & Operators  
   ✓ Tables, Views & Indexes
   ✓ Joins & Subqueries
   ✓ Functions & Triggers
   ✓ Advanced Concepts
   
   👉 https://www.tutorialspoint.com/postgresql/
   
─────────────────────────────────────────────────── */


/* ─────────────────────────────────────────────────
   📊 SQL TUTORIAL
   ─────────────────────────────────────────────────
   
   Master standard SQL from basics to advanced
   ✓ SQL Fundamentals
   ✓ CRUD Operations
   ✓ Joins & Unions
   ✓ Aggregate Functions
   ✓ Stored Procedures
   ✓ Performance Tuning
   
   👉 https://www.tutorialspoint.com/sql/
   
─────────────────────────────────────────────────── */


/* ─────────────────────────────────────────────────
   🪶 SQLITE TUTORIAL  
   ─────────────────────────────────────────────────
   
   Lightweight database for applications
   ✓ SQLite Basics
   ✓ Database Operations
   ✓ Working with Tables
   ✓ Queries & Clauses
   ✓ SQLite with Python/PHP
   ✓ Mobile Development
   
   👉 https://www.tutorialspoint.com/sqlite/
   
─────────────────────────────────────────────────── */`,
      tip: "🎓 Visit TutorialsPoint for in-depth SQL tutorials with examples and practice exercises!"
    }
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed right-3 top-3 bottom-3 z-[10000] w-[calc(100%-24px)] max-w-2xl bg-gradient-to-b from-slate-50 to-white shadow-2xl overflow-hidden rounded-3xl animate-slide-in-right flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                <FontAwesomeIcon icon={faGraduationCap} className="text-white text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Learn SQL</h2>
                <p className="text-sm text-white/80">Step-by-step PostgreSQL Tutorial</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/20 text-white"
            >
              <FontAwesomeIcon icon={faXmark} className="text-lg" />
            </button>
          </div>
          
          {/* Progress indicator */}
          <div className="mt-4 flex gap-1">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === activeStep 
                    ? 'bg-white w-8' 
                    : idx < activeStep 
                      ? 'bg-white/60 w-4' 
                      : 'bg-white/30 w-4'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Navigation Tabs */}
        <div className="px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0 overflow-x-auto">
          <div className="flex gap-2">
            {steps.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => setActiveStep(idx)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  idx === activeStep
                    ? `bg-gradient-to-r ${step.color} text-white shadow-lg scale-105`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{step.emoji}</span>
                <span className="hidden sm:inline">{step.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Active Step Content */}
            <div className="space-y-5">
              {/* Step Header */}
              <div className={`${steps[activeStep].bgLight} ${steps[activeStep].borderColor} border rounded-2xl p-5`}>
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${steps[activeStep].color} flex items-center justify-center text-2xl shadow-lg`}>
                    {steps[activeStep].emoji}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${steps[activeStep].color} text-white`}>
                        STEP {steps[activeStep].id}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      {steps[activeStep].title}
                    </h3>
                    <p className="text-gray-600">
                      {steps[activeStep].description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Code Block */}
              <div className="rounded-2xl overflow-hidden shadow-xl border border-gray-200">
                <div className="px-4 py-3 bg-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-gray-400 text-sm font-medium flex items-center gap-2">
                      <FontAwesomeIcon icon={faCode} />
                      step{steps[activeStep].id}.sql
                    </span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(steps[activeStep].code, activeStep)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      copiedIndex === activeStep
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <FontAwesomeIcon icon={copiedIndex === activeStep ? faCheck : faCopy} />
                    {copiedIndex === activeStep ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="p-4 bg-gray-900 text-sm overflow-x-auto">
                  <code className="text-green-400 leading-relaxed whitespace-pre-wrap">{steps[activeStep].code}</code>
                </pre>
              </div>

              {/* Tip Box */}
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <FontAwesomeIcon icon={faLightbulb} className="text-amber-600" />
                </div>
                <p className="text-sm text-amber-800 font-medium">
                  {steps[activeStep].tip}
                </p>
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                  disabled={activeStep === 0}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                    activeStep === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <FontAwesomeIcon icon={faChevronRight} className="rotate-180" />
                  Previous
                </button>
                
                <span className="text-sm text-gray-500 font-medium">
                  {activeStep + 1} of {steps.length}
                </span>
                
                <button
                  onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))}
                  disabled={activeStep === steps.length - 1}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                    activeStep === steps.length - 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : `bg-gradient-to-r ${steps[activeStep].color} text-white shadow-lg hover:shadow-xl`
                  }`}
                >
                  Next
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FontAwesomeIcon icon={faRocket} className="text-indigo-500" />
              <span>Powered by <strong className="text-indigo-600">PGlite</strong> - Full PostgreSQL in Browser</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">~65% SQL Server compatible</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
};

export default SQLHelpModal;