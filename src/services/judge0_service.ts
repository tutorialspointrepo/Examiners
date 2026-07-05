// src/services/judge0_service.ts
// Enhanced with multi-language preprocessing and error handling

const JUDGE0_BASE_URL = 'https://tpcg2.tutorialspoint.com/judge0/';

// Language ID mappings
export const LANGUAGE_IDS: Record<string, number> = {
  'python': 71,
  'javascript': 63,
  'java': 62,
  'cpp': 54,
  'c': 50,
  'csharp': 51,
  'go': 60,
  'rust': 73,
  'ruby': 72,
  'kotlin': 78,
  'swift': 83,
  'typescript': 74,
  'php': 68,
  'r': 80,
};

export const LANGUAGE_NAMES: Record<number, string> = {
  71: 'python',
  63: 'javascript',
  62: 'java',
  54: 'cpp',
  50: 'c',
  51: 'csharp',
  60: 'go',
  73: 'rust',
  72: 'ruby',
  78: 'kotlin',
  83: 'swift',
  74: 'typescript',
  68: 'php',
  80: 'r',
};

export const LANGUAGE_EXTENSIONS: Record<number, string> = {
  71: 'py',
  63: 'js',
  62: 'java',
  54: 'cpp',
  50: 'c',
  51: 'cs',
  60: 'go',
  73: 'rs',
  72: 'rb',
  78: 'kt',
  83: 'swift',
  74: 'ts',
  68: 'php',
  80: 'r',
};

interface Judge0Submission {
  source_code: string;
  language_id: number;
  stdin?: string;
  wait?: boolean;
}

interface Judge0Status {
  id: number;
  description: string;
}

interface Judge0Result {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: Judge0Status;
  time: string | null;
  memory: number | null;
  token?: string;
}

class Judge0Service {
  private baseUrl: string;

  constructor(baseUrl: string = JUDGE0_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Submit code for execution
   */
  async submitCode(submission: Judge0Submission): Promise<Judge0Result> {
    const { source_code, language_id, stdin = '', wait = false } = submission;
    
    // Base64 encode the source code and stdin to handle special characters
    const encodedSourceCode = btoa(unescape(encodeURIComponent(source_code)));
    const encodedStdin = stdin ? btoa(unescape(encodeURIComponent(stdin))) : '';
    
    const payload: Record<string, any> = { 
      source_code: encodedSourceCode, 
      language_id, 
      stdin: encodedStdin 
    };

    // Pass -lm for C (50) and C++ (54) so math.h functions (log, pow, sqrt, etc.) link properly
    if (language_id === 50 || language_id === 54) {
      payload.compiler_options = '-lm';
    }
    
    // Use base64_encoded=true to tell Judge0 we're sending base64
    const url = wait 
      ? `${this.baseUrl}/submissions?base64_encoded=true&wait=true` 
      : `${this.baseUrl}/submissions?base64_encoded=true`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Try to parse error response from Judge0
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // If we can't parse JSON, use the default message
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Decode base64 response fields if present
      if (result.stdout) {
        try {
          result.stdout = decodeURIComponent(escape(atob(result.stdout)));
        } catch (e) { /* Keep original if decode fails */ }
      }
      if (result.stderr) {
        try {
          result.stderr = decodeURIComponent(escape(atob(result.stderr)));
        } catch (e) { /* Keep original if decode fails */ }
      }
      if (result.compile_output) {
        try {
          result.compile_output = decodeURIComponent(escape(atob(result.compile_output)));
        } catch (e) { /* Keep original if decode fails */ }
      }
      if (result.message) {
        try {
          result.message = decodeURIComponent(escape(atob(result.message)));
        } catch (e) { /* Keep original if decode fails */ }
      }
      
      return result;
    } catch (error) {
      console.error('Judge0 submission error:', error);
      throw error;
    }
  }

  /**
   * Get submission result by token
   */
  async getSubmission(token: string): Promise<Judge0Result> {
    try {
      // Request base64 encoded response
      const response = await fetch(`${this.baseUrl}/submissions/${token}?base64_encoded=true`);
      
      if (!response.ok) {
        // Try to parse error response from Judge0
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // If we can't parse JSON, use the default message
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Decode base64 response fields if present
      if (result.stdout) {
        try {
          result.stdout = decodeURIComponent(escape(atob(result.stdout)));
        } catch (e) { /* Keep original if decode fails */ }
      }
      if (result.stderr) {
        try {
          result.stderr = decodeURIComponent(escape(atob(result.stderr)));
        } catch (e) { /* Keep original if decode fails */ }
      }
      if (result.compile_output) {
        try {
          result.compile_output = decodeURIComponent(escape(atob(result.compile_output)));
        } catch (e) { /* Keep original if decode fails */ }
      }
      if (result.message) {
        try {
          result.message = decodeURIComponent(escape(atob(result.message)));
        } catch (e) { /* Keep original if decode fails */ }
      }
      
      return result;
    } catch (error) {
      console.error('Judge0 get submission error:', error);
      throw error;
    }
  }

  /**
   * Submit code and wait for result
   */
  async submitAndWait(submission: Judge0Submission, maxWaitTime: number = 30000): Promise<Judge0Result> {
    try {
      // Try with wait=true first (synchronous)
      const result = await this.submitCode({ ...submission, wait: true });
      
      // If status is completed (id > 2), return immediately
      if (result.status && result.status.id > 2) {
        return result;
      }

      // If we got a token, poll for result
      if (result.token) {
        return await this.pollForResult(result.token, maxWaitTime);
      }

      return result;
    } catch (error) {
      // Fallback to async submission + polling
//       console.log('Falling back to async submission...');
      const result = await this.submitCode(submission);
      return await this.pollForResult(result.token!, maxWaitTime);
    }
  }

  /**
   * Poll for submission result
   */
  async pollForResult(token: string, maxWaitTime: number = 30000): Promise<Judge0Result> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.getSubmission(token);
      
      // Status IDs: 1 = In Queue, 2 = Processing, >2 = Completed
      if (result.status && result.status.id > 2) {
        return result;
      }

      // Wait 1 second before next poll
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Execution timeout after ${maxWaitTime}ms`);
  }

  /**
   * Preprocess code based on language
   */
  private preprocessCode(code: string, language: string): string {
    const lang = language.toLowerCase();
    
//     console.log(`🔧 Preprocessing ${language} code...`);
    
    switch (lang) {
      case 'java':
        return this.preprocessJavaCode(code);
      
      case 'kotlin':
        return this.preprocessKotlinCode(code);
      
      case 'csharp':
      case 'c#':
        return this.preprocessCSharpCode(code);
      
      case 'cpp':
      case 'c++':
        return this.preprocessCppCode(code);
      
      case 'python':
        return this.preprocessPythonCode(code);
      
      case 'javascript':
      case 'typescript':
        return this.preprocessJavaScriptCode(code);
      
      case 'php':
      case 'ruby':
      case 'r':
      case 'go':
      case 'rust':
      case 'swift':
        // Basic preprocessing - normalize line endings
        return code.includes('\r\n') ? code.replace(/\r\n/g, '\n') : code;
      
      default:
        return code;
    }
  }

  /**
   * Preprocess Java code - Fix class name to Main
   */
  private preprocessJavaCode(code: string): string {
//     console.log('  🔧 Java: Fixing class name...');
    
    const publicClassPattern = /public\s+class\s+([A-Za-z_]\w*)/g;
    let processedCode = code;
    let match;
    
    while ((match = publicClassPattern.exec(code)) !== null) {
      const className = match[1];
      if (className !== 'Main') {
//         console.log(`  🔄 Renaming class "${className}" → "Main"`);
        
        // Rename class declaration
        processedCode = processedCode.replace(
          new RegExp(`public\\s+class\\s+${className}\\b`, 'g'),
          'public class Main'
        );
        
        // Rename constructor
        processedCode = processedCode.replace(
          new RegExp(`\\b${className}\\s*\\(`, 'g'),
          'Main('
        );
        
        // Rename static references (e.g., ClassName.method())
        processedCode = processedCode.replace(
          new RegExp(`\\b${className}\\.`, 'g'),
          'Main.'
        );
      }
    }
    
//     console.log('  ✅ Java preprocessing complete');
    return processedCode;
  }

  /**
   * Preprocess Kotlin code
   */
  private preprocessKotlinCode(code: string): string {
//     console.log('  🔧 Kotlin: Ensuring main function...');
    
    // Check if main function exists
    if (!code.includes('fun main')) {
//       console.log('  ⚠️ No main function found in Kotlin code');
    }
    
    // Ensure package declaration is at top if present
    let processedCode = code;
    if (processedCode.includes('package ')) {
      const lines = processedCode.split('\n');
      const packageLines = lines.filter(l => l.trim().startsWith('package '));
      const otherLines = lines.filter(l => !l.trim().startsWith('package '));
      processedCode = [...packageLines, '', ...otherLines].join('\n');
    }
    
//     console.log('  ✅ Kotlin preprocessing complete');
    return processedCode;
  }

  /**
   * Preprocess C# code
   */
  private preprocessCSharpCode(code: string): string {
//     console.log('  🔧 C#: Checking class structure...');
    
    let processedCode = code;
    
    // Ensure using statements are at the top
    const usingPattern = /using\s+[\w.]+;/g;
    const usings = code.match(usingPattern) || [];
    
    if (usings.length > 0) {
      // Remove usings from their current positions
      processedCode = processedCode.replace(usingPattern, '').trim();
      
      // Add them at the top
      processedCode = usings.join('\n') + '\n\n' + processedCode;
    }
    
//     console.log('  ✅ C# preprocessing complete');
    return processedCode;
  }

  /**
   * Preprocess C++ code
   */
  private preprocessCppCode(code: string): string {
//     console.log('  🔧 C++: Checking includes and namespace...');
    
    let processedCode = code;
    
    // Ensure common includes
    const hasIostream = code.includes('#include <iostream>') || code.includes('#include<iostream>');
    const hasNamespace = code.includes('using namespace std');
    
    if (!hasIostream) {
//       console.log('  ➕ Adding #include <iostream>');
      processedCode = '#include <iostream>\n' + processedCode;
    }
    
    if (!hasNamespace && code.includes('cout') || code.includes('cin') || code.includes('endl')) {
//       console.log('  ➕ Adding using namespace std;');
      const includeEnd = processedCode.lastIndexOf('#include');
      const nextLine = processedCode.indexOf('\n', includeEnd) + 1;
      processedCode = 
        processedCode.slice(0, nextLine) + 
        'using namespace std;\n' + 
        processedCode.slice(nextLine);
    }
    
//     console.log('  ✅ C++ preprocessing complete');
    return processedCode;
  }

  /**
   * Preprocess Python code
   */
  private preprocessPythonCode(code: string): string {
//     console.log('  🔧 Python: Checking indentation and syntax...');
    
    let processedCode = code;
    
    // Fix common indentation issues (convert tabs to spaces)
    if (code.includes('\t')) {
//       console.log('  🔄 Converting tabs to spaces');
      processedCode = processedCode.replace(/\t/g, '    ');
    }
    
    // Remove Windows line endings
    if (code.includes('\r\n')) {
//       console.log('  🔄 Normalizing line endings');
      processedCode = processedCode.replace(/\r\n/g, '\n');
    }
    
    // Trim trailing whitespace from each line
    processedCode = processedCode
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n');
    
//     console.log('  ✅ Python preprocessing complete');
    return processedCode;
  }

  /**
   * Preprocess JavaScript/TypeScript code
   */
  private preprocessJavaScriptCode(code: string): string {
//     console.log('  🔧 JavaScript/TypeScript: Checking structure...');
    
    // No major preprocessing needed for JS/TS
    // Just ensure proper encoding
    let processedCode = code;
    
    // Remove Windows line endings
    if (code.includes('\r\n')) {
      processedCode = processedCode.replace(/\r\n/g, '\n');
    }
    
//     console.log('  ✅ JavaScript preprocessing complete');
    return processedCode;
  }

  /**
   * Execute code with custom input
   */
  async executeCode(
    code: string,
    language: string,
    input: string = ''
  ): Promise<{
    success: boolean;
    output: string;
    error: string | null;
    time: string;
    memory: string;
    status: string;
  }> {
    try {
      const languageId = LANGUAGE_IDS[language.toLowerCase()] || LANGUAGE_IDS['javascript'];

      // ✅ Preprocess code based on language
      const processedCode = this.preprocessCode(code, language);

//       console.log(`🚀 Executing ${language} code...`);
      const result = await this.submitAndWait({
        source_code: processedCode,
        language_id: languageId,
        stdin: input,
      });

//       console.log('✅ Execution result:', result);

      // Status 3 = Accepted (success)
      const success = result.status.id === 3;
      
      // Get error message - prefer compile_output for compilation errors, stderr for runtime errors
      let errorMessage: string | null = null;
      if (result.compile_output) {
        errorMessage = result.compile_output;
      } else if (result.stderr) {
        errorMessage = result.stderr;
      } else if (result.message) {
        errorMessage = result.message;
      }

      return {
        success,
        output: result.stdout || '',
        error: errorMessage,
        time: result.time || '0',
        memory: result.memory ? `${(result.memory / 1024).toFixed(2)} MB` : '0 KB',
        status: result.status.description,
      };
    } catch (error: any) {
      console.error('❌ Execution error:', error);
      return {
        success: false,
        output: '',
        error: error.message,
        time: '0',
        memory: '0 KB',
        status: 'Error',
      };
    }
  }

  /**
   * Run multiple test cases
   */
  async runTestCases(
    code: string,
    language: string,
    testCases: Array<{ input: string; expected_output?: string; output?: string }>
  ): Promise<{
    results: Array<{
      passed: boolean;
      input: string;
      expected: string;
      actual: string;
      error: string | null;
      time: string;
      memory: string;
      status: string;
    }>;
    totalPassed: number;
    totalFailed: number;
    executionTime: string;
  }> {
    const languageId = LANGUAGE_IDS[language.toLowerCase()] || LANGUAGE_IDS['javascript'];
    
    // ✅ Preprocess code once before running test cases
    const processedCode = this.preprocessCode(code, language);
    
    const results = [];
    let totalPassed = 0;
    let totalFailed = 0;
    const startTime = Date.now();

//     console.log(`🧪 Running ${testCases.length} test cases for ${language}...`);

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
//       console.log(`  📝 Test case ${i + 1}/${testCases.length}...`);

      try {
        const result = await this.submitAndWait({
          source_code: processedCode,
          language_id: languageId,
          stdin: testCase.input || '',
        });

        const actualOutput = (result.stdout || '').trim();
        const expectedOutput = (testCase.expected_output || testCase.output || '').trim();
        
        // Check if passed (status 3 = Accepted AND output matches)
        const passed = result.status.id === 3 && actualOutput === expectedOutput;

        results.push({
          passed,
          input: testCase.input || '',
          expected: expectedOutput,
          actual: actualOutput,
          error: result.stderr || result.compile_output || result.message || null,
          time: result.time || '0',
          memory: result.memory ? `${(result.memory / 1024).toFixed(2)} MB` : '0 KB',
          status: result.status.description,
        });

        if (passed) {
          totalPassed++;
//           console.log(`    ✅ Test case ${i + 1} passed`);
        } else {
          totalFailed++;
//           console.log(`    ❌ Test case ${i + 1} failed`);
//           console.log(`       Expected: "${expectedOutput}"`);
//           console.log(`       Got: "${actualOutput}"`);
        }
        
        // ✅ Add small delay between test cases to avoid overwhelming Judge0
        if (i < testCases.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
      } catch (error: any) {
        console.error(`    ⚠️ Test case ${i + 1} error:`, error);
        results.push({
          passed: false,
          input: testCase.input || '',
          expected: (testCase.expected_output || testCase.output || '').trim(),
          actual: '',
          error: error.message,
          time: '0',
          memory: '0 KB',
          status: 'Error',
        });
        totalFailed++;
      }
    }

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`✅ Test execution complete: ${totalPassed} passed, ${totalFailed} failed (${executionTime}s)`);

    return {
      results,
      totalPassed,
      totalFailed,
      executionTime: `${executionTime}s`,
    };
  }

  /**
   * Get language-specific boilerplate/starter code
   */
  getBoilerplate(language: string, functionName: string = 'solution'): string {
    const lang = language.toLowerCase();
    
    switch (lang) {
      case 'python':
        return `def ${functionName}():\n    # Write your code here\n    pass\n\nif __name__ == "__main__":\n    ${functionName}()`;
      
      case 'java':
        return `public class Main {\n    public static void main(String[] args) {\n        // Write your code here\n        \n    }\n}`;
      
      case 'javascript':
        return `function ${functionName}() {\n    // Write your code here\n    \n}\n\n${functionName}();`;
      
      case 'cpp':
      case 'c++':
        return `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    \n    return 0;\n}`;
      
      case 'c':
        return `#include <stdio.h>\n\nint main() {\n    // Write your code here\n    \n    return 0;\n}`;
      
      case 'csharp':
      case 'c#':
        return `using System;\n\nclass Program {\n    static void Main() {\n        // Write your code here\n        \n    }\n}`;
      
      case 'kotlin':
        return `fun main() {\n    // Write your code here\n    \n}`;
      
      case 'go':
        return `package main\n\nimport "fmt"\n\nfunc main() {\n    // Write your code here\n    \n}`;
      
      case 'rust':
        return `fn main() {\n    // Write your code here\n    \n}`;
      
      case 'ruby':
        return `# Write your code here\n\n`;
      
      case 'typescript':
        return `function ${functionName}(): void {\n    // Write your code here\n    \n}\n\n${functionName}();`;
      
      case 'php':
        return `<?php\n// Write your code here\n\n?>`;
      
      case 'r':
        return `# Write your code here\n\n`;
      
      case 'swift':
        return `import Foundation\n\n// Write your code here\n`;
      
      default:
        return `// Write your code here\n`;
    }
  }
}

export const judge0Service = new Judge0Service();