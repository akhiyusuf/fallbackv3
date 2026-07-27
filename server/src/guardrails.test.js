import test from 'node:test';
import assert from 'node:assert/strict';
import { GUARDRAIL_FIXTURES, classifyGuardrail } from './guardrails.js';

test('the four canonical guardrail fixtures (docs/API.md §4)', () => {
  for (const fixture of GUARDRAIL_FIXTURES) {
    const result = classifyGuardrail(fixture.input);
    assert.equal(result.category, fixture.expectCategory, fixture.input);
    assert.equal(result.hasLiteralLoggingRequest, fixture.expectLiteral, fixture.input);
  }
});

test('flags self-harm', () => {
  assert.equal(classifyGuardrail('I want to kill myself').category, 'self-harm');
});

test('does not flag a neutral request', () => {
  assert.equal(classifyGuardrail('Add a morning run every day at 7am').category, null);
});
