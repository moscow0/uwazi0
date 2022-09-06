/* eslint-disable max-statements */
/*global page*/
import { adminLogin, logout } from '../helpers/login';
import proxyMock from '../helpers/proxyMock';
import insertFixtures from '../helpers/insertFixtures';
import disableTransitions from '../helpers/disableTransitions';
import { prepareToMatchImageSnapshot, testSelectorShot } from '../helpers/regression';

prepareToMatchImageSnapshot();

const selectSettingsPage = async (title: string) => {
  await expect(page).toClick('a.settings-section');
  await expect(page).toClick('span', { text: title });
};

const testSettingsContent = async () => {
  await testSelectorShot('div.settings-content');
};

describe('Settings', () => {
  beforeAll(async () => {
    await insertFixtures();
    await proxyMock();
    await adminLogin();
    await disableTransitions();
  });

  it('should display Account', async () => {
    await selectSettingsPage('Account');
    await testSelectorShot('div.account-settings');
  });

  it('should display Users', async () => {
    await selectSettingsPage('Users');
    await testSettingsContent();
  });

  it('should display Collection', async () => {
    await selectSettingsPage('Collection');
    await page.waitForSelector('.leafletmap');
    await testSelectorShot('div.collection-settings');
  });

  describe('Pages', () => {
    it('should display create Pages page', async () => {
      await selectSettingsPage('Pages');
      await expect(page).toClick('.settings-footer > a');
      await testSettingsContent();
    });
  });

  describe('Filters', () => {
    it('should display filters page with filters', async () => {
      await selectSettingsPage('Filters');
      await testSettingsContent();
    });

    it('should display filter groups', async () => {
      await selectSettingsPage('Filters');
      await expect(page).toClick('button', { text: 'Create group' });
      await testSettingsContent();
    });
  });

  describe('Templates', () => {
    const getMetadataOptionSelector = (position: number) =>
      `.metadataTemplate-constructor > ul.list-group > li.list-group-item:nth-child(${position}) > button`;

    it('should display Templates page', async () => {
      await selectSettingsPage('Templates');
      await testSettingsContent();
    });

    it('should display new templates page', async () => {
      await selectSettingsPage('Templates');
      await expect(page).toClick('div.settings-footer > a');
      await testSettingsContent();
    });

    it('should display new templates page with more metadata options', async () => {
      await selectSettingsPage('Templates');
      await expect(page).toClick('div.settings-footer > a');
      await expect(page).toClick(getMetadataOptionSelector(2));
      await expect(page).toClick(getMetadataOptionSelector(4));
      await testSettingsContent();
    });
  });

  describe('Thesauri', () => {
    it('should display Thesaurus page', async () => {
      await selectSettingsPage('Thesauri');
      await testSettingsContent();
    });

    it('should display new Thesaurus page', async () => {
      await selectSettingsPage('Thesauri');
      await expect(page).toClick('div.settings-footer > a');
      await testSettingsContent();
    });

    it('should display new Thesaurus with groups page', async () => {
      await selectSettingsPage('Thesauri');
      await expect(page).toClick('a', { text: 'Add thesaurus' });
      await expect(page).toClick('button', { text: 'Add group' });
      await expect(page).toClick('button', { text: 'Add group' });
      await expect(page).toClick('button', { text: 'Add group' });
      await testSettingsContent();
    });
  });

  it('should display Languages', async () => {
    await selectSettingsPage('Languages');
    await testSelectorShot('.settings-content > .panel > .list-group:last-child');
  });

  it('should display Translations', async () => {
    await selectSettingsPage('Translations');
    await testSettingsContent();
  });

  afterAll(async () => {
    await logout();
  });
});
