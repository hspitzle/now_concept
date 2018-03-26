import config from '~/src/config';
import pino from 'pino';

const logger = pino(config.get('pino'));

export {
  logger,
};
