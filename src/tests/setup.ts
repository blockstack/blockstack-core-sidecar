import { loadDotEnv } from '../helpers';

export default (): void => {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
  }
  loadDotEnv();
};
