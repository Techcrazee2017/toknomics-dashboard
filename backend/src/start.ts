// Single-instance production entry: the API server and the ingestion worker share one long-running process,
// so one host instance serves HTTP (and its health check) while holding the Euler sockets.
import './api/server';
import { main as runWorker } from './worker';

runWorker().catch(e => { console.error(e); process.exit(1); });
