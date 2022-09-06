import { createEntity } from '../helpers/createEntity';
import { createTemplate } from '../helpers/createTemplate';
import { adminLogin, logout } from '../helpers/login';
import proxyMock from '../helpers/proxyMock';
import insertFixtures from '../helpers/insertFixtures';

const setupPreFlights = async (): Promise<void> => {
  await insertFixtures();
  await proxyMock();
  await adminLogin();
};

const setupTest = async () => {
  await createTemplate('With image');
  await createEntity('With image', {
    pdf: `${__dirname}/../test_files/valid.pdf`,
    supportingFile: `${__dirname}/../test_files/batman.jpg`,
  });
};

describe('Image is rendered when editing an entity in document view', () => {
  beforeAll(async () => {
    await setupPreFlights();
    await setupTest();
  });

  afterAll(async () => {
    await logout();
  });

  it('Should select image for image property from supporting files', async () => {
    await expect(page).toClick('.metadata-sidepanel.is-active a', { text: 'View' });

    await expect(page).toClick('.metadata-sidepanel button.edit-metadata', {
      text: 'Edit',
    });
    await expect(page).toClick('.form-group.image span', { text: 'Add file' });
    await expect(page).toMatchElement('div.media-grid-card-header > h5', { text: 'batman.jpg' });
  });
});
