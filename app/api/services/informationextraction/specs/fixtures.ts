import { DBFixture } from 'api/utils/testing_db';
import { getFixturesFactory } from 'api/utils/fixturesFactory';

const factory = getFixturesFactory();

const settings = [
  {
    languages: [{ default: true, label: 'English', key: 'en' }],
    features: {
      metadataExtraction: {
        url: 'http://localhost:1234/',
        templates: [
          {
            template: factory.id('templateToSegmentA'),
            properties: ['property1', 'property2', 'property3', 'property4'],
          },
          {
            template: factory.id('templateToSegmentB'),
            properties: ['property1'],
          },
        ],
      },
      segmentation: {
        url: 'http://localhost:1234/files',
      },
    },
  },
];

const fixturesPdfNameA = 'documentA.pdf';
const fixturesPdfNameB = 'documentB.pdf';
const fixturesPdfNameC = 'documentC.pdf';
const fixturesPdfNameD = 'documentD.pdf';
const fixturesPdfNameE = 'documentE.pdf';
const fixturesPdfNameF = 'documentF.pdf';

const fixtures: DBFixture = {
  settings,
  entities: [
    factory.entity('A1', 'templateToSegmentA', {
      property1: [
        {
          value: 1088985600,
        },
      ],
    }),
    factory.entity('A2', 'templateToSegmentA'),
    factory.entity('A3', 'templateToSegmentA'),
    factory.entity('A4', 'templateToSegmentA'),
    factory.entity('A5', 'templateToSegmentA'),
    factory.entity('A6', 'templateToSegmentA'),
    factory.entity('A7', 'templateToSegmentA'),
    factory.entity('A8', 'templateToSegmentA'),
    factory.entity('A9', 'templateToSegmentA'),
    factory.entity('A10', 'templateToSegmentA'),
    factory.entity('A11', 'templateToSegmentA'),
    factory.entity('A12', 'templateToSegmentA'),
    factory.entity('A13', 'templateToSegmentA'),
    factory.entity('A14', 'templateToSegmentA'),
  ],
  files: [
    factory.file('F1', 'A1', 'document', fixturesPdfNameA, 'other', '', [
      {
        name: 'property1',
        selection: {
          text: 'something',
          selectionRectangles: [{ top: 0, left: 0, width: 0, height: 0, page: '1' }],
        },
      },
    ]),
    factory.file('F2', 'A2', 'document', fixturesPdfNameB, 'eng', '', [
      {
        name: 'text',
        selection: {
          text: 'property1',
          selectionRectangles: [{ top: 0, left: 0, width: 0, height: 0, page: '1' }],
        },
      },
    ]),
    factory.file('F3', 'A3', 'document', fixturesPdfNameC, 'eng', '', [
      {
        name: 'property1',
        selection: {
          text: 'something',
          selectionRectangles: [{ top: 0, left: 0, width: 0, height: 0, page: '1' }],
        },
      },
    ]),
    factory.file('F4', 'A1', 'document', fixturesPdfNameD, 'eng', '', [
      {
        name: 'property2',
        selection: {
          text: 'something',
          selectionRectangles: [{ top: 0, left: 0, width: 0, height: 0, page: '1' }],
        },
      },
    ]),
    factory.file('F5', 'A5', 'document', fixturesPdfNameE, 'spa'),
    factory.file('F6', 'A6', 'document', fixturesPdfNameF, 'eng'),
  ],
  segmentations: [
    {
      _id: factory.id('S1'),
      filename: fixturesPdfNameA,
      xmlname: 'documentA.xml',
      fileID: factory.id('F1'),
      status: 'ready',
      segmentation: {
        page_height: 841,
        page_width: 595,
        paragraphs: [
          {
            left: 58,
            top: 63,
            width: 457,
            height: 15,
            page_number: 1,
            text: 'something something',
          },
        ],
      },
    },
    {
      _id: factory.id('S2'),
      filename: fixturesPdfNameB,
      xmlname: 'documentB.xml',
      fileID: factory.id('F2'),
      status: 'ready',
      segmentation: { page_height: 1, page_width: 2, paragraphs: [] },
    },
    {
      _id: factory.id('S3'),
      filename: fixturesPdfNameC,
      xmlname: 'documentC.xml',
      fileID: factory.id('F3'),
      status: 'ready',
      segmentation: { page_height: 1, page_width: 2, paragraphs: [] },
    },
    {
      _id: factory.id('S4'),
      filename: fixturesPdfNameD,
      xmlname: 'documentD.xml',
      fileID: factory.id('F4'),
      status: 'ready',
      segmentation: { page_height: 1, page_width: 2, paragraphs: [] },
    },
    {
      _id: factory.id('S5'),
      filename: fixturesPdfNameE,
      xmlname: 'documentE.xml',
      fileID: factory.id('F5'),
      status: 'ready',
      segmentation: { page_height: 1, page_width: 2, paragraphs: [] },
    },
    {
      _id: factory.id('S6'),
      filename: fixturesPdfNameF,
      xmlname: 'documentF.xml',
      fileID: factory.id('F6'),
      status: 'processing',
    },
  ],
  ixsuggestions: [
    {
      fileId: factory.id('F1'),
      entityId: 'A1',
      language: 'en',
      propertyName: 'property1',
      suggestedValue: 'suggestion_text_1',
      segment: 'segment_text_1',
      status: 'ready',
      page: 1,
      date: 100,
    },
  ],
  ixmodels: [
    { propertyName: 'property1', creationDate: 200, status: 'ready' },
    { propertyName: 'property4', creationDate: 200, status: 'ready' },
    { propertyName: 'property2', creationDate: 200, status: 'ready' },
  ],
  templates: [
    factory.template('templateToSegmentA', [
      factory.property('property1', 'text'),
      factory.property('property2', 'date'),
      factory.property('property3', 'numeric'),
      factory.property('property4', 'markdown'),
    ]),
    factory.template('templateToSegmentB', [factory.property('property1', 'text')]),
  ],
};

export { fixtures, factory };
