// Zod 4 probes `Function('')` to decide whether it can compile object schemas, and decides when each schema
// is created. Our CSP has no 'unsafe-eval', so the probe is blocked and reported as a violation on every load.
// main.tsx imports this module first so the setting is in place before any schema exists.
import { config } from 'zod';

config({ jitless: true });
