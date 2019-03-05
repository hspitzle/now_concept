
global.sinon = require('sinon');

beforeEach(() => {
  // Using these globally-available Sinon features is preferrable, as they're
  // automatically restored for you in the subsequent `afterEach`
  global.sandbox = sinon.sandbox.create();
  global.stub = sandbox.stub.bind(global.sandbox);
  // spy = sandbox.spy.bind(root.sandbox);
  // mock = sandbox.mock.bind(root.sandbox);
  // useFakeTimers = sandbox.useFakeTimers.bind(root.sandbox);
  // useFakeXMLHttpRequest = sandbox.useFakeXMLHttpRequest.bind(root.sandbox);
  // useFakeServer = sandbox.useFakeServer.bind(root.sandbox);
});

afterEach(() => {
  delete global.stub;
  // delete root.spy;
  global.sandbox.restore();
});
