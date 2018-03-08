import { NowService } from '~/src/services';

import express from 'express';
import schedule from 'node-schedule';

class App {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.nowService = new NowService();

    this.app.get('/auth', function(req, res) {
      console.log(req);
      console.log(res);
    });

    this.scheduleUpdates();
  }

  scheduleUpdates() {
    // schedule.scheduleJob('* * * * *', () => {
      this.nowService.expire();
    // });
  }

  start() {
    // console.log(`Listening on port: ${this.port}`);
    // this.app.listen(this.port);
  }
}

const app = new App();
app.start();

