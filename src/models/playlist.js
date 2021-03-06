import config from '~/src/config';

import _ from 'lodash';
import fs from 'fs';
import moment from 'moment';

class Playlist {
  constructor(obj, userConfigFields) {
    Object.assign(
      this,
      _.pick(obj, userConfigFields)
    );
    this.userConfigFields = userConfigFields;
    this._save();
  }

  _save() {
    fs.writeFileSync(
      config.get('userConfigsPath') + 'playlists/' + this.name + '.json',
      JSON.stringify(this, null, '  ')
    );
  }
}

export default Playlist;
