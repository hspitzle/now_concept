import { SpotifyClient } from '~/src/clients';
import { logger } from '~/src/util';

import _ from 'lodash';
import Promise from 'bluebird';

class NowService {
  constructor() {
    this.log = logger.child({ class: this.constructor.name });
    this.log.debug('creating now service');
    this.clients = [];
  }

  addClient(client) {
    this.clients.push(client);
  }

  expire() {
    this.log.debug('expiring clients');
    return Promise.each(this.clients, client => {
      return client.expire();
    });
  }
}

export default NowService;
