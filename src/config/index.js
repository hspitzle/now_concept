import schema from './schema';
import convict from 'convict';
import fs from 'fs';

const config = convict(schema);

// Load environment dependent configuration
var userConfigsPath = config.get('userConfigsPath');
if (fs.existsSync(userConfigsPath)) {
  config.loadFile(userConfigsPath);
  config.set('usingStoredConfigs', true);
}

// Perform validation
config.validate({allowed: 'strict'});

export default config;
