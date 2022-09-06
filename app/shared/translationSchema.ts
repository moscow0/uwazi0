import Ajv from 'ajv';
import { objectIdSchema } from 'shared/types/commonSchemas';
import { wrapValidator } from 'shared/tsUtils';
import { TranslationType } from './translationType';

const emitSchemaTypes = true;

const ajv = new Ajv({ allErrors: true, removeAdditional: true });
ajv.addVocabulary(['tsType']);

const translationValueSchema = {
  title: 'TranslationValue',
  type: 'object',
  additionalProperties: false,
  definitions: { objectIdSchema },
  properties: {
    _id: objectIdSchema,
    key: { type: 'string', minLength: 1 },
    value: { type: 'string', minLength: 1 },
  },
};

const translationContextSchema = {
  title: 'TranslationContext',
  type: 'object',
  additionalProperties: false,
  definitions: { objectIdSchema, translationValueSchema },
  properties: {
    _id: objectIdSchema,
    id: { type: 'string', minLength: 1 },
    label: { type: 'string', minLength: 1 },
    type: { type: 'string', minLength: 1 },
    values: {
      type: 'array',
      items: translationValueSchema,
    },
  },
};

const translationSchema = {
  $schema: 'http://json-schema.org/schema#',
  $async: true,
  type: 'object',
  additionalProperties: false,
  title: 'TranslationType',
  definitions: { objectIdSchema, translationContextSchema },
  properties: {
    _id: objectIdSchema,
    locale: { type: 'string', minLength: 1 },
    contexts: {
      type: 'array',
      items: translationContextSchema,
    },
  },
};

const validate = wrapValidator(ajv.compile(translationSchema));

export const validateTranslation = async (translation: TranslationType): Promise<TranslationType> =>
  validate({ ...translation });

export { emitSchemaTypes, translationValueSchema, translationContextSchema, translationSchema };
