import { SpotifyClient } from '~/src/clients';
import _ from 'lodash';
import Promise from 'bluebird';

class NowService {
  constructor() {
    console.log('creating now service');
    this.clients = [];
  }

  addClient(client) {
    this.clients.push(client);
  }

  expire() {
    console.log('expiring clients');
    return Promise.each(this.clients, client => {
      return client.expire();
    });
  }
}

export default NowService;
