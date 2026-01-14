import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/sharp-light-svg-icons';
import katex from 'katex';
import 'katex/dist/katex.min.css';


interface MathFormulaToolbarProps {
  onClose: () => void;
  onInsertFormula: (latex: string) => void;
  darkMode?: boolean;
}

interface FormulaButton {
  label: string;
  latex: string;
  display: string;
}

// Beautiful Formula Edit Dialog Component
export interface FormulaEditDialogProps {
  isOpen: boolean;
  initialFormula: string;
  onSave: (formula: string) => void;
  onCancel: () => void;
}
const FormulaEditDialog: React.FC<FormulaEditDialogProps> = ({
  isOpen,
  initialFormula,
  onSave,
  onCancel,
}) => {
  const [formula, setFormula] = useState(initialFormula);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setFormula(initialFormula);
  }, [initialFormula]);

  // Live preview rendering
  useEffect(() => {
    if (formula) {
      try {
        const html = katex.renderToString(formula, {
          throwOnError: false,
          displayMode: false,
        });
        setPreviewHtml(html);
        setPreviewError(false);
      } catch (error) {
        console.error('KaTeX render error:', error);
        setPreviewError(true);
        setPreviewHtml('');
      }
    } else {
      setPreviewHtml('');
      setPreviewError(false);
    }
  }, [formula]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(formula);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <>
      <style>{`
        .dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.3s ease;
          padding: 20px;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .dialog-container {
          background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
          border-radius: 14px;
          box-shadow: 0 14px 42px rgba(0, 0, 0, 0.3);
          max-width: 455px;
          width: 100%;
          max-height: 72vh;
          overflow: hidden;
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
        }
        .dialog-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 14px 17px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        .header-content {
          display: flex;
          align-items: center;
          gap: 10px;
          position: relative;
          z-index: 1;
        }
        .header-icon {
          width: 29px;
          height: 29px;
          background: rgba(255, 255, 255, 0.25);
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          font-weight: bold;
          color: white;
          backdrop-filter: blur(10px);
          animation: pulse 2s ease-in-out infinite;
        }
        .header-text h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: white;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        .header-text p {
          margin: 3px 0 0 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 400;
        }
        .close-icon-btn {
          width: 25px;
          height: 25px;
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          color: white;
          font-size: 17px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
          position: relative;
          z-index: 1;
        }
        .close-icon-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: rotate(90deg) scale(1.1);
        }
        .dialog-body {
          padding: 17px;
          overflow-y: auto;
          flex: 1;
        }
        .input-section {
          margin-bottom: 14px;
        }
        .input-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 7px;
        }
        .label-icon {
          font-size: 16px;
        }
        .formula-input {
          width: 100%;
          padding: 10px;
          border: 2px solid #e2e8f0;
          border-radius: 7px;
          font-size: 14px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          color: #2d3748;
          background: white;
          transition: all 0.3s ease;
          resize: vertical;
          min-height: 56px;
          max-height: 105px;
          box-sizing: border-box;
        }
        .formula-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
          background: #fafbfc;
        }
        .input-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 4px;
          font-size: 11px;
          color: #718096;
        }
        .keyboard-hint {
          font-size: 10px;
          color: #a0aec0;
          background: #f7fafc;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
        }
        .preview-section {
          margin-bottom: 14px;
        }
        .preview-box {
          background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
          border: 2px solid #e2e8f0;
          border-radius: 7px;
          padding: 14px;
          min-height: 49px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }
        .preview-box:hover {
          border-color: #667eea;
          background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%);
        }
        .preview-content {
          width: 100%;
          text-align: center;
          font-size: 18px;
        }
        .preview-empty {
          text-align: center;
          color: #a0aec0;
        }
        .empty-icon {
          font-size: 22px;
          display: block;
          margin-bottom: 6px;
          opacity: 0.5;
        }
        .preview-empty p {
          margin: 0;
          font-size: 12px;
          font-weight: 500;
        }
        .preview-error {
          color: #e53e3e;
          font-size: 12px;
          text-align: center;
        }
        .dialog-footer {
          background: #f7fafc;
          padding: 11px 17px;
          display: flex;
          gap: 7px;
          justify-content: flex-end;
          border-top: 1px solid #e2e8f0;
        }
        .btn {
          padding: 7px 14px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .btn-icon {
          font-size: 14px;
          font-weight: bold;
        }
        .btn-cancel {
          background: white;
          color: #718096;
          border: 2px solid #e2e8f0;
        }
        .btn-cancel:hover {
          background: #f7fafc;
          border-color: #cbd5e0;
          transform: translateY(-1px);
        }
        .btn-save {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: 2px solid transparent;
        }
        .btn-save:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 11px rgba(102, 126, 234, 0.4);
        }
        @media (max-width: 768px) {
          .dialog-container {
            max-width: 95%;
          }
        }
      `}</style>
      
      <div className="dialog-overlay" onClick={onCancel}>
        <div className="dialog-container" onClick={(e) => e.stopPropagation()}>
          <div className="dialog-header">
            <div className="header-content">
              <div className="header-icon">∑</div>
              <div className="header-text">
                <h2>Edit LaTeX Formula</h2>
                <p>Create beautiful mathematical expressions</p>
              </div>
            </div>
            <button className="close-icon-btn" onClick={onCancel}>×</button>
          </div>

          <div className="dialog-body">
            <div className="input-section">
              <label className="input-label">
                <span className="label-icon">📝</span>
                LaTeX Code
              </label>
              <textarea
                id="formula-input"
                className="formula-input"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter LaTeX formula... e.g., E = mc^2"
                autoFocus
              />
              <div className="input-footer">
                <span>{formula.length} characters</span>
                <span className="keyboard-hint">Ctrl+Enter to save</span>
              </div>
            </div>

            <div className="preview-section">
              <label className="input-label">
                <span className="label-icon">👁️</span>
                Live Preview
              </label>
              <div className="preview-box">
                {formula ? (
                  previewError ? (
                    <div className="preview-error">
                      Invalid LaTeX syntax
                    </div>
                  ) : previewHtml ? (
                    <div 
                      className="preview-content"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  ) : (
                    <div className="preview-empty">
                      <span className="empty-icon">✨</span>
                      <p>Rendering...</p>
                    </div>
                  )
                ) : (
                  <div className="preview-empty">
                    <span className="empty-icon">✨</span>
                    <p>Your formula preview will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="dialog-footer">
            <button className="btn btn-cancel" onClick={onCancel}>
              <span className="btn-icon">✕</span>
              Cancel
            </button>
            <button className="btn btn-save" onClick={handleSave}>
              <span className="btn-icon">✓</span>
              Save Formula
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const MathFormulaToolbar: React.FC<MathFormulaToolbarProps> = ({
  onClose,
  onInsertFormula,
  darkMode = false
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('basic');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState('');

  // Function to open edit dialog (you can expose this or trigger it differently)
  const handleEditFormula = (latex: string) => {
    setEditingFormula(latex);
    setIsEditDialogOpen(true);
  };

  const handleSaveFormula = (newFormula: string) => {
    onInsertFormula(newFormula);
    setIsEditDialogOpen(false);
  };

  const categories = [
    { id: 'basic', label: 'Basic' },
    { id: 'maths', label: 'Maths' },
    { id: 'formula', label: 'Formula' },
    { id: 'equations', label: 'Equations' },
    { id: 'alphabets', label: 'Alphabets' },
    { id: 'symbols', label: 'Symbols' },
    { id: 'functions', label: 'Functions' },
  ];

  const formulas: Record<string, FormulaButton[]> = {
    basic: [
      { label: 'Plus Minus', latex: '\\pm', display: '±' },
      { label: 'Minus Plus', latex: '\\mp', display: '∓' },
      { label: 'Times', latex: '\\times', display: '×' },
      { label: 'Divide', latex: '\\div', display: '÷' },
      { label: 'Equals', latex: '=', display: '=' },
      { label: 'Not Equal', latex: '\\neq', display: '≠' },
      { label: 'Approximately', latex: '\\approx', display: '≈' },
      { label: 'Equivalent', latex: '\\equiv', display: '≡' },
      { label: 'Proportional', latex: '\\propto', display: '∝' },
      { label: 'Less Than', latex: '<', display: '<' },
      { label: 'Greater Than', latex: '>', display: '>' },
      { label: 'Less Equal', latex: '\\leq', display: '≤' },
      { label: 'Greater Equal', latex: '\\geq', display: '≥' },
      { label: 'Much Less', latex: '\\ll', display: '≪' },
      { label: 'Much Greater', latex: '\\gg', display: '≫' },
      { label: 'Left Paren', latex: '(', display: '(' },
      { label: 'Right Paren', latex: ')', display: ')' },
      { label: 'Left Bracket', latex: '[', display: '[' },
      { label: 'Right Bracket', latex: ']', display: ']' },
      { label: 'Left Brace', latex: '\\lbrace', display: '{' },
      { label: 'Right Brace', latex: '\\rbrace', display: '}' },
      // Arrows - merged from Arrows tab
      { label: 'Right Arrow', latex: '\\rightarrow', display: '→' },
      { label: 'Left Arrow', latex: '\\leftarrow', display: '←' },
      { label: 'Up Arrow', latex: '\\uparrow', display: '↑' },
      { label: 'Down Arrow', latex: '\\downarrow', display: '↓' },
      { label: 'Double Right', latex: '\\Rightarrow', display: '⇒' },
      { label: 'Double Left', latex: '\\Leftarrow', display: '⇐' },
      { label: 'Double Left Right', latex: '\\Leftrightarrow', display: '⇔' },
      { label: 'Double Up', latex: '\\Uparrow', display: '⇑' },
      { label: 'Double Down', latex: '\\Downarrow', display: '⇓' },
      { label: 'Maps To', latex: '\\mapsto', display: '↦' },
      { label: 'Long Right', latex: '\\longrightarrow', display: '⟶' },
      { label: 'Long Left', latex: '\\longleftarrow', display: '⟵' },
      { label: 'Long Double Right', latex: '\\Longrightarrow', display: '⟹' },
      { label: 'Long Double Left', latex: '\\Longleftarrow', display: '⟸' },
      { label: 'Near Arrow', latex: '\\nearrow', display: '↗' },
      { label: 'Southeast', latex: '\\searrow', display: '↘' },
      { label: 'Southwest', latex: '\\swarrow', display: '↙' },
      { label: 'Northwest', latex: '\\nwarrow', display: '↖' },
      { label: 'Sum', latex: '\\sum', display: '∑' },
      { label: 'Product', latex: '\\prod', display: '∏' },
      { label: 'Coproduct', latex: '\\coprod', display: '∐' },
      { label: 'Integral', latex: '\\int', display: '∫' },
      { label: 'Double Integral', latex: '\\iint', display: '∬' },
      { label: 'Contour Integral', latex: '\\oint', display: '∮' },
      { label: 'Union', latex: '\\bigcup', display: '⋃' },
      { label: 'Intersection', latex: '\\bigcap', display: '⋂' },
      { label: 'Big Vee', latex: '\\bigvee', display: '⋁' },
      { label: 'Big Wedge', latex: '\\bigwedge', display: '⋀' },
      { label: 'Big Oplus', latex: '\\bigoplus', display: '⨁' },
      { label: 'Big Otimes', latex: '\\bigotimes', display: '⨂' },
      { label: 'Big Odot', latex: '\\bigodot', display: '⨀' },
      { label: 'Composition', latex: '\\circ', display: '∘' },
      { label: 'Oplus', latex: '\\oplus', display: '⊕' },
      { label: 'Otimes', latex: '\\otimes', display: '⊗' },
      { label: 'Odot', latex: '\\odot', display: '⊙' },
    ],
    maths: [
      { label: 'Fraction', latex: '\\frac{a}{b}', display: 'a/b' },
      { label: 'Mixed Number', latex: 'a\\frac{b}{c}', display: 'a b/c' },
      { label: 'Square Root', latex: '\\sqrt{x}', display: '√x' },
      { label: 'Cube Root', latex: '\\sqrt[3]{x}', display: '³√x' },
      { label: 'Nth Root', latex: '\\sqrt[n]{x}', display: 'ⁿ√x' },
      { label: 'Power', latex: 'x^{n}', display: 'xⁿ' },
      { label: 'Square', latex: 'x^{2}', display: 'x²' },
      { label: 'Cube', latex: 'x^{3}', display: 'x³' },
      { label: 'Subscript', latex: 'x_{n}', display: 'xₙ' },
      { label: 'Power & Sub', latex: 'x_{n}^{m}', display: 'xₙᵐ' },
      { label: 'Summation', latex: '\\sum_{i=1}^{n}', display: 'Σⁿᵢ₌₁' },
      { label: 'Product', latex: '\\prod_{i=1}^{n}', display: '∏ⁿᵢ₌₁' },
      { label: 'Integral', latex: '\\int_{a}^{b}', display: '∫ᵇₐ' },
      { label: 'Double Integral', latex: '\\iint_{D}', display: '∬ᴰ' },
      { label: 'Triple Integral', latex: '\\iiint_{V}', display: '∭ⱽ' },
      { label: 'Contour Integral', latex: '\\oint_{C}', display: '∮ᶜ' },
      { label: 'Union', latex: '\\cup', display: '∪' },
      { label: 'Intersection', latex: '\\cap', display: '∩' },
      { label: 'Big Union', latex: '\\bigcup_{i=1}^{n}', display: '⋃ⁿᵢ₌₁' },
      { label: 'Big Intersection', latex: '\\bigcap_{i=1}^{n}', display: '⋂ⁿᵢ₌₁' },
      { label: 'Limit', latex: '\\lim_{x \\to \\infty}', display: 'lim(x→∞)' },
      { label: 'Limit at a', latex: '\\lim_{x \\to a}', display: 'lim(x→a)' },
      { label: 'Logarithm', latex: '\\log_{a} b', display: 'logₐ b' },
      { label: 'Log base 10', latex: '\\log_{10} x', display: 'log₁₀ x' },
      { label: 'Natural Log', latex: '\\ln x', display: 'ln x' },
      { label: 'Absolute Value', latex: '|x|', display: '|x|' },
      { label: 'Norm', latex: '\\|x\\|', display: '∥x∥' },
      { label: 'Floor', latex: '\\lfloor x \\rfloor', display: '⌊x⌋' },
      { label: 'Ceiling', latex: '\\lceil x \\rceil', display: '⌈x⌉' },
      { label: 'Binomial', latex: '\\binom{n}{k}', display: '(ⁿₖ)' },
      { label: 'Factorial', latex: 'n!', display: 'n!' },
      { label: 'Overline', latex: '\\overline{ab}', display: 'a̅b̅' },
      { label: 'Underline', latex: '\\underline{ab}', display: 'a̲b̲' },
      { label: 'Hat', latex: '\\hat{x}', display: 'x̂' },
      { label: 'Bar', latex: '\\bar{x}', display: 'x̄' },
      { label: 'Tilde', latex: '\\tilde{x}', display: 'x̃' },
      { label: 'Vector', latex: '\\vec{x}', display: 'x⃗' },
      { label: 'Dot Product', latex: '\\vec{a} \\cdot \\vec{b}', display: 'a⃗ · b⃗' },
      { label: 'Cross Product', latex: '\\vec{a} \\times \\vec{b}', display: 'a⃗ × b⃗' },
      { label: 'Differential', latex: '\\frac{dx}{dy}', display: 'dx/dy' },
    ],
    formula: [
      // Algebra
      { label: 'Quadratic Formula', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}', display: 'x = (-b±√(b²-4ac))/2a' },
      { label: 'Binomial Coeff', latex: '\\binom{n}{k} = \\frac{n!}{k!(n-k)!}', display: '(ⁿₖ) = n!/[k!(n-k)!]' },
      { label: 'Binomial Theorem', latex: '(a+b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k}b^k', display: '(a+b)ⁿ = Σₖ₌₀ⁿ (ⁿₖ)aⁿ⁻ᵏbᵏ' },
      
      // Geometry
      { label: 'Pythagorean', latex: 'a^2 + b^2 = c^2', display: 'a²+b²=c²' },
      { label: 'Distance', latex: 'd = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}', display: 'd = √[(x₂-x₁)²+(y₂-y₁)²]' },
      { label: 'Circle Area', latex: 'A = \\pi r^2', display: 'A=πr²' },
      { label: 'Sphere Volume', latex: 'V = \\frac{4}{3}\\pi r^3', display: 'V=(4/3)πr³' },
      
      // Trigonometry
      { label: 'Sin²+Cos²', latex: '\\sin^2\\theta + \\cos^2\\theta = 1', display: 'sin²θ+cos²θ=1' },
      { label: 'Tan Identity', latex: '\\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}', display: 'tanθ=sinθ/cosθ' },
      { label: 'Double Angle', latex: '\\cos(2\\theta) = \\cos^2\\theta - \\sin^2\\theta', display: 'cos(2θ)=cos²θ-sin²θ' },
      { label: 'Law of Sines', latex: '\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C}', display: 'a/sinA = b/sinB = c/sinC' },
      { label: 'Law of Cosines', latex: 'c^2 = a^2 + b^2 - 2ab\\cos C', display: 'c²=a²+b²-2ab cosC' },
      
      // Calculus
      { label: 'Power Rule', latex: '\\frac{d}{dx}x^n = nx^{n-1}', display: 'd/dx(xⁿ) = nxⁿ⁻¹' },
      { label: 'Product Rule', latex: '(fg)\' = f\'g + fg\'', display: '(fg)′ = f′g + fg′' },
      { label: 'Quotient Rule', latex: '\\left(\\frac{f}{g}\\right)\' = \\frac{f\'g - fg\'}{g^2}', display: '(f/g)′ = (f′g-fg′)/g²' },
      { label: 'Chain Rule', latex: '\\frac{dy}{dx} = \\frac{dy}{du} \\cdot \\frac{du}{dx}', display: 'dy/dx = (dy/du)·(du/dx)' },
      { label: 'Taylor Series', latex: 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n', display: 'f(x) = Σₙ₌₀^∞ [f⁽ⁿ⁾(a)/n!](x-a)ⁿ' },
      { label: 'Integration Parts', latex: '\\int u\\,dv = uv - \\int v\\,du', display: '∫u dv = uv - ∫v du' },
      
      // Physics
      { label: 'Einstein', latex: 'E = mc^2', display: 'E=mc²' },
      { label: 'Newton 2nd Law', latex: 'F = ma', display: 'F=ma' },
      { label: 'Kinetic Energy', latex: 'KE = \\frac{1}{2}mv^2', display: 'KE=½mv²' },
      { label: 'Potential Energy', latex: 'PE = mgh', display: 'PE=mgh' },
      { label: 'Ohm\'s Law', latex: 'V = IR', display: 'V=IR' },
      { label: 'Ideal Gas Law', latex: 'PV = nRT', display: 'PV=nRT' },
      
      // Statistics
      { label: 'Mean', latex: '\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i', display: 'x̄ = (1/n)Σᵢ₌₁ⁿ xᵢ' },
      { label: 'Variance', latex: '\\sigma^2 = \\frac{1}{n}\\sum_{i=1}^{n}(x_i - \\bar{x})^2', display: 'σ² = (1/n)Σᵢ₌₁ⁿ(xᵢ-x̄)²' },
      { label: 'Std Deviation', latex: '\\sigma = \\sqrt{\\frac{1}{n}\\sum_{i=1}^{n}(x_i - \\bar{x})^2}', display: 'σ = √[(1/n)Σᵢ₌₁ⁿ(xᵢ-x̄)²]' },
      { label: 'Normal Dist', latex: 'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}}e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}', display: 'f(x) = (1/σ√(2π))e^[-(x-μ)²/(2σ²)]' },
      
      // Famous Identities
      { label: 'Euler\'s Identity', latex: 'e^{i\\pi} + 1 = 0', display: 'e^(iπ)+1=0' },
      { label: 'Golden Ratio', latex: '\\phi = \\frac{1 + \\sqrt{5}}{2}', display: 'φ=(1+√5)/2' },
    ],
    equations: [
      // Algebra Examples
      { label: 'Fermat\'s Last', latex: 'x^n + y^n = z^n', display: 'xⁿ+yⁿ=zⁿ' },
      { label: 'Polynomial', latex: 'p(x) = a_nx^n + a_{n-1}x^{n-1} + \\cdots + a_0', display: 'p(x) = aₙxⁿ + aₙ₋₁xⁿ⁻¹ + ... + a₀' },
      { label: 'Linear Equation', latex: '3x + y = 12', display: '3x+y=12' },
      
      // Calculus Notation
      { label: 'Evaluation Bar', latex: '\\left.\\frac{x^3}{3}\\right|_a^b', display: '[x³/3]ₐᵇ' },
      { label: 'Improper Integral', latex: '\\int_0^{\\infty} e^{-x} dx', display: '∫₀^∞ e⁻ˣdx' },
      { label: 'Double Int Region', latex: '\\iint_A f(x,y) dA', display: '∬ₐ f(x,y)dA' },
      { label: 'Derivative d/dx', latex: '\\frac{d}{dx}', display: 'd/dx' },
      { label: 'Partial ∂/∂x', latex: '\\frac{\\partial}{\\partial x}', display: '∂/∂x' },
      { label: 'Nabla', latex: '\\nabla', display: '∇' },
      
      // Linear Algebra Structures
      { label: 'Matrix 2×2', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', display: '[a b; c d]' },
      { label: 'Matrix 3×3', latex: '\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}', display: '[a b c; d e f; g h i]' },
      { label: 'Determinant 2×2', latex: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc', display: '|a b; c d| = ad-bc' },
      { label: 'Identity Matrix', latex: 'I = \\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}', display: 'I = [1 0; 0 1]' },
      
      // Function Forms
      { label: 'Rational Function', latex: 'f(x) = \\frac{P(x)}{Q(x)}', display: 'f(x) = P(x)/Q(x)' },
      { label: 'Series under Root', latex: '\\sqrt{1 + x + x^2 + \\cdots}', display: '√(1+x+x²+...)' },
      { label: 'Continued Fraction', latex: '\\cfrac{a}{b + \\cfrac{c}{d + \\cfrac{e}{f}}}', display: 'a/(b+c/(d+e/f))' },
      { label: 'Complex Fraction', latex: '\\frac{\\frac{1}{x} + \\frac{1}{y}}{y-z}', display: '(1/x+1/y)/(y-z)' },
      
      // Advanced Notation
      { label: 'Double Sum', latex: '\\sum_{\\substack{0 \\le i \\le m \\\\ 0 \\le j \\le n}} P(i,j)', display: 'Σ₀≤ᵢ≤ₘ,₀≤ⱼ≤ₙ P(i,j)' },
      { label: 'Arrow Label Top', latex: 'A \\xrightarrow{n+1} B', display: 'A →ⁿ⁺¹ B' },
      { label: 'Arrow Label Both', latex: 'A \\xrightarrow[bottom]{top} B', display: 'A →ᵗᵒᵖ_ᵦₒₜₜₒₘ B' },
      
      // Systems & Cases
      { label: 'Cases', latex: '\\begin{cases} a & x = 0 \\\\ b & x > 0 \\end{cases}', display: '{a if x=0; b if x>0}' },
      { label: 'System 2×2', latex: '\\begin{cases} ax + by = c \\\\ dx + ey = f \\end{cases}', display: '{ax+by=c; dx+ey=f}' },
    ],
    alphabets: [
      // Lowercase Greek
      { label: 'alpha', latex: '\\alpha', display: 'α' },
      { label: 'beta', latex: '\\beta', display: 'β' },
      { label: 'gamma', latex: '\\gamma', display: 'γ' },
      { label: 'delta', latex: '\\delta', display: 'δ' },
      { label: 'epsilon', latex: '\\epsilon', display: 'ε' },
      { label: 'varepsilon', latex: '\\varepsilon', display: 'ε' },
      { label: 'zeta', latex: '\\zeta', display: 'ζ' },
      { label: 'eta', latex: '\\eta', display: 'η' },
      { label: 'theta', latex: '\\theta', display: 'θ' },
      { label: 'vartheta', latex: '\\vartheta', display: 'ϑ' },
      { label: 'iota', latex: '\\iota', display: 'ι' },
      { label: 'kappa', latex: '\\kappa', display: 'κ' },
      { label: 'lambda', latex: '\\lambda', display: 'λ' },
      { label: 'mu', latex: '\\mu', display: 'μ' },
      { label: 'nu', latex: '\\nu', display: 'ν' },
      { label: 'xi', latex: '\\xi', display: 'ξ' },
      { label: 'pi', latex: '\\pi', display: 'π' },
      { label: 'varpi', latex: '\\varpi', display: 'ϖ' },
      { label: 'rho', latex: '\\rho', display: 'ρ' },
      { label: 'varrho', latex: '\\varrho', display: 'ϱ' },
      { label: 'sigma', latex: '\\sigma', display: 'σ' },
      { label: 'varsigma', latex: '\\varsigma', display: 'ς' },
      { label: 'tau', latex: '\\tau', display: 'τ' },
      { label: 'upsilon', latex: '\\upsilon', display: 'υ' },
      { label: 'phi', latex: '\\phi', display: 'φ' },
      { label: 'varphi', latex: '\\varphi', display: 'ϕ' },
      { label: 'chi', latex: '\\chi', display: 'χ' },
      { label: 'psi', latex: '\\psi', display: 'ψ' },
      { label: 'omega', latex: '\\omega', display: 'ω' },
      // Uppercase Greek
      { label: 'Gamma', latex: '\\Gamma', display: 'Γ' },
      { label: 'Delta', latex: '\\Delta', display: 'Δ' },
      { label: 'Theta', latex: '\\Theta', display: 'Θ' },
      { label: 'Lambda', latex: '\\Lambda', display: 'Λ' },
      { label: 'Xi', latex: '\\Xi', display: 'Ξ' },
      { label: 'Pi', latex: '\\Pi', display: 'Π' },
      { label: 'Sigma', latex: '\\Sigma', display: 'Σ' },
      { label: 'Upsilon', latex: '\\Upsilon', display: 'Υ' },
      { label: 'Phi', latex: '\\Phi', display: 'Φ' },
      { label: 'Psi', latex: '\\Psi', display: 'Ψ' },
      { label: 'Omega', latex: '\\Omega', display: 'Ω' },
    ],
    symbols: [
      // Infinity and Limits
      { label: 'Infinity', latex: '\\infty', display: '∞' },
      { label: 'Partial', latex: '\\partial', display: '∂' },
      { label: 'Nabla', latex: '\\nabla', display: '∇' },
      { label: 'Aleph', latex: '\\aleph', display: 'ℵ' },
      
      // Set Theory
      { label: 'Empty Set', latex: '\\emptyset', display: '∅' },
      { label: 'Element Of', latex: '\\in', display: '∈' },
      { label: 'Not Element', latex: '\\notin', display: '∉' },
      { label: 'Subset', latex: '\\subset', display: '⊂' },
      { label: 'Superset', latex: '\\supset', display: '⊃' },
      { label: 'Subset Equal', latex: '\\subseteq', display: '⊆' },
      { label: 'Superset Equal', latex: '\\supseteq', display: '⊇' },
      { label: 'Not Subset', latex: '\\not\\subset', display: '⊄' },
      { label: 'Set Minus', latex: '\\setminus', display: '∖' },
      
      // Logic
      { label: 'For All', latex: '\\forall', display: '∀' },
      { label: 'Exists', latex: '\\exists', display: '∃' },
      { label: 'Not Exists', latex: '\\nexists', display: '∄' },
      { label: 'And', latex: '\\land', display: '∧' },
      { label: 'Or', latex: '\\lor', display: '∨' },
      { label: 'Not', latex: '\\lnot', display: '¬' },
      { label: 'Implies', latex: '\\implies', display: '⟹' },
      { label: 'Iff', latex: '\\iff', display: '⟺' },
      { label: 'Therefore', latex: '\\therefore', display: '∴' },
      { label: 'Because', latex: '\\because', display: '∵' },
      
      // Geometry
      { label: 'Angle', latex: '\\angle', display: '∠' },
      { label: 'Measured Angle', latex: '\\measuredangle', display: '∡' },
      { label: 'Triangle', latex: '\\triangle', display: '△' },
      { label: 'Square', latex: '\\square', display: '□' },
      { label: 'Degree', latex: '^\\circ', display: '°' },
      { label: 'Perpendicular', latex: '\\perp', display: '⊥' },
      { label: 'Parallel', latex: '\\parallel', display: '∥' },
      { label: 'Not Parallel', latex: '\\nparallel', display: '∦' },
      { label: 'Congruent', latex: '\\cong', display: '≅' },
      { label: 'Similar', latex: '\\sim', display: '∼' },
      { label: 'Proportional', latex: '\\propto', display: '∝' },
      
      // Special Symbols
      { label: 'Prime', latex: '\'', display: '′' },
      { label: 'Double Prime', latex: '\'\'', display: '″' },
      { label: 'Asterisk', latex: '\\ast', display: '∗' },
      { label: 'Star', latex: '\\star', display: '⋆' },
      { label: 'Bullet', latex: '\\bullet', display: '•' },
      { label: 'Dots (low)', latex: '\\ldots', display: '…' },
      { label: 'Dots (center)', latex: '\\cdots', display: '⋯' },
      { label: 'Dots (vertical)', latex: '\\vdots', display: '⋮' },
      { label: 'Dots (diagonal)', latex: '\\ddots', display: '⋱' },
      
      // Relations
      { label: 'Approximately', latex: '\\approx', display: '≈' },
      { label: 'Equivalent', latex: '\\equiv', display: '≡' },
      { label: 'Not Equivalent', latex: '\\not\\equiv', display: '≢' },
      { label: 'Identical', latex: '\\equiv', display: '≡' },
      { label: 'Plus Minus', latex: '\\pm', display: '±' },
      { label: 'Minus Plus', latex: '\\mp', display: '∓' },
    ],
    functions: [

      // Inverse Trigonometric
      { label: 'sin⁻¹', latex: '\\sin^{-1}', display: 'sin⁻¹' },
      { label: 'cos⁻¹', latex: '\\cos^{-1}', display: 'cos⁻¹' },
      { label: 'tan⁻¹', latex: '\\tan^{-1}', display: 'tan⁻¹' },
      { label: 'log₂', latex: '\\log_2', display: 'log₂' },
      { label: 'log₁₀', latex: '\\log_{10}', display: 'log₁₀' },
      
      // Logarithm Identities
      { label: 'a^(log_a b) = b', latex: 'a^{\\log_a b} = b', display: 'a^(logₐ b) = b' },
      { label: 'log_a(a^x) = x', latex: '\\log_a(a^x) = x', display: 'logₐ(aˣ) = x' },
      { label: 'e^(ln x) = x', latex: 'e^{\\ln x} = x', display: 'e^(ln x) = x' },
      { label: 'ln(e^x) = x', latex: '\\ln(e^x) = x', display: 'ln(eˣ) = x' },
      // Logarithm Laws
      { label: 'Product Law', latex: '\\log_a(mn) = \\log_a m + \\log_a n', display: 'logₐ(mn) = logₐ m + logₐ n' },
      { label: 'Quotient Law', latex: '\\log_a\\left(\\frac{m}{n}\\right) = \\log_a m - \\log_a n', display: 'logₐ(m/n) = logₐ m - logₐ n' },
      { label: 'Power Law', latex: '\\log_a(m^n) = n \\log_a m', display: 'logₐ(mⁿ) = n logₐ m' },
      { label: 'Change of Base', latex: '\\log_a b = \\frac{\\log_c b}{\\log_c a}', display: 'logₐ b = (logc b)/(logc a)' },
      { label: 'Reciprocal', latex: '\\log_a b = \\frac{1}{\\log_b a}', display: 'logₐ b = 1/(logb a)' },
    ],
  };

  return (
    <div
      className={`flex flex-col border-b ${
        darkMode
          ? 'bg-gray-750 border-gray-700'
          : 'bg-white border-gray-200'
      }`}
    >
      {/* Category Tabs */}
      <div className="flex items-center border-b">
        {/* Category Tabs */}
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-r ${
              activeCategory === category.id
                ? darkMode
                  ? 'bg-gray-700 text-blue-400 border-gray-700'
                  : 'bg-blue-50 text-blue-600 border-gray-200'
                : darkMode
                ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300 border-gray-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-700 border-gray-200'
            }`}
          >
            {category.label}
          </button>
        ))}
        
        {/* Spacer to push close button to right */}
        <div className="flex-1"></div>

        {/* Close Button - Rightmost */}
        <button
          onClick={onClose}
          className={`px-3 py-2 border-l transition-colors ${
            darkMode
              ? 'text-gray-300 hover:bg-gray-700 border-gray-700'
              : 'text-gray-700 hover:bg-gray-100 border-gray-200'
          }`}
          title="Close Math Toolbar"
        >
          <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
        </button>
      </div>

      {/* Formula Buttons */}
      <div className="p-2 flex flex-wrap gap-1 max-h-[160px] overflow-y-auto">
        {formulas[activeCategory]?.map((formula, index) => {
          // Render LaTeX to HTML for button display
          let renderedHtml = formula.display;
          try {
            renderedHtml = katex.renderToString(formula.latex, {
              throwOnError: false,
              displayMode: false,
            });
          } catch (error) {
            // Fallback to display text if rendering fails
            renderedHtml = formula.display;
          }

          return (
            <button
              key={index}
              onClick={() => {
                console.log('Inserting formula:', formula.label, '→', formula.latex);
                onInsertFormula(formula.latex);
              }}
              onDoubleClick={() => {
                // Double-click to edit formula
                handleEditFormula(formula.latex);
              }}
              onContextMenu={(e) => {
                // Right-click to edit formula
                e.preventDefault();
                handleEditFormula(formula.latex);
              }}
              className={`px-3 py-2 rounded text-xs transition-colors ${
                darkMode
                  ? 'text-gray-300 hover:bg-gray-700 bg-gray-800'
                  : 'text-gray-700 hover:bg-gray-100 bg-gray-50'
              }`}
              title={`${formula.label} - Click to insert, Double-click or Right-click to edit`}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          );
        })}
      </div>

      {/* Beautiful Edit Dialog */}
      <FormulaEditDialog
        isOpen={isEditDialogOpen}
        initialFormula={editingFormula}
        onSave={handleSaveFormula}
        onCancel={() => setIsEditDialogOpen(false)}
      />
    </div>
  );
};

export default MathFormulaToolbar;
export { FormulaEditDialog };