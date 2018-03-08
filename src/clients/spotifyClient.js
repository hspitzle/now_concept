import SpotifyWebApi from 'spotify-web-api-node'; // https://www.npmjs.com/package/spotify-web-api-node
import moment from 'moment';
import _ from 'lodash';
import Promise from 'bluebird';
import requestPromise from 'request-promise';

const clientId = 'd1b416572ed14b339dabad82548cc4d1';
const clientSecret = 'ebe8b7fd4d3d430ebb191fddafa57c9f';

class SpotifyClient {
  constructor(nowPlaylistName, ttl, units) {
    this.init();
    this.nowPlaylistName = nowPlaylistName;
    this.ttl = ttl;
    this.windowUnits = units;
    this.userId = '22m7auzrhql2yqdjgnb6filpy';
  }

  init() {
  /**
   * Authorization code flow
   */
    console.log('::init');

    const scopes = ['playlist-read-private', 'playlist-modify-public', 'playlist-modify-private'];
    const redirectUri = 'https://example.com/callback';
    const state = 'CO';
    
    const spotifyApi = new SpotifyWebApi({
      redirectUri : redirectUri,
      clientId : clientId,
      clientSecret : clientSecret
    });
    
    // Create the authorization URL
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
    console.log(authorizeURL);
    
    // return requestPromise(authorizeURL).then( response => {
    //   console.log(response);
    // });

    const code = 'AQDneit9eailDw9DXVbHYcU6CMLgflPpGW4US0BbJLJ-zBagV7Md7CMspA0CKymr_JXE9t_kRuI_FLpgW7VgI7p_phMv1vjzyC7ZJYxSifbtxT0AHH-cK4Tos2srhibp55Bu6Kidt-03wwF9plzxtDc_mmzukftaZgBeqmRkNEWfh0CLHgnx3oZFenHBWkblw9Op5M_sjOHB83uRfe9BnKwavl2oNxrb7nW3XBmW2UZkgW0AKJH3_pqy8SAJloR6WU5HYUiNkcJtUyh7RQ6ll2aknX1wDMefBfY';

    // Retrieve an access token.
    // this.spotify = spotifyApi.authorizationCodeGrant(code).then( data => {
    //   console.log('The access token expires in ' + data.body['expires_in']);
    //   console.log('The access token is ' + data.body['access_token']);
  
    //   // Save the access token so that it's used in future calls
    //   spotifyApi.setAccessToken(data.body['access_token']);
    //   return spotifyApi;
    // });

    const token = 'BQD3t37fgyDQ8sCrDlFyP5LXowLmu78tdFtg4CS7PllqsxFncALhMh1RlZDqT-vragXkGlpZ-lKU-WBUD6HiimXP4ic9lkbB6HapHeow7EpwKiZx_SMFfh5rT5U8yS6gUxeh6jN0euNFTSWH0cneVrnvs-NxpRy1pSqLlIoifxyVLFTC58osano6qvVcwafxE5E1ixDpVgKAWexeH7OPCE0sMFtodkBl_cyp6c5il1LeU68ITAeYTRLUzzpYLTZKps1ZjPN0XMY';
    spotifyApi.setAccessToken(token);
    this.spotify = Promise.resolve(spotifyApi);
  }

  expire() {
    console.log('::expire');
    return this.spotify.then( spotifyApi => {
      return this._findOrCreatePlaylist(this.nowPlaylistName);
    }).then( nowPlaylist => {
      console.log(_.pick(nowPlaylist, ['id', 'name']));
      return this._getPlaylistTracks(nowPlaylist).then( tracks => {
        console.log(`${nowPlaylist.name} contains ${tracks.length} tracks`);

        const archiveMapping = this._determineExpirableTracks(tracks);
        return Promise.each(
          Object.keys(archiveMapping),
          archivePlaylistName => this._moveTracksToArchive(nowPlaylist, archivePlaylistName, archiveMapping[archivePlaylistName])
        );
      }).catch( err => {
        console.log('Expiration failed: ', err);
      });
    });
  }

  _getPlaylistTracks(playlist) {
    console.log('::_getPlaylistTracks');
    return this.spotify.then( spotifyApi => {
      return spotifyApi.getPlaylistTracks(this.userId, playlist.id, { 'fields' : 'items' })
        .then( data => data.body.items);
    });
  }

  _determineExpirableTracks(tracks) {
    const archiveMapping = {};
    let expireCount = 0;
    tracks.forEach( track => {
      const dateAdded = moment(track.added_at);
      if (dateAdded.isBefore(moment().subtract(this.window, this.windowUnits))) {
        const archivePlaylistName = this._getArchiveNameFromDate(dateAdded)
        if (!_.has(archiveMapping, archivePlaylistName)) {
          archiveMapping[archivePlaylistName] = [];
        }
        archiveMapping[archivePlaylistName].push(track.track);
        expireCount++;
      }
    });
    console.log(`Expiring ${expireCount} tracks`);
    return archiveMapping;
  }

  _moveTracksToArchive(nowPlaylist, playlistName, tracks) {
    return this.spotify.then( spotifyApi => {
      console.log(`Moving ${tracks.length} tracks to playlist: ${playlistName}`);

      if (playlistName === '2017-vol.08-aug') { //testing
        return Promise.resolve('next');
      }

      return this._findOrCreatePlaylist(playlistName).then( playlist => {
        return Promise.each(tracks, track => this._moveTrack(track, nowPlaylist, playlist));
      });
    });
  }

  _moveTrack(track, srcPlaylist, destPlaylist) {
    return this._addTrackToPlaylist(destPlaylist, track).then( () => {
      return this._removeTrackFromPlaylist(srcPlaylist, track);
    });
  }

  _addTrackToPlaylist(playlist, track) {
    return this.spotify.then( spotifyApi => {
      return spotifyApi.addTracksToPlaylist(this.userId, playlist.id, [track.uri]).catch( err => {
        console.log(`Error adding ${track.name} to ${playlist.name}`, err);
        return Promise.reject(err);
      });
    });
  }

  _removeTrackFromPlaylist(playlist, track) {
    return this.spotify.then( spotifyApi => {
      return spotifyApi.removeTracksFromPlaylist(this.userId, playlist.id, [track]).catch( err => {
        console.log(`Error removing ${track.name} from ${playlist.name}`, err);
        return Promise.reject(err);
      });
    });
  }

  _findOrCreatePlaylist(playlistName) {
    return this.spotify.then( spotifyApi => {
      return spotifyApi.getUserPlaylists(this.userId).then( data => {
        let resultPlaylist = {};
        data.body.items.forEach( playlist => {
          if (playlist.name === playlistName) {
            resultPlaylist = playlist;
          }
        });
        if (!_.has(resultPlaylist, 'id')) {
          console.log(`Playlist does not exist, creating playlist ${playlistName}`);
          resultPlaylist = spotifyApi.createPlaylist(this.userId, playlistName, { 'public' : false })
            .then( data => {
              console.log(`Created playlist ${playlistName}`);
              return data.body;
            }).catch( err => {
              console.log('Something went wrong creating playlist!', err);
            });
        }
        return resultPlaylist;
      }).catch( err => {
        console.log('Something went wrong!', err);
      });
    });
  }

  _getArchiveNameFromDate(date) {
    const year = date.format('YYYY');
    const monthNum = date.format('MM');
    const monthAbbrv = date.format('MMM').toLowerCase();
    return `${year}-vol.${monthNum}-${monthAbbrv}`;
  }
}
// spotify:user:22m7auzrhql2yqdjgnb6filpy:playlist:32RYvB0tTU6jCuGw4YS6nW
export default SpotifyClient;
