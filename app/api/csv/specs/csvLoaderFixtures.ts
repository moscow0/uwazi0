import db from 'api/utils/testing_db';
import { propertyTypes } from 'shared/propertyTypes';
import { templateUtils } from 'api/templates';

const template1Id = db.id();
const multiSelectThesaurusId = db.id();
const thesauri1Id = db.id();
const templateToRelateId = db.id();
const templateWithGeneratedTitle = db.id();

const commonTranslationContexts = [
  {
    id: 'System',
    label: 'System',
    values: [
      { key: 'original 1', value: 'original 1' },
      { key: 'original 2', value: 'original 2' },
      { key: 'original 3', value: 'original 3' },
    ],
  },
  {
    id: thesauri1Id.toString(),
    label: 'thesauri1',
    values: [{ key: 'thesauri1', value: 'thesauri1' }],
    type: 'Dictionary',
  },
  {
    id: multiSelectThesaurusId.toString(),
    label: 'multi_select_thesaurus',
    values: [
      { key: 'multi_select_thesaurus', value: 'multi_select_thesaurus' },
      { key: 'multivalue1', value: 'multivalue1' },
    ],
    type: 'Dictionary',
  },
];

export default {
  templates: [
    {
      _id: templateToRelateId,
      name: 'template to relate',
      properties: [],
    },
    {
      _id: template1Id,
      name: 'base template',
      properties: [
        {
          type: propertyTypes.text,
          label: 'text label',
          name: templateUtils.safeName('text label'),
        },
        {
          type: propertyTypes.numeric,
          label: 'numeric label',
          name: templateUtils.safeName('numeric label'),
        },
        {
          type: propertyTypes.select,
          label: 'Select Label',
          name: templateUtils.safeName('select label'),
          content: thesauri1Id.toString(),
        },
        {
          type: 'non_defined_type',
          label: 'not defined type',
          name: templateUtils.safeName('not defined type'),
        },
        {
          type: propertyTypes.text,
          label: 'not configured on csv',
          name: templateUtils.safeName('not configured on csv'),
        },
        {
          type: propertyTypes.geolocation,
          label: 'geolocation',
          name: templateUtils.safeName('geolocation_geolocation'),
        },
        {
          type: propertyTypes.generatedid,
          label: 'Auto ID',
          name: templateUtils.safeName('auto id'),
        },
        {
          _id: db.id(),
          type: propertyTypes.text,
          label: 'additional tag(s)',
          name: templateUtils.safeName('additional tag(s)', true),
        },
        {
          type: propertyTypes.multiselect,
          label: 'Multi Select Label',
          name: templateUtils.safeName('multi_select_label'),
          content: multiSelectThesaurusId.toString(),
        },
        {
          type: propertyTypes.date,
          label: 'Date label',
          name: templateUtils.safeName('Date label'),
        },
      ],
    },
    {
      _id: templateWithGeneratedTitle,
      name: 'template with generated title',
      commonProperties: [{ name: 'title', label: 'Title', type: 'text', generatedId: true }],
      properties: [
        {
          type: propertyTypes.numeric,
          label: 'numeric label',
          name: templateUtils.safeName('numeric label'),
        },
      ],
    },
  ],

  dictionaries: [
    {
      _id: thesauri1Id,
      name: 'thesauri1',
      values: [
        {
          label: ' value4 ',
          id: db.id().toString(),
        },
      ],
    },
    {
      _id: multiSelectThesaurusId,
      name: 'multi_select_thesaurus',
      values: [
        {
          label: 'multivalue1',
          id: db.id().toString(),
        },
      ],
    },
  ],

  settings: [
    {
      _id: db.id(),
      site_name: 'Uwazi',
      languages: [
        { key: 'en', label: 'English', default: true },
        { key: 'es', label: 'Spanish' },
        { key: 'fr', label: 'French' },
      ],
      newNameGeneration: true,
      dateFormat: 'dd/MM/yyyy',
    },
  ],

  translations: [
    {
      _id: db.id(),
      locale: 'en',
      contexts: commonTranslationContexts,
    },
    {
      _id: db.id(),
      locale: 'es',
      contexts: commonTranslationContexts,
    },
    {
      _id: db.id(),
      locale: 'fr',
      contexts: commonTranslationContexts,
    },
  ],
};

export { template1Id, templateWithGeneratedTitle, thesauri1Id };
