import testYoGeneratorBabelBoilerplate from '../../src/spotify_now_concept';

describe('testYoGeneratorBabelBoilerplate', () => {
  describe('Greet function', () => {
    beforeEach(() => {
      spy(testYoGeneratorBabelBoilerplate, 'greet');
      testYoGeneratorBabelBoilerplate.greet();
    });

    it('should have been run once', () => {
      expect(testYoGeneratorBabelBoilerplate.greet).to.have.been.calledOnce;
    });

    it('should have always returned hello', () => {
      expect(testYoGeneratorBabelBoilerplate.greet).to.have.always.returned('hello');
    });
  });
});
