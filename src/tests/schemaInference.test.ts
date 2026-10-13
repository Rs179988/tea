import test from 'node:test';
import assert from 'node:assert';
import { inferValueType, unifyTypes, typeToTypeScript } from '../domain/schemaInference.js';

test('inferValueType correctly detects primitives', () => {
  assert.deepStrictEqual(inferValueType('hello'), { kind: 'string' });
  assert.deepStrictEqual(inferValueType(42), { kind: 'number', isInteger: true });
  assert.deepStrictEqual(inferValueType(3.14), { kind: 'number', isInteger: false });
  assert.deepStrictEqual(inferValueType(true), { kind: 'boolean' });
  assert.deepStrictEqual(inferValueType(null), { kind: 'null' });
});

test('unifyTypes detects optional fields across multiple observations', () => {
  const obs1 = inferValueType({ id: 'u1', name: 'Alice', age: 30 });
  const obs2 = inferValueType({ id: 'u2', name: 'Bob' }); // age missing

  const unified = unifyTypes(obs1, obs2);
  assert.strictEqual(unified.kind, 'object');

  if (unified.kind === 'object') {
    assert.strictEqual(unified.properties.id.optional, false);
    assert.strictEqual(unified.properties.name.optional, false);
    assert.strictEqual(unified.properties.age.optional, true);
  }
});

test('typeToTypeScript generates clean interfaces', () => {
  const schema = inferValueType({ id: 1, title: 'Item' });
  const ts = typeToTypeScript(schema);
  assert.ok(ts.includes('id: number;'));
  assert.ok(ts.includes('title: string;'));
});
