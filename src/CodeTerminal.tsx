import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faMinus,
  faSquare,
  faClock,
  faMemory,
  faTerminal,
} from '@fortawesome/sharp-light-svg-icons';

interface CodeTerminalProps {
  isOpen: boolean;
  onClose: () => void;
  output: string;
  executionTime: string;
  executionMemory: string;
  isRunning: boolean;
  darkMode: boolean;
}

const CodeTerminal: React.FC<CodeTerminalProps> = ({
  isOpen,
  onClose,
  output,
  executionTime,
  executionMemory,
  isRunning,
  darkMode,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  // Calculate height based on maximized state
  const terminalHeight = isMaximized ? 'h-[75vh]' : 'h-[50vh]';

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 transform transition-all duration-300 ease-in-out z-[9997] ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      } ${terminalHeight}`}
      style={{ 
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div className={`h-full flex flex-col ${
        darkMode ? 'bg-gray-900' : 'bg-white'
      }`}>
        {/* Terminal Header */}
        <div className={`px-4 py-3 border-b flex items-center justify-between ${
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-200 border-gray-300'
        }`}>
          {/* Left: macOS-style buttons */}
          <div className="flex items-center space-x-2">
            {/* Close Button (Red) */}
            <button
              onClick={onClose}
              className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center group"
              title="Close"
            >
              <FontAwesomeIcon 
                icon={faXmark} 
                className="text-red-900 text-[8px] opacity-0 group-hover:opacity-100 transition-opacity" 
              />
            </button>
            
            {/* Minimize Button (Yellow) */}
            <button
              onClick={onClose}
              className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors flex items-center justify-center group"
              title="Minimize"
            >
              <FontAwesomeIcon 
                icon={faMinus} 
                className="text-yellow-900 text-[8px] opacity-0 group-hover:opacity-100 transition-opacity" 
              />
            </button>
            
            {/* Maximize Button (Green) */}
            <button
              onClick={handleMaximize}
              className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors flex items-center justify-center group"
              title={isMaximized ? "Restore" : "Maximize"}
            >
              <FontAwesomeIcon 
                icon={faSquare} 
                className="text-green-900 text-[8px] opacity-0 group-hover:opacity-100 transition-opacity" 
              />
            </button>
          </div>

          {/* Center: Title */}
          <div className="flex items-center space-x-2">
            <FontAwesomeIcon 
              icon={faTerminal} 
              className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} 
            />
            <span className={`text-sm font-semibold ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Terminal
            </span>
          </div>

          {/* Right: Spacer for symmetry */}
          <div className="w-16"></div>
        </div>

        {/* Terminal Output */}
        <div className={`flex-1 overflow-y-auto p-4 font-mono text-sm ${
          darkMode 
            ? 'bg-gray-900 text-green-400' 
            : 'bg-white text-gray-900'
        }`}>
          {isRunning ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full"></div>
              <span>Executing code...</span>
            </div>
          ) : output ? (
            <pre className="whitespace-pre-wrap break-words">{output}</pre>
          ) : (
            <div className={darkMode ? 'text-gray-500' : 'text-gray-400'}>
              💡 Terminal output will appear here when you run your code...
            </div>
          )}
        </div>

        {/* Terminal Footer - Stats */}
        <div className={`px-4 py-2 border-t flex items-center justify-between text-xs ${
          darkMode 
            ? 'bg-gray-800 border-gray-700 text-gray-400' 
            : 'bg-gray-200 border-gray-300 text-gray-600'
        }`}>
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <FontAwesomeIcon icon={faClock} />
              <span>Time: {executionTime}</span>
            </span>
            <span className="flex items-center space-x-1">
              <FontAwesomeIcon icon={faMemory} />
              <span>Memory: {executionMemory}</span>
            </span>
          </div>
          <span className={`font-semibold flex items-center space-x-1 ${
            isRunning ? 'text-yellow-500' : 'text-green-500'
          }`}>
            <span className={`inline-block w-2 h-2 rounded-full ${
              isRunning ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'
            }`}></span>
            <span>Status: {isRunning ? 'Running' : 'Ready'}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default CodeTerminal;