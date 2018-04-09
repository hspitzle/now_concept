import { SpotifyClient } from '~/src/clients';

describe('SpotifyClient', function() {
  let client;

  beforeEach(async function() {
    client = await SpotifyClient.create();
  });

  describe('#create', function() {
    it('sets correct ttl units', async function() {
      // TODO: remove if-check
      client.playlists.forEach(playlist => {
        if (playlist.name === 'Refinition Now') {
          expect(client.ttlUnits).to.equal('days');
        } else {
          expect(client.ttlUnits).to.equal('minutes');
        }
      });
    });

    it('adds playlists', function() {
      expect(client.playlists.length).to.not.equal(0);
    });
  });
});
