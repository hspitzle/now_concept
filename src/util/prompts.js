import config from '~/src/config';

import fs from 'fs';
import inquirer from 'inquirer';
import Promise from 'bluebird';

class Prompt {
  constructor() {
    this.userConfigFields = userConfigFields;
  }

  getPlaylistsToManage() {
    return this._getFromConfigsOrPrompt()
      .then(answers => this._verifyInput(answers));
  }

  _getCredentials() {
    return Promise.resolve();
  }

  _getFromConfigsOrPrompt() {
    if (config.get('usingStoredConfigs')) {
      return null;
    }

    const questions = this.userConfigFields.map(field => {
      return {
        type: 'input',
        name: field,
        message: 'value for ' + field + ':',
      };
    });
    return inquirer.prompt(questions);
  }

  _verifyInput(answers) {
    if (!answers) {
      return Promise.resolve();
    }
    //print contents of playlist? ask user to verify
    return inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'is this the correct playlist?',
        default: false,
      }
    ]).then(res => {
      // if (res.confirmed) {
        this.userConfigFields.forEach(field => {
          config.set(field, answers[field]);
        });
      // };
      return fs.writeFileSync(config.get('userConfigsPath'), JSON.stringify(config.getProperties(), null, '  '));
    });
  }
}

// var Prompt = require('./src/util/prompts').default;
// var p = new Prompt();
// p.getUserInput();

export default Prompt;
