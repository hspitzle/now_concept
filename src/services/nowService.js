import { SpotifyClient } from '~/src/clients';
import _ from 'lodash';
import Promise from 'bluebird';

class NowService {
  constructor() {
    console.log('creating now service');
  }

  static create() {
    const service = new NowService();
    return SpotifyClient.create('Test Now', 0, 'minutes').then(client => {
      service.clients = [client];
      return service;
    });
  }

  expire() {
    console.log('expiring records');
    _.forEach(this.clients, el => {
      el.expire();
    });
  }
}

export default NowService;
