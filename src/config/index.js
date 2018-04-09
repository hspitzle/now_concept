import schema from './schema';

import convict from 'convict';
import fs from 'fs';

const config = convict(schema);

// Load environment dependent configuration
const envConfigs = `./src/config/${config.get('env')}.json`;
if (fs.existsSync(envConfigs)) {
  console.log('Loading env file:', envConfigs);
  config.loadFile(envConfigs);
} else {
  console.log('Missing env file:', envConfigs);
}

// Load user files
var userConfigsPath = config.get('userConfigsPath') + 'user.json';
if (fs.existsSync(userConfigsPath)) {
  config.loadFile(userConfigsPath);
}

// Perform validation
config.validate({allowed: 'strict'});

export default config;
