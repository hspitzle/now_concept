import config from '~/src/config';
import { Playlist } from '~/src/models';
import { logger } from '~/src/util';

import fs from 'fs';
import inquirer from 'inquirer';

const log = logger.child({ class: 'PlaylistFactory' });

class PlaylistFactory {
  static getPlaylists(userConfigFields) {
    return config.get('usingStoredConfigs') ?
      this._loadPlaylists() :
      this._promptForPlaylistInfo(userConfigFields);
  }

  static async _loadPlaylists(userConfigFields) {
    const playlists = [];

    const playlistConfigPath = config.get('userConfigsPath') + 'playlists/';
    fs.readdirSync(playlistConfigPath).forEach(file => {
      log.debug('loading ' + playlistConfigPath + file);
      const playlistConfigs = JSON.parse(fs.readFileSync(playlistConfigPath + file, 'utf8'));
      log.debug('::playlistConfigs');
      log.debug(playlistConfigs);
      playlists.push(new Playlist(playlistConfigs, playlistConfigs.userConfigFields));
    })
    return playlists;
  }

  static async _promptForPlaylistInfo(userConfigFields) {
    const playlists = [];
    do {
      const questions = userConfigFields.map(field => {
        return {
          type: 'input',
          name: field,
          message: 'What is the ' + field + '?',
        };
      });
      const answers = await inquirer.prompt(questions);
      playlists.push(new Playlist(answers, userConfigFields));
    } while (await this._addAnotherPlaylist());
    return playlists;
  }

  static _addAnotherPlaylist() {
    return inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Would you like to add another playlist?',
        default: false,
      }
    ]).then( answers => {
      return answers.confirmed;
    });
  }
}

export default PlaylistFactory;
