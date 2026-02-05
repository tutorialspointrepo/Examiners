import { useState, useEffect, useRef } from 'react';
import { X, GraduationCap, Send, Sparkles, Lightbulb, BookOpen, Code, HelpCircle, ListChecks, Brain, FlaskConical, MessageCircle, User } from 'lucide-react';
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

interface AILearningAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  courseName?: string;
  currentChapter?: string;
  currentLecture?: string;
  courseSlug?: string;
}

// Quick actions for learning - will be dynamically updated with course, chapter and lecture context
const getQuickActions = (courseName: string, currentChapter: string, currentLecture: string) => [
  {
    id: 'explain',
    icon: Lightbulb,
    label: 'Explain This Concept',
    prompt: `I'm learning the course "${courseName}"${currentChapter ? `, Chapter: "${currentChapter}"` : ''}${currentLecture ? `, Lecture: "${currentLecture}"` : ''}. Please explain the key concepts in simple terms with examples.`
  },
  {
    id: 'summary',
    icon: BookOpen,
    label: 'Summarize Lecture',
    prompt: `I'm studying the course "${courseName}"${currentChapter ? `, Chapter: "${currentChapter}"` : ''}${currentLecture ? `, Lecture: "${currentLecture}"` : ''}. Can you provide a concise summary of the main points? Include key takeaways.`
  },
  {
    id: 'code-examples',
    icon: Code,
    label: 'Code Examples',
    prompt: `I'm learning the course "${courseName}"${currentChapter ? `, Chapter: "${currentChapter}"` : ''}${currentLecture ? `, Lecture: "${currentLecture}"` : ''}. Show me practical code examples with detailed comments explaining each part.`
  },
  {
    id: 'quiz',
    icon: HelpCircle,
    label: 'Quick Quiz',
    prompt: `I'm studying the course "${courseName}"${currentChapter ? `, Chapter: "${currentChapter}"` : ''}${currentLecture ? `, Lecture: "${currentLecture}"` : ''}. Create a quick quiz with 5 multiple-choice questions to test my understanding. Include answers and explanations.`
  },
  {
    id: 'interview',
    icon: ListChecks,
    label: 'Interview Questions',
    prompt: `I'm learning the course "${courseName}"${currentChapter ? `, Chapter: "${currentChapter}"` : ''}${currentLecture ? `, Lecture: "${currentLecture}"` : ''}. Give me 5 common interview questions that could be asked on this topic. Include ideal answers and tips.`
  },
  {
    id: 'deeper',
    icon: Brain,
    label: 'Go Deeper',
    prompt: `I'm taking the course "${courseName}"${currentChapter ? `, Chapter: "${currentChapter}"` : ''}${currentLecture ? `, and just learned about "${currentLecture}"` : ''}. What are the more advanced concepts I should explore next?`
  },
  {
    id: 'realworld',
    icon: FlaskConical,
    label: 'Real-World Applications',
    prompt: `In the context of the course "${courseName}"${currentChapter ? `, Chapter: "${currentChapter}"` : ''}${currentLecture ? `, Lecture: "${currentLecture}"` : ''}, what are some real-world applications and industry use cases?`
  },
  {
    id: 'doubt',
    icon: MessageCircle,
    label: 'Clear My Doubts',
    prompt: `I'm studying the course "${courseName}"${currentChapter ? `, Chapter: "${currentChapter}"` : ''}${currentLecture ? `, Lecture: "${currentLecture}"` : ''}. I'm having trouble understanding this topic. Can you explain it in a different way with simple analogies?`
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
              <code className="block text-gray-800 text-xs font-mono whitespace-pre-wrap">
                {children}
              </code>
            ),
          pre: ({ children }) => (
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-3 text-xs font-mono">
              {children}
            </pre>
          ),
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

export default function AILearningAssistant({ isOpen, onClose, courseName = '', currentChapter = '', currentLecture = '', courseSlug = '' }: AILearningAssistantProps) {
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

  const quickActions = getQuickActions(courseName, currentChapter, currentLecture);
  
  const getWelcomeMessage = (): Message => ({
    id: '1',
    role: 'assistant',
    content: `Hello! 👋 I'm your AI Learning Assistant for **${courseName || 'this course'}**. I can help you with:

- Explaining concepts from the lectures
- Providing code examples and interview questions
- Creating quizzes to test your understanding
- Answering your questions about the course material
- Suggesting real-world applications

${currentChapter ? `📂 **Chapter:** ${currentChapter}\n` : ''}${currentLecture ? `📚 **Lecture:** ${currentLecture}\n` : ''}
Click on any quick action below or type your question!`,
    timestamp: new Date()
  });

  const [messages, setMessages] = useState<Message[]>([getWelcomeMessage()]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isQuickActionsExpanded, setIsQuickActionsExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Update welcome message when lecture changes
  useEffect(() => {
    if (isOpen && messages.length === 1 && messages[0].id === '1') {
      setMessages([getWelcomeMessage()]);
    }
  }, [currentChapter, currentLecture, courseName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

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
      const chatWithLearningAI = httpsCallable(functions, 'chatWithLearningAI');
      
      const conversationHistory = messages
        .filter(m => m.id !== '1') // Exclude welcome message
        .map(m => ({ role: m.role, content: m.content }));
      
      const result = await chatWithLearningAI({
        message: messageText,
        conversationHistory,
        courseContext: {
          courseName,
          currentChapter,
          currentLecture,
          courseSlug
        }
      });
      
      const response = (result.data as any)?.response || 'Sorry, I could not generate a response. Please try again.';
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('AI Learning Assistant error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputMessage);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] transition-opacity"
        onClick={onClose}
      />
      
      {/* Dialog - Slides in from right with margin and rounded corners */}
      <div 
        className="fixed right-2 top-2 bottom-2 z-[10000] w-[calc(100%-16px)] max-w-[35rem] bg-white shadow-2xl overflow-hidden rounded-2xl"
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div 
            className="px-5 py-3 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
            style={{ background: brand.gradients.primary }}
          >
            <div className="flex items-center space-x-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                <GraduationCap size={22} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">AI Learning Assistant</h2>
                <p className="text-xs text-white/80">Powered by AI</p>
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
                          <GraduationCap size={14} className="text-gray-500" />
                          <span className="text-xs font-medium text-gray-500">AI Learning Assistant</span>
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
                      <GraduationCap size={14} className="text-gray-500" />
                      <span className="text-xs font-medium text-gray-500">AI Learning Assistant</span>
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
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`Ask me anything about ${courseName || 'this course'}...`}
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