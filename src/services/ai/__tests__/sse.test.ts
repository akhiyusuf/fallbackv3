import { parseEventStream } from '../sse';

function streamFrom(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]));
        i += 1;
      } else {
        controller.close();
      }
    },
  });
}

describe('parseEventStream', () => {
  it('parses one JSON object per data: line', async () => {
    const stream = streamFrom(['data: {"type":"text-delta","delta":"Hi"}\n\n', 'data: {"type":"done","summary":"ok"}\n\n']);
    const events: unknown[] = [];
    for await (const e of parseEventStream(stream)) events.push(e);
    expect(events).toEqual([
      { type: 'text-delta', delta: 'Hi' },
      { type: 'done', summary: 'ok' },
    ]);
  });

  it('handles a frame split across two chunks', async () => {
    const stream = streamFrom(['data: {"type":"text', '-delta","delta":"chunked"}\n\n']);
    const events: unknown[] = [];
    for await (const e of parseEventStream(stream)) events.push(e);
    expect(events).toEqual([{ type: 'text-delta', delta: 'chunked' }]);
  });

  it('drops a malformed frame without throwing', async () => {
    const stream = streamFrom(['data: {not json}\n\n', 'data: {"type":"done","summary":"ok"}\n\n']);
    const events: unknown[] = [];
    for await (const e of parseEventStream(stream)) events.push(e);
    expect(events).toEqual([{ type: 'done', summary: 'ok' }]);
  });

  it('returns nothing for a null body', async () => {
    const events: unknown[] = [];
    for await (const e of parseEventStream(null)) events.push(e);
    expect(events).toEqual([]);
  });
});
