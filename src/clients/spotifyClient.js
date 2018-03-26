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
import fs from 'fs';

const SPOTIFY_CONFIG_FIELDS = ['name', 'ttl'];
const AUTH_PATH = config.get('userConfigsPath') + 'auth.json';

class SpotifyClient {
  constructor() {
    this.userId = config.get('spotifyUserId');
    this.ttlUnits = 'minutes'; //TODO: change to 'days'
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
    
    const redirectUri = 'https://example.com/callback';
    const clientConfigs = {
      redirectUri : redirectUri,
      clientId : config.get('spotifyClientId'),
      clientSecret : config.get('spotifyClientSecret'),
    };
    this.spotifyApi = new SpotifyWebApi(clientConfigs);
    
    const token = await this._getToken();
    this.spotifyApi.setAccessToken(token);
    return null;
  }

  async _getToken() {
    let auth = {};
    if (fs.existsSync(AUTH_PATH)) {
      console.log('...loading token');
      auth = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
    } else {
      console.log('...need to generate token');
      auth.expiration = moment().format();
    }
    const expiration = moment(auth.expiration).subtract(5, 'minutes');
    return moment().isAfter(expiration) ? this._generateToken() : auth.token;
  }

  async _generateToken() {
    // Create the authorization URL
    const scopes = ['playlist-read-private', 'playlist-modify-public', 'playlist-modify-private'];
    const state = 'CO';
    const authorizeURL = this.spotifyApi.createAuthorizeURL(scopes, state);

    console.log('\n1. copy-paste the following url into a browser and complete the spotify sign in');
    console.log('2. copy the url of the page it redirects you to and paste it here\n');
    console.log(authorizeURL);

    await opn(authorizeURL, {wait: false});

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
    const authGrant = await this.spotifyApi.authorizationCodeGrant(code);
    const token = authGrant.body['access_token'];
    const expiration = moment().add(authGrant.body['expires_in'], 'seconds');
    const auth = {
      token,
      expiration,
    };
    fs.writeFileSync(AUTH_PATH, JSON.stringify(auth, null, '  '));

    // console.log('The access token expires in ' + authGrant.body['expires_in']);
    // console.log('The access token is ' + token);
    return token;
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
    const nowPlaylist = await this._findOrCreatePlaylist(playlist.name);
    console.log('::spotify playlist', _.pick(nowPlaylist, ['id', 'name']));

    try {
      const tracks = await this._getPlaylistTracks(nowPlaylist);
      console.log(`${nowPlaylist.name} contains ${tracks.length} tracks`);

      const archiveMapping = this._determineExpirableTracks(playlist, tracks);
      console.log('::archiveMapping');
      console.log(archiveMapping);
      return Promise.each(
        Object.keys(archiveMapping),
        archivePlaylistName => this._moveTracksToArchive(nowPlaylist, archivePlaylistName, archiveMapping[archivePlaylistName])
      );
    } catch(err) {
      console.log('Expiration failed: ', err);
      throw err;
    }
    return null; //testing
  }

  async _getPlaylistTracks(playlist) {
    console.log('::spotifyClient::_getPlaylistTracks');
    const data = await this.spotifyApi.getPlaylistTracks(this.userId, playlist.id, { 'fields' : 'items' })
    return data.body.items;
  }

  _determineExpirableTracks(playlist, tracks) { //TODO: fix expiration
    const archiveMapping = {};
    tracks.forEach( track => {
      const dateAdded = moment(track.added_at);
      if (dateAdded.isBefore(moment().subtract(playlist.ttl, this.ttlUnits))) {
        const archivePlaylistName = this._getArchiveNameFromDate(dateAdded)
        if (!_.has(archiveMapping, archivePlaylistName)) {
          archiveMapping[archivePlaylistName] = [];
        }
        archiveMapping[archivePlaylistName].push(track.track);
      }
    });
    const expireCount = _.reduce(archiveMapping, (acc, val) => {
      acc + val.length;
    }, 0);
    console.log(`Expiring ${expireCount} tracks`);
    return archiveMapping;
  }

  async _moveTracksToArchive(nowPlaylist, archivePlaylistName, tracks) {
    console.log(`Moving ${tracks.length} tracks to playlist: ${archivePlaylistName}`);
    const archivePlaylist = await this._findOrCreatePlaylist(archivePlaylistName);
    return Promise.each(
      tracks, 
      track => this._moveTrack(track, nowPlaylist, archivePlaylist)
    );
  }

  async _moveTrack(track, srcPlaylist, destPlaylist) {
    await this._addTrackToPlaylist(track, destPlaylist);
    return this._removeTrackFromPlaylist(track, srcPlaylist);
  }

  async _addTrackToPlaylist(track, playlist) {
    try {
      return await this.spotifyApi.addTracksToPlaylist(this.userId, playlist.id, [track.uri]);
    } catch(err) {
      console.log(`Error adding ${track.name} to ${playlist.name}`, err);
      throw err;
    }      
  }

  async _removeTrackFromPlaylist(track, playlist) {
    try {
      return await this.spotifyApi.removeTracksFromPlaylist(this.userId, playlist.id, [track]);
    } catch(err) {
      console.log(`Error removing ${track.name} from ${playlist.name}`, err);
      throw err;
    }
  }

  async _findOrCreatePlaylist(playlistName) {
    try {
      const data = await this.spotifyApi.getUserPlaylists(this.userId);
      let resultPlaylist = {};
      data.body.items.forEach( playlist => {
        if (playlist.name === playlistName) {
          resultPlaylist = playlist;
        }
      });
      if (!_.has(resultPlaylist, 'id')) {
        console.log(`Playlist does not exist, creating playlist ${playlistName}`);
        resultPlaylist = this._createPlaylist(playlistName);
      }
      return resultPlaylist;
    } catch(err) {
      console.log('Something went wrong!', err);
    }
  }

  async _createPlaylist(playlistName) {
    try {
      const data = await this.spotifyApi.createPlaylist(this.userId, playlistName, { 'public' : false });
      console.log(`Created playlist ${playlistName}`);
      return data.body;
    } catch(err) {
      console.log('Something went wrong creating playlist!', err);
    }
  }

  _getArchiveNameFromDate(date) {
    const year = date.format('YYYY');
    const monthNum = date.format('MM');
    const monthAbbrv = date.format('MMM').toLowerCase();
    return `${year}-vol.${monthNum}-${monthAbbrv}`; //TODO: make pattern configurable
  }
}
// spotify:user:22m7auzrhql2yqdjgnb6filpy:playlist:32RYvB0tTU6jCuGw4YS6nW
export default SpotifyClient;
