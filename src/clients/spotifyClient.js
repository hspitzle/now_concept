import config from '~/src/config';
import { PlaylistFactory } from '~/src/factories';
import { logger, Prompt } from '~/src/util';

import _ from 'lodash';
import fs from 'fs';
import inquirer from 'inquirer';
import moment from 'moment';
import opn from 'opn';
import Promise from 'bluebird';
import queryString from 'query-string';
import requestPromise from 'request-promise';
import SpotifyWebApi from 'spotify-web-api-node'; // https://www.npmjs.com/package/spotify-web-api-node

const SPOTIFY_CONFIG_FIELDS = ['name', 'ttl'];
const AUTH_PATH = config.get('userConfigsPath') + 'auth.json';

class SpotifyClient {
  constructor() {
    this.userId = config.get('spotifyUserId');
    this.ttlUnits = 'minutes'; //TODO: change to 'days'
    this.spotifyApi;
    this.log = logger.child({ class: this.constructor.name });
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

  /**
   * Authorization code flow
   */
  async init() {
    this.log.debug('::spotifyClient::init');
    
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
      this.log.debug('...loading token');
      auth = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
    } else {
      this.log.debug('...need to generate token');
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

    // Leave as console.log
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
    return token;
  }

  async expire() {
    await this.init();
    this.log.debug('::spotifyClient::expire');
    return Promise.each(
      this.playlists, 
      playlist => this._expirePlaylist(playlist)
    );
  }

  async _expirePlaylist(playlist) {
    this.log.info('Expiring', playlist);
    const nowPlaylist = await this._findOrCreatePlaylist(playlist.name);
    this.log.debug('::spotify playlist', _.pick(nowPlaylist, ['id', 'name']));

    try {
      const tracks = await this._getPlaylistTracks(nowPlaylist);
      this.log.info(`${nowPlaylist.name} contains ${tracks.length} tracks`);

      const archiveMapping = this._determineExpirableTracks(playlist, tracks);
      this.log.debug('::archiveMapping');
      this.log.debug(archiveMapping);
      return Promise.each(
        Object.keys(archiveMapping),
        archivePlaylistName => this._moveTracksToArchive(nowPlaylist, archivePlaylistName, archiveMapping[archivePlaylistName])
      );
    } catch(err) {
      this.log.error('Expiration failed: ', err);
      throw err;
    }
    return null; //testing
  }

  async _getPlaylistTracks(playlist) {
    this.log.debug('::spotifyClient::_getPlaylistTracks');
    const data = await this.spotifyApi.getPlaylistTracks(this.userId, playlist.id, { 'fields' : 'items' })
    return data.body.items;
  }

  _determineExpirableTracks(playlist, tracks) {
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
    this.log.info(`Expiring ${expireCount} tracks`);
    return archiveMapping;
  }

  async _moveTracksToArchive(nowPlaylist, archivePlaylistName, tracks) {
    this.log.info(`Moving ${tracks.length} tracks to playlist: ${archivePlaylistName}`);
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
      this.log.error(`Error adding ${track.name} to ${playlist.name}`, err);
      throw err;
    }      
  }

  async _removeTrackFromPlaylist(track, playlist) {
    try {
      return await this.spotifyApi.removeTracksFromPlaylist(this.userId, playlist.id, [track]);
    } catch(err) {
      this.log.error(`Error removing ${track.name} from ${playlist.name}`, err);
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
        this.log.info(`Playlist does not exist, creating playlist ${playlistName}`);
        resultPlaylist = this._createPlaylist(playlistName);
      }
      return resultPlaylist;
    } catch(err) {
      this.log.error('Something went wrong!', err);
    }
  }

  async _createPlaylist(playlistName) {
    try {
      const data = await this.spotifyApi.createPlaylist(this.userId, playlistName, { 'public' : false });
      this.log.info(`Created playlist ${playlistName}`);
      return data.body;
    } catch(err) {
      this.log.error('Something went wrong creating playlist!', err);
    }
  }

  _getArchiveNameFromDate(date) {
    const year = date.format('YYYY');
    const monthNum = date.format('MM');
    const monthAbbrv = date.format('MMM').toLowerCase();
    return `${year}-vol.${monthNum}-${monthAbbrv}`; //TODO: make pattern configurable
  }
}

export default SpotifyClient;
