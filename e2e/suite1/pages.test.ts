import { adminLogin, logout } from '../helpers/login';
import { host } from '../config';
import proxyMock from '../helpers/proxyMock';
import insertFixtures from '../helpers/insertFixtures';
import disableTransitions from '../helpers/disableTransitions';

const selectors = {
  pageContentsInput: '.tab-content > textarea:nth-child(1)',
  useCustomLandingPage:
    '#collectionSettings > div:nth-child(5) > div > div.toggle-children-button > label',
};

describe('Custom home page and styles', () => {
  const newPageUrl = async () => {
    await expect(page).toMatchElement('div.alert-info', {
      text: /\/page\/.*\(view page\)/g,
      visible: true,
    });
    const newPageUrlData = await page.$eval('div.alert-info', e => e.textContent);
    const url = newPageUrlData?.match(/\/page\/[a-z,A-Z,0-9]*/gm);
    return url?.[0] || '';
  };

  beforeAll(async () => {
    await insertFixtures();
    await proxyMock();
    await adminLogin();
  });

  afterAll(async () => {
    await logout();
  });

  it('should log in and create a page', async () => {
    await expect(page).toClick('a', { text: 'Settings' });
    await expect(page).toClick('a', { text: 'Pages' });
    await expect(page).toClick('a', { text: 'Add page' });
  });

  it('should create a page to be used as home', async () => {
    await expect(page).toFill('input[name="page.data.title"]', 'Custom home page');
    await expect(page).toFill(
      selectors.pageContentsInput,
      '<h1>Custom HomePage header</h1><div class="myDiv">contents</div>'
    );
    await expect(page).toClick('button', { text: 'Save' });
    await expect(page).toClick('span', { text: 'Saved successfully.' });
    const pageUrl = await newPageUrl();
    await page.goto(`${host}${pageUrl}`);
    await disableTransitions();
    await expect(page).toMatch('Custom HomePage header');
  });

  it('should allow setting the page as custom home page', async () => {
    await expect(page).toClick('a', { text: 'Settings' });
    await expect(page).toClick('a', { text: 'Pages' });
    await expect(page).toClick('a', { text: 'Custom home page' });
    const pageUrl = await newPageUrl();
    await expect(page).toClick('a', { text: 'Collection' });
    await expect(page).toClick(selectors.useCustomLandingPage);
    await expect(page).toFill('input[name="home_page"]', pageUrl);
    await expect(page).toClick('button', { text: 'Save' });
  });

  it('should allow setting up a custom CSS', async () => {
    await expect(page).toClick('a', { text: 'Global CSS' });
    await expect(page).toFill(
      'textarea[name="settings.settings.customCSS"]',
      '.myDiv { color: white; font-size: 20px; background-color: red; }'
    );

    await expect(page).toClick('button', { text: 'Save' });
  });

  it('should render the custom page as home page with the custom CSS styles', async () => {
    await page.goto(`${host}`);
    await page.reload();
    await disableTransitions();
    await expect(page).toMatchElement('h1', { text: 'Custom HomePage header' });

    const elements = await page.$$('div.myDiv');
    const styles = await page.evaluate(e => {
      const computedStyle = window.getComputedStyle(e);
      return {
        color: computedStyle.getPropertyValue('color'),
        backgroundColor: computedStyle.getPropertyValue('background-color'),
        fontSize: computedStyle.getPropertyValue('font-size'),
      };
    }, elements[0]);

    expect(styles).toEqual({
      color: 'rgb(255, 255, 255)',
      backgroundColor: 'rgb(255, 0, 0)',
      fontSize: '20px',
    });
  });
});
