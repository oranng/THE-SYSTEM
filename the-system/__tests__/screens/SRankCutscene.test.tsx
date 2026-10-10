import React from 'react';
import renderer from 'react-test-renderer';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}));

jest.mock('../../src/store/useSystemStore', () => ({
  useSystemStore: () => ({ refresh: jest.fn().mockResolvedValue(undefined) }),
}));

jest.mock('../../src/db/queries', () => ({
  setSystemState: jest.fn().mockResolvedValue(undefined),
}));

import SRankCutscene from '../../src/screens/SRankCutscene';

describe('SRankCutscene', () => {
  it('renders first frame', () => {
    let tree: renderer.ReactTestRenderer;
    renderer.act(() => { tree = renderer.create(<SRankCutscene />); });
    const json = tree!.toJSON();
    expect(json).not.toBeNull();
    // Should contain FRAME I in the rendered tree
    const str = JSON.stringify(json);
    expect(str).toContain('КАДР I');
  });
});
