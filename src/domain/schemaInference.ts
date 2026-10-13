import { InferredType } from './types.js';

export function inferValueType(value: any): InferredType {
  if (value === null || value === undefined) {
    return { kind: 'null' };
  }

  const type = typeof value;
  if (type === 'boolean') {
    return { kind: 'boolean' };
  }

  if (type === 'number') {
    return { kind: 'number', isInteger: Number.isInteger(value) };
  }

  if (type === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return { kind: 'string', format: 'date-time' };
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return { kind: 'string', format: 'uuid' };
    }
    return { kind: 'string' };
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { kind: 'array', itemType: { kind: 'any' } };
    }
    let unifiedItemType: InferredType = inferValueType(value[0]);
    for (let i = 1; i < value.length; i++) {
      unifiedItemType = unifyTypes(unifiedItemType, inferValueType(value[i]));
    }
    return { kind: 'array', itemType: unifiedItemType };
  }

  if (type === 'object') {
    const properties: Record<string, { type: InferredType; optional: boolean }> = {};
    for (const [key, val] of Object.entries(value)) {
      properties[key] = {
        type: inferValueType(val),
        optional: false,
      };
    }
    return { kind: 'object', properties };
  }

  return { kind: 'any' };
}

export function unifyTypes(a: InferredType, b: InferredType): InferredType {
  if (a.kind === b.kind) {
    if (a.kind === 'object' && b.kind === 'object') {
      const mergedProps: Record<string, { type: InferredType; optional: boolean }> = {};
      const allKeys = new Set([...Object.keys(a.properties), ...Object.keys(b.properties)]);

      for (const key of allKeys) {
        const propA = a.properties[key];
        const propB = b.properties[key];

        if (propA && propB) {
          mergedProps[key] = {
            type: unifyTypes(propA.type, propB.type),
            optional: propA.optional || propB.optional,
          };
        } else if (propA) {
          mergedProps[key] = {
            type: propA.type,
            optional: true,
          };
        } else if (propB) {
          mergedProps[key] = {
            type: propB.type,
            optional: true,
          };
        }
      }
      return { kind: 'object', properties: mergedProps };
    }

    if (a.kind === 'array' && b.kind === 'array') {
      return {
        kind: 'array',
        itemType: unifyTypes(a.itemType, b.itemType),
      };
    }

    if (a.kind === 'number' && b.kind === 'number') {
      return {
        kind: 'number',
        isInteger: a.isInteger && b.isInteger,
      };
    }

    return a;
  }

  if (a.kind === 'any') return b;
  if (b.kind === 'any') return a;

  const existingTypes: InferredType[] = a.kind === 'union' ? a.types : [a];
  const incomingTypes: InferredType[] = b.kind === 'union' ? b.types : [b];

  const combined: InferredType[] = [...existingTypes];
  for (const inc of incomingTypes) {
    if (!combined.some((t) => t.kind === inc.kind)) {
      combined.push(inc);
    }
  }

  return { kind: 'union', types: combined };
}

export function typeToTypeScript(type: InferredType, indent = ''): string {
  switch (type.kind) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'any':
      return 'any';
    case 'array':
      return `${typeToTypeScript(type.itemType, indent)}[]`;
    case 'union':
      return type.types.map((t) => typeToTypeScript(t, indent)).join(' | ');
    case 'object': {
      const keys = Object.keys(type.properties);
      if (keys.length === 0) return 'Record<string, unknown>';
      const lines = keys.map((key) => {
        const prop = type.properties[key];
        const opt = prop.optional ? '?' : '';
        return `${indent}  ${key}${opt}: ${typeToTypeScript(prop.type, indent + '  ')};`;
      });
      return `{\n${lines.join('\n')}\n${indent}}`;
    }
  }
}
