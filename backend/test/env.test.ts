import { afterEach, describe, expect, it } from 'vitest';
import { needOrigin } from '../src/env';

const set = (v: string | undefined) => { if (v === undefined) delete process.env.TEST_ORIGIN; else process.env.TEST_ORIGIN = v; };

describe('needOrigin', () => {
  afterEach(() => set(undefined));

  it.each([
    ['https://toknomics.backwoodstechsolutions.com', 'https://toknomics.backwoodstechsolutions.com'],
    ['https://api.toknomics.backwoodstechsolutions.com/', 'https://api.toknomics.backwoodstechsolutions.com'],
    ['http://localhost:5173', 'http://localhost:5173'],
  ])('accepts %s', (raw, want) => { set(raw); expect(needOrigin('TEST_ORIGIN')).toBe(want); });

  it.each([
    'https://toknomics.backwoodstechsolutions.com/dashboard',
    'https://toknomics.backwoodstechsolutions.com/api',
    'https://x.test/?a=1',
    'https://x.test/#frag',
    'toknomics.backwoodstechsolutions.com',
    'ftp://x.test',
  ])('rejects %s', raw => { set(raw); expect(() => needOrigin('TEST_ORIGIN')).toThrow(/TEST_ORIGIN/); });

  it('rejects a missing value', () => { expect(() => needOrigin('TEST_ORIGIN')).toThrow(/Missing env/); });
});
