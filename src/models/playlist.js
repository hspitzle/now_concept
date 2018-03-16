import config from '~/src/config';

import _ from 'lodash';
import moment from 'moment';
import fs from 'fs';

class Playlist {
  constructor(obj, userConfigFields) {
    Object.assign(
      this,
      _.pick(obj, userConfigFields)
    );
    this._save();
  }

  _save() {
    fs.writeFileSync(
      config.get('userConfigsPath') + this.name + '.json', 
      JSON.stringify(this, null, '  ')
    );
  }

  


}

export default Playlist;
