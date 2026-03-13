/**
 * schema.js — .graph file format definition for the Lokus mathematical graphing system.
 *
 * A .graph file is a JSON document that stores a mathematical graph (Desmos-style)
 * including expressions, variables/sliders, viewport state, animations, and annotations.
 *
 * Schema version: 1
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Current schema version. Increment when making breaking format changes. */
export const SCHEMA_VERSION = 1;

/**
 * All valid expression type strings.
 * - explicit:    y = f(x)
 * - implicit:    f(x, y) = 0
 * - parametric:  (x(t), y(t))
 * - polar:       r = f(θ)
 * - point:       a single (x, y) coordinate
 * - inequality:  y > f(x), y ≤ f(x), etc.
 * - surface3d:   z = f(x, y) surface in 3-D
 * - curve3d:     parametric curve in 3-D space
 */
export const EXPRESSION_TYPES = [
  'explicit',
  'implicit',
  'parametric',
  'polar',
  'point',
  'inequality',
  'surface3d',
  'curve3d',
];

/**
 * Preset color palette for new expressions (Desmos-inspired).
 * Colors cycle in order when expressions are added without an explicit color.
 */
export const DEFAULT_COLORS = [
  '#c0392b', // red
  '#2980b9', // blue
  '#27ae60', // green
  '#8e44ad', // purple
  '#e67e22', // orange
  '#16a085', // teal
  '#d35400', // dark orange
  '#2c3e50', // dark navy
  '#c0392b', // (cycles back — intentional, list provides 8 distinct hues)
  '#7f8c8d', // grey
];

// ---------------------------------------------------------------------------
// Default object factories
// ---------------------------------------------------------------------------

/**
 * Returns a new empty .graph object with all defaults set.
 *
 * @param {string} [title='Untitled Graph'] - Human-readable title for the graph.
 * @returns {object} A complete graph data object ready to be serialized.
 */
export function createDefaultGraph(title = 'Untitled Graph') {
  const now = new Date().toISOString();

  return {
    version: SCHEMA_VERSION,
    metadata: {
      title,
      created: now,
      modified: now,
    },
    viewport: {
      xMin: -10,
      xMax: 10,
      yMin: -10,
      yMax: 10,
      zMin: -10,
      zMax: 10,
    },
    settings: {
      showGrid: true,
      showAxes: true,
      showLabels: true,
      degreeMode: false,
      polarMode: false,
      backgroundColor: '#ffffff',
      gridColor: '#e0e0e0',
      axisColor: '#333333',
    },
    variables: [],
    expressions: [],
    animations: [],
    annotations: [],
  };
}

/**
 * Creates a new expression object with a unique ID.
 *
 * @param {string} type    - One of EXPRESSION_TYPES.
 * @param {string} latex   - LaTeX string for the expression (e.g. 'y = \\sin(x)').
 * @param {string} [color] - Hex color. Defaults to the first preset color.
 * @returns {object} A fully-populated expression object.
 */
export function createExpression(type, latex, color = DEFAULT_COLORS[0]) {
  return {
    id: `e_${crypto.randomUUID()}`,
    type,
    latex,
    color,
    lineWidth: 2,
    lineStyle: 'solid',
    visible: true,
    domain: null,
  };
}

/**
 * Creates a new slider/variable object with a unique ID.
 *
 * @param {string} name          - Variable name (e.g. 'a').
 * @param {number} [value=1]     - Initial value.
 * @param {number} [min=-10]     - Minimum slider value.
 * @param {number} [max=10]      - Maximum slider value.
 * @param {number} [step=0.1]    - Step size for the slider.
 * @returns {object} A fully-populated variable object.
 */
export function createVariable(name, value = 1, min = -10, max = 10, step = 0.1) {
  return {
    id: `v_${crypto.randomUUID()}`,
    name,
    value,
    min,
    max,
    step,
  };
}

/**
 * Creates a new animation object with a unique ID.
 *
 * @param {string} targetVariableId  - The `id` of the variable to animate.
 * @param {'oscillate'|'loop'|'once'} [mode='oscillate'] - Playback mode.
 * @param {number} [speed=1.0]        - Playback speed multiplier.
 * @returns {object} A fully-populated animation object.
 */
export function createAnimation(targetVariableId, mode = 'oscillate', speed = 1.0) {
  return {
    id: `a_${crypto.randomUUID()}`,
    targetVariable: targetVariableId,
    mode,
    speed,
    playing: false,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_LINE_STYLES = new Set(['solid', 'dashed', 'dotted']);
const VALID_ANIMATION_MODES = new Set(['oscillate', 'loop', 'once']);
const VALID_ANNOTATION_TYPES = new Set(['label', 'arrow']);
const VALID_EXPRESSION_TYPES = new Set(EXPRESSION_TYPES);

/**
 * Validates a parsed .graph JSON object against the v1 schema.
 *
 * @param {unknown} data - The parsed JSON value to validate.
 * @returns {{ valid: boolean, errors: string[] }} Validation result.
 */
export function validateGraph(data) {
  const errors = [];

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Root value must be a plain object.'] };
  }

  // --- version ---
  if (typeof data.version !== 'number') {
    errors.push('version must be a number.');
  }

  // --- metadata ---
  if (data.metadata !== null && typeof data.metadata === 'object') {
    if (typeof data.metadata.title !== 'string') {
      errors.push('metadata.title must be a string.');
    }
  } else {
    errors.push('metadata must be an object.');
  }

  // --- viewport ---
  if (data.viewport !== null && typeof data.viewport === 'object') {
    const vp = data.viewport;
    const numericFields = ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'];
    for (const field of numericFields) {
      if (typeof vp[field] !== 'number') {
        errors.push(`viewport.${field} must be a number.`);
      }
    }
    if (typeof vp.xMin === 'number' && typeof vp.xMax === 'number' && vp.xMin >= vp.xMax) {
      errors.push('viewport.xMin must be less than viewport.xMax.');
    }
    if (typeof vp.yMin === 'number' && typeof vp.yMax === 'number' && vp.yMin >= vp.yMax) {
      errors.push('viewport.yMin must be less than viewport.yMax.');
    }
  } else {
    errors.push('viewport must be an object.');
  }

  // --- expressions ---
  if (Array.isArray(data.expressions)) {
    data.expressions.forEach((expr, i) => {
      const prefix = `expressions[${i}]`;
      if (typeof expr.id !== 'string') {
        errors.push(`${prefix}.id must be a string.`);
      }
      if (!VALID_EXPRESSION_TYPES.has(expr.type)) {
        errors.push(
          `${prefix}.type "${expr.type}" is not valid. Must be one of: ${EXPRESSION_TYPES.join(', ')}.`
        );
      }
      if (typeof expr.latex !== 'string') {
        errors.push(`${prefix}.latex must be a string.`);
      }
      if (expr.lineStyle !== undefined && !VALID_LINE_STYLES.has(expr.lineStyle)) {
        errors.push(`${prefix}.lineStyle "${expr.lineStyle}" must be solid, dashed, or dotted.`);
      }
      if (expr.visible !== undefined && typeof expr.visible !== 'boolean') {
        errors.push(`${prefix}.visible must be a boolean.`);
      }
    });
  } else if (data.expressions !== undefined) {
    errors.push('expressions must be an array.');
  }

  // --- variables ---
  if (Array.isArray(data.variables)) {
    data.variables.forEach((variable, i) => {
      const prefix = `variables[${i}]`;
      if (typeof variable.id !== 'string') {
        errors.push(`${prefix}.id must be a string.`);
      }
      if (typeof variable.name !== 'string') {
        errors.push(`${prefix}.name must be a string.`);
      }
      if (typeof variable.min === 'number' && typeof variable.max === 'number') {
        if (variable.min >= variable.max) {
          errors.push(`${prefix}.min must be less than ${prefix}.max.`);
        }
      } else {
        if (variable.min !== undefined && typeof variable.min !== 'number') {
          errors.push(`${prefix}.min must be a number.`);
        }
        if (variable.max !== undefined && typeof variable.max !== 'number') {
          errors.push(`${prefix}.max must be a number.`);
        }
      }
    });
  } else if (data.variables !== undefined) {
    errors.push('variables must be an array.');
  }

  // --- animations ---
  if (Array.isArray(data.animations)) {
    data.animations.forEach((anim, i) => {
      const prefix = `animations[${i}]`;
      if (typeof anim.id !== 'string') {
        errors.push(`${prefix}.id must be a string.`);
      }
      if (typeof anim.targetVariable !== 'string') {
        errors.push(`${prefix}.targetVariable must be a string.`);
      }
      if (anim.mode !== undefined && !VALID_ANIMATION_MODES.has(anim.mode)) {
        errors.push(`${prefix}.mode "${anim.mode}" must be oscillate, loop, or once.`);
      }
      if (anim.speed !== undefined && typeof anim.speed !== 'number') {
        errors.push(`${prefix}.speed must be a number.`);
      }
    });
  } else if (data.animations !== undefined) {
    errors.push('animations must be an array.');
  }

  // --- annotations ---
  if (Array.isArray(data.annotations)) {
    data.annotations.forEach((ann, i) => {
      const prefix = `annotations[${i}]`;
      if (typeof ann.id !== 'string') {
        errors.push(`${prefix}.id must be a string.`);
      }
      if (!VALID_ANNOTATION_TYPES.has(ann.type)) {
        errors.push(`${prefix}.type "${ann.type}" must be label or arrow.`);
      }
    });
  } else if (data.annotations !== undefined) {
    errors.push('annotations must be an array.');
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

/**
 * Applies schema migrations to bring older .graph files up to the current version.
 * Currently a no-op (only v1 exists). Add version-specific branches here as the
 * schema evolves.
 *
 * @param {object} data - A parsed .graph object (any supported version).
 * @returns {object} The migrated graph object at SCHEMA_VERSION.
 */
export function migrateGraph(data) {
  // Guard: already current
  if (data?.version === SCHEMA_VERSION) {
    return data;
  }

  // Future migration stubs (uncomment and extend as new versions land):
  // if (data.version === 1) {
  //   data = migrateV1toV2(data);
  // }

  return data;
}
