import { catchErrors } from 'api/utils/jasmineHelpers';
import db from 'api/utils/testing_db';

import thesauri from 'api/thesauri/thesauri.js';
import fixtures, {
  entityTemplateId,
  documentTemplateId,
  englishTranslation,
  dictionaryId,
} from './fixtures.js';
import translations from '../translations';

describe('translations', () => {
  beforeEach(async () => {
    await db.setupFixturesAndContext(fixtures);
  });

  afterAll(async () => {
    await db.disconnect();
  });

  describe('process System context', () => {
    it('should add keys that do not exist into all languages', async () => {
      const keys = [
        {
          key: 'Password',
        },
        {
          key: 'Account',
        },
        {
          key: 'Email',
        },
        {
          key: 'Age',
        },
        {
          key: 'new key',
        },
        {
          key: 'new key 2',
          label: 'label2',
        },
      ];
      await translations.processSystemKeys(keys);
      const result = await translations.get();

      const ESTranslations =
        (result.find(t => t.locale === 'es')?.contexts || []).find(c => c.label === 'System')
          ?.values || {};
      const ENTranslations =
        (result.find(t => t.locale === 'en')?.contexts || []).find(c => c.label === 'System')
          ?.values || {};
      const otherTranslation =
        (result.find(t => t.locale === 'other')?.contexts || []).find(c => c.label === 'System')
          ?.values || {};

      expect(ENTranslations.Password).toBe('Password');
      expect(ENTranslations.Account).toBe('Account');
      expect(ENTranslations.Email).toBe('E-Mail');
      expect(ENTranslations.Age).toBe('Age');
      expect(ENTranslations['new key']).toBe('new key');
      expect(ENTranslations['new key 2']).toBe('label2');

      expect(otherTranslation.Password).toBe('Password');
      expect(otherTranslation.Account).toBe('Account');
      expect(otherTranslation.Email).toBe('Email');
      expect(otherTranslation.Age).toBe('Age');
      expect(otherTranslation['new key']).toBe('new key');
      expect(otherTranslation['new key 2']).toBe('label2');

      expect(ESTranslations.Password).toBe('Contraseña');
      expect(ESTranslations.Account).toBe('Cuenta');
      expect(ESTranslations.Email).toBe('Correo electronico');
      expect(ESTranslations.Age).toBe('Edad');
      expect(ESTranslations['new key']).toBe('new key');
      expect(ESTranslations['new key 2']).toBe('label2');
    });

    it('should delete the keys that are missing', async () => {
      const keys = [{ key: 'Email' }, { key: 'Age' }, { key: 'new key' }];
      await translations.processSystemKeys(keys);
      const result = await translations.get();

      const ESTrnaslations =
        (result.find(t => t.locale === 'es')?.contexts || []).find(c => c.label === 'System')
          ?.values || {};
      const ENTrnaslations =
        (result.find(t => t.locale === 'en')?.contexts || []).find(c => c.label === 'System')
          ?.values || {};

      expect(ENTrnaslations.Password).not.toBeDefined();
      expect(ENTrnaslations.Account).not.toBeDefined();
      expect(ENTrnaslations.Email).toBe('E-Mail');
      expect(ENTrnaslations.Age).toBe('Age');
      expect(ENTrnaslations['new key']).toBe('new key');

      expect(ESTrnaslations.Password).not.toBeDefined();
      expect(ESTrnaslations.Account).not.toBeDefined();
      expect(ESTrnaslations.Email).toBe('Correo electronico');
      expect(ESTrnaslations.Age).toBe('Edad');
      expect(ESTrnaslations['new key']).toBe('new key');
    });
  });

  describe('get()', () => {
    it('should return the translations', async () => {
      const result = await translations.get();

      expect(result.length).toBe(3);
      expect(result[0].locale).toBe('en');
      expect(result[0].contexts?.[0].id).toBe('System');
      expect(result[0].contexts?.[0].type).toBe('Uwazi UI');

      expect(result[0].contexts?.[1].id).toBe('Filters');
      expect(result[0].contexts?.[1].type).toBe('Uwazi UI');

      expect(result[0].contexts?.[2].id).toBe('Menu');
      expect(result[0].contexts?.[2].type).toBe('Uwazi UI');

      expect(result[0].contexts?.[3].id).toBe(entityTemplateId.toString());
      expect(result[0].contexts?.[3].type).toBe('Entity');

      expect(result[0].contexts?.[4].id).toBe(documentTemplateId.toString());
      expect(result[0].contexts?.[4].type).toBe('Document');

      expect(result[1].locale).toBe('es');
    });
  });

  describe('save()', () => {
    it('should save the translation and return it', done => {
      translations
        .save({ locale: 'fr' })
        .then(result => {
          expect(result._id).toBeDefined();
          done();
        })
        .catch(catchErrors(done));
    });

    it('should transform values from map to array if its a map', async () => {
      await translations.save({
        locale: 'fr',
        contexts: [
          { values: { test: 'value' } },
          // @ts-ignore
          { values: [{ key: 'test2', value: 'value2' }] },
        ],
      });

      const result = await translations.get();

      const fr = result.find(r => r.locale === 'fr');
      expect(fr?.contexts?.[0].values.test).toEqual('value');
      expect(fr?.contexts?.[1].values.test2).toEqual('value2');
    });

    describe('when saving a dictionary context', () => {
      it('should propagate translation changes to entities denormalized label', async () => {
        spyOn(thesauri, 'renameThesaurusInMetadata').and.callFake(async () => Promise.resolve());
        await translations.save({
          _id: englishTranslation,
          locale: 'en',
          contexts: [
            {
              id: dictionaryId.toString(),
              type: 'Thesaurus',
              values: {
                'dictionary 2': 'new name',
                Password: 'Password',
                Account: 'Account',
                Email: 'E-Mail',
                Age: 'Age changed',
              },
            },
          ],
        });

        expect(thesauri.renameThesaurusInMetadata).toHaveBeenLastCalledWith(
          'age id',
          'Age changed',
          dictionaryId,
          'en'
        );
      });
    });

    it('should save partial translations', async () => {
      await translations.save({
        _id: englishTranslation,
        locale: 'en',
        contexts: [
          {
            id: 'Filters',
            label: 'Filters',
            values: { something: 'new' },
          },
        ],
      });

      const [translation] = await translations.get({ _id: englishTranslation });

      expect(translation.contexts?.length).toBe(6);
      expect(translation.contexts?.find(context => context.id === 'Filters')?.values).toEqual({
        something: 'new',
      });
    });
  });

  it('should not allow duplicate keys', async () => {
    try {
      await translations.save({
        locale: 'fr',
        contexts: [
          {
            values: [
              { key: 'repeated_key', value: 'first_value' },
              { key: 'unique_key', value: 'unique_value' },
              { key: 'repeated_key', value: 'second_value' },
            ],
          },
        ],
      });
      fail('Should throw error.');
    } catch (error) {
      expect(error.message).toContain('Process is trying to save repeated translation key');
    }

    try {
      await translations.save({
        locale: 'en',
        contexts: [
          {
            id: dictionaryId.toString(),
            // eslint-disable-next-line max-lines
            values: [
              { key: 'repeated_key', value: 'first_value' },
              { key: 'unique_key', value: 'unique_value' },
              { key: 'repeated_key', value: 'second_value' },
            ],
          },
        ],
      });
      fail('Should throw error.');
    } catch (error) {
      expect(error.message).toContain('Process is trying to save repeated translation key');
    }
  });

  describe('addEntry()', () => {
    it('should add the new key to each dictionary in the given context', async () => {
      const result = await translations.addEntry('System', 'Key', 'default');

      expect(result).toBe('ok');

      const translated = await translations.get();

      expect(translated[0].contexts?.[0].values.Key).toBe('default');
      expect(translated[1].contexts?.[0].values.Key).toBe('default');
    });

    it('should not allow adding existing keys', async () => {
      try {
        await translations.addEntry('System', 'Password', 'password_again');
        fail('Should throw error.');
      } catch (error) {
        expect(error.message).toContain('Process is trying to save repeated translation key');
      }
    });
  });

  describe('updateEntries', () => {
    it('should update the entries', async () => {
      await translations.updateEntries('System', {
        en: { Password: 'Passphrase', Age: 'Years Old' },
      });

      const result = await translations.get();

      expect(result[0].contexts?.[0].values).toMatchObject({
        Password: 'Passphrase',
        Account: 'Account',
        Email: 'E-Mail',
        Age: 'Years Old',
      });
    });

    it('should throw an error on if trying to update missing keys', async () => {
      try {
        await translations.updateEntries('System', {
          en: { Key: 'english_value', OtherKey: 'other_english_value' },
          es: { Key: 'spanish_value' },
        });
        fail('Should throw error.');
      } catch (error) {
        expect(error.message).toBe(
          'Process is trying to update missing translation keys: en - System - Key,OtherKey.'
        );
      }
    });

    it('should not fail when trying to update a nonexisting language', async () => {
      await translations.updateEntries('System', {
        en: { Password: 'Passphrase', Age: 'Years Old' },
        es: { Password: 'Password in Spanish', Age: 'Age in Spanish' },
        fr: { Password: 'mot de masse', Age: 'âge' },
      });

      const result = await translations.get();

      expect(result[0].contexts?.[0].values).toMatchObject({
        Password: 'Passphrase',
        Account: 'Account',
        Email: 'E-Mail',
        Age: 'Years Old',
      });
      expect(result[1].contexts?.[0].values).toMatchObject({
        Password: 'Password in Spanish',
        Account: 'Cuenta',
        Email: 'Correo electronico',
        Age: 'Age in Spanish',
      });
    });
  });

  describe('addContext()', () => {
    it('should add a context with its values', async () => {
      const values = { Name: 'Name', Surname: 'Surname' };
      const result = await translations.addContext('context', 'Judge', values, 'type');

      expect(result).toBe('ok');

      const translated = await translations.get();

      expect(translated.find(t => t.locale === 'en')?.contexts?.[6].values).toEqual(values);
      expect(translated.find(t => t.locale === 'en')?.contexts?.[6].type).toEqual('type');
      expect(translated.find(t => t.locale === 'es')?.contexts?.[1].values).toEqual(values);
      expect(translated.find(t => t.locale === 'es')?.contexts?.[1].type).toEqual('type');
    });
  });

  describe('deleteContext()', () => {
    it('should delete a context and its values', async () => {
      const result = await translations.deleteContext('System');

      expect(result).toBe('ok');

      const translated = await translations.get();

      expect(translated[0].contexts?.length).toBe(5);
      expect(translated[1].contexts?.length).toBe(0);
    });
  });

  describe('updateContext()', () => {
    it('should add values if the context values are undefined', async () => {
      const keyNameChanges = { Password: 'Pass', Account: 'Acc', System: 'Interface' };
      const deletedProperties = ['Age'];
      const context = {
        Pass: 'Pass',
        Acc: 'Acc',
        Email: 'Email',
        Name: 'Name',
        Interface: 'Interface',
      };

      const result = await translations.updateContext(
        'Menu',
        'Menu',
        keyNameChanges,
        deletedProperties,
        context
      );

      expect(result).toBe('ok');
    });

    it('should update a context with its values', async () => {
      const keyNameChanges = { Password: 'Pass', Account: 'Acc', System: 'Interface' };
      const deletedProperties = ['Age'];
      const values = {
        Pass: 'Pass',
        Acc: 'Acc',
        Email: 'Email',
        Name: 'Names',
        Interface: 'Interfaces',
      };

      const result = await translations.updateContext(
        'System',
        'Interface',
        keyNameChanges,
        deletedProperties,
        values
      );

      expect(result).toBe('ok');

      const translated = await translations.get();
      const en = translated.find(t => t.locale === 'en');
      const es = translated.find(t => t.locale === 'es');

      expect(en?.contexts?.[0].label).toBe('Interface');
      expect(en?.contexts?.[0].values.Pass).toBe('Pass');
      expect(en?.contexts?.[0].values.Interface).toBe('Interfaces');
      expect(es?.contexts?.[0].values.Pass).toBe('Contraseña');

      expect(en?.contexts?.[0].values.Age).not.toBeDefined();
      expect(es?.contexts?.[0].values.Age).not.toBeDefined();
      expect(en?.contexts?.[0].values.System).not.toBeDefined();
      expect(es?.contexts?.[0].values.System).not.toBeDefined();

      expect(en?.contexts?.[0].values.Name).toBe('Names');
      expect(es?.contexts?.[0].values.Name).toBe('Names');
    });
  });

  describe('addLanguage', () => {
    it('should clone translations of default language and change language to the one added', async () => {
      await translations.addLanguage('fr');
      const allTranslations = await translations.get();

      const frTranslation = allTranslations.find(t => t.locale === 'fr');
      const defaultTranslation = allTranslations.find(t => t.locale === 'en');

      expect(frTranslation?.contexts?.[0]._id?.toString()).not.toBe(
        defaultTranslation?.contexts?.[0]._id?.toString()
      );
      expect(frTranslation?.contexts?.[1]._id?.toString()).not.toBe(
        defaultTranslation?.contexts?.[1]._id?.toString()
      );
      expect(frTranslation?.contexts?.[2]._id?.toString()).not.toBe(
        defaultTranslation?.contexts?.[2]._id?.toString()
      );
      expect(frTranslation?.contexts?.[3]._id?.toString()).not.toBe(
        defaultTranslation?.contexts?.[3]._id?.toString()
      );
      expect(frTranslation?.contexts?.[4]._id?.toString()).not.toBe(
        defaultTranslation?.contexts?.[4]._id?.toString()
      );

      expect(frTranslation?.contexts?.[0].values).toEqual(defaultTranslation?.contexts?.[0].values);
      expect(frTranslation?.contexts?.[1].values).toEqual(defaultTranslation?.contexts?.[1].values);
    });

    describe('when translation already exists', () => {
      it('should not clone it again', async () => {
        await translations.addLanguage('fr');
        await translations.addLanguage('fr');
        const allTranslations = await translations.get();

        const frTranslations = allTranslations.filter(t => t.locale === 'fr');

        expect(frTranslations.length).toBe(1);
      });
    });
  });

  describe('removeLanguage', () => {
    it('should remove translation for the language passed', async () => {
      await translations.removeLanguage('es');
      await translations.removeLanguage('other');
      const allTranslations = await translations.get();

      expect(allTranslations.length).toBe(1);
      expect(allTranslations[0].locale).toBe('en');
    });
  });
});
