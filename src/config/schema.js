export default {
  userConfigsPath: {
    doc: 'Path to userr config file',
    format: String,
    default: './src/config/curator.json',
  },
  usingStoredConfigs: {
    doc: 'Whether or not a stored config file was loaded',
    format: Boolean,
    default: false,
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
};
