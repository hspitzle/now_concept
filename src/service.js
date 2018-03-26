import { NowService } from '~/src/services';
import SpotifyClient from './clients/spotifyClient';

async function run() {
  const service = new NowService();
  service.addClient(await SpotifyClient.create());
  return service.expire();
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.log(err);
    process.exit(1)
  });
