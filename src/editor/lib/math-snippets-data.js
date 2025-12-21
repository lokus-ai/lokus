/**
 * Math Snippets Data
 *
 * Defines all available math snippets with tab-stop placeholders.
 * Placeholder syntax: ${n:default} where n is the tab order
 *
 * Usage: Type :shortcut: to expand (e.g., :mat2: for 2x2 matrix)
 */

export const mathSnippets = {
  // ============================================
  // MATRICES & VECTORS (Priority 1)
  // ============================================

  'mat2': {
    name: '2×2 Matrix',
    category: 'matrices',
    template: '$\\begin{pmatrix} ${1:a} & ${2:b} \\\\ ${3:c} & ${4:d} \\end{pmatrix}$',
    preview: '(a b; c d)',
  },
  'mat3': {
    name: '3×3 Matrix',
    category: 'matrices',
    template: '$\\begin{pmatrix} ${1:a} & ${2:b} & ${3:c} \\\\ ${4:d} & ${5:e} & ${6:f} \\\\ ${7:g} & ${8:h} & ${9:i} \\end{pmatrix}$',
    preview: '3×3 matrix',
  },
  'mat4': {
    name: '4×4 Matrix',
    category: 'matrices',
    template: '$\\begin{pmatrix} ${1:a} & ${2:b} & ${3:c} & ${4:d} \\\\ ${5:e} & ${6:f} & ${7:g} & ${8:h} \\\\ ${9:i} & ${10:j} & ${11:k} & ${12:l} \\\\ ${13:m} & ${14:n} & ${15:o} & ${16:p} \\end{pmatrix}$',
    preview: '4×4 matrix',
  },
  'vec2': {
    name: '2D Column Vector',
    category: 'matrices',
    template: '$\\begin{pmatrix} ${1:x} \\\\ ${2:y} \\end{pmatrix}$',
    preview: '(x; y)',
  },
  'vec3': {
    name: '3D Column Vector',
    category: 'matrices',
    template: '$\\begin{pmatrix} ${1:x} \\\\ ${2:y} \\\\ ${3:z} \\end{pmatrix}$',
    preview: '(x; y; z)',
  },
  'vec4': {
    name: '4D Column Vector',
    category: 'matrices',
    template: '$\\begin{pmatrix} ${1:x} \\\\ ${2:y} \\\\ ${3:z} \\\\ ${4:w} \\end{pmatrix}$',
    preview: '(x; y; z; w)',
  },
  'rvec2': {
    name: '2D Row Vector',
    category: 'matrices',
    template: '$\\begin{pmatrix} ${1:x} & ${2:y} \\end{pmatrix}$',
    preview: '(x y)',
  },
  'rvec3': {
    name: '3D Row Vector',
    category: 'matrices',
    template: '$\\begin{pmatrix} ${1:x} & ${2:y} & ${3:z} \\end{pmatrix}$',
    preview: '(x y z)',
  },
  'det2': {
    name: '2×2 Determinant',
    category: 'matrices',
    template: '$\\begin{vmatrix} ${1:a} & ${2:b} \\\\ ${3:c} & ${4:d} \\end{vmatrix}$',
    preview: '|a b; c d|',
  },
  'det3': {
    name: '3×3 Determinant',
    category: 'matrices',
    template: '$\\begin{vmatrix} ${1:a} & ${2:b} & ${3:c} \\\\ ${4:d} & ${5:e} & ${6:f} \\\\ ${7:g} & ${8:h} & ${9:i} \\end{vmatrix}$',
    preview: '3×3 determinant',
  },
  'bmat2': {
    name: '2×2 Bracketed Matrix',
    category: 'matrices',
    template: '$\\begin{bmatrix} ${1:a} & ${2:b} \\\\ ${3:c} & ${4:d} \\end{bmatrix}$',
    preview: '[a b; c d]',
  },
  'bmat3': {
    name: '3×3 Bracketed Matrix',
    category: 'matrices',
    template: '$\\begin{bmatrix} ${1:a} & ${2:b} & ${3:c} \\\\ ${4:d} & ${5:e} & ${6:f} \\\\ ${7:g} & ${8:h} & ${9:i} \\end{bmatrix}$',
    preview: '3×3 bracketed',
  },
  'augmat': {
    name: 'Augmented Matrix',
    category: 'matrices',
    template: '$\\left[\\begin{array}{cc|c} ${1:a} & ${2:b} & ${3:x} \\\\ ${4:c} & ${5:d} & ${6:y} \\end{array}\\right]$',
    preview: '[A|b]',
  },
  'imat2': {
    name: '2×2 Identity Matrix',
    category: 'matrices',
    template: '$\\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}$',
    preview: 'I₂',
  },
  'imat3': {
    name: '3×3 Identity Matrix',
    category: 'matrices',
    template: '$\\begin{pmatrix} 1 & 0 & 0 \\\\ 0 & 1 & 0 \\\\ 0 & 0 & 1 \\end{pmatrix}$',
    preview: 'I₃',
  },

  // ============================================
  // FRACTIONS & ROOTS (Priority 1)
  // ============================================

  'frac': {
    name: 'Fraction',
    category: 'fractions',
    template: '$\\frac{${1:num}}{${2:den}}$',
    preview: 'a/b',
  },
  'dfrac': {
    name: 'Display Fraction',
    category: 'fractions',
    template: '$\\dfrac{${1:num}}{${2:den}}$',
    preview: 'a/b (large)',
  },
  'tfrac': {
    name: 'Text Fraction',
    category: 'fractions',
    template: '$\\tfrac{${1:num}}{${2:den}}$',
    preview: 'a/b (small)',
  },
  'sfrac': {
    name: 'Square Root',
    category: 'fractions',
    template: '$\\sqrt{${1:x}}$',
    preview: '√x',
  },
  'nroot': {
    name: 'Nth Root',
    category: 'fractions',
    template: '$\\sqrt[${1:n}]{${2:x}}$',
    preview: 'ⁿ√x',
  },
  'cfrac': {
    name: 'Continued Fraction',
    category: 'fractions',
    template: '$${1:a_0} + \\cfrac{1}{${2:a_1} + \\cfrac{1}{${3:a_2} + \\cfrac{1}{${4:...}}}}$',
    preview: 'a₀ + 1/(a₁ + ...)',
  },

  // ============================================
  // CALCULUS (Priority 1)
  // ============================================

  'intg': {
    name: 'Definite Integral',
    category: 'calculus',
    template: '$\\int_{${1:a}}^{${2:b}} ${3:f(x)} \\, d${4:x}$',
    preview: '∫ₐᵇ f(x)dx',
  },
  'iint': {
    name: 'Double Integral',
    category: 'calculus',
    template: '$\\iint_{${1:D}} ${2:f(x,y)} \\, dA$',
    preview: '∬ f dA',
  },
  'iiint': {
    name: 'Triple Integral',
    category: 'calculus',
    template: '$\\iiint_{${1:V}} ${2:f(x,y,z)} \\, dV$',
    preview: '∭ f dV',
  },
  'oint': {
    name: 'Contour Integral',
    category: 'calculus',
    template: '$\\oint_{${1:C}} ${2:f(z)} \\, d${3:z}$',
    preview: '∮ f dz',
  },
  'uint': {
    name: 'Indefinite Integral',
    category: 'calculus',
    template: '$\\int ${1:f(x)} \\, d${2:x}$',
    preview: '∫ f(x)dx',
  },
  'dv': {
    name: 'Derivative',
    category: 'calculus',
    template: '$\\frac{d${1:y}}{d${2:x}}$',
    preview: 'dy/dx',
  },
  'ddv': {
    name: 'Second Derivative',
    category: 'calculus',
    template: '$\\frac{d^2${1:y}}{d${2:x}^2}$',
    preview: 'd²y/dx²',
  },
  'pdv': {
    name: 'Partial Derivative',
    category: 'calculus',
    template: '$\\frac{\\partial ${1:f}}{\\partial ${2:x}}$',
    preview: '∂f/∂x',
  },
  'ppdv': {
    name: 'Second Partial Derivative',
    category: 'calculus',
    template: '$\\frac{\\partial^2 ${1:f}}{\\partial ${2:x}^2}$',
    preview: '∂²f/∂x²',
  },
  'mpdv': {
    name: 'Mixed Partial Derivative',
    category: 'calculus',
    template: '$\\frac{\\partial^2 ${1:f}}{\\partial ${2:x} \\partial ${3:y}}$',
    preview: '∂²f/∂x∂y',
  },
  'lim': {
    name: 'Limit',
    category: 'calculus',
    template: '$\\lim_{${1:x} \\to ${2:a}} ${3:f(x)}$',
    preview: 'lim x→a',
  },
  'limn': {
    name: 'Limit to Infinity',
    category: 'calculus',
    template: '$\\lim_{${1:n} \\to \\infty} ${2:a_n}$',
    preview: 'lim n→∞',
  },
  'liminf': {
    name: 'Limit Inferior',
    category: 'calculus',
    template: '$\\liminf_{${1:n} \\to \\infty} ${2:a_n}$',
    preview: 'lim inf',
  },
  'limsup': {
    name: 'Limit Superior',
    category: 'calculus',
    template: '$\\limsup_{${1:n} \\to \\infty} ${2:a_n}$',
    preview: 'lim sup',
  },
  'grad': {
    name: 'Gradient',
    category: 'calculus',
    template: '$\\nabla ${1:f}$',
    preview: '∇f',
  },
  'divg': {
    name: 'Divergence',
    category: 'calculus',
    template: '$\\nabla \\cdot ${1:\\mathbf{F}}$',
    preview: '∇·F',
  },
  'curl': {
    name: 'Curl',
    category: 'calculus',
    template: '$\\nabla \\times ${1:\\mathbf{F}}$',
    preview: '∇×F',
  },
  'lapl': {
    name: 'Laplacian',
    category: 'calculus',
    template: '$\\nabla^2 ${1:f}$',
    preview: '∇²f',
  },

  // ============================================
  // SUMS & PRODUCTS (Priority 1)
  // ============================================

  'ssum': {
    name: 'Summation',
    category: 'sums',
    template: '$\\sum_{${1:i}=${2:1}}^{${3:n}} ${4:a_i}$',
    preview: 'Σᵢ₌₁ⁿ aᵢ',
  },
  'ssuminf': {
    name: 'Infinite Sum',
    category: 'sums',
    template: '$\\sum_{${1:n}=${2:0}}^{\\infty} ${3:a_n}$',
    preview: 'Σₙ₌₀^∞ aₙ',
  },
  'prod': {
    name: 'Product',
    category: 'sums',
    template: '$\\prod_{${1:i}=${2:1}}^{${3:n}} ${4:a_i}$',
    preview: 'Πᵢ₌₁ⁿ aᵢ',
  },
  'bcup': {
    name: 'Big Union',
    category: 'sums',
    template: '$\\bigcup_{${1:i}=${2:1}}^{${3:n}} ${4:A_i}$',
    preview: '⋃ᵢ₌₁ⁿ Aᵢ',
  },
  'bcap': {
    name: 'Big Intersection',
    category: 'sums',
    template: '$\\bigcap_{${1:i}=${2:1}}^{${3:n}} ${4:A_i}$',
    preview: '⋂ᵢ₌₁ⁿ Aᵢ',
  },

  // ============================================
  // SUBSCRIPTS & SUPERSCRIPTS (Priority 2)
  // ============================================

  'sub': {
    name: 'Subscript',
    category: 'scripts',
    template: '$${1:x}_{${2:i}}$',
    preview: 'xᵢ',
  },
  'sup': {
    name: 'Superscript',
    category: 'scripts',
    template: '$${1:x}^{${2:n}}$',
    preview: 'xⁿ',
  },
  'subsup': {
    name: 'Sub & Superscript',
    category: 'scripts',
    template: '$${1:x}_{${2:i}}^{${3:n}}$',
    preview: 'xᵢⁿ',
  },

  // ============================================
  // LINEAR ALGEBRA (Priority 2)
  // ============================================

  'norm': {
    name: 'Norm',
    category: 'linalg',
    template: '$\\|${1:x}\\|$',
    preview: '‖x‖',
  },
  'pnorm': {
    name: 'P-Norm',
    category: 'linalg',
    template: '$\\|${1:x}\\|_{${2:p}}$',
    preview: '‖x‖ₚ',
  },
  'abs': {
    name: 'Absolute Value',
    category: 'linalg',
    template: '$|${1:x}|$',
    preview: '|x|',
  },
  'inner': {
    name: 'Inner Product',
    category: 'linalg',
    template: '$\\langle ${1:x}, ${2:y} \\rangle$',
    preview: '⟨x, y⟩',
  },
  'outer': {
    name: 'Outer Product',
    category: 'linalg',
    template: '$${1:x} \\otimes ${2:y}$',
    preview: 'x ⊗ y',
  },
  'cross': {
    name: 'Cross Product',
    category: 'linalg',
    template: '$${1:\\mathbf{a}} \\times ${2:\\mathbf{b}}$',
    preview: 'a × b',
  },
  'dot': {
    name: 'Dot Product',
    category: 'linalg',
    template: '$${1:\\mathbf{a}} \\cdot ${2:\\mathbf{b}}$',
    preview: 'a · b',
  },
  'trans': {
    name: 'Transpose',
    category: 'linalg',
    template: '$${1:A}^{\\top}$',
    preview: 'Aᵀ',
  },
  'inv': {
    name: 'Inverse',
    category: 'linalg',
    template: '$${1:A}^{-1}$',
    preview: 'A⁻¹',
  },
  'trace': {
    name: 'Trace',
    category: 'linalg',
    template: '$\\text{tr}(${1:A})$',
    preview: 'tr(A)',
  },
  'rank': {
    name: 'Rank',
    category: 'linalg',
    template: '$\\text{rank}(${1:A})$',
    preview: 'rank(A)',
  },
  'diag': {
    name: 'Diagonal Matrix',
    category: 'linalg',
    template: '$\\text{diag}(${1:a_1}, ${2:a_2}, ${3:...})$',
    preview: 'diag(a₁, a₂, ...)',
  },

  // ============================================
  // STATISTICS & PROBABILITY (Priority 2)
  // ============================================

  'expect': {
    name: 'Expectation',
    category: 'stats',
    template: '$\\mathbb{E}[${1:X}]$',
    preview: 'E[X]',
  },
  'vari': {
    name: 'Variance',
    category: 'stats',
    template: '$\\text{Var}(${1:X})$',
    preview: 'Var(X)',
  },
  'cov': {
    name: 'Covariance',
    category: 'stats',
    template: '$\\text{Cov}(${1:X}, ${2:Y})$',
    preview: 'Cov(X, Y)',
  },
  'corr': {
    name: 'Correlation',
    category: 'stats',
    template: '$\\text{Corr}(${1:X}, ${2:Y})$',
    preview: 'Corr(X, Y)',
  },
  'prob': {
    name: 'Probability',
    category: 'stats',
    template: '$P(${1:A})$',
    preview: 'P(A)',
  },
  'cprob': {
    name: 'Conditional Probability',
    category: 'stats',
    template: '$P(${1:A} \\mid ${2:B})$',
    preview: 'P(A|B)',
  },
  'normal': {
    name: 'Normal Distribution',
    category: 'stats',
    template: '$\\mathcal{N}(${1:\\mu}, ${2:\\sigma^2})$',
    preview: 'N(μ, σ²)',
  },
  'binom': {
    name: 'Binomial Coefficient',
    category: 'stats',
    template: '$\\binom{${1:n}}{${2:k}}$',
    preview: '(n choose k)',
  },
  'mean': {
    name: 'Mean (Overline)',
    category: 'stats',
    template: '$\\overline{${1:x}}$',
    preview: 'x̄',
  },
  'sdev': {
    name: 'Standard Deviation',
    category: 'stats',
    template: '$\\sigma_{${1:X}}$',
    preview: 'σₓ',
  },

  // ============================================
  // SET THEORY (Priority 2)
  // ============================================

  'sset': {
    name: 'Set Builder',
    category: 'sets',
    template: '$\\{${1:x} \\mid ${2:condition}\\}$',
    preview: '{x | condition}',
  },
  'reals': {
    name: 'Real Numbers',
    category: 'sets',
    template: '$\\mathbb{R}$',
    preview: 'ℝ',
  },
  'complex': {
    name: 'Complex Numbers',
    category: 'sets',
    template: '$\\mathbb{C}$',
    preview: 'ℂ',
  },
  'naturals': {
    name: 'Natural Numbers',
    category: 'sets',
    template: '$\\mathbb{N}$',
    preview: 'ℕ',
  },
  'integers': {
    name: 'Integers',
    category: 'sets',
    template: '$\\mathbb{Z}$',
    preview: 'ℤ',
  },
  'rationals': {
    name: 'Rational Numbers',
    category: 'sets',
    template: '$\\mathbb{Q}$',
    preview: 'ℚ',
  },
  'realn': {
    name: 'R^n',
    category: 'sets',
    template: '$\\mathbb{R}^{${1:n}}$',
    preview: 'ℝⁿ',
  },
  'powset': {
    name: 'Power Set',
    category: 'sets',
    template: '$\\mathcal{P}(${1:A})$',
    preview: 'P(A)',
  },

  // ============================================
  // PHYSICS (Priority 3)
  // ============================================

  'vhat': {
    name: 'Unit Vector',
    category: 'physics',
    template: '$\\hat{${1:v}}$',
    preview: 'v̂',
  },
  'varr': {
    name: 'Vector Arrow',
    category: 'physics',
    template: '$\\vec{${1:v}}$',
    preview: 'v⃗',
  },
  'bfv': {
    name: 'Bold Vector',
    category: 'physics',
    template: '$\\mathbf{${1:v}}$',
    preview: 'v (bold)',
  },
  'bra': {
    name: 'Bra (Quantum)',
    category: 'physics',
    template: '$\\langle ${1:\\psi} |$',
    preview: '⟨ψ|',
  },
  'ket': {
    name: 'Ket (Quantum)',
    category: 'physics',
    template: '$| ${1:\\psi} \\rangle$',
    preview: '|ψ⟩',
  },
  'braket': {
    name: 'Braket',
    category: 'physics',
    template: '$\\langle ${1:\\phi} | ${2:\\psi} \\rangle$',
    preview: '⟨φ|ψ⟩',
  },
  'comm': {
    name: 'Commutator',
    category: 'physics',
    template: '$[${1:A}, ${2:B}]$',
    preview: '[A, B]',
  },
  'acomm': {
    name: 'Anti-commutator',
    category: 'physics',
    template: '$\\{${1:A}, ${2:B}\\}$',
    preview: '{A, B}',
  },

  // ============================================
  // CHEMISTRY (Priority 3)
  // ============================================

  'isotope': {
    name: 'Isotope',
    category: 'chemistry',
    template: '$^{${1:A}}_{${2:Z}}${3:X}$',
    preview: 'ᴬ_Z X',
  },
  'rxn': {
    name: 'Reaction Arrow',
    category: 'chemistry',
    template: '$${1:reactants} \\rightarrow ${2:products}$',
    preview: 'A → B',
  },
  'eqrxn': {
    name: 'Equilibrium',
    category: 'chemistry',
    template: '$${1:A} \\rightleftharpoons ${2:B}$',
    preview: 'A ⇌ B',
  },

  // ============================================
  // COMMON EQUATIONS (Priority 3)
  // ============================================

  'quad': {
    name: 'Quadratic Formula',
    category: 'equations',
    template: '$x = \\frac{-${1:b} \\pm \\sqrt{${1:b}^2 - 4${2:a}${3:c}}}{2${2:a}}$',
    preview: 'Quadratic formula',
  },
  'taylor': {
    name: 'Taylor Series',
    category: 'equations',
    template: '$${1:f}(${2:x}) = \\sum_{n=0}^{\\infty} \\frac{${1:f}^{(n)}(${3:a})}{n!}(${2:x}-${3:a})^n$',
    preview: 'Taylor series',
  },
  'euler': {
    name: "Euler's Formula",
    category: 'equations',
    template: '$e^{i${1:\\theta}} = \\cos(${1:\\theta}) + i\\sin(${1:\\theta})$',
    preview: 'e^iθ = cos + isin',
  },
  'pytho': {
    name: 'Pythagorean Theorem',
    category: 'equations',
    template: '$${1:a}^2 + ${2:b}^2 = ${3:c}^2$',
    preview: 'a² + b² = c²',
  },

  // ============================================
  // LOGIC (Priority 3)
  // ============================================

  'fall': {
    name: 'For All',
    category: 'logic',
    template: '$\\forall ${1:x} \\in ${2:S}, ${3:P(x)}$',
    preview: '∀x ∈ S, P(x)',
  },
  'exst': {
    name: 'Exists',
    category: 'logic',
    template: '$\\exists ${1:x} \\in ${2:S}: ${3:P(x)}$',
    preview: '∃x ∈ S: P(x)',
  },
  'nexst': {
    name: 'Not Exists',
    category: 'logic',
    template: '$\\nexists ${1:x} \\in ${2:S}: ${3:P(x)}$',
    preview: '∄x ∈ S: P(x)',
  },

  // ============================================
  // MISCELLANEOUS
  // ============================================

  'cases': {
    name: 'Cases (Piecewise)',
    category: 'misc',
    template: '$${1:f(x)} = \\begin{cases} ${2:a} & \\text{if } ${3:condition1} \\\\ ${4:b} & \\text{if } ${5:condition2} \\end{cases}$',
    preview: 'f(x) = { a if...; b if... }',
  },
  'floor': {
    name: 'Floor',
    category: 'misc',
    template: '$\\lfloor ${1:x} \\rfloor$',
    preview: '⌊x⌋',
  },
  'ceil': {
    name: 'Ceiling',
    category: 'misc',
    template: '$\\lceil ${1:x} \\rceil$',
    preview: '⌈x⌉',
  },
  'cancel': {
    name: 'Cancel',
    category: 'misc',
    template: '$\\cancel{${1:x}}$',
    preview: 'x̶',
  },
  'boxed': {
    name: 'Boxed',
    category: 'misc',
    template: '$\\boxed{${1:result}}$',
    preview: '□result',
  },
  'undl': {
    name: 'Underline',
    category: 'misc',
    template: '$\\underline{${1:text}}$',
    preview: 'text̲',
  },
  'ovrl': {
    name: 'Overline',
    category: 'misc',
    template: '$\\overline{${1:text}}$',
    preview: 'text̅',
  },
  'underbr': {
    name: 'Underbrace',
    category: 'misc',
    template: '$\\underbrace{${1:expression}}_{${2:label}}$',
    preview: 'expr with label below',
  },
  'overbr': {
    name: 'Overbrace',
    category: 'misc',
    template: '$\\overbrace{${1:expression}}^{${2:label}}$',
    preview: 'expr with label above',
  },
  'txt': {
    name: 'Text in Math',
    category: 'misc',
    template: '$\\text{${1:text}}$',
    preview: 'text in math mode',
  },
};

// Category metadata for UI
export const mathSnippetCategories = {
  matrices: { name: 'Matrices & Vectors', icon: '▦' },
  fractions: { name: 'Fractions & Roots', icon: '⁄' },
  calculus: { name: 'Calculus', icon: '∫' },
  sums: { name: 'Sums & Products', icon: 'Σ' },
  scripts: { name: 'Sub/Superscripts', icon: 'xⁿ' },
  linalg: { name: 'Linear Algebra', icon: '‖‖' },
  stats: { name: 'Statistics', icon: 'μ' },
  sets: { name: 'Set Theory', icon: 'ℝ' },
  physics: { name: 'Physics', icon: 'ψ' },
  chemistry: { name: 'Chemistry', icon: '⚗' },
  equations: { name: 'Equations', icon: '=' },
  logic: { name: 'Logic', icon: '∀' },
  misc: { name: 'Miscellaneous', icon: '◇' },
};

// Helper to get all snippets as array for searching
export function getAllMathSnippets() {
  return Object.entries(mathSnippets).map(([key, snippet]) => ({
    shortcut: key,
    ...snippet,
  }));
}

// Helper to search snippets
export function searchMathSnippets(query) {
  const q = query.toLowerCase();
  return getAllMathSnippets().filter(s =>
    s.shortcut.toLowerCase().includes(q) ||
    s.name.toLowerCase().includes(q) ||
    s.category.toLowerCase().includes(q)
  );
}
