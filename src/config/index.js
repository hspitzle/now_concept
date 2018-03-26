import schema from './schema';
import convict from 'convict';
import fs from 'fs';

const config = convict(schema);

// Load environment dependent configuration
var userConfigsPath = config.get('userConfigsPath') + 'user.json';
if (fs.existsSync(userConfigsPath)) {
  console.log('...loading')
  config.loadFile(userConfigsPath);
}

// Perform validation
config.validate({allowed: 'strict'});

export default config;
