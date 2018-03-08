import { SpotifyClient } from '~/src/clients';
import _ from 'lodash';

class NowService {
  constructor() {
    this.clients = [
      new SpotifyClient('Test Now', 0, 'minutes')
    ];
  }

  expire() {
    console.log('expiring records');
    _.forEach(this.clients, el => {
      el.client.expire();
    });
  }
}

export default NowService;
