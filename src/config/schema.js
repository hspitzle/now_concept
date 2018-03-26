export default {
  userConfigsPath: {
    doc: 'Path to userr config file',
    format: String,
    default: './src/config/',
  },
  usingStoredConfigs: {
    doc: 'Whether or not a stored config file was loaded',
    format: Boolean,
    default: false,
  },
  spotifyUserId: {
    doc: 'ID of user',
    format: String,
    default: ''
  },
  spotifyClientId: {
    doc: 'client id',
    format: String,
    default: ''
  },
  spotifyClientSecret: {
    doc: 'client secret',
    format: String,
    default: ''
  },
  playlist: {
    doc: 'Name of playlist to clean',
    format: String,
    default: '',
  },
  ttl: {
    doc: 'Number of days to keep songs on the playlist',
    format: Number,
    default: 45,
  },
  pino: {
    level: 'info',
    prettyPrint: true
  }
};
