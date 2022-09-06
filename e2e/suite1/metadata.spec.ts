import { waitForNavigation } from '../helpers/formActions';
import disableTransitions from '../helpers/disableTransitions';
import insertFixtures from '../helpers/insertFixtures';
import { adminLogin, logout } from '../helpers/login';
import proxyMock from '../helpers/proxyMock';
import { host } from '../config';

describe('Metadata', () => {
  beforeAll(async () => {
    await insertFixtures();
    await proxyMock();
    await adminLogin();
  });

  afterAll(async () => {
    await logout();
  });

  beforeEach(async () => {
    await waitForNavigation(expect(page).toClick('a', { text: 'Settings' }));
    await disableTransitions();
    expect(page.url()).toBe(`${host}/en/settings/account`);
  });

  describe('Thesauri tests', () => {
    it('should create a new thesaurus with two values', async () => {
      await expect(page).toClick('a', { text: 'Thesauri' });
      await expect(page).toClick('a', { text: 'Add thesaurus' });
      await expect(page).toFill('input[name="thesauri.data.name"', 'New thesaurus');
      await expect(page).toFill('input[name="thesauri.data.values[0].label"', 'Value 1');
      await expect(page).toFill('input[name="thesauri.data.values[1].label"', 'Value 2');
      await expect(page).toClick('button', { text: 'Save' });
      await expect(page).toClick('.alert.alert-success');
    });

    it('should go back to thesauri then edit the created thesaurus', async () => {
      await expect(page).toClick('a', { text: 'Thesauri' });
      await expect(page).toClick(
        'div.thesauri-list > table > tbody > tr:nth-child(4) > td:nth-child(3) > div > a'
      );
      await expect(page).toClick('button', { text: 'Add group' });
      await expect(page).toFill('input[name="thesauri.data.values[2].label"', 'Group');
      await expect(page).toFill(
        'input[name="thesauri.data.values[2].values[0].label"',
        'Sub value 1'
      );
      await expect(page).toFill(
        'input[name="thesauri.data.values[2].values[1].label"',
        'Sub value 2'
      );
      await expect(page).toClick('button', { text: 'Save' });
      await expect(page).toClick('.alert.alert-success');
    });

    it('should go back to thesauri then delete the created thesaurus', async () => {
      await expect(page).toClick('a', { text: 'Thesauri' });
      await page.waitForSelector(
        '.thesauri-list > table > tbody > tr:nth-child(4) > td:nth-child(3) > div > button'
      );
      await expect(page).toClick(
        '.thesauri-list > table > tbody > tr:nth-child(4) > td:nth-child(3) > div > button'
      );
      await page.waitForSelector('div.modal-content');
      await expect(page).toMatchElement('div.modal-body > h4', {
        text: 'Confirm delete thesaurus: New thesaurus',
      });
      await expect(page).toClick('button', { text: 'Accept' });
    });
  });

  describe('Templates tests', () => {
    const createFromModal = async (button: string, inputSelector: string, newIntem: string) => {
      await expect(page).toClick('a', { text: 'Templates' });
      await expect(page).toClick('a', { text: 'My edited template' });
      await expect(page).toClick('button', { text: button });
      await expect(page).toFill(inputSelector, newIntem);
      await expect(page).toClick('.modal-footer > button', { text: 'Save' });
      await expect(page).toClick('.alert.alert-success');
    };

    it('should create a new template with no properties added', async () => {
      await expect(page).toClick('a', { text: 'Templates' });
      await expect(page).toClick('a', { text: 'Add template' });
      await expect(page).toFill('input[name="template.data.name"', 'My template');
      await expect(page).toClick('button', { text: 'Save' });
      await expect(page).toClick('.alert.alert-success');
    });

    it('should go back and then edit the created template', async () => {
      await expect(page).toClick('a', { text: 'Templates' });
      await expect(page).toClick('a', { text: 'My template' });
      await expect(page).toFill('input[name="template.data.name"', 'My edited template');
      await expect(page).toClick('.panel-body > div > aside > div > ul > li:nth-child(1) > button');
      await expect(page).toClick('button', { text: 'Save' });
      await expect(page).toClick('.alert.alert-success');
    });

    it('should create a thesaurus and relationship type from the template editor', async () => {
      await createFromModal('Add thesaurus', '#thesaurusInput', 'My new dictionary');
      await createFromModal(
        'Add relationship type',
        '#relationshipTypeInput',
        'My new relationship type'
      );
    });

    it('should check that the new thesaurus and relationship are listed', async () => {
      await expect(page).toClick('a', { text: 'Thesauri' });
      await expect(page).toMatch('My new dictionary');
      await expect(page).toClick('a', { text: 'Relationship types' });
      await expect(page).toMatch('My new relationship type');
    });

    it('should use the new thesaurus and relationship type', async () => {
      await expect(page).toClick('a', { text: 'Templates' });
      await expect(page).toClick('a', { text: 'My edited template' });
      await expect(page).toClick('li.list-group-item:nth-child(3) > button:nth-child(1)');
      await expect(page).toClick(
        '.metadataTemplate-list > li:nth-child(5) > div:nth-child(1) > div:nth-child(2) > button',
        { text: 'Edit' }
      );
      await expect(page).toSelect('select.form-control', 'My new dictionary');
      await expect(page).toClick('li.list-group-item:nth-child(5) > button:nth-child(1)');
      await expect(page).toClick(
        '.metadataTemplate-list > li:nth-child(6) > div:nth-child(1) > div:nth-child(2) > button',
        { text: 'Edit' }
      );
      await expect(page).toSelect(
        'div.form-group:nth-child(2) > select:nth-child(2)',
        'My new relationship type'
      );
      await expect(page).toClick('button', { text: 'Save' });
      await expect(page).toClick('.alert.alert-success');
    });

    it('should go back to Template then delete the created template', async () => {
      await expect(page).toClick('a', { text: 'Templates' });
      await page.waitForSelector(
        '.settings-content > div > ul > li:nth-child(6) > div > button.btn.btn-danger.btn-xs.template-remove'
      );
      await expect(page).toClick(
        '.settings-content > div > ul > li:nth-child(6) > div > button.btn.btn-danger.btn-xs.template-remove'
      );
      await page.waitForSelector('div.modal-content');
      await expect(page).toMatchElement('div.modal-body > h4', {
        text: 'Confirm delete of template: My edited template',
      });
      await expect(page).toClick('button', { text: 'Accept' });
      await expect(page).not.toMatch('My edited template');
    });
  });

  describe('Relationship types tests', () => {
    it('should create a new connection', async () => {
      await expect(page).toClick('a', { text: 'Relationship types' });
      await expect(page).toClick('a', { text: 'Add connection' });
      await expect(page).toFill('input[placeholder="Template name"]', 'test connection');
      await expect(page).toClick('button', { text: 'Save' });
      await expect(page).toClick('.alert.alert-success');
      await expect(page).toClick('a', { text: 'Relationship types' });
      await expect(page).toMatch('test connection');
    });

    it('should go back to Connections then edit the created connection', async () => {
      await expect(page).toClick('a', { text: 'Relationship types' });
      await expect(page).toClick('a', { text: 'test connection' });
      await expect(page).toFill('input[value="test connection"]', 'test connection edited');
      await expect(page).toClick('button', { text: 'Save' });
      await expect(page).toClick('.alert.alert-success');
      await expect(page).toClick('a', { text: 'Relationship types' });
      await expect(page).toMatch('test connection edited');
    });

    it('should go back to connections then delete the created connection', async () => {
      await expect(page).toClick('a', { text: 'Relationship types' });
      await expect(page).toClick(
        // types not up to date pr here https://github.com/DefinitelyTyped/DefinitelyTyped/pull/60579
        // @ts-ignore
        { type: 'xpath', value: '//*[text() = "test connection edited"]/parent::li//a' },
        { text: 'Delete' }
      );
      await expect(page).toClick('button', { text: 'Accept' });
      await expect(page).not.toMatch('test connection edited');
    });
  });
});
