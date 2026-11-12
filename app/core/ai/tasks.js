// The AI framework's tasks (app/core/AI.md): jobs in Träumerei's own terms, each with a versioned
// input and output schema, written as data (JSON Schema, plus one documented binary layout for
// vectors) so a provider in any language can read them. Nothing here names tokens, prompts or
// weights: a task says what Träumerei needs, never how an AI does it.
//
// Additions only: a new task, or a new version of one, is added; a version once listed is never
// changed or taken away.

// Readers' directions for a gap (KERNEL.md), repeated here so the schema is self-contained.
const DIRECTIONS = ['to world', 'from world', 'to maker'];

const id = { type: 'string', minLength: 1 };
const score = { type: 'number', minimum: 0, maximum: 1 };
const words = { type: 'string' };
// A mark as a task sees it: its id, its words as plain text, when it was made.
const item = { type: 'object', required: ['id', 'text'], properties: { id, text: { type: 'string' }, at: { type: 'number' } } };
const items = { type: 'array', items: item };
const most = { type: 'integer', minimum: 1 };
// A provider's own numbers about one result: stored on the suggestion and handed back with its verdict.
const features = { type: 'array', items: { type: 'number' } };

// Vectors: `dim` numbers per item, in item order, as one Float32Array of length n × dim
// (row-major, the platform's byte order in memory; little-endian whenever bytes travel).
export const VECTORS = Object.freeze({ type: 'object', required: ['dim', 'data'], properties: { dim: { type: 'integer', minimum: 1 }, data: { 'x-binary': 'float32' } } });

// Vectors a caller already has for the items (from embed), in item order: a provider may use them.
const withVectors = (input, output) => !input.vectors || input.vectors.data.length === input.items.length * input.vectors.dim || 'the vectors handed in must be dim numbers for each item';

export const TASKS = Object.freeze({
  embed: {
    version: 1, note: 'a vector for each mark, so that nearness means likeness',
    input: { type: 'object', required: ['items'], properties: { items } },
    output: { type: 'object', required: ['vectors'], properties: { vectors: VECTORS } },
    check: (input, output) => output.vectors.data.length === input.items.length * output.vectors.dim || 'there must be dim numbers for each item',
    // Several callers' embeds are run as one batch: their items joined, the vectors split back.
    batch: {
      join: (inputs) => ({ items: inputs.flatMap((i) => i.items) }),
      split: (output, inputs) => {
        const { dim, data } = output.vectors;
        let at = 0;
        return inputs.map((i) => { const n = i.items.length; const part = data.slice(at * dim, (at + n) * dim); at += n; return { vectors: { dim, data: part } }; });
      },
    },
  },
  search: {
    version: 1, note: 'the marks that answer a question, by meaning, best first',
    input: { type: 'object', required: ['query', 'items'], properties: { query: words, items, most, vectors: VECTORS } },
    accepts: withVectors,
    output: { type: 'object', required: ['hits'], properties: { hits: { type: 'array', items: { type: 'object', required: ['id', 'score'], properties: { id, score } } } } },
  },
  link: {
    version: 1, note: 'pairs of marks that speak of the same thing',
    input: { type: 'object', required: ['items'], properties: { items, most, vectors: VECTORS } },
    accepts: withVectors,
    output: { type: 'object', required: ['links'], properties: { links: { type: 'array', items: { type: 'object', required: ['from', 'to', 'score'],
      properties: { from: id, to: id, score, why: words, words: { type: 'array', items: words }, features } } } } },
  },
  group: {
    version: 1, note: 'handfuls of marks that belong together, each with a name',
    input: { type: 'object', required: ['items'], properties: { items, most, vectors: VECTORS } },
    accepts: withVectors,
    output: { type: 'object', required: ['groups'], properties: { groups: { type: 'array', items: { type: 'object', required: ['marks', 'score'],
      properties: { marks: { type: 'array', items: id, minItems: 2 }, score, title: words, why: words, words: { type: 'array', items: words }, features } } } } },
  },
  label: {
    version: 1, note: 'a short name for what some marks share',
    input: { type: 'object', required: ['items'], properties: { items } },
    output: { type: 'object', required: ['title', 'score'], properties: { title: { type: 'string', minLength: 1 }, score } },
  },
  judge: {
    version: 1, note: 'how likely the maker is to keep a suggestion',
    input: { type: 'object', required: ['act', 'items'], properties: { act: { type: 'string', enum: ['link', 'group', 'label', 'gap'] }, items, says: words, features } },
    output: { type: 'object', required: ['score'], properties: { score, why: words } },
  },
  suggest: {
    version: 1, note: 'finished suggestions of any kind, for the maker to keep or refuse',
    input: { type: 'object', required: ['items'], properties: { items, most } },
    output: { type: 'object', required: ['suggestions'], properties: { suggestions: { type: 'array', items: { type: 'object', required: ['act', 'marks', 'says', 'score'],
      properties: { act: { type: 'string', enum: ['link', 'group', 'label', 'gap'] }, marks: { type: 'array', items: id, minItems: 1 }, says: { type: 'string', minLength: 1 },
        title: words, direction: { type: 'string', enum: DIRECTIONS }, why: words, score, features } } } } },
  },
  gap: {
    version: 1, note: 'a gap a mark seems to have: what it was made to close, and which way',
    input: { type: 'object', required: ['items'], properties: { items, most } },
    output: { type: 'object', required: ['gaps'], properties: { gaps: { type: 'array', items: { type: 'object', required: ['mark', 'direction', 'says', 'score'],
      properties: { mark: id, direction: { type: 'string', enum: DIRECTIONS }, says: { type: 'string', minLength: 1 }, why: words, score, features } } } } },
  },
});

// Speed budgets the evaluation harness holds each task to, per call of `items` marks (ms per
// mark, plus a fixed start). A provider over budget fails its exam, whatever its score.
export const BUDGETS = Object.freeze({
  embed: { start: 50, perItem: 2 }, search: { start: 50, perItem: 1 }, link: { start: 50, perItem: 2 }, group: { start: 50, perItem: 2 },
  label: { start: 50, perItem: 1 }, judge: { start: 20, perItem: 1 }, suggest: { start: 100, perItem: 3 }, gap: { start: 50, perItem: 2 },
});

// Checks a value against a schema. Returns null when it fits, else where and why, in words.
// Covers what the task schemas use: type, required, properties, items, enum, minimum, maximum,
// minLength, minItems, and the binary layout ('x-binary': 'float32').
export function invalid(schema, value, at = 'it') {
  if (!schema) return null;
  if (schema['x-binary'] === 'float32') return value instanceof Float32Array ? null : `${at} must be a Float32Array`;
  const t = schema.type;
  if (t === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return `${at} must be an object`;
    for (const k of schema.required || []) if (value[k] === undefined) return `${at} needs ${k}`;
    for (const [k, s] of Object.entries(schema.properties || {})) if (value[k] !== undefined) { const bad = invalid(s, value[k], `${at}.${k}`); if (bad) return bad; }
    return null;
  }
  if (t === 'array') {
    if (!Array.isArray(value)) return `${at} must be a list`;
    if (schema.minItems && value.length < schema.minItems) return `${at} needs at least ${schema.minItems}`;
    for (let i = 0; i < value.length; i++) { const bad = invalid(schema.items, value[i], `${at}[${i}]`); if (bad) return bad; }
    return null;
  }
  if (t === 'string') {
    if (typeof value !== 'string') return `${at} must be words`;
    if (schema.minLength && value.length < schema.minLength) return `${at} must not be empty`;
  } else if (t === 'number' || t === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return `${at} must be a number`;
    if (t === 'integer' && !Number.isInteger(value)) return `${at} must be a whole number`;
    if (schema.minimum !== undefined && value < schema.minimum) return `${at} must be at least ${schema.minimum}`;
    if (schema.maximum !== undefined && value > schema.maximum) return `${at} must be at most ${schema.maximum}`;
  }
  if (schema.enum && !schema.enum.includes(value)) return `${at} must be one of ${schema.enum.join(', ')}`;
  return null;
}

// A task's schemas as plain data (what a provider in another language reads), without the
// functions the app uses to check and batch.
export function schemaOf(name) {
  const task = TASKS[name];
  if (!task) return null;
  return JSON.parse(JSON.stringify({ name, version: task.version, note: task.note, input: task.input, output: task.output }));
}
