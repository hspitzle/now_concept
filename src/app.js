import { NowService } from '~/src/services';

import express from 'express';
import schedule from 'node-schedule';
import Promise from 'bluebird';

class App {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();

    this.app.get('/auth', function(req, res) {
      console.log(req);
      console.log(res);
    });

    this.scheduleUpdates();
  }

  scheduleUpdates() {
    // schedule.scheduleJob('* * * * *', () => {
      // this.nowService.expire();
    // });
  }

  start() {
    // console.log(`Listening on port: ${this.port}`);
    // this.app.listen(this.port);
    return NowService.create();
  }
}

const app = new App();
app.start().then(() => process.exit(0));

