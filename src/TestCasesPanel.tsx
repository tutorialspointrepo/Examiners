import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faPlay,
  faCircleCheck,
  faCircleXmark,
  faClock,
  faMemory,
  faSpinner,
  faListCheck,
} from '@fortawesome/sharp-light-svg-icons';
import { judge0Service } from './services/judge0_service';
import { useBrand } from './BrandContext';

interface TestCase {
  input: string;
  expected_output?: string;
  output?: string;
  marks?: number;
}

interface TestCasesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  testCases: TestCase[];
  code: string;
  language: string;
  darkMode: boolean;
  editorRef?: React.RefObject<any>;  // ✅ Add editor ref
}

interface TestResult {
  passed: boolean | null; // null = not run yet
  input: string;
  expected: string;
  actual: string;
  error: string | null;
  time: string;
  memory: string;
  status: string;
  running: boolean;
}

const TestCasesPanel: React.FC<TestCasesPanelProps> = ({
  isOpen,
  onClose,
  testCases,
  code,
  language,
  darkMode,
  editorRef,  // ✅ Accept editor ref
}) => {
  const brand = useBrand(); // Get brand theme
  
  const [testResults, setTestResults] = useState<TestResult[]>(
    testCases.map(tc => ({
      passed: null,
      input: tc.input || '',
      expected: (tc.expected_output || tc.output || '').trim(),
      actual: '',
      error: null,
      time: '0',
      memory: '0 KB',
      status: 'Not Run',
      running: false,
    }))
  );
  const [isRunningAll, setIsRunningAll] = useState(false);

  // ✅ Helper: Get fresh code from editor or fallback to prop
  const getFreshCode = (): string => {
    if (editorRef?.current) {
      const freshCode = editorRef.current.getValue();
      console.log('🎯 TestCasesPanel: Using fresh code from editor, length:', freshCode.length);
      return freshCode;
    }
    console.log('📝 TestCasesPanel: Using code from prop (no editor ref), length:', code.length);
    return code;
  };

  // Run individual test case
  const runTestCase = async (index: number) => {
    // Update state to show running
    setTestResults(prev => 
      prev.map((result, i) => 
        i === index ? { ...result, running: true, passed: null } : result
      )
    );

    try {
      const testCase = testCases[index];
      const freshCode = getFreshCode();  // ✅ Get fresh code
      
      console.log(`🧪 Running Test Case ${index + 1} with fresh code`);
      
      const result = await judge0Service.executeCode(
        freshCode,
        language,
        testCase.input || ''
      );

      const actualOutput = (result.output || '').trim();
      const expectedOutput = (testCase.expected_output || testCase.output || '').trim();
      const passed = result.success && actualOutput === expectedOutput;

      console.log('🔍 Test Case Result:', {
        index: index + 1,
        'result.output': result.output,
        'result.success': result.success,
        actualOutput,
        expectedOutput,
        passed,
        'actualOutput === expectedOutput': actualOutput === expectedOutput
      });

      setTestResults(prev =>
        prev.map((r, i) =>
          i === index
            ? {
                passed,
                input: testCase.input || '',
                expected: expectedOutput,
                actual: actualOutput,
                error: result.error,
                time: result.time,
                memory: result.memory,
                status: passed ? 'Accepted' : result.error ? 'Runtime Error' : 'Wrong Answer',
                running: false,
              }
            : r
        )
      );
      
      console.log('✅ State updated for test', index + 1, 'passed:', passed);
    } catch (error: any) {
      setTestResults(prev =>
        prev.map((r, i) =>
          i === index
            ? {
                ...r,
                passed: false,
                error: error.message,
                status: 'Error',
                running: false,
              }
            : r
        )
      );
    }
  };

  // Run all test cases
  const runAllTestCases = async () => {
    setIsRunningAll(true);
    
    // Reset all results to running state
    setTestResults(prev =>
      prev.map(result => ({ ...result, running: true, passed: null }))
    );

    try {
      const freshCode = getFreshCode();  // ✅ Get fresh code
      
      console.log(`🧪 Running ALL Test Cases with fresh code (${testCases.length} tests)`);
      
      const result = await judge0Service.runTestCases(freshCode, language, testCases);
      
      console.log('🔍 Raw results from judge0:', result.results);
      
      setTestResults(
        result.results.map((r, idx) => {
          // Force calculate passed status by comparing outputs
          const actualTrimmed = String(r.actual || '').trim();
          const expectedTrimmed = String(r.expected || '').trim();
          const hasError = Boolean(r.error);
          const isPassed = !hasError && actualTrimmed === expectedTrimmed;
          
          console.log(`Test ${idx + 1}:`, {
            actual: actualTrimmed,
            expected: expectedTrimmed,
            hasError,
            isPassed,
            rawPassed: r.passed
          });
          
          return {
            passed: isPassed,
            input: r.input,
            expected: expectedTrimmed,
            actual: actualTrimmed,
            error: r.error,
            time: r.time,
            memory: r.memory,
            status: isPassed ? 'Accepted' : hasError ? 'Runtime Error' : 'Wrong Answer',
            running: false,
          };
        })
      );
      
      console.log('✅ Test results set');
    } catch (error: any) {
      setTestResults(prev =>
        prev.map(r => ({
          ...r,
          passed: false,
          error: error.message,
          status: 'Error',
          running: false,
        }))
      );
    } finally {
      setIsRunningAll(false);
    }
  };

  const passedCount = testResults.filter(r => r.passed === true).length;
  const failedCount = testResults.filter(r => r.passed === false).length;
  const notRunCount = testResults.filter(r => r.passed === null).length;

  return (
    <>
      {/* Hide Scrollbar Styles */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-[9998] ${
          isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sliding Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-2xl transform transition-transform duration-300 ease-in-out z-[9999] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${darkMode ? 'bg-gray-900' : 'bg-white'} shadow-2xl flex flex-col`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="flex items-center space-x-3">
            <FontAwesomeIcon icon={faListCheck} className="text-2xl" style={{ color: brand.colors.primary }} />
            <div>
              <h2
                className={`text-xl font-extrabold ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}
              >
                Test Cases
              </h2>
              <p
                className={`text-sm ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {testCases.length} test case{testCases.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              darkMode
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-200 text-gray-600'
            }`}
          >
            <FontAwesomeIcon icon={faXmark} className="text-xl" />
          </button>
        </div>

        {/* Test Cases List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
          {testCases.map((testCase, index) => {
            const result = testResults[index];
            
            // Dynamic border colors - keep background grey/white
            const getCardStyle = () => {
              if (result.passed === true) {
                return darkMode
                  ? { borderColor: '#10b981', backgroundColor: '#1f2937' }
                  : { borderColor: '#10b981', backgroundColor: '#ffffff' };
              } else if (result.passed === false) {
                return darkMode
                  ? { borderColor: '#ef4444', backgroundColor: '#1f2937' }
                  : { borderColor: '#ef4444', backgroundColor: '#ffffff' };
              } else {
                return darkMode
                  ? { borderColor: '#374151', backgroundColor: '#1f2937' }
                  : { borderColor: '#d1d5db', backgroundColor: '#ffffff' };
              }
            };
            
            return (
              <div
                key={index}
                className="rounded-lg border overflow-hidden transition-all"
                style={getCardStyle()}
              >
                {/* Test Case Header */}
                <div
                  className={`px-4 py-3 flex items-center justify-between ${
                    darkMode ? 'bg-gray-750' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {result.passed === true && (
                      <FontAwesomeIcon
                        icon={faCircleCheck}
                        className="text-lg"
                        style={{ color: brand.colors.primary }}
                      />
                    )}
                    {result.passed === false && (
                      <FontAwesomeIcon
                        icon={faCircleXmark}
                        className="text-red-500 text-lg"
                      />
                    )}
                    {result.running && (
                      <FontAwesomeIcon
                        icon={faSpinner}
                        className="text-lg animate-spin"
                        style={{ color: brand.colors.primary }}
                      />
                    )}
                    <span
                      className={`font-semibold ${
                        darkMode ? 'text-gray-200' : 'text-gray-900'
                      }`}
                    >
                      Test Case {index + 1}
                    </span>
                  </div>
                  <button
                    onClick={() => runTestCase(index)}
                    disabled={result.running || isRunningAll}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 text-white shadow-lg hover:shadow-xl ${
                      result.running || isRunningAll
                        ? 'bg-gray-400 cursor-not-allowed'
                        : ''
                    }`}
                    style={
                      result.running || isRunningAll
                        ? {}
                        : { background: brand.gradients.primary }
                    }
                  >
                    {result.running ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                        <span>Running...</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faPlay} />
                        <span>Run</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Test Case Content */}
                <div className="px-4 py-4 space-y-3">
                  {/* Input */}
                  <div>
                    <label
                      className={`block text-xs font-semibold mb-2 uppercase tracking-wide ${
                        darkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      Input
                    </label>
                    <div
                      className={`p-3 rounded-lg font-mono text-sm whitespace-pre-wrap ${
                        darkMode
                          ? 'bg-gray-900 text-gray-300'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {testCase.input || '(empty)'}
                    </div>
                  </div>

                  {/* Expected Output */}
                  <div>
                    <label
                      className={`block text-xs font-semibold mb-2 uppercase tracking-wide ${
                        darkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      Expected Output
                    </label>
                    <div
                      className={`p-3 rounded-lg font-mono text-sm whitespace-pre-wrap ${
                        darkMode
                          ? 'bg-gray-900 text-gray-300'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {(testCase.expected_output || testCase.output || '').trim() || '(empty)'}
                    </div>
                  </div>

                  {/* Actual Output (if run) */}
                  {result.passed !== null && (
                    <div>
                      <label
                        className={`block text-xs font-semibold mb-2 uppercase tracking-wide ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        Your Output
                      </label>
                      <div
                        className={`p-3 rounded-lg font-mono text-sm whitespace-pre-wrap ${
                          darkMode
                            ? 'bg-gray-900 text-gray-300'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {result.actual || '(empty)'}
                      </div>
                    </div>
                  )}

                  {/* Error (if any) */}
                  {result.error && (
                    <div>
                      <label
                        className={`block text-xs font-semibold mb-2 uppercase tracking-wide text-red-500`}
                      >
                        Error
                      </label>
                      <div
                        className={`p-3 rounded-lg font-mono text-sm whitespace-pre-wrap ${
                          darkMode
                            ? 'bg-red-900/30 text-red-300'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {result.error}
                      </div>
                    </div>
                  )}

                  {/* Metrics (if run) */}
                  {result.passed !== null && (
                    <div
                      className={`flex items-center justify-between pt-3 border-t text-xs ${
                        darkMode ? 'border-gray-700' : 'border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <span
                          className={`flex items-center space-x-1 ${
                            darkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}
                        >
                          <FontAwesomeIcon icon={faClock} />
                          <span>{result.time}s</span>
                        </span>
                        <span
                          className={`flex items-center space-x-1 ${
                            darkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}
                        >
                          <FontAwesomeIcon icon={faMemory} />
                          <span>{result.memory}</span>
                        </span>
                      </div>
                      <span
                        className={`font-bold text-sm px-3 py-1 rounded ${
                          result.passed === true 
                            ? 'bg-green-100 text-green-700'
                            : result.passed === false
                            ? 'bg-red-100 text-red-700'
                            : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {result.passed === true 
                          ? '✓ Accepted' 
                          : result.passed === false 
                          ? '✗ Failed' 
                          : result.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-4 border-t ${
            darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
          }`}
        >
          {/* Stats and Action Buttons - Same Row */}
          <div className="flex items-center justify-between">
            {/* Stats - Left Side */}
            <div className="flex items-center space-x-4 text-sm">
              <span className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faCircleCheck} style={{ color: brand.colors.primary }} />
                <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                  {passedCount} passed
                </span>
              </span>
              <span className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faCircleXmark} className="text-red-500" />
                <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                  {failedCount} failed
                </span>
              </span>
              {notRunCount > 0 && (
                <span
                  className={`text-sm ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  {notRunCount} not run
                </span>
              )}
            </div>

            {/* Action Buttons - Right Side */}
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                  darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                Close
              </button>
              <button
                onClick={runAllTestCases}
                disabled={isRunningAll}
                className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center space-x-2 text-white shadow-lg hover:shadow-xl ${
                  isRunningAll
                    ? 'bg-gray-400 cursor-not-allowed'
                    : ''
                }`}
                style={
                  isRunningAll
                    ? {}
                    : { background: brand.gradients.primary }
                }
              >
                {isRunningAll ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                    <span>Running All Tests...</span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPlay} />
                    <span>Run All Tests</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TestCasesPanel;