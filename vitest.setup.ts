import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

beforeAll(() => {
  // this is a good place to add 'polyfills' for the browser environment where jsdom doesn't include them
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  // Element.prototype.scrollTo = () => {};
});

afterEach(() => {
  cleanup();
});
