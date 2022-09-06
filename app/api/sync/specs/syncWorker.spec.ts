import authRoutes from 'api/auth/routes';
import entities from 'api/entities';
import entitiesModel from 'api/entities/entitiesModel';
import { attachmentsPath, customUploadsPath, storage, files, testingUploadPaths } from 'api/files';
import translations from 'api/i18n';
import { permissionsContext } from 'api/permissions/permissionsContext';
import relationships from 'api/relationships';
import relationtypes from 'api/relationtypes';
import syncRoutes from 'api/sync/routes';
import templates from 'api/templates';
import { tenants } from 'api/tenants';
import thesauri from 'api/thesauri';
import users from 'api/users/users';
import { appContext } from 'api/utils/AppContext';
import { appContextMiddleware } from 'api/utils/appContextMiddleware';
import { elasticTesting } from 'api/utils/elastic_testing';
import errorHandlingMiddleware from 'api/utils/error_handling_middleware';
import mailer from 'api/utils/mailer';
import db from 'api/utils/testing_db';
import { advancedSort } from 'app/utils/advancedSort';
import bodyParser from 'body-parser';
import express, { NextFunction, Request, Response } from 'express';
// eslint-disable-next-line node/no-restricted-import
import { rmdir, writeFile } from 'fs/promises';
import { Server } from 'http';
import 'isomorphic-fetch';
import _ from 'lodash';
import { FetchResponseError } from 'shared/JSONRequest';
import { syncWorker } from '../syncWorker';
import {
  host1Fixtures,
  host2Fixtures,
  hub3,
  newDoc1,
  newDoc3,
  relationship9,
  relationtype4,
  template1,
  template2,
  thesauri1,
  thesauri1Value2,
} from './fixtures';

async function runAllTenants() {
  try {
    await syncWorker.runAllTenants();
  } catch (e) {
    if (e instanceof FetchResponseError) {
      throw e.json;
    }
    throw e;
  }
}

async function applyFixtures() {
  await db.setupFixturesAndContext(host1Fixtures, undefined, 'host1');
  await db.setupFixturesAndContext(host2Fixtures, undefined, 'host2');
  await db.setupFixturesAndContext({ settings: [{}] }, undefined, 'target1');
  await db.setupFixturesAndContext({ settings: [{}] }, undefined, 'target2');
  db.UserInContextMockFactory.restore();

  await tenants.run(async () => {
    await elasticTesting.reindex();
    await users.newUser({
      username: 'user',
      password: 'password',
      role: 'admin',
      email: 'user@testing',
    });
  }, 'target1');

  await tenants.run(async () => {
    await elasticTesting.reindex();
    await users.newUser({
      username: 'user2',
      password: 'password2',
      role: 'admin',
      email: 'user2@testing',
    });
  }, 'target2');
}

describe('syncWorker', () => {
  let server: Server;
  let server2: Server;

  beforeAll(async () => {
    const app = express();
    await db.connect({ defaultTenant: false });
    spyOn(mailer, 'send').and.callFake(async () => Promise.resolve());

    tenants.add({
      name: 'host1',
      dbName: 'host1',
      indexName: 'host1',
      ...(await testingUploadPaths()),
    });

    tenants.add({
      name: 'host2',
      dbName: 'host2',
      indexName: 'host2',
      ...(await testingUploadPaths()),
    });

    tenants.add({
      name: 'target1',
      dbName: 'target1',
      indexName: 'target1',
      ...(await testingUploadPaths('syncWorker_target1_files')),
    });

    tenants.add({
      name: 'target2',
      dbName: 'target2',
      indexName: 'target2',
      ...(await testingUploadPaths('syncWorker_target2_files')),
    });

    await applyFixtures();

    app.use(bodyParser.json());
    app.use(appContextMiddleware);

    const multitenantMiddleware = (req: Request, _res: Response, next: NextFunction) => {
      if (req.get('host') === 'localhost:6667') {
        appContext.set('tenant', 'target1');
      }
      if (req.get('host') === 'localhost:6668') {
        appContext.set('tenant', 'target2');
      }
      next();
    };

    //@ts-ignore
    app.use(multitenantMiddleware);

    authRoutes(app);
    syncRoutes(app);
    app.use(errorHandlingMiddleware);
    await tenants.run(async () => {
      await writeFile(attachmentsPath(`${newDoc1.toString()}.jpg`), '');
      await writeFile(attachmentsPath('test_attachment.txt'), '');
      await writeFile(attachmentsPath('test_attachment2.txt'), '');
      await writeFile(attachmentsPath('test.txt'), '');
      await writeFile(attachmentsPath('test2.txt'), '');
      await writeFile(customUploadsPath('customUpload.gif'), '');
    }, 'host1');
    server = app.listen(6667);
    server2 = app.listen(6668);
  });

  afterAll(async () => {
    await tenants.run(async () => {
      await rmdir(attachmentsPath(), { recursive: true });
    }, 'target1');
    await tenants.run(async () => {
      await rmdir(attachmentsPath(), { recursive: true });
    }, 'target2');
    await new Promise(resolve => {
      server.close(resolve);
    });
    await new Promise(resolve => {
      server2.close(resolve);
    });
    await db.disconnect();
  });

  it('should sync the configured templates and its defined properties', async () => {
    await runAllTenants();
    await tenants.run(async () => {
      const syncedTemplates = await templates.get();
      expect(syncedTemplates).toHaveLength(1);
      const [template] = syncedTemplates;
      expect(template.name).toBe('template1');
      expect(template.properties).toMatchObject([
        { name: 't1Property1' },
        { name: 't1Property2' },
        { name: 't1Thesauri1Select' },
        { name: 't1Relationship1' },
      ]);
    }, 'target1');

    await tenants.run(async () => {
      const syncedTemplates = await templates.get();
      const [syncedTemplate2, syncedTemplate3] = advancedSort(syncedTemplates, {
        property: 'name',
      });

      expect(syncedTemplate2).toMatchObject({ name: 'template2' });
      expect(syncedTemplate3).toMatchObject({ name: 'template3' });
    }, 'target2');
  });

  it('should sync entities that belong to the configured templates', async () => {
    await runAllTenants();
    await tenants.run(async () => {
      permissionsContext.setCommandContext();
      expect(await entities.get({}, {}, { sort: { title: 'asc' } })).toEqual([
        {
          _id: expect.anything(),
          sharedId: 'newDoc1SharedId',
          title: 'a new entity',
          template: template1,
          metadata: {
            t1Property1: [{ value: 'sync property 1' }],
            t1Property2: [{ value: 'sync property 2' }],
            t1Thesauri1Select: [{ value: thesauri1Value2.toString() }],
            t1Relationship1: [{ value: newDoc3.toString() }],
          },
          __v: 0,
          documents: [],
          attachments: [
            {
              _id: expect.anything(),
              creationDate: expect.anything(),
              entity: 'newDoc1SharedId',
              filename: 'test2.txt',
              type: 'attachment',
            },
            {
              _id: expect.anything(),
              creationDate: expect.anything(),
              entity: 'newDoc1SharedId',
              filename: `${newDoc1.toString()}.jpg`,
              type: 'attachment',
            },
          ],
        },
        {
          _id: expect.anything(),
          title: 'another new entity',
          template: template1,
          sharedId: 'entitytest.txt',
          metadata: {
            t1Property1: [{ value: 'another doc property 1' }],
            t1Property2: [{ value: 'another doc property 2' }],
          },
          __v: 0,
          documents: [],
          attachments: [
            {
              _id: expect.anything(),
              creationDate: expect.anything(),
              entity: 'entitytest.txt',
              filename: 'test.txt',
              type: 'attachment',
            },
          ],
        },
      ]);
    }, 'target1');

    await tenants.run(async () => {
      permissionsContext.setCommandContext();
      expect(await entities.get({}, {}, { sort: { title: 'asc' } })).toEqual([
        {
          __v: 0,
          _id: expect.anything(),
          attachments: [],
          documents: [],
          metadata: {},
          sharedId: 'newDoc3SharedId',
          template: template2,
          title: 'New Doc 3',
        },
      ]);
    }, 'target2');
  });

  it('should sync files belonging to the entities synced', async () => {
    await runAllTenants();
    await tenants.run(async () => {
      const syncedFiles = await files.get();
      expect(syncedFiles).toMatchObject([
        { entity: 'newDoc1SharedId', type: 'attachment' },
        { entity: 'entitytest.txt', type: 'attachment' },
        { entity: 'newDoc1SharedId', type: 'attachment' },
        { type: 'custom' },
      ]);

      expect(await storage.fileExists(syncedFiles[0].filename!, 'attachment')).toBe(true);
      expect(await storage.fileExists(syncedFiles[1].filename!, 'attachment')).toBe(true);
      expect(await storage.fileExists(syncedFiles[2].filename!, 'attachment')).toBe(true);
      expect(await storage.fileExists(syncedFiles[3].filename!, 'custom')).toBe(true);
    }, 'target1');
  });

  it('should sync dictionaries that match template properties whitelist', async () => {
    await runAllTenants();
    await tenants.run(async () => {
      expect(await thesauri.get()).toMatchObject([
        {
          name: 'thesauri1',
          values: [
            { _id: expect.anything(), label: 'th1value1' },
            { _id: expect.anything(), label: 'th1value2' },
          ],
        },
      ]);
    }, 'target1');
  });

  it('should sync relationTypes that match configured template properties', async () => {
    await runAllTenants();
    await tenants.run(async () => {
      expect(await relationtypes.get()).toMatchObject([
        {
          _id: expect.anything(),
          name: 'relationtype4',
        },
      ]);
    }, 'target1');
  });

  it('should syncronize translations that match configured properties', async () => {
    await runAllTenants();
    await tenants.run(async () => {
      const syncedTranslations = await translations.get({});
      expect(syncedTranslations).toEqual([
        {
          __v: 0,
          _id: expect.anything(),
          contexts: [
            {
              _id: expect.anything(),
              id: 'System',
              type: 'Uwazi UI',
              values: {
                'Sytem Key': 'System Value',
              },
            },
            {
              _id: expect.anything(),
              id: template1.toString(),
              type: 'Entity',
              values: {
                'Template Title': 'Template Title translated',
                t1Property1L: 't1Property1T',
                t1Relationship1L: 't1Relationship1T',
                template1: 'template1T',
              },
            },
            {
              _id: expect.anything(),
              id: thesauri1.toString(),
              type: 'Dictionary',
              values: {},
            },
            {
              _id: expect.anything(),
              id: relationtype4.toString(),
              type: 'Connection',
              values: {},
            },
          ],
          locale: 'en',
        },
      ]);
    }, 'target1');
  });

  it('should syncronize connections that match configured properties', async () => {
    await runAllTenants();
    await tenants.run(async () => {
      const syncedConnections = await relationships.get({});
      expect(syncedConnections).toEqual([
        {
          _id: relationship9,
          entity: 'newDoc1SharedId',
          hub: hub3,
          template: null,
        },
      ]);
    }, 'target1');
  });

  describe('when a template that is configured has been deleted', () => {
    it('should not throw an error', async () => {
      await tenants.run(async () => {
        await entitiesModel.delete({ template: template1 });
        //@ts-ignore
        await templates.delete({ _id: template1 });
      }, 'host1');

      await expect(syncWorker.runAllTenants()).resolves.not.toThrowError();
    });
  });

  describe('after changing sync configurations', () => {
    it('should delete templates not defined in the config', async () => {
      await runAllTenants();
      const changedFixtures = _.cloneDeep(host1Fixtures);
      //@ts-ignore
      changedFixtures.settings[0].sync[0].config.templates = {};
      await db.setupFixturesAndContext({ ...changedFixtures }, undefined, 'host1');

      await syncWorker.runAllTenants();

      await tenants.run(async () => {
        const syncedTemplates = await templates.get();
        expect(syncedTemplates).toHaveLength(0);
      }, 'target1');
    });
  });

  describe('when active is false', () => {
    it('should not sync anything', async () => {
      await applyFixtures();
      await runAllTenants();
      const changedFixtures = _.cloneDeep(host1Fixtures);
      //@ts-ignore
      changedFixtures.settings[0].sync[0].config.templates = {};
      //@ts-ignore
      changedFixtures.settings[0].sync[0].active = false;
      await db.setupFixturesAndContext({ ...changedFixtures }, undefined, 'host1');

      await runAllTenants();

      await tenants.run(async () => {
        const syncedTemplates = await templates.get();
        expect(syncedTemplates).toHaveLength(1);
      }, 'target1');
    }, 10000);
  });
});
