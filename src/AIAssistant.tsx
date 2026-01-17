import { useState, useEffect, useRef } from 'react';
import { X, Bot, Send, Sparkles, FileQuestion, ClipboardList, BookOpen, GraduationCap, MessageSquare, User } from 'lucide-react';
import { useBrand } from './BrandContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import 'katex/contrib/mhchem';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

const quickActions = [
  {
    id: 'sample-mcq',
    icon: FileQuestion,
    label: 'Generate MCQ Questions',
    prompt: 'Create 10 multiple-choice questions suitable for a high school science exam. Include 4 options per question with correct answers and brief explanations.'
  },
  {
    id: 'math-questions',
    icon: FileQuestion,
    label: 'Mathematics Questions',
    prompt: 'Generate 8 mathematics word problems suitable for grade 10 students, covering topics like algebra, geometry, and basic trigonometry. Include step-by-step solutions.'
  },
  {
    id: 'essay-questions',
    icon: BookOpen,
    label: 'Essay Questions',
    prompt: 'Create 5 essay-type questions for a literature or social studies exam. Include key points that should be covered in ideal answers.'
  },
  {
    id: 'short-answer',
    icon: MessageSquare,
    label: 'Short Answer Questions',
    prompt: 'Generate 15 short answer questions (2-3 sentences) covering general knowledge, science, and current affairs suitable for competitive exams.'
  },
  {
    id: 'assessment-rubric',
    icon: ClipboardList,
    label: 'Assessment Rubric',
    prompt: 'Design a comprehensive assessment rubric for evaluating student projects or assignments. Include criteria for excellent, good, satisfactory, and needs improvement performance levels.'
  },
  {
    id: 'marking-scheme',
    icon: GraduationCap,
    label: 'Marking Scheme',
    prompt: 'Create a detailed marking scheme for a 50-mark exam paper with sections for MCQs (20 marks), short answers (15 marks), and long-form questions (15 marks). Include point distribution and evaluation criteria.'
  },
  {
    id: 'bloom-taxonomy',
    icon: Sparkles,
    label: 'Bloom\'s Taxonomy Questions',
    prompt: 'Create a set of questions based on Bloom\'s Taxonomy covering all six cognitive levels: Remember, Understand, Apply, Analyze, Evaluate, and Create. Use a science or social studies topic.'
  },
  {
    id: 'exam-paper-format',
    icon: ClipboardList,
    label: 'Exam Paper Format',
    prompt: 'Suggest a professional exam paper format for CBSE/ICSE board exams including header layout, instructions section, question paper structure, and marking guidelines.'
  }
];

const MessageContent = ({ content, brandColor }: { content: string; brandColor: string }) => {
  return (
    <div className="text-sm prose prose-sm max-w-none markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, {
          throwOnError: false,
          strict: false,
          trust: true,
          output: 'html',
        }]]}
        components={{
          p: ({ children }) => <p className="mb-3 leading-relaxed last:mb-0">{children}</p>,
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mb-3 mt-4 first:mt-0 text-gray-900 pl-3 py-2 rounded-lg"
              style={{ 
                borderLeft: `5px solid ${brandColor}`,
                backgroundColor: `${brandColor}10`
              }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold mb-3 mt-4 first:mt-0 text-gray-900 pl-3 py-2 rounded-lg"
              style={{ 
                borderLeft: `4px solid ${brandColor}`,
                backgroundColor: `${brandColor}08`
              }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold mb-2 mt-3 first:mt-0 text-gray-800 pl-3 py-1.5"
              style={{ 
                borderLeft: `3px solid ${brandColor}`
              }}>
              {children}
            </h3>
          ),
          ul: ({ children }) => <ul>{children}</ul>,
          ol: ({ children }) => <ol>{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          code: ({ inline, children }: any) =>
            inline ? (
              <code className="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
            ) : (
              <code className="block bg-gray-200 text-gray-800 p-2 rounded text-xs font-mono overflow-x-auto my-2"
                style={{ borderLeft: `2px solid ${brandColor}40` }}>
                {children}
              </code>
            ),
          pre: ({ children }) => <pre className="bg-gray-200 p-2 rounded overflow-x-auto my-2">{children}</pre>,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline"
              style={{ color: brandColor }}>
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="pl-3 italic my-2"
              style={{ borderLeft: `4px solid ${brandColor}30` }}>
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3" style={{ borderColor: `${brandColor}30` }} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default function AIAssistant({ isOpen, onClose }: AIAssistantProps) {
  const brand = useBrand();
  
  // Get color for quick action based on index
  const getQuickActionColor = (index: number): string => {
    const colors = [
      brand.colors.primary,
      brand.colors.secondary,
      brand.colors.accent,
      brand.colors.primary,
      brand.colors.secondary,
      brand.colors.accent,
      brand.colors.primary,
      brand.colors.secondary
    ];
    return colors[index % colors.length];
  };
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! 👋 I'm your AI Exams Specialist for EXAMINERS. I can help you with:

- Creating sample questions and exam papers
- Designing assessment rubrics
- Generating marking schemes
- Formatting question papers
- Creating Bloom's Taxonomy based questions

Click on any quick action below or type your question!`,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isQuickActionsExpanded, setIsQuickActionsExpanded] = useState(true);
  const [showDialogElement, setShowDialogElement] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Animation effect - slide in from right
  useEffect(() => {
    if (isOpen) {
      setShowDialogElement(true);
      const timer = setTimeout(() => {
        const dialogElement = document.getElementById('ai-assistant-dialog');
        if (dialogElement) {
          dialogElement.classList.remove('translate-x-full');
          dialogElement.classList.add('translate-x-0');
        }
        const backdropElement = document.getElementById('ai-assistant-backdrop');
        if (backdropElement) {
          backdropElement.classList.remove('opacity-0');
          backdropElement.classList.add('opacity-100');
        }
      }, 10);
      return () => clearTimeout(timer);
    } else {
      const dialogElement = document.getElementById('ai-assistant-dialog');
      const backdropElement = document.getElementById('ai-assistant-backdrop');
      if (dialogElement && backdropElement) {
        dialogElement.classList.remove('translate-x-0');
        dialogElement.classList.add('translate-x-full');
        backdropElement.classList.remove('opacity-100');
        backdropElement.classList.add('opacity-0');
        setTimeout(() => {
          setShowDialogElement(false);
        }, 500);
      }
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const functions = getFunctions();
      const chatWithAI = httpsCallable(functions, 'chatWithAI');
      
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const result = await chatWithAI({
        message: messageText,
        conversationHistory
      });

      const data = result.data as { success: boolean; response: string };

      if (!data.success) {
        throw new Error('Failed to get response from AI');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error: any) {
      console.error('Error sending message:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputMessage);
    }
  };

  if (!showDialogElement) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        id="ai-assistant-backdrop"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] transition-opacity duration-500 opacity-0"
        onClick={onClose}
      />

      {/* Dialog - Slides in from right with margin and rounded corners */}
      <div 
        id="ai-assistant-dialog"
        className="fixed right-2 top-2 bottom-2 z-[9999] w-[calc(100%-16px)] max-w-[35rem] bg-white shadow-2xl transition-transform duration-500 ease-out overflow-hidden translate-x-full rounded-2xl"
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div 
            className="px-5 py-3 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
            style={{ 
              background: brand.gradients.primary
            }}
          >
            <div className="flex items-center space-x-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                <Bot size={22} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">AI Exams Specialist</h2>
                <p className="text-xs text-white/80">Powered by ChatGPT</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
            >
              <X size={18} className="text-white" />
            </button>
          </div>

          {/* Quick Actions Header */}
          <div 
            className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer flex-shrink-0" 
            onClick={() => setIsQuickActionsExpanded(!isQuickActionsExpanded)}
          >
            <div className="flex items-center space-x-2">
              <Sparkles size={18} style={{ color: brand.colors.primary }} />
              <span className="font-semibold text-gray-700 text-sm">QUICK ACTIONS</span>
              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{quickActions.length}</span>
            </div>
            <div className={`transition-transform ${isQuickActionsExpanded ? 'rotate-180' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-gray-400">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          {/* Quick Actions - Expandable */}
          {isQuickActionsExpanded && (
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  const actionColor = getQuickActionColor(index);
                  return (
                    <button
                      key={action.id}
                      onClick={() => {
                        sendMessage(action.prompt);
                        setIsQuickActionsExpanded(false);
                      }}
                      className="flex items-center space-x-2 px-3 py-2.5 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-all text-left group"
                      disabled={isLoading}
                    >
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" 
                        style={{ backgroundColor: `${actionColor}15` }}
                      >
                        <Icon size={16} style={{ color: actionColor }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
                        {action.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="w-full">
                <div
                  className={`w-full rounded-xl shadow-sm ${
                    message.role === 'user'
                      ? 'text-white'
                      : 'bg-gray-50 text-gray-900 border border-gray-200'
                  }`}
                  style={{ background: message.role === 'user' ? brand.gradients.primary : undefined }}
                >
                  <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
                    message.role === 'user' ? 'border-white/20' : 'border-gray-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      {message.role === 'assistant' ? (
                        <>
                          <div className="w-3 h-3 rounded-full bg-red-400"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                          <div className="w-3 h-3 rounded-full bg-green-400"></div>
                        </>
                      ) : (
                        <>
                          <div className="w-3 h-3 rounded-full bg-white/30"></div>
                          <div className="w-3 h-3 rounded-full bg-white/30"></div>
                          <div className="w-3 h-3 rounded-full bg-white/30"></div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {message.role === 'assistant' ? (
                        <div className="flex items-center space-x-1.5">
                          <Bot size={14} className="text-gray-500" />
                          <span className="text-xs font-medium text-gray-500">AI Exams Specialist</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5">
                          <User size={14} className="text-white/70" />
                          <span className="text-xs font-medium text-white/70">You</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-4 py-3 overflow-hidden">
                    {message.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">{message.content}</p>
                    ) : (
                      <div className="overflow-x-auto overflow-y-hidden">
                        <MessageContent content={message.content} brandColor={brand.colors.primary} />
                      </div>
                    )}
                  </div>
                  
                  <div className={`px-4 py-2 border-t ${
                    message.role === 'user' ? 'border-white/20' : 'border-gray-200'
                  }`}>
                    <p className={`text-xs ${message.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                      {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="w-full">
                <div className="w-full rounded-xl shadow-sm bg-gray-50 border border-gray-200">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Bot size={14} className="text-gray-500" />
                      <span className="text-xs font-medium text-gray-500">AI Exams Specialist</span>
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="px-5 py-4 bg-white border-t border-gray-200 flex-shrink-0 rounded-b-2xl">
            <form onSubmit={handleSubmit}>
              <div className="relative w-full">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about exams, questions, or assessments..."
                  rows={2}
                  className="w-full px-4 py-3 pr-14 border border-gray-300 rounded-xl focus:outline-none transition-all resize-none text-sm"
                  style={{
                    borderColor: inputMessage ? brand.colors.primary : '#d1d5db',
                    maxHeight: '120px'
                  }}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className="absolute right-3 p-2 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    background: brand.gradients.primary,
                    top: '50%',
                    transform: 'translateY(calc(-30% - 10px))'
                  }}
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Press Enter to send, Shift+Enter for new line</p>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}