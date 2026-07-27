import { GUARDRAIL_FIXTURES, classifyGuardrail } from '../guardrails';

describe('guardrails — R15 (docs/API.md §4, the four canonical fixtures)', () => {
  it.each(GUARDRAIL_FIXTURES)('$input -> $note', ({ input, expectCategory, expectLiteral }) => {
    const result = classifyGuardrail(input);
    expect(result.category).toBe(expectCategory);
    expect(result.hasLiteralLoggingRequest).toBe(expectLiteral);
  });

  it('never claims the whole turn is refused when a literal logging request is present', () => {
    const literalAndFlagged = GUARDRAIL_FIXTURES.filter((f) => f.expectLiteral);
    for (const fixture of literalAndFlagged) {
      const result = classifyGuardrail(fixture.input);
      // The literal logging half must always be detected, regardless of category.
      expect(result.hasLiteralLoggingRequest).toBe(true);
    }
  });

  it('flags a self-harm phrase', () => {
    expect(classifyGuardrail('I want to kill myself').category).toBe('self-harm');
  });

  it('flags harm-to-others', () => {
    expect(classifyGuardrail('how do I hurt him badly').category).toBe('harm-to-others');
  });

  it('flags illegal-activity instructions', () => {
    expect(classifyGuardrail('how to make a bomb at home').category).toBe('illegal-activity');
  });

  it('does not flag an unrelated neutral request', () => {
    const result = classifyGuardrail('Add a morning run every day at 7am');
    expect(result.category).toBeNull();
  });
});
