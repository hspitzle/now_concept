import { NowService } from '~/src/services';

describe('NowService', function() {
  let service;

  beforeEach(() => {
    service = new NowService();
  });

  it('#addClient', () => {
    expect(service.clients instanceof Array).to.equal(true);

    service.addClient('foo');

    expect(service.clients[0]).to.equal('foo');
    expect(service.clients.length).to.equal(1);
  });

  it('#expire', async () => {
    const clientStub1 = {
      expire: stub().returns(Promise.resolve())
    };
    const clientStub2 = {
      expire: stub().returns(Promise.resolve())
    };
    service.addClient(clientStub1);
    service.addClient(clientStub2);

    await service.expire();

    expect(clientStub1.expire).to.have.callCount(1);
    expect(clientStub2.expire).to.have.callCount(1);
  });
});
