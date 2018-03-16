import SpotifyWebApi from 'spotify-web-api-node'; // https://www.npmjs.com/package/spotify-web-api-node
import moment from 'moment';
import _ from 'lodash';
import Promise from 'bluebird';
import requestPromise from 'request-promise';
import { Prompt } from '~/src/util';
import config from '~/src/config';
import { PlaylistFactory } from '~/src/factories';
import opn from 'opn';
import inquirer from 'inquirer';
import queryString from 'query-string';

const SPOTIFY_CONFIG_FIELDS = ['name', 'ttl'];

class SpotifyClient {
  constructor() {
    this.userId = config.get('spotifyUserId');
    this.ttlUnit = 'minutes'; //TODO: change to 'days'
  }

  static async create() {
    const client = new SpotifyClient();
    const playlists = await PlaylistFactory.getPlaylists(SPOTIFY_CONFIG_FIELDS);

    playlists.forEach( playlist => {
      console.log(playlist);
    });
    
    client.playlists = playlists;
    return client;
  }

  async init() {
  /**
   * Authorization code flow
   */
    console.log('::spotifyClient::init');

    const scopes = ['playlist-read-private', 'playlist-modify-public', 'playlist-modify-private'];
    const redirectUri = 'https://example.com/callback';
    const state = 'CO';
    
    const clientConfigs = {
      redirectUri : redirectUri,
      clientId : config.get('spotifyClientId'),
      clientSecret : config.get('spotifyClientSecret'),
    };
    const spotifyApi = new SpotifyWebApi(clientConfigs);
    
    // Create the authorization URL
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);

    console.log('\n1. copy-paste the following url into a browser and complete the spotify sign in');
    console.log('2. copy the url of the page it redirects you to and paste it here\n');
    console.log(authorizeURL);
    // await opn(authorizeURL);

    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'enter the url:',
      }
    ]);

    const qs = answer.url.split('?')[1];
    const code = queryString.parse(qs).code;
    
    // Retrieve an access token.
    this.spotify = spotifyApi.authorizationCodeGrant(code).then( data => {
      console.log('The access token expires in ' + data.body['expires_in']);
      console.log('The access token is ' + data.body['access_token']);
  
      // Save the access token so that it's used in future calls
      spotifyApi.setAccessToken(data.body['access_token']);
      return spotifyApi;
    });

    // const token = 'BQD3t37fgyDQ8sCrDlFyP5LXowLmu78tdFtg4CS7PllqsxFncALhMh1RlZDqT-vragXkGlpZ-lKU-WBUD6HiimXP4ic9lkbB6HapHeow7EpwKiZx_SMFfh5rT5U8yS6gUxeh6jN0euNFTSWH0cneVrnvs-NxpRy1pSqLlIoifxyVLFTC58osano6qvVcwafxE5E1ixDpVgKAWexeH7OPCE0sMFtodkBl_cyp6c5il1LeU68ITAeYTRLUzzpYLTZKps1ZjPN0XMY';
    // spotifyApi.setAccessToken(token);
    // this.spotify = Promise.resolve(spotifyApi);
    return Promise.resolve(spotifyApi);
  }

  async expire() {
    await this.init();
    console.log('::spotifyClient::expire');
    return Promise.each(
      this.playlists, 
      playlist => this._expirePlaylist(playlist)
    );
  }

  async _expirePlaylist(playlist) {
    console.log('expiring', playlist);
    const spotifyApi = await this.spotify;
    const nowPlaylist = await this._findOrCreatePlaylist(playlist.name);
    console.log('::spotify playlist', _.pick(nowPlaylist, ['id', 'name']));

    try {
      const tracks = await this._getPlaylistTracks(nowPlaylist);
      console.log(`${nowPlaylist.name} contains ${tracks.length} tracks`);

      // const archiveMapping = this._determineExpirableTracks(tracks);
      // return Promise.each(
      //   Object.keys(archiveMapping),
      //   archivePlaylistName => this._moveTracksToArchive(nowPlaylist, archivePlaylistName, archiveMapping[archivePlaylistName])
      // );
    } catch(err) {
      console.log('Expiration failed: ', err);
      throw err;
    }
    return null;
  }

  async _getPlaylistTracks(playlist) {
    console.log('::spotifyClient::_getPlaylistTracks');
    const spotifyApi = await this.spotify;
    const data = await spotifyApi.getPlaylistTracks(this.userId, playlist.id, { 'fields' : 'items' })
    return data.body.items;
  }

  _determineExpirableTracks(tracks) {
    const archiveMapping = {};
    let expireCount = 0;
    tracks.forEach( track => {
      const dateAdded = moment(track.added_at);
      if (dateAdded.isBefore(moment().subtract(this.window, this.ttlUnits))) {
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

  async _moveTracksToArchive(nowPlaylist, playlistName, tracks) {
    const spotifyApi = await this.spotify;
    console.log(`Moving ${tracks.length} tracks to playlist: ${playlistName}`);

    if (playlistName === '2017-vol.08-aug') { //testing
      return Promise.resolve('next');
    }

    return this._findOrCreatePlaylist(playlistName).then( playlist => {
      return Promise.each(tracks, track => this._moveTrack(track, nowPlaylist, playlist));
    });
  }

  async _moveTrack(track, srcPlaylist, destPlaylist) {
    await this._addTrackToPlaylist(destPlaylist, track);
    return this._removeTrackFromPlaylist(srcPlaylist, track);
  }

  async _addTrackToPlaylist(playlist, track) {
    const spotifyApi = await this.spotify;
    return spotifyApi.addTracksToPlaylist(this.userId, playlist.id, [track.uri]).catch( err => {
      console.log(`Error adding ${track.name} to ${playlist.name}`, err);
      return Promise.reject(err);
    });
  }

  async _removeTrackFromPlaylist(playlist, track) {
    const spotifyApi = await this.spotify;
    return spotifyApi.removeTracksFromPlaylist(this.userId, playlist.id, [track]).catch( err => {
      console.log(`Error removing ${track.name} from ${playlist.name}`, err);
      return Promise.reject(err);
    });
  }

  async _findOrCreatePlaylist(playlistName) {
    const spotifyApi = await this.spotify;
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
