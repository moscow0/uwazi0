import { Repeater } from '../Repeater';

describe('Repeater', () => {
  let callbackOne;
  let callbackTwo;

  let repeaterOne;
  let repeaterTwo;

  function advanceTime(time) {
    jest.advanceTimersByTime(time);
    return new Promise(resolve => {
      setImmediate(resolve);
    });
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.useFakeTimers('legacy');

    callbackOne = jasmine.createSpy('callbackone').and.callFake(() => Promise.resolve());
    callbackTwo = jasmine.createSpy('callbackone').and.callFake(() => Promise.resolve());
  });

  it('should be able to have two independant repeaters', async () => {
    repeaterOne = new Repeater(callbackOne, 1);
    repeaterTwo = new Repeater(callbackTwo, 1);

    repeaterTwo.start();
    repeaterOne.start();

    await advanceTime(1);

    repeaterOne.stop();

    await advanceTime(1);

    expect(callbackOne).toHaveBeenCalledTimes(1);
    expect(callbackTwo).toHaveBeenCalledTimes(2);
  });

  it('should resolve stopped promise', async () => {
    jest.useRealTimers();
    repeaterOne = new Repeater(callbackOne, 1);

    repeaterOne.start();

    await expect(repeaterOne.stop()).resolves.toBeUndefined();
  });
});
