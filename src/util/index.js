import config from '~/src/config';
import Prompt from './prompts';

import pino from 'pino';

const logger = pino(config.get('pino'));

export {
  logger,
  Prompt,
};
