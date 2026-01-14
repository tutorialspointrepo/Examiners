import { Node, mergeAttributes } from '@tiptap/core';
import katex from 'katex';

export const MathInline = Node.create({
  name: 'mathInline',

  group: 'inline',

  inline: true,

  atom: true,

  addOptions() {
    return {
      onEditFormula: null, // Callback to open custom dialog
    };
  },

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: element => element.getAttribute('data-latex'),
        renderHTML: attributes => {
          return {
            'data-latex': attributes.latex,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-latex]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-latex': node.attrs.latex,
        'class': 'math-inline-node',
      }),
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('span');
      dom.classList.add('math-inline-rendered');
      dom.setAttribute('data-latex', node.attrs.latex);
      dom.setAttribute('contenteditable', 'false');
      
      try {
        katex.render(node.attrs.latex, dom, {
          throwOnError: false,
          displayMode: false,
        });
      } catch (error) {
        console.error('KaTeX render error:', error);
        dom.textContent = node.attrs.latex;
      }

      // Make it clickable to edit - use custom dialog
      dom.addEventListener('click', () => {
        const onEditFormula = this.options.onEditFormula;
        
        if (onEditFormula && typeof onEditFormula === 'function') {
          // Use custom dialog
          onEditFormula(node.attrs.latex, (newLatex: string) => {
            if (newLatex !== null && newLatex !== node.attrs.latex) {
              const pos = getPos();
              if (typeof pos === 'number') {
                editor.commands.command(({ tr }) => {
                  tr.setNodeMarkup(pos, null, { latex: newLatex });
                  return true;
                });
              }
            }
          });
        } else {
          // Fallback to standard prompt if callback not provided
          const newLatex = window.prompt('Edit LaTeX formula:', node.attrs.latex);
          if (newLatex !== null && newLatex !== node.attrs.latex) {
            const pos = getPos();
            if (typeof pos === 'number') {
              editor.commands.command(({ tr }) => {
                tr.setNodeMarkup(pos, null, { latex: newLatex });
                return true;
              });
            }
          }
        }
      });

      dom.style.cursor = 'pointer';
      dom.title = `Click to edit: ${node.attrs.latex}`;

      return {
        dom,
      };
    };
  },
});

export default MathInline;