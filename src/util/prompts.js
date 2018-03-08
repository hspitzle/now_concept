import fs from 'fs';
import config from '~/src/config';
import Promise from 'bluebird';
import inquirer from 'inquirer';

class Prompt {
  constructor(userConfigFields = ['playlist', 'ttl']) {
    this.userConfigFields = userConfigFields;
  }

  getUserInput() {
    return this._getCredentials()
    .then(() => this._getFromConfigsOrPrompt())
    .then(answers => this._verifyInput(answers));
  }

  _getCredentials() {
    return Promise.resolve();
  }

  _getFromConfigsOrPrompt(keys) {
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
