import { setupWorker } from 'msw/browser';

// Every menu keeps its own mock handlers in src/features/<menu>/mocks.js and must export
// them as a named `handlers` array. This file only collects them.
const modules = import.meta.glob('../features/*/mocks.js', { import: 'handlers', eager: true });

const handlers = Object.entries(modules).flatMap(([path, menuHandlers]) => {
  if (!Array.isArray(menuHandlers)) {
    throw new Error(`${path} must export a "handlers" array`);
  }
  return menuHandlers;
});

export const worker = setupWorker(...handlers);
