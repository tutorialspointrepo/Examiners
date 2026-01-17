import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TextSelection } from 'prosemirror-state';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBold,
  faItalic,
  faSigma,
  faUnderline,
  faStrikethrough,
  faCode,
  faListUl,
  faListOl,
  faQuoteLeft,
  faAlignLeft,
  faAlignCenter,
  faAlignRight,
  faAlignJustify,
  faUndo,
  faRedo,
  faPalette,
  faHighlighter,
  faEraser,
  faTable,
  faChevronDown,
  faFont,
  faAlignSlash,
  faHeading,
  faList,
} from '@fortawesome/sharp-light-svg-icons';
import MathFormulaToolbar, { FormulaEditDialog } from './MathFormulaToolbar';
import MathInline from './MathInlineExtension';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  darkMode: boolean;
  placeholder?: string;
  minHeight?: string;
  height?: string;  // ✅ Add height prop
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  darkMode,
  placeholder = 'Type your answer here...',
  minHeight = '150px',
  height = 'auto'  // ✅ Add height with default
}) => {
  const [showTextColorPicker, setShowTextColorPicker] = React.useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = React.useState(false);
  const [showFormatDropdown, setShowFormatDropdown] = React.useState(false);
  const [showHeadingDropdown, setShowHeadingDropdown] = React.useState(false);
  const [showAlignDropdown, setShowAlignDropdown] = React.useState(false);
  const [showTableDropdown, setShowTableDropdown] = React.useState(false);
  const [showListDropdown, setShowListDropdown] = React.useState(false);
  const [mathToolbarOpen, setMathToolbarOpen] = React.useState(false);
  const [savedSelection, setSavedSelection] = React.useState<any>(null);
  const [tableGridHover, setTableGridHover] = React.useState({ rows: 0, cols: 0 });
  
  // Formula Edit Dialog state
  const [isFormulaDialogOpen, setIsFormulaDialogOpen] = React.useState(false);
  const [editingFormula, setEditingFormula] = React.useState('');
  const [formulaCallback, setFormulaCallback] = React.useState<((newLatex: string) => void) | null>(null);
  
  const textColorRef = React.useRef<HTMLDivElement>(null);
  const highlightRef = React.useRef<HTMLDivElement>(null);
  const formatRef = React.useRef<HTMLDivElement>(null);
  const headingRef = React.useRef<HTMLDivElement>(null);
  const alignRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // ✅ Helper function to close all dropdowns
  const closeAllDropdowns = () => {
    setShowTextColorPicker(false);
    setShowHighlightPicker(false);
    setShowFormatDropdown(false);
    setShowHeadingDropdown(false);
    setShowAlignDropdown(false);
    setShowTableDropdown(false);
    setShowListDropdown(false);
  };

  // Helper function to clean empty tags from HTML
  const cleanHTML = (html: string): string => {
    console.log('🧹 cleanHTML called, input length:', html.length);
    console.log('  - Contains data-latex before:', html.includes('data-latex'));
    
    let cleaned = html;
    let previousCleaned = '';
    let iterations = 0;
    const maxIterations = 10;
    
    // Keep cleaning until no more changes (handles nested empty tags)
    while (previousCleaned !== cleaned && iterations < maxIterations) {
      previousCleaned = cleaned;
      iterations++;
      
      // Remove empty paragraph tags - most aggressive patterns
      cleaned = cleaned.replace(/<p[^>]*>[\s\n\r]*<\/p>/g, '');
      
      // Remove empty pre tags (code blocks) - catch ANY whitespace including newlines
      cleaned = cleaned.replace(/<pre[^>]*><code[^>]*>[\s\n\r]*<\/code><\/pre>/g, '');
      cleaned = cleaned.replace(/<pre[^>]*>[\s\n\r]*<\/pre>/g, '');
      
      // Remove empty code tags
      cleaned = cleaned.replace(/<code[^>]*>[\s\n\r]*<\/code>/g, '');
      
      // Remove empty blockquote tags
      cleaned = cleaned.replace(/<blockquote[^>]*>[\s\n\r]*<\/blockquote>/g, '');
      
      // Remove empty heading tags
      cleaned = cleaned.replace(/<h[1-6][^>]*>[\s\n\r]*<\/h[1-6]>/g, '');
      
      // Remove empty div and span tags (but keep math spans with data-latex)
      cleaned = cleaned.replace(/<div[^>]*>[\s\n\r]*<\/div>/g, '');
      // Only remove spans that DON'T have data-latex attribute
      cleaned = cleaned.replace(/<span(?![^>]*data-latex)[^>]*>[\s\n\r]*<\/span>/g, '');
    }
    
    // Final pass - super aggressive, no grouping
    cleaned = cleaned.replace(/<pre><\/pre>/g, '');
    cleaned = cleaned.replace(/<code><\/code>/g, '');
    cleaned = cleaned.replace(/<p><\/p>/g, '');
    
    console.log('  - Contains data-latex after:', cleaned.includes('data-latex'));
    console.log('  - Output length:', cleaned.trim().length);
    
    return cleaned.trim();
  };

  // Beautiful color palettes
  const textColors = [
    { name: 'Black', value: '#000000' },
    { name: 'Dark Gray', value: '#4B5563' },
    { name: 'Gray', value: '#6B7280' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Orange', value: '#F97316' },
    { name: 'Amber', value: '#F59E0B' },
    { name: 'Yellow', value: '#EAB308' },
    { name: 'Lime', value: '#84CC16' },
    { name: 'Green', value: '#10B981' },
    { name: 'Emerald', value: '#059669' },
    { name: 'Teal', value: '#14B8A6' },
    { name: 'Cyan', value: '#06B6D4' },
    { name: 'Sky', value: '#0EA5E9' },
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Indigo', value: '#6366F1' },
    { name: 'Violet', value: '#8B5CF6' },
    { name: 'Purple', value: '#A855F7' },
    { name: 'Fuchsia', value: '#D946EF' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Rose', value: '#F43F5E' },
  ];

  const highlightColors = [
    { name: 'Yellow', value: '#FEF08A' },
    { name: 'Lime', value: '#D9F99D' },
    { name: 'Green', value: '#BBF7D0' },
    { name: 'Cyan', value: '#A5F3FC' },
    { name: 'Blue', value: '#BFDBFE' },
    { name: 'Indigo', value: '#C7D2FE' },
    { name: 'Purple', value: '#DDD6FE' },
    { name: 'Pink', value: '#FBCFE8' },
    { name: 'Rose', value: '#FECDD3' },
    { name: 'Orange', value: '#FED7AA' },
    { name: 'Red', value: '#FECACA' },
    { name: 'Gray', value: '#E5E7EB' },
  ];

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if the click is on a dropdown button itself (to prevent immediate close)
      const isDropdownButton = (target as HTMLElement).closest('button[title="Heading"], button[title="Format"], button[title="Text Color"], button[title="Highlight"], button[title="Align"], button[title="Insert Table"], button[title="Lists"]');
      
      if (isDropdownButton) {
        // Don't close if clicking the dropdown button - let its onClick handle it
        return;
      }
      
      if (textColorRef.current && !textColorRef.current.contains(target)) {
        setShowTextColorPicker(false);
      }
      if (highlightRef.current && !highlightRef.current.contains(target)) {
        setShowHighlightPicker(false);
      }
      if (formatRef.current && !formatRef.current.contains(target)) {
        setShowFormatDropdown(false);
      }
      if (headingRef.current && !headingRef.current.contains(target)) {
        setShowHeadingDropdown(false);
      }
      if (alignRef.current && !alignRef.current.contains(target)) {
        setShowAlignDropdown(false);
      }
      if (tableRef.current && !tableRef.current.contains(target)) {
        setShowTableDropdown(false);
      }
      if (listRef.current && !listRef.current.contains(target)) {
        setShowListDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Callback for editing formulas - opens beautiful dialog
  const handleEditFormula = React.useCallback((latex: string, callback: (newLatex: string) => void) => {
    setEditingFormula(latex);
    setFormulaCallback(() => callback);
    setIsFormulaDialogOpen(true);
  }, []);

  const handleSaveFormula = (newLatex: string) => {
    if (formulaCallback) {
      formulaCallback(newLatex);
    }
    setIsFormulaDialogOpen(false);
    setFormulaCallback(null);
  };

  const handleCancelFormula = () => {
    setIsFormulaDialogOpen(false);
    setFormulaCallback(null);
  };

  const cleanedContent = React.useMemo(() => {
    return cleanHTML(value || '');
  }, [value]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({
        placeholder: placeholder,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline cursor-pointer',
        },
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full my-4 tiptap-table',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'tiptap-table-row',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'tiptap-table-header',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'tiptap-table-cell',
        },
      }),
      MathInline.configure({
        onEditFormula: handleEditFormula,
      }),
    ],
    content: cleanedContent,  // ⭐ Clean empty tags from initial content
    onUpdate: ({ editor }) => {
      try {
        const html = editor.getHTML();
        // Just pass the HTML as-is, don't clean on every keystroke
        onChange(html);
      } catch (error) {
        console.error('Error serializing editor content:', error);
      }
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none min-h-[500px] ${
          darkMode ? 'prose-invert' : ''
        }`,
      },
    },
  });

  // Validate content on mount - clear if it has old broken math nodes
  React.useEffect(() => {
    if (!editor) return;
    
    // Small delay to let editor fully initialize
    const timeoutId = setTimeout(() => {
      try {
        editor.getHTML();
        
        // ✅ On mount, render any math equations in the initial content
        const mathElements = editor.view.dom.querySelectorAll('[data-latex]');
        if (mathElements.length > 0) {
          console.log('🔄 RichTextEditor: Rendering math on mount/remount, found:', mathElements.length);
          mathElements.forEach(el => {
            const latex = el.getAttribute('data-latex');
            if (latex && !el.classList.contains('katex-rendered')) {
              try {
                el.innerHTML = katex.renderToString(latex, {
                  throwOnError: false,
                  displayMode: el.classList.contains('math-display')
                });
                el.classList.add('katex-rendered');
              } catch (err) {
                console.error('Failed to render math:', err);
              }
            }
          });
        }
      } catch (error) {
        console.error('Editor has invalid math content from old version. Please clear and re-add formulas.');
        // Optionally auto-clear: editor.commands.setContent('');
      }
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [editor]);

  {/* Headings Dropdown */}

  const insertTableFromGrid = (rows: number, cols: number) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setShowTableDropdown(false);
    setTableGridHover({ rows: 0, cols: 0 });
  };
  // Inject table action buttons
  React.useEffect(() => {
    if (!editor) return;

    const injectTableActions = () => {
      const tables = document.querySelectorAll('.ProseMirror table');
      
      tables.forEach((table) => {
        let wrapper = table.closest('.tableWrapper');
        
        // If no tableWrapper exists, get or create parent wrapper
        if (!wrapper) {
          wrapper = table.parentElement;
          if (wrapper && !wrapper.classList.contains('table-container')) {
            wrapper.classList.add('table-container');
          }
        }
        
        if (!wrapper) return;

        // Check if button already exists using data attribute
        if (table.hasAttribute('data-table-actions-injected')) return;
        
        // Mark this table as processed
        table.setAttribute('data-table-actions-injected', 'true');

        // Track last clicked cell - we'll determine it from editor selection when needed
        let lastClickedCell: HTMLElement | null = null;

        // ✅ Track clicks on table cells to remember which cell user was in
        const cells = table.querySelectorAll('td, th');
        cells.forEach(cell => {
          cell.addEventListener('click', () => {
            lastClickedCell = cell as HTMLElement;
            console.log('📍 Cell clicked, saved as lastClickedCell:', cell.textContent?.substring(0, 20));
          });
        });

        // Create action button
        const actionButton = document.createElement('div');
        actionButton.className = 'table-actions-button';
        actionButton.innerHTML = `
          <button class="action-icon" tabindex="-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fill-rule="evenodd" d="M8.34 1.804A1 1 0 019.32 1h1.36a1 1 0 01.98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 011.262.125l.962.962a1 1 0 01.125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 01.804.98v1.361a1 1 0 01-.804.98l-1.473.295a6.95 6.95 0 01-.587 1.416l.834 1.25a1 1 0 01-.125 1.262l-.962.962a1 1 0 01-1.262.125l-1.25-.834a6.953 6.953 0 01-1.416.587l-.294 1.473a1 1 0 01-.98.804H9.32a1 1 0 01-.98-.804l-.295-1.473a6.957 6.957 0 01-1.416-.587l-1.25.834a1 1 0 01-1.262-.125l-.962-.962a1 1 0 01-.125-1.262l.834-1.25a6.957 6.957 0 01-.587-1.416l-1.473-.294A1 1 0 011 10.68V9.32a1 1 0 01.804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 01.125-1.262l.962-.962A1 1 0 015.38 3.03l1.25.834a6.957 6.957 0 011.416-.587l.294-1.473zM13 10a3 3 0 11-6 0 3 3 0 016 0z" clip-rule="evenodd" />
            </svg>
          </button>
          <div class="action-menu">
            <button class="menu-item" data-action="add-row-before" title="Add row above" tabindex="-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              <span>Row Above</span>
            </button>
            <button class="menu-item" data-action="add-row-after" title="Add row below" tabindex="-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              <span>Row Below</span>
            </button>
            <button class="menu-item danger" data-action="delete-row" title="Delete current row" tabindex="-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
              <span>Del Row</span>
            </button>
            <div class="menu-divider"></div>
            <button class="menu-item" data-action="add-col-before" title="Add column before" tabindex="-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              <span>Col Before</span>
            </button>
            <button class="menu-item" data-action="add-col-after" title="Add column after" tabindex="-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              <span>Col After</span>
            </button>
            <button class="menu-item danger" data-action="delete-col" title="Delete current column" tabindex="-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
              <span>Del Col</span>
            </button>
            <div class="menu-divider"></div>
            <button class="menu-item danger" data-action="delete-table" title="Delete entire table" tabindex="-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
              </svg>
              <span>Del Table</span>
            </button>
          </div>
        `;

        // Position absolutely relative to wrapper
        (wrapper as HTMLElement).style.position = 'relative';
        wrapper.appendChild(actionButton);
        
        // ✅ Make action button completely non-interactive for text selection
        actionButton.style.userSelect = 'none';
        actionButton.style.pointerEvents = 'auto';  // But still clickable
        actionButton.setAttribute('contenteditable', 'false');  // Prevent editing
        actionButton.setAttribute('data-drag-handle', '');  // Prevent dragging interference
        
        // Add click handler to cog button to toggle menu
        const cogButton = actionButton.querySelector('.action-icon') as HTMLElement;
        const actionMenu = actionButton.querySelector('.action-menu') as HTMLElement;
        let menuOpen = false;
        
        // ✅ Use mousedown instead of click to prevent focus loss
        cogButton.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          e.preventDefault();  // Prevents focus change!
          
          // ✅ CRITICAL: Save the editor state BEFORE any DOM changes
          const savedSelection = editor.state.selection;
          
          // ✅ IMPORTANT: Save the current cell BEFORE doing anything
          // This ensures we remember which cell the user was in
          try {
            const { selection } = editor.state;
            const resolvedPos = selection.$anchor;
            
            let depth = resolvedPos.depth;
            while (depth > 0) {
              const node = resolvedPos.node(depth);
              if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                const pos = resolvedPos.before(depth);
                const domNode = editor.view.nodeDOM(pos);
                if (domNode && (domNode instanceof HTMLTableCellElement) && table.contains(domNode)) {
                  lastClickedCell = domNode as HTMLElement;
                  console.log('📍 Saved current cell before opening menu:', lastClickedCell.textContent?.substring(0, 20));
                  break;
                }
              }
              depth--;
            }
          } catch (error) {
            console.log('⚠️ Could not determine current cell from selection');
          }
          
          menuOpen = !menuOpen;
          
          if (menuOpen) {
            actionMenu.classList.add('menu-visible');
            console.log('📋 Menu opened');
            
            // ✅ CRITICAL: Restore selection immediately after menu opens
            setTimeout(() => {
              try {
                editor.view.focus();
                const tr = editor.state.tr.setSelection(savedSelection);
                editor.view.dispatch(tr);
                console.log('✅ Selection restored after menu open');
              } catch (error) {
                console.log('⚠️ Could not restore selection');
              }
            }, 0);
          } else {
            actionMenu.classList.remove('menu-visible');
            console.log('📋 Menu closed');
          }
          
          return false;  // Extra safety to prevent default
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          if (!actionButton.contains(target) && menuOpen) {
            menuOpen = false;
            actionMenu.classList.remove('menu-visible');
            console.log('📋 Menu closed (outside click)');
          }
        });

        // Add event listeners for buttons using data-action
        const menuItems = actionButton.querySelectorAll('[data-action]');
        
        // Global execution tracker to prevent ANY double execution
        const executionTracker = {
          lastAction: '',
          lastTimestamp: 0,
          isExecuting: false
        };
        
        menuItems.forEach((item) => {
          // MOUSEDOWN event - works reliably when click doesn't
          // Use capture phase to catch event before it bubbles
          item.addEventListener('mousedown', (e) => {
            const now = Date.now();
            const action = (item as HTMLElement).getAttribute('data-action') || '';
            
            // CRITICAL: Prevent execution if same action was just executed (within 500ms)
            if (executionTracker.lastAction === action && 
                (now - executionTracker.lastTimestamp) < 500) {
              console.log(`⛔ BLOCKED duplicate ${action} (${now - executionTracker.lastTimestamp}ms since last)`);
              return;
            }
            
            // CRITICAL: Prevent execution if already executing anything
            if (executionTracker.isExecuting) {
              console.log(`⛔ BLOCKED ${action} - another action is executing`);
              return;
            }
            
            // Mark as executing
            executionTracker.isExecuting = true;
            executionTracker.lastAction = action;
            executionTracker.lastTimestamp = now;
            
            console.log(`▶️ Executing ${action}`);
            
            // Stop event from bubbling to parent elements
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Get the currently selected/focused cell from editor state
            let targetCell: HTMLElement | null = null;
            
            // ✅ PRIORITY 1: Use lastClickedCell if available (user was in a specific cell)
            if (lastClickedCell && table.contains(lastClickedCell)) {
              targetCell = lastClickedCell;
              console.log('📍 Using lastClickedCell:', targetCell.textContent?.substring(0, 20));
            }
            
            // PRIORITY 2: Try to get cell from current selection
            if (!targetCell) {
              try {
                // Try to get cell from current selection
                const { selection } = editor.state;
                const resolvedPos = selection.$anchor;
                
                // Find the table cell node in the document
                let depth = resolvedPos.depth;
                while (depth > 0) {
                  const node = resolvedPos.node(depth);
                  if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                    const pos = resolvedPos.before(depth);
                    const domNode = editor.view.nodeDOM(pos);
                    if (domNode && (domNode instanceof HTMLTableCellElement)) {
                      targetCell = domNode as HTMLElement;
                      console.log('📍 Using cell from editor selection:', targetCell.textContent?.substring(0, 20));
                      break;
                    }
                  }
                  depth--;
                }
              } catch (error) {
                console.log('Could not get cell from selection');
              }
            }
            
            // PRIORITY 3: Fallback to first cell if no selection found
            if (!targetCell) {
              targetCell = table.querySelector('td, th') as HTMLElement;
              console.log('📍 Using first cell as fallback');
            }
            
            if (!targetCell) {
              console.error('❌ No cell found to perform action');
              executionTracker.isExecuting = false;
              return;
            }
            
            console.log('📍 Using cell:', targetCell.tagName, targetCell.textContent?.substring(0, 20));
            
            try {
              // Get the position of the cell in the document
              const pos = editor.view.posAtDOM(targetCell, 0);
              
              // Create a text selection at that position
              const $pos = editor.state.doc.resolve(pos);
              const selection = TextSelection.near($pos);
              
              // Set the selection
              const tr = editor.state.tr.setSelection(selection);
              editor.view.dispatch(tr);
              
              // Focus the editor
              editor.view.focus();
              
              // Execute the command immediately
              let success = false;
              
              switch(action) {
                case 'add-row-before':
                  success = editor.chain().addRowBefore().run();
                  break;
                case 'add-row-after':
                  success = editor.chain().addRowAfter().run();
                  break;
                case 'delete-row':
                  success = editor.chain().deleteRow().run();
                  break;
                case 'add-col-before':
                  success = editor.chain().addColumnBefore().run();
                  break;
                case 'add-col-after':
                  success = editor.chain().addColumnAfter().run();
                  break;
                case 'delete-col':
                  success = editor.chain().deleteColumn().run();
                  break;
                case 'delete-table':
                  success = editor.chain().deleteTable().run();
                  break;
              }
              
              if (success) {
                console.log(`✅ ${action} completed`);
              } else {
                console.error(`❌ ${action} failed`);
              }
            } catch (error) {
              console.error('💥 Error executing table action:', error);
            } finally {
              // Reset execution flag after a delay
              setTimeout(() => {
                executionTracker.isExecuting = false;
              }, 300);
            }
          }, { capture: true }); // Use capture phase
        });
      });
    };

    // Run on mount and when content changes
    injectTableActions();
    editor.on('update', injectTableActions);

    return () => {
      editor.off('update', injectTableActions);
    };
  }, [editor]);

  // ✅ Early return AFTER all hooks
  if (!editor) {
    return null;
  }

  const ToolbarButton = ({
    onClick,
    active = false,
    disabled = false,
    icon,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    icon: any;
    title: string;
  }) => (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) {
          onClick();
        }
      }}
      disabled={disabled}
      title={title}
      className={`p-2 rounded transition-colors text-sm ${
        active
          ? darkMode
            ? 'bg-blue-600 text-white'
            : 'bg-blue-500 text-white'
          : darkMode
          ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
          : 'text-gray-700 hover:bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <FontAwesomeIcon icon={icon} className="w-4 h-4" />
    </button>
  );

  const Divider = () => (
    <div
      className={`w-px h-6 mx-1 ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}
    />
  );

  const DropdownButton = ({
    onClick,
    icon,
    title,
    active = false
  }: {
    onClick: () => void;
    icon: any;
    title: string;
    active?: boolean;
  }) => (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={`flex items-center space-x-1 px-2 py-2 rounded transition-colors text-sm ${
        active
          ? darkMode
            ? 'bg-blue-600 text-white'
            : 'bg-blue-500 text-white'
          : darkMode
          ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
          : 'text-gray-700 hover:bg-gray-200'
      }`}
    >
      <FontAwesomeIcon icon={icon} className="w-4 h-4" />
      <FontAwesomeIcon icon={faChevronDown} className="w-3 h-3" />
    </button>
  );

  const DropdownMenu = ({
    children,
    className = ''
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div className={`absolute top-full left-0 mt-1 z-[1200] rounded-lg shadow-2xl border ${
      darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    } py-1 min-w-[180px] ${className}`}>
      {children}
    </div>
  );

  const DropdownItem = ({
    onClick,
    icon,
    label,
    active = false
  }: {
    onClick: () => void;
    icon?: any;
    label: string;
    active?: boolean;
  }) => (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`w-full flex items-center space-x-2 px-4 py-2 text-sm text-left transition-colors ${
        active
          ? darkMode
            ? 'bg-blue-600 text-white'
            : 'bg-blue-500 text-white'
          : darkMode
          ? 'text-gray-300 hover:bg-gray-700'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {icon && <FontAwesomeIcon icon={icon} className="w-4 h-4" />}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="rich-text-editor-wrapper flex-1 flex flex-col gap-0">
      <style>{`
        /* Editor Styles */
        .rich-text-editor-wrapper .ProseMirror {
          min-height: ${minHeight};
          padding: 0;
          margin: 0;
          ${darkMode ? `
            background: #1f2937;
            color: #f3f4f6;
          ` : `
            background: white;
            color: #111827;
          `}
        }

        .rich-text-editor-wrapper .ProseMirror:focus {
          outline: none;
        }

        /* Placeholder Styles */
        .rich-text-editor-wrapper .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: ${darkMode ? '#6b7280' : '#9ca3af'};
          pointer-events: none;
          float: left;
          height: 0;
          width: 100%;
        }

        /* Code Block Styles */
        .rich-text-editor-wrapper .ProseMirror pre {
          background: ${darkMode ? '#111827' : '#f3f4f6'};
          border: 1px solid ${darkMode ? '#4b5563' : '#d1d5db'};
          border-radius: 6px;
          padding: 12px;
          margin: 0;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
          font-size: 13px;
          overflow-x: auto;
        }

        .rich-text-editor-wrapper .ProseMirror pre code {
          background: transparent;
          padding: 0;
          border: none;
          color: ${darkMode ? '#f3f4f6' : '#111827'};
          font-family: inherit;
        }

        /* Table Styles */
        .rich-text-editor-wrapper .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 0;
          overflow: hidden;
          position: relative;
        }

        /* Table wrapper container */
        .rich-text-editor-wrapper .ProseMirror .tableWrapper,
        .rich-text-editor-wrapper .ProseMirror .table-container {
          position: relative;
          margin: 40px 0 24px 0;
        }

        /* Table action button */
        .rich-text-editor-wrapper .table-actions-button {
          position: absolute;
          top: -33px;
          left: 0;
          right: 0;
          height: 32px;
          z-index: 1000;
          pointer-events: auto;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        .rich-text-editor-wrapper .table-actions-button * {
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        /* Enable pointer events on container when table is hovered */
        .rich-text-editor-wrapper .tableWrapper:hover .table-actions-button,
        .rich-text-editor-wrapper .table-container:hover .table-actions-button {
          pointer-events: auto;
        }

        .rich-text-editor-wrapper .table-actions-button .action-icon {
          position: absolute;
          top: 0;
          right: 8px;
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, ${darkMode ? '#3b82f6' : '#2563eb'} 0%, ${darkMode ? '#2563eb' : '#1d4ed8'} 100%);
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          opacity: 0;
          transition: all 0.2s ease;
          pointer-events: auto;
          z-index: 1;
        }

        .rich-text-editor-wrapper .tableWrapper:hover .table-actions-button .action-icon,
        .rich-text-editor-wrapper .table-container:hover .table-actions-button .action-icon,
        .rich-text-editor-wrapper .table-actions-button .action-icon:hover {
          opacity: 1;
          pointer-events: auto;
        }

        /* Show menu only when .menu-visible class is added (via click) */
        .rich-text-editor-wrapper .table-actions-button .action-menu.menu-visible {
          opacity: 1;
          pointer-events: auto;
          visibility: visible;
        }

        /* Hide button when menu is visible */
        .rich-text-editor-wrapper .table-actions-button .action-menu.menu-visible ~ .action-icon {
          opacity: 0;
          pointer-events: none;
        }

        .rich-text-editor-wrapper .table-actions-button .action-icon:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        /* Action menu */
        .rich-text-editor-wrapper .table-actions-button .action-menu {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          width: 100%;
          height: 32px;
          background: ${darkMode ? '#1f2937' : 'white'};
          border: 1px solid ${darkMode ? '#4b5563' : '#d1d5db'};
          border-bottom: none;
          border-radius: 8px 8px 0 0;
          box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
          padding: 0 48px 0 8px;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 4px;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: all 0.2s ease;
          white-space: nowrap;
          overflow-x: auto;
          overflow-y: hidden;
          z-index: 200;
        }

        .rich-text-editor-wrapper .table-actions-button .action-menu::-webkit-scrollbar {
          display: none;
        }

        .rich-text-editor-wrapper .table-actions-button .action-menu {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        /* Ensure menu items can receive clicks when menu is visible */
        .rich-text-editor-wrapper .table-actions-button .action-menu.menu-visible .menu-item {
          pointer-events: auto !important;
        }

        /* Menu items */
        .rich-text-editor-wrapper .table-actions-button .menu-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: transparent;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          color: ${darkMode ? '#e5e7eb' : '#374151'};
          transition: background 0.15s ease;
          white-space: nowrap;
          pointer-events: auto;
          position: relative;
          z-index: 10;
        }

        .rich-text-editor-wrapper .table-actions-button .menu-item:hover {
          background: ${darkMode ? '#374151' : '#f3f4f6'};
        }

        .rich-text-editor-wrapper .table-actions-button .menu-item.danger {
          color: ${darkMode ? '#fca5a5' : '#dc2626'};
        }

        .rich-text-editor-wrapper .table-actions-button .menu-item.danger:hover {
          background: ${darkMode ? '#7f1d1d' : '#fee2e2'};
        }

        .rich-text-editor-wrapper .table-actions-button .menu-item svg {
          flex-shrink: 0;
        }

        .rich-text-editor-wrapper .table-actions-button .menu-item span {
          font-size: 12px;
          font-weight: 500;
        }

        .rich-text-editor-wrapper .table-actions-button .menu-divider {
          width: 1px;
          height: 20px;
          background: ${darkMode ? '#374151' : '#e5e7eb'};
          margin: 0 4px;
        }

        .rich-text-editor-wrapper .ProseMirror table td,
        .rich-text-editor-wrapper .ProseMirror table th {
          min-width: 1em;
          border: 2px solid ${darkMode ? '#4b5563' : '#d1d5db'};
          padding: 8px 12px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }

        .rich-text-editor-wrapper .ProseMirror table th {
          font-weight: bold;
          text-align: left;
          background: ${darkMode ? '#374151' : '#f3f4f6'};
        }

        .rich-text-editor-wrapper .ProseMirror table .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          background: rgba(59, 130, 246, 0.2);
          pointer-events: none;
        }

        /* Table Column Resize Handle */
        .rich-text-editor-wrapper .ProseMirror .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 4px;
          cursor: col-resize;
          background-color: ${darkMode ? '#3b82f6' : '#2563eb'};
          opacity: 0;
          transition: opacity 0.2s;
        }

        .rich-text-editor-wrapper .ProseMirror table td:hover .column-resize-handle,
        .rich-text-editor-wrapper .ProseMirror table th:hover .column-resize-handle {
          opacity: 0.5;
        }

        .rich-text-editor-wrapper .ProseMirror .column-resize-handle:hover {
          opacity: 1 !important;
        }

        /* Add resize cursor to right edge of cells */
        .rich-text-editor-wrapper .ProseMirror table td,
        .rich-text-editor-wrapper .ProseMirror table th {
          cursor: default;
        }

        .rich-text-editor-wrapper .ProseMirror table td:hover,
        .rich-text-editor-wrapper .ProseMirror table th:hover {
          position: relative;
          background: ${darkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)'};
          transition: background 0.2s ease;
        }

        .rich-text-editor-wrapper .ProseMirror table tr:hover td,
        .rich-text-editor-wrapper .ProseMirror table tr:hover th {
          background: ${darkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)'};
        }

        /* Enhanced table focus styles */
        .rich-text-editor-wrapper .ProseMirror table.selectedTable {
          outline: 2px solid ${darkMode ? '#3b82f6' : '#2563eb'};
          outline-offset: 2px;
        }

        /* Highlight the active cell being used as reference */
        .rich-text-editor-wrapper .ProseMirror table td.active-reference-cell,
        .rich-text-editor-wrapper .ProseMirror table th.active-reference-cell {
          background: ${darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'};
          position: relative;
        }

        .rich-text-editor-wrapper .ProseMirror table td.active-reference-cell::after,
        .rich-text-editor-wrapper .ProseMirror table th.active-reference-cell::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border: 2px solid ${darkMode ? '#3b82f6' : '#2563eb'};
          pointer-events: none;
        }

        .rich-text-editor-wrapper .ProseMirror table td::after,
        .rich-text-editor-wrapper .ProseMirror table th::after {
          content: '';
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 6px;
          cursor: col-resize;
          z-index: 10;
        }

        /* Math Formula Styles */
        .rich-text-editor-wrapper .ProseMirror .math-inline {
          display: inline-block;
          background: ${darkMode ? '#374151' : '#f3f4f6'};
          padding: 2px 6px;
          border-radius: 4px;
          margin: 0 2px;
        }

        .rich-text-editor-wrapper .ProseMirror .math-inline.katex-rendered {
          background: transparent;
          padding: 0;
        }

        /* KaTeX math rendering */
        .rich-text-editor-wrapper .ProseMirror .math-node,
        .rich-text-editor-wrapper .ProseMirror span[data-type="mathInline"] {
          display: inline;
        }

        .rich-text-editor-wrapper .ProseMirror .katex-display {
          margin: 1em 0;
          text-align: center;
        }

        .rich-text-editor-wrapper .ProseMirror .katex {
          font-size: 1.1em;
        }

        /* Image Styles */
        .rich-text-editor-wrapper .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
          margin: 0;
        }

        /* List Styles */
        .rich-text-editor-wrapper .ProseMirror ul,
        .rich-text-editor-wrapper .ProseMirror ol {
          padding-left: 1.5rem;
        }

        /* Link Styles */
        .rich-text-editor-wrapper .ProseMirror a {
          color: ${darkMode ? '#60a5fa' : '#2563eb'};
          text-decoration: underline;
          cursor: pointer;
        }

        /* Highlight Styles */
        .rich-text-editor-wrapper .ProseMirror mark {
          padding: 2px 4px;
          border-radius: 2px;
        }

        /* Prose Dark Mode */
        .rich-text-editor-wrapper .prose-invert h1,
        .rich-text-editor-wrapper .prose-invert h2,
        .rich-text-editor-wrapper .prose-invert h3,
        .rich-text-editor-wrapper .prose-invert h4,
        .rich-text-editor-wrapper .prose-invert h5,
        .rich-text-editor-wrapper .prose-invert h6 {
          color: #f3f4f6;
        }

        .rich-text-editor-wrapper .prose-invert strong {
          color: #f3f4f6;
        }

        .rich-text-editor-wrapper .prose-invert a {
          color: #60a5fa;
        }

        .rich-text-editor-wrapper .prose-invert code {
          color: #f3f4f6;
          background: #374151;
        }

        .rich-text-editor-wrapper .prose-invert blockquote {
          color: #d1d5db;
          border-left-color: #4b5563;
        }

        /* Remove all default prose margins and padding */
        .rich-text-editor-wrapper .ProseMirror p {
          margin: 0;
          padding: 0;
        }

        .rich-text-editor-wrapper .ProseMirror h1,
        .rich-text-editor-wrapper .ProseMirror h2,
        .rich-text-editor-wrapper .ProseMirror h3,
        .rich-text-editor-wrapper .ProseMirror h4,
        .rich-text-editor-wrapper .ProseMirror h5,
        .rich-text-editor-wrapper .ProseMirror h6 {
          margin: 0;
          padding: 0;
        }

        .rich-text-editor-wrapper .ProseMirror ul,
        .rich-text-editor-wrapper .ProseMirror ol {
          margin: 0;
          padding-left: 1.5rem;
        }

        .rich-text-editor-wrapper .ProseMirror blockquote {
          margin: 0;
          padding-left: 1rem;
        }
      `}</style>

      {/* Compact Toolbar - Sticky */}
      {!mathToolbarOpen && (
      <div
        className={`sticky top-0 z-[1300] flex flex-wrap items-center gap-1 p-2 border-b ${
          darkMode
            ? 'bg-gray-750 border-gray-700'
            : 'bg-white border-gray-200'
        }`}
      >
    
        {/* Headings Dropdown */}
        <div className="relative" ref={headingRef}>
          <DropdownButton
            onClick={() => {
              const wasOpen = showHeadingDropdown;
              closeAllDropdowns();
              setShowHeadingDropdown(!wasOpen);
            }}
            icon={faHeading}
            title="Heading"
            active={editor.isActive('heading')}
          />
          {showHeadingDropdown && (
            <DropdownMenu>
              <DropdownItem
                onClick={() => {
                  editor.chain().focus().setParagraph().run();
                  setShowHeadingDropdown(false);
                }}
                label="Normal"
                active={editor.isActive('paragraph') && !editor.isActive('table')}
              />
              <DropdownItem
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 1 }).run();
                  setShowHeadingDropdown(false);
                }}
                label="Heading 1"
                active={editor.isActive('heading', { level: 1 })}
              />
              <DropdownItem
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 2 }).run();
                  setShowHeadingDropdown(false);
                }}
                label="Heading 2"
                active={editor.isActive('heading', { level: 2 })}
              />
              <DropdownItem
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 3 }).run();
                  setShowHeadingDropdown(false);
                }}
                label="Heading 3"
                active={editor.isActive('heading', { level: 3 })}
              />
            </DropdownMenu>
          )}
        </div>

        {/* Format Dropdown */}
        <div className="relative" ref={formatRef}>
          <DropdownButton
            onClick={() => {
              const wasOpen = showFormatDropdown;
              closeAllDropdowns();
              setShowFormatDropdown(!wasOpen);
            }}
            icon={faFont}
            title="Format"
          />
          {showFormatDropdown && (
            <DropdownMenu>
              <DropdownItem
                onClick={() => {
                  editor.chain().focus().toggleBold().run();
                  setShowFormatDropdown(false);
                }}
                icon={faBold}
                label="Bold"
                active={editor.isActive('bold')}
              />
              <DropdownItem
                onClick={() => {
                  editor.chain().focus().toggleItalic().run();
                  setShowFormatDropdown(false);
                }}
                icon={faItalic}
                label="Italic"
                active={editor.isActive('italic')}
              />
              <DropdownItem
                onClick={() => {
                  editor.chain().focus().toggleUnderline().run();
                  setShowFormatDropdown(false);
                }}
                icon={faUnderline}
                label="Underline"
                active={editor.isActive('underline')}
              />
              <DropdownItem
                onClick={() => {
                  editor.chain().focus().toggleStrike().run();
                  setShowFormatDropdown(false);
                }}
                icon={faStrikethrough}
                label="Strikethrough"
                active={editor.isActive('strike')}
              />
              <DropdownItem
                onClick={() => {
                  editor.chain().focus().toggleCode().run();
                  setShowFormatDropdown(false);
                }}
                icon={faCode}
                label="Inline Code"
                active={editor.isActive('code')}
              />
            </DropdownMenu>
          )}
        </div>

        {/* Text Color Picker */}
        <div className="relative" ref={textColorRef}>
          <ToolbarButton
            onClick={() => {
              const wasOpen = showTextColorPicker;
              closeAllDropdowns();
              setShowTextColorPicker(!wasOpen);
            }}
            icon={faPalette}
            title="Text Color"
          />
          {showTextColorPicker && (
            <div className={`absolute top-full left-0 mt-1 z-[1200] rounded-lg shadow-2xl border ${
              darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            } p-3 min-w-[280px]`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Text Color
                </span>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    editor.chain().focus().unsetColor().run();
                    setShowTextColorPicker(false);
                  }}
                  className={`text-xs px-2 py-1 rounded ${
                    darkMode 
                      ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  title="Remove color"
                >
                  Reset
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {textColors.map((color) => (
                  <button
                    key={color.value}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      editor.chain().focus().setColor(color.value).run();
                      setShowTextColorPicker(false);
                    }}
                    className={`w-10 h-10 rounded-md border transition-all hover:scale-110 ${
                      darkMode ? 'border-gray-600 hover:border-gray-400' : 'border-gray-300 hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  >
                    <span className="sr-only">{color.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Highlight Color Picker */}
        <div className="relative" ref={highlightRef}>
          <ToolbarButton
            onClick={() => {
              const wasOpen = showHighlightPicker;
              closeAllDropdowns();
              setShowHighlightPicker(!wasOpen);
            }}
            active={editor.isActive('highlight')}
            icon={faHighlighter}
            title="Highlight"
          />
          {showHighlightPicker && (
            <div className={`absolute top-full left-0 mt-1 z-[1200] rounded-lg shadow-2xl border ${
              darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            } p-3 min-w-[280px]`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Highlight Color
                </span>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    editor.chain().focus().unsetHighlight().run();
                    setShowHighlightPicker(false);
                  }}
                  className={`text-xs px-2 py-1 rounded ${
                    darkMode 
                      ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  title="Remove highlight"
                >
                  Reset
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {highlightColors.map((color) => (
                  <button
                    key={color.value}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      editor.chain().focus().setHighlight({ color: color.value }).run();
                      setShowHighlightPicker(false);
                    }}
                    className={`w-12 h-10 rounded-md border transition-all hover:scale-110 flex items-center justify-center ${
                      darkMode ? 'border-gray-600 hover:border-gray-400' : 'border-gray-300 hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  >
                    <span className="text-xs font-medium text-gray-800">Aa</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Divider />

        {/* Lists Dropdown */}
        <div className="relative" ref={listRef}>
          <DropdownButton
            onClick={() => {
              const wasOpen = showListDropdown;
              closeAllDropdowns();
              setShowListDropdown(!wasOpen);
            }}
            icon={faList}
            title="Lists"
            active={editor.isActive('bulletList') || editor.isActive('orderedList')}
          />
          {showListDropdown && (
            <DropdownMenu>
              <DropdownItem
                onClick={() => {
                  editor.chain().focus().toggleBulletList().run();
                  setShowListDropdown(false);
                }}
                icon={faListUl}
                label="Bullet List"
                active={editor.isActive('bulletList')}
              />
              <DropdownItem
                onClick={() => {
                  editor.chain().focus().toggleOrderedList().run();
                  setShowListDropdown(false);
                }}
                icon={faListOl}
                label="Numbered List"
                active={editor.isActive('orderedList')}
              />
            </DropdownMenu>
          )}
        </div>

        {/* Align Dropdown */}
        <div className="relative" ref={alignRef}>
          <DropdownButton
            onClick={() => {
              console.log('🎯 Align dropdown clicked, current state:', showAlignDropdown);
              const wasOpen = showAlignDropdown;
              closeAllDropdowns();
              setShowAlignDropdown(!wasOpen);
              console.log('🎯 Align dropdown new state:', !wasOpen);
            }}
            icon={faAlignSlash}
            title="Align"
          />
          {showAlignDropdown && (
            <DropdownMenu>
              <DropdownItem
                onClick={() => {
                  editor.chain().focus().setTextAlign('left').run();
                  setShowAlignDropdown(false);
                }}
                icon={faAlignLeft}
                label="Align Left"
                active={editor.isActive({ textAlign: 'left' })}
              />
              <DropdownItem
                onClick={() => {
                  editor.chain().focus().setTextAlign('center').run();
                  setShowAlignDropdown(false);
                }}
                icon={faAlignCenter}
                label="Align Center"
                active={editor.isActive({ textAlign: 'center' })}
              />
              <DropdownItem
                onClick={() => {
                  editor.chain().focus().setTextAlign('right').run();
                  setShowAlignDropdown(false);
                }}
                icon={faAlignRight}
                label="Align Right"
                active={editor.isActive({ textAlign: 'right' })}
              />
              <DropdownItem
                onClick={() => {
                  editor.chain().focus().setTextAlign('justify').run();
                  setShowAlignDropdown(false);
                }}
                icon={faAlignJustify}
                label="Justify"
                active={editor.isActive({ textAlign: 'justify' })}
              />
            </DropdownMenu>
          )}
        </div>

        <Divider />

        {/* Code Block & Blockquote */}
        <ToolbarButton
          onClick={() => {
            const { state } = editor;
            const { selection } = state;
            const { $from, empty } = selection;
            
            // Check if we're already in a code block
            if (editor.isActive('codeBlock')) {
              // If in code block, toggle it off
              editor.chain().focus().toggleCodeBlock().run();
            } else if (!empty) {
              // There's a text selection - convert it to code block
              editor.chain().focus().setCodeBlock().run();
            } else {
              // No selection, just cursor
              // Check if current paragraph is empty
              const currentNode = $from.parent;
              const isEmpty = currentNode.textContent.length === 0;
              
              if (isEmpty) {
                // Empty line - just convert to code block
                editor.chain().focus().setCodeBlock().run();
              } else {
                // Has content - insert new line and then code block
                editor.chain()
                  .focus()
                  .command(({ tr, dispatch }) => {
                    if (dispatch) {
                      // Insert a new paragraph after current one
                      const pos = $from.after();
                      const node = state.schema.nodes.paragraph.create();
                      tr.insert(pos, node);
                      // Move cursor to the new paragraph
                      tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)));
                    }
                    return true;
                  })
                  .setCodeBlock()
                  .run();
              }
            }
          }}
          active={editor.isActive('codeBlock')}
          icon={faCode}
          title="Code Block"
        />
        <ToolbarButton
          onClick={() => {
            const { state } = editor;
            const { selection } = state;
            const { $from, empty } = selection;
            
            // Check if we're already in a blockquote
            if (editor.isActive('blockquote')) {
              // If in blockquote, toggle it off
              editor.chain().focus().toggleBlockquote().run();
            } else if (!empty) {
              // There's a text selection - convert it to blockquote
              editor.chain().focus().setBlockquote().run();
            } else {
              // No selection, just cursor
              // Check if current paragraph is empty
              const currentNode = $from.parent;
              const isEmpty = currentNode.textContent.length === 0;
              
              if (isEmpty) {
                // Empty line - just convert to blockquote
                editor.chain().focus().setBlockquote().run();
              } else {
                // Has content - insert new line and then blockquote
                editor.chain()
                  .focus()
                  .command(({ tr, dispatch }) => {
                    if (dispatch) {
                      // Insert a new paragraph after current one
                      const pos = $from.after();
                      const node = state.schema.nodes.paragraph.create();
                      tr.insert(pos, node);
                      // Move cursor to the new paragraph
                      tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)));
                    }
                    return true;
                  })
                  .setBlockquote()
                  .run();
              }
            }
          }}
          active={editor.isActive('blockquote')}
          icon={faQuoteLeft}
          title="Blockquote"
        />

        <Divider />

        {/* Table Dropdown */}
        <div className="relative" ref={tableRef}>
          <DropdownButton
            onClick={() => {
              const wasOpen = showTableDropdown;
              closeAllDropdowns();
              setTimeout(() => {
                setShowTableDropdown(!wasOpen);
              }, 0);
            }}
            icon={faTable}
            title="Insert Table"
          />
          {showTableDropdown && (
            <>
              <DropdownMenu className="min-w-[240px]">
                {/* Visual Table Grid Selector - PowerPoint Style */}
                <div className={`px-4 py-3 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="flex items-center space-x-2 mb-2">
                    <FontAwesomeIcon icon={faTable} className="w-4 h-4" />
                    <span className="text-xs font-semibold">
                      {tableGridHover.rows > 0 && tableGridHover.cols > 0
                        ? `Table ${tableGridHover.rows} × ${tableGridHover.cols}`
                        : 'Insert Table'}
                    </span>
                  </div>
                
                {/* Grid Selector */}
                <div className="inline-block p-2 rounded" 
                     onMouseLeave={() => setTableGridHover({ rows: 0, cols: 0 })}>
                  {Array.from({ length: 8 }).map((_, rowIndex) => (
                    <div key={rowIndex} className="flex">
                      {Array.from({ length: 10 }).map((_, colIndex) => {
                        const isHovered = rowIndex < tableGridHover.rows && colIndex < tableGridHover.cols;
                        return (
                          <div
                            key={colIndex}
                            className={`w-5 h-5 border cursor-pointer transition-all ${
                              isHovered
                                ? darkMode
                                  ? 'bg-blue-500 border-blue-400'
                                  : 'bg-blue-400 border-blue-500'
                                : darkMode
                                ? 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                                : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                            }`}
                            onMouseEnter={() => setTableGridHover({ rows: rowIndex + 1, cols: colIndex + 1 })}
                            onClick={() => insertTableFromGrid(rowIndex + 1, colIndex + 1)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                
                <p className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Hover to select size, click to insert
                </p>
              </div>
            </DropdownMenu>
            </>
          )}
        </div>

        <Divider />

        {/* Math Formula Toggle */}
        <ToolbarButton
          onClick={() => {
            if (!mathToolbarOpen) {
              // Save cursor position before opening math toolbar
              setSavedSelection(editor.state.selection);
              console.log('💾 Saved cursor position:', editor.state.selection);
            }
            setMathToolbarOpen(!mathToolbarOpen);
          }}
          icon={faSigma}
          title="Math Formula"
          active={mathToolbarOpen}
        />

        <Divider />

        {/* Clear Formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          icon={faEraser}
          title="Clear Formatting"
        />

        <Divider />

        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          icon={faUndo}
          title="Undo (Ctrl+Z)"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          icon={faRedo}
          title="Redo (Ctrl+Y)"
        />
      </div>
      )}

      {/* Math Formula Toolbar - Replaces main toolbar when active */}
      {mathToolbarOpen && (
        <MathFormulaToolbar
          onClose={() => setMathToolbarOpen(false)}
          onInsertFormula={(latex) => {
            console.log('📝 Inserting formula:', latex);
            
            // Try to restore the saved selection if available and valid
            if (savedSelection) {
              try {
                console.log('🔄 Attempting to restore saved position:', savedSelection);
                // Check if selection is still valid for current document
                if (savedSelection.from <= editor.state.doc.content.size && 
                    savedSelection.to <= editor.state.doc.content.size) {
                  const tr = editor.state.tr.setSelection(savedSelection);
                  editor.view.dispatch(tr);
                } else {
                  console.log('⚠️ Saved selection is out of bounds, using current position');
                }
              } catch (error) {
                console.log('⚠️ Could not restore selection, using current position:', error);
              }
            }
            
            // Insert MathInline node using proper Tiptap command
            editor.chain().focus().insertContent({
              type: 'mathInline',
              attrs: { latex: latex }
            }).insertContent(' ').run();
            
            console.log('✅ Formula inserted successfully');
            
            // Clear saved selection
            setSavedSelection(null);
          }}
          darkMode={darkMode}
        />
      )}

      {/* Beautiful Formula Edit Dialog */}
      <FormulaEditDialog
        isOpen={isFormulaDialogOpen}
        initialFormula={editingFormula}
        onSave={handleSaveFormula}
        onCancel={handleCancelFormula}
      />

      {/* Editor Content */}
      <div 
        className={`overflow-y-auto editor-scroll-container ${
          darkMode ? 'bg-gray-900' : 'bg-white'
        }`}
        style={{ 
          height: height !== 'auto' ? height : minHeight,  // ✅ Use height prop if provided
          minHeight: '100px',
          maxHeight: height !== 'auto' ? 'none' : '500px',  // ✅ Remove maxHeight if custom height provided
          resize: 'vertical',
          overflow: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        <style>{`
          .overflow-y-auto::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <div style={{ padding: '8px' }}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
};

export default RichTextEditor;