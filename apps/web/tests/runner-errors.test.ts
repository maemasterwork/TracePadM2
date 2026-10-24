import { describe, expect, it, vi } from 'vitest';
import { PyRunner } from '../src/runner/client';

function createWorker(): Worker {
	return {
		onmessage: null,
		onerror: null,
		postMessage: vi.fn(),
		terminate: vi.fn(),
	} as unknown as Worker;
}

describe('runner initialization errors', () => {
	it('rejects when the worker reports an initialization failure', async () => {
		const worker = createWorker();
		const runner = new PyRunner({ userKey: 'test', workerFactory: () => worker });

		const ready = runner.ensureReady();
		worker.onmessage?.({ data: { type: 'failed', message: 'Pyodide failed to load' } } as MessageEvent);

		await expect(ready).rejects.toThrow('Pyodide failed to load');
		expect(runner.getStatus()).toEqual({ state: 'failed', message: 'Pyodide failed to load' });
	});

	it('rejects when the worker emits an error', async () => {
		const worker = createWorker();
		const runner = new PyRunner({ userKey: 'test', workerFactory: () => worker });

		const ready = runner.ensureReady();
		worker.onerror?.({ message: 'worker crashed' } as ErrorEvent);

		await expect(ready).rejects.toThrow('worker crashed');
		expect(runner.getStatus()).toEqual({ state: 'failed', message: 'worker crashed' });
	});
});
