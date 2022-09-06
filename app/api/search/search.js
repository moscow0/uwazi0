/* eslint-disable max-lines */
import date from 'api/utils/date';
import propertiesHelper from 'shared/comonProperties';
import dictionariesModel from 'api/thesauri/dictionariesModel';
import { createError } from 'api/utils';
import { filterOptions } from 'shared/optionsUtils';
import { preloadOptionsLimit, preloadOptionsSearch } from 'shared/config';
import { permissionsContext } from 'api/permissions/permissionsContext';
import { checkWritePermissions } from 'shared/permissionsUtils';
import usersModel from 'api/users/users';
import userGroups from 'api/usergroups/userGroups';
import { propertyTypes } from 'shared/propertyTypes';
import { UserRole } from 'shared/types/userSchema';
import documentQueryBuilder from './documentQueryBuilder';
import { elastic } from './elastic';
import entitiesModel from '../entities/entitiesModel';
import templatesModel from '../templates';
import { bulkIndex, indexEntities, updateMapping } from './entitiesIndex';
import thesauri from '../thesauri';

function processParentThesauri(property, values, dictionaries, properties) {
  if (!values) {
    return values;
  }

  const sourceProperty =
    property.type === 'relationship' && property.inherit
      ? properties.find(p => p._id.toString() === property.inherit.property.toString())
      : property;

  if (!sourceProperty || !['select', 'multiselect'].includes(sourceProperty.type)) {
    return values;
  }

  const dictionary = dictionaries.find(d => d._id.toString() === sourceProperty.content.toString());
  return values.reduce((memo, v) => {
    const dictionaryValue = dictionary.values.find(dv => dv.id === v);

    if (!dictionaryValue || !dictionaryValue.values) {
      return [...memo, v];
    }

    return [...memo, ...dictionaryValue.values.map(dvv => dvv.id)];
  }, []);
}

function processFilters(filters, properties, dictionaries) {
  return Object.keys(filters || {}).reduce((res, filterName) => {
    const suggested = filterName.startsWith('__');
    const propertyName = suggested ? filterName.substring(2) : filterName;
    const property = properties.find(p => p.name === propertyName);

    if (!property) {
      return res;
    }

    let { type } = property;
    let value = filters[filterName];

    if (property.inherit) {
      ({ type } = propertiesHelper.getInheritedProperty(property, properties));
    }

    if (['multidaterange', 'daterange', 'date', 'multidate'].includes(type)) {
      value.from = date.descriptionToTimestamp(value.from);
      value.to = date.descriptionToTimestamp(value.to);
    }

    if (['text', 'markdown', 'generatedid'].includes(type) && typeof value === 'string') {
      value = value.toLowerCase();
    }

    if (['date', 'multidate', 'numeric'].includes(type)) {
      type = 'range';
    }

    if (['select', 'multiselect', 'relationship'].includes(type)) {
      type = 'multiselect';
      value.values = processParentThesauri(property, value.values, dictionaries, properties);
    }

    if (type === 'multidaterange' || type === 'daterange') {
      type = 'daterange';
    }

    return [
      ...res,
      {
        ...property,
        value,
        suggested,
        type,
        name: property.inherit ? `${property.name}.inheritedValue.value` : `${property.name}.value`,
      },
    ];
  }, []);
}

function aggregationProperties(propertiesToBeAggregated, allProperties) {
  return propertiesToBeAggregated
    .filter(property => {
      const type = property.inherit ? property.inherit.type : property.type;

      return (
        type === 'select' || type === 'multiselect' || type === 'relationship' || type === 'nested'
      );
    })
    .map(property => ({
      ...property,
      name: property.inherit ? `${property.name}.inheritedValue.value` : `${property.name}.value`,
      content: property.inherit
        ? propertiesHelper.getInheritedProperty(property, allProperties).content
        : property.content,
    }));
}

function metadataSnippetsFromSearchHit(hit) {
  const defaultSnippets = { count: 0, snippets: [] };
  if (hit.highlight) {
    const metadataHighlights = hit.highlight;
    const metadataSnippets = Object.keys(metadataHighlights).reduce((foundSnippets, field) => {
      const fieldSnippets = { field, texts: metadataHighlights[field] };
      return {
        count: foundSnippets.count + fieldSnippets.texts.length,
        snippets: [...foundSnippets.snippets, fieldSnippets],
      };
    }, defaultSnippets);
    return metadataSnippets;
  }
  return defaultSnippets;
}

function getSnippets() {
  return snippet => {
    const regex = /\[\[(\d+)\]\]/g;
    const matches = regex.exec(snippet);
    return {
      text: snippet.replace(regex, ''),
      page: matches ? Number(matches[1]) : 0,
    };
  };
}

function getHits(hit) {
  return hit.inner_hits &&
    hit.inner_hits.fullText.hits.hits &&
    hit.inner_hits.fullText.hits.hits.length > 0 &&
    hit.inner_hits.fullText.hits.hits[0].highlight
    ? hit.inner_hits.fullText.hits.hits
    : undefined;
}
function fullTextSnippetsFromSearchHit(hit) {
  const hits = getHits(hit);
  if (hits) {
    const fullTextHighlights = hits[0].highlight;
    const fullTextLanguageKey = Object.keys(fullTextHighlights)[0];
    return fullTextHighlights[fullTextLanguageKey].map(getSnippets());
  }
  return [];
}

function snippetsFromSearchHit(hit) {
  const snippets = {
    count: 0,
    metadata: [],
    fullText: [],
  };

  const metadataSnippets = metadataSnippetsFromSearchHit(hit);
  const fullTextSnippets = fullTextSnippetsFromSearchHit(hit);
  snippets.count = metadataSnippets.count + fullTextSnippets.length;
  snippets.metadata = metadataSnippets.snippets;
  snippets.fullText = fullTextSnippets;

  return snippets;
}

function searchGeolocation(documentsQuery, templates) {
  documentsQuery.limit(9999);
  documentsQuery.from(0);
  const geolocationProperties = [];

  templates.forEach(template => {
    template.properties.forEach(prop => {
      if (prop.type === 'geolocation') {
        geolocationProperties.push(`${prop.name}`);
      }

      if (prop.type === 'relationship' && prop.inherit) {
        const contentTemplate = templates.find(t => t._id.toString() === prop.content.toString());
        const inheritedProperty = propertiesHelper.getInheritedProperty(
          prop,
          contentTemplate.properties
        );
        if (inheritedProperty?.type === 'geolocation') {
          geolocationProperties.push(`${prop.name}`);
        }
      }
    });
  });

  documentsQuery.hasMetadataProperties(geolocationProperties);

  const selectProps = geolocationProperties
    .map(p => `metadata.${p}`)
    .concat(['title', 'template', 'sharedId', 'language']);

  documentsQuery.select(selectProps);
}

const _sanitizeAgregationNames = aggregations =>
  Object.keys(aggregations).reduce((allAggregations, key) => {
    const sanitizedKey = key.replace('.inheritedValue.value', '').replace('.value', '');
    return Object.assign(allAggregations, { [sanitizedKey]: aggregations[key] });
  }, {});

const indexedDictionaryValues = dictionary =>
  dictionary.values
    .reduce((values, v) => {
      if (v.values) {
        return values.concat(v.values, [v]);
      }
      values.push(v);
      return values;
    }, [])
    .reduce((v, value) => {
      // eslint-disable-next-line no-param-reassign
      v[value.id] = value;
      return v;
    }, {});

const _getAggregationDictionary = async (aggregation, language, property, dictionaries) => {
  if (property.type === 'relationship') {
    const entitiesSharedId = aggregation.buckets.map(bucket => bucket.key);

    const bucketEntities = await entitiesModel.getUnrestricted(
      {
        sharedId: { $in: entitiesSharedId },
        language,
      },
      {
        sharedId: 1,
        title: 1,
        icon: 1,
      }
    );

    const dictionary = thesauri.entitiesToThesauri(bucketEntities);
    return [dictionary, indexedDictionaryValues(dictionary)];
  }

  const dictionary = dictionaries.find(d => d._id.toString() === property.content.toString());
  return [dictionary, indexedDictionaryValues(dictionary)];
};

const _formatDictionaryWithGroupsAggregation = (aggregation, dictionary) => {
  const buckets = dictionary.values
    .map(dictionaryValue => {
      const bucket = aggregation.buckets.find(b => b.key === dictionaryValue.id);
      if (bucket && dictionaryValue.values) {
        bucket.values = dictionaryValue.values
          .map(v => aggregation.buckets.find(b => b.key === v.id))
          .filter(b => b);
      }
      return bucket;
    })
    .filter(b => b);
  const bucketsIncludeMissing = aggregation.buckets.find(b => b.key === 'missing');
  if (bucketsIncludeMissing) {
    buckets.push(bucketsIncludeMissing);
  }
  return Object.assign(aggregation, { buckets });
};

const _denormalizeAggregations = async (aggregations, templates, dictionaries, language) => {
  const properties = propertiesHelper.allProperties(templates);
  return Object.keys(aggregations).reduce(async (denormaLizedAgregationsPromise, key) => {
    const denormaLizedAgregations = await denormaLizedAgregationsPromise;
    if (
      !aggregations[key].buckets ||
      aggregations[key].type === 'nested' ||
      ['_types', 'generatedToc', '_permissions.self', '_published'].includes(key)
    ) {
      return Object.assign(denormaLizedAgregations, { [key]: aggregations[key] });
    }

    if (['_permissions.read', '_permissions.write'].includes(key)) {
      const [users, groups] = await Promise.all([usersModel.get(), userGroups.get()]);

      const info = [
        ...users.map(u => ({ type: 'user', refId: u._id, label: u.username })),
        ...groups.map(g => ({ type: 'group', refId: g._id, label: g.name })),
      ];

      const role = permissionsContext.getUserInContext()?.role;
      const refIds = permissionsContext.permissionsRefIds();

      const buckets = aggregations[key].buckets
        .filter(bucket => role === UserRole.ADMIN || refIds.includes(bucket.key))
        .map(bucket => {
          const itemInfo = info.find(i => i.refId.toString() === bucket.key);

          if (!itemInfo) return null;

          return {
            ...bucket,
            label: itemInfo.label,
            ...(itemInfo.type === 'group' ? { icon: 'users' } : {}),
          };
        })
        .filter(b => b);

      return Object.assign(denormaLizedAgregations, { [key]: { ...aggregations[key], buckets } });
    }

    let property = properties.find(prop => prop.name === key || `__${prop.name}` === key);

    if (property.inherit) {
      property = propertiesHelper.getInheritedProperty(property, properties);
    }

    const [dictionary, dictionaryValues] = await _getAggregationDictionary(
      aggregations[key],
      language,
      property,
      dictionaries
    );

    const buckets = aggregations[key].buckets
      .map(bucket => {
        const labelItem =
          bucket.key === 'missing' ? { label: 'No label' } : dictionaryValues[bucket.key];

        if (labelItem) {
          const { label, icon } = labelItem;
          return Object.assign(bucket, { label, icon });
        }
        return null;
      })
      .filter(item => item);

    let denormalizedAggregation = Object.assign(aggregations[key], { buckets });

    if (dictionary && dictionary.values.find(v => v.values)) {
      denormalizedAggregation = _formatDictionaryWithGroupsAggregation(
        denormalizedAggregation,
        dictionary
      );
    }
    return Object.assign(denormaLizedAgregations, { [key]: denormalizedAggregation });
  }, {});
};

const _sanitizeAggregationsStructure = (aggregations, limit) => {
  const result = {};
  Object.keys(aggregations).forEach(aggregationKey => {
    const aggregation = aggregations[aggregationKey];

    //grouped dictionary
    if (aggregation.buckets && !Array.isArray(aggregation.buckets)) {
      aggregation.buckets = Object.keys(aggregation.buckets).map(key => ({
        key,
        ...aggregation.buckets[key],
      }));
    }

    //permissions
    if (['_permissions.read', '_permissions.write', '_permissions.self'].includes(aggregationKey)) {
      aggregation.buckets = aggregation.nestedPermissions.filtered.buckets.map(b => ({
        key: b.key,
        filtered: { doc_count: b.filteredByUser.uniqueEntities.doc_count },
      }));
    }

    //published
    if (aggregationKey === '_published') {
      aggregation.buckets = aggregation.filtered.buckets.map(b => ({
        key: b.key,
        filtered: { doc_count: b.doc_count },
      }));
    }

    //nested
    if (!aggregation.buckets) {
      Object.keys(aggregation).forEach(key => {
        if (aggregation[key].buckets) {
          const buckets = aggregation[key].buckets.map(option => ({
            key: option.key,
            ...option.filtered.total,
          }));
          result[key] = {
            type: 'nested',
            doc_count: aggregation[key].doc_count,
            buckets,
          };
        }
      });
    }

    if (aggregation.buckets) {
      aggregation.buckets = aggregation.buckets.filter(b => b.filtered.doc_count);
      const missingBucket = aggregation.buckets.find(b => b.key === 'missing');

      aggregation.count = aggregation.buckets.length;
      aggregation.buckets = aggregation.buckets.slice(0, limit);

      const bucketsIncludeMissing = aggregation.buckets.find(b => b.key === 'missing');
      if (!bucketsIncludeMissing && missingBucket) {
        aggregation.buckets = aggregation.buckets.slice(0, limit - 1);
        aggregation.buckets.push(missingBucket);
      }
    }

    result[aggregationKey] = aggregation;
  });

  return result;
};

const _addAnyAggregation = (aggregations, filters, response) => {
  const result = {};
  Object.keys(aggregations).map(aggregationKey => {
    const aggregation = aggregations[aggregationKey];

    if (aggregation.buckets && aggregationKey !== '_types') {
      const missingBucket = aggregation.buckets.find(b => b.key === 'missing');
      const keyFilters = ((filters || {})[aggregationKey.replace('.value', '')] || {}).values || [];
      const filterNoneOrMissing =
        !keyFilters.filter(v => v !== 'any').length || keyFilters.find(v => v === 'missing');

      const anyCount =
        (typeof response.body.hits.total === 'object'
          ? response.body.hits.total.value
          : response.body.hits.total) -
        (missingBucket && filterNoneOrMissing ? missingBucket.filtered.doc_count : 0);

      aggregation.buckets.push({
        key: 'any',
        doc_count: anyCount,
        label: 'Any',
        filtered: { doc_count: anyCount },
      });
      aggregation.count += 1;
    }

    result[aggregationKey] = aggregation;
  });

  return result;
};

const _sanitizeAggregations = async (
  aggregations,
  templates,
  dictionaries,
  language,
  limit = preloadOptionsLimit
) => {
  const sanitizedAggregations = _sanitizeAggregationsStructure(aggregations, limit);
  const sanitizedAggregationNames = _sanitizeAgregationNames(sanitizedAggregations);
  return _denormalizeAggregations(sanitizedAggregationNames, templates, dictionaries, language);
};

const permissionsInformation = (hit, user) => {
  const { permissions } = hit._source;

  const canWrite = checkWritePermissions(user, permissions);

  return canWrite ? permissions : undefined;
};

const processResponse = async (response, templates, dictionaries, language, filters) => {
  const user = permissionsContext.getUserInContext();
  const rows = response.body.hits.hits.map(hit => {
    const result = hit._source;
    result._explanation = hit._explanation;
    result.snippets = snippetsFromSearchHit(hit);
    result._id = hit._id;
    result.permissions = permissionsInformation(hit, user);
    return result;
  });
  const sanitizedAggregations = await _sanitizeAggregations(
    response.body.aggregations.all,
    templates,
    dictionaries,
    language
  );

  const aggregationsWithAny = _addAnyAggregation(sanitizedAggregations, filters, response);

  return {
    rows,
    totalRows: response.body.hits.total.value,
    relation: response.body.hits.total.relation,
    aggregations: { all: aggregationsWithAny },
  };
};

const entityHasGeolocation = entity =>
  entity.metadata &&
  !!Object.keys(entity.metadata)
    .filter(field => entity.metadata[field])
    .find(field => {
      if (/_geolocation/.test(field) && entity.metadata[field].length) {
        return true;
      }
      if (Array.isArray(entity.metadata[field])) {
        return !!entity.metadata[field].find(
          f => f.inherit_geolocation && f.inherit_geolocation.length
        );
      }
      return false;
    });

const processGeolocationResults = _results => {
  const results = _results;
  results.rows = results.rows
    .filter(r => r.metadata)
    .map(_row => ({
      ..._row,
      metadata: Object.fromEntries(
        Object.entries(_row.metadata).map(([key, values]) => [
          key,
          values.map(_v => {
            const newValue = { ..._v };
            if (_v.inheritedType === propertyTypes.geolocation) {
              newValue.inherit_geolocation = (_v.inheritedValue || []).filter(iv => iv.value);
            }
            return newValue;
          }),
        ])
      ),
    }))
    .filter(r => r.metadata && Object.keys(r.metadata).length && entityHasGeolocation(r));
  results.totalRows = results.rows.length;
  return results;
};

const _getTextFields = (query, templates) =>
  query.fields ||
  propertiesHelper
    .allUniqueProperties(templates)
    .map(prop =>
      ['text', 'markdown', 'generatedid'].includes(prop.type)
        ? `metadata.${prop.name}.value`
        : `metadata.${prop.name}.label`
    )
    .concat(['title', 'fullText']);

async function searchTypeFromSearchTermValidity(searchTerm) {
  const validationResult = await elastic.indices.validateQuery({
    body: { query: { query_string: { query: searchTerm } } },
  });
  return validationResult.body.valid ? 'query_string' : 'simple_query_string';
}

const buildQuery = async (query, language, user, resources, includeReviewAggregations) => {
  const [templates, dictionaries] = resources;
  const textFieldsToSearch = _getTextFields(query, templates);
  const searchTextType = query.searchTerm
    ? await searchTypeFromSearchTermValidity(query.searchTerm)
    : 'query_string';
  const onlyPublished = query.published || !(query.includeUnpublished || query.unpublished);
  const queryBuilder = documentQueryBuilder()
    .include(query.include)
    .fullTextSearch(query.searchTerm, textFieldsToSearch, 2, searchTextType)
    .filterByTemplate(query.types)
    .filterById(query.ids)
    .language(language)
    .filterByPermissions(onlyPublished);

  if (Number.isInteger(parseInt(query.from, 10))) {
    queryBuilder.from(query.from);
  }

  if (Number.isInteger(parseInt(query.limit, 10))) {
    queryBuilder.limit(query.limit);
  }

  if (query.includeUnpublished && user && !query.unpublished) {
    queryBuilder.includeUnpublished();
  }

  if (query.unpublished && user) {
    queryBuilder.onlyUnpublished();
  }

  const allProps = propertiesHelper.allProperties(templates);
  if (query.sort) {
    const sortingProp = allProps.find(p =>
      [`metadata.${p.name}`, `metadata.${p.name}.inheritedValue`].includes(query.sort)
    );
    const sortByLabel =
      sortingProp &&
      (sortingProp.type === 'select' ||
        (sortingProp.inherit && sortingProp.inherit.type === 'select'));
    queryBuilder.sort(query.sort, query.order, sortByLabel);
  }

  const allTemplates = templates.map(t => t._id);
  const filteringTypes = query.types && query.types.length ? query.types : allTemplates;
  let properties =
    !query.types || !query.types.length
      ? propertiesHelper.defaultFilters(templates)
      : propertiesHelper.comonFilters(templates, filteringTypes);

  if (query.allAggregations) {
    properties = allProps;
  }

  // this is where we decide which aggregations to send to elastic
  const aggregations = aggregationProperties(properties, allProps);

  const filters = processFilters(query.filters, [...allProps, ...properties], dictionaries);
  // this is where the query filters are built
  queryBuilder.filterMetadata(filters);
  queryBuilder.customFilters(query.customFilters);
  // this is where the query aggregations are built
  queryBuilder.aggregations(aggregations, dictionaries, includeReviewAggregations);

  return queryBuilder;
};

const search = {
  async search(query, language, user) {
    const resources = await Promise.all([templatesModel.get(), dictionariesModel.get()]);
    const [templates, dictionaries] = resources;
    const includeReviewAggregations = query.includeReviewAggregations || false;
    const queryBuilder = await buildQuery(
      query,
      language,
      user,
      resources,
      includeReviewAggregations
    );
    if (query.geolocation) {
      searchGeolocation(queryBuilder, templates);
    }

    if (query.aggregatePermissionsByLevel) {
      queryBuilder.permissionsLevelAgreggations();
    }

    if (query.aggregatePermissionsByUsers) {
      queryBuilder.permissionsUsersAgreggations();
    }

    if (query.aggregateGeneratedToc) {
      queryBuilder.generatedTocAggregations();
    }

    if (query.aggregatePublishingStatus) {
      queryBuilder.publishingStatusAggregations();
    }

    return elastic
      .search({ body: queryBuilder.query() })
      .then(response => processResponse(response, templates, dictionaries, language, query.filters))
      .catch(e => {
        throw createError(e, 400);
      });
  },

  async searchGeolocations(query, language, user) {
    let results = await this.search({ ...query, geolocation: true }, language, user);

    if (results.rows.length) {
      results = processGeolocationResults(results);
    }

    return results;
  },

  async searchSnippets(searchTerm, sharedId, language, user) {
    const templates = await templatesModel.get();

    const searchTextType = searchTerm
      ? await searchTypeFromSearchTermValidity(searchTerm)
      : 'query_string';
    const searchFields = propertiesHelper
      .textFields(templates)
      .map(prop => `metadata.${prop.name}.value`)
      .concat(['title', 'fullText']);
    const query = documentQueryBuilder()
      .fullTextSearch(searchTerm, searchFields, 9999, searchTextType)
      .filterById(sharedId)
      .language(language);

    if (user) {
      query.includeUnpublished();
    }

    const response = await elastic.search({
      body: query.query(),
    });

    if (response.body.hits.hits.length === 0) {
      return {
        count: 0,
        metadata: [],
        fullText: [],
      };
    }
    return snippetsFromSearchHit(response.body.hits.hits[0]);
  },

  async indexEntities(query, select = '', limit = 50, batchCallback = () => {}) {
    return indexEntities({
      query,
      select,
      limit,
      batchCallback,
      searchInstance: this,
    });
  },

  async bulkIndex(docs, action = 'index') {
    return bulkIndex(docs, action);
  },

  bulkDelete(docs) {
    const body = docs.map(doc => ({
      delete: { _id: doc._id },
    }));
    return elastic.bulk({ body });
  },

  delete(entity) {
    const id = entity._id.toString();
    return elastic.delete({ id });
  },

  deleteLanguage(language) {
    const query = { query: { match: { language } } };
    return elastic.deleteByQuery({ body: query });
  },

  async autocompleteAggregations(query, language, propertyName, searchTerm, user) {
    const [templates, dictionaries] = await Promise.all([
      templatesModel.get(),
      dictionariesModel.get(),
    ]);

    const queryBuilder = await buildQuery({ ...query, limit: 0 }, language, user, [
      templates,
      dictionaries,
    ]);

    const property = propertiesHelper
      .allUniqueProperties(templates)
      .find(p => p.name === propertyName);

    queryBuilder
      .resetAggregations()
      .aggregations([{ ...property, name: `${propertyName}.value` }], dictionaries);

    const body = queryBuilder.query();

    const aggregation = body.aggregations.all.aggregations[`${propertyName}.value`];

    aggregation.aggregations.filtered.filter.bool.filter.push({
      wildcard: { [`metadata.${propertyName}.label`]: { value: `*${searchTerm.toLowerCase()}*` } },
    });

    const response = await elastic.search({
      body,
    });

    const sanitizedAggregations = await _sanitizeAggregations(
      response.body.aggregations.all,
      templates,
      dictionaries,
      language,
      preloadOptionsSearch
    );

    const options = sanitizedAggregations[propertyName].buckets
      .map(bucket => ({
        label: bucket.label,
        value: bucket.key,
        icon: bucket.icon,
        results: bucket.filtered.doc_count,
      }))
      .filter(o => o.results);

    const filteredOptions = filterOptions(searchTerm, options);

    return {
      options: filteredOptions.slice(0, preloadOptionsLimit),
      count: filteredOptions.length,
    };
  },

  async autocomplete(searchTerm, language, templates = []) {
    const queryBuilder = documentQueryBuilder()
      .include(['title', 'template', 'sharedId', 'icon'])
      .language(language)
      .limit(preloadOptionsSearch)
      .filterByPermissions()
      .includeUnpublished();

    if (templates.length) {
      queryBuilder.filterByTemplate(templates);
    }

    const body = queryBuilder.query();

    body.query.bool.must = [
      {
        multi_match: {
          query: searchTerm,
          type: 'bool_prefix',
          fields: ['title.sayt', 'title.sayt._2gram', 'title.sayt._3gram', 'title.sayt_ngram'],
        },
      },
    ];

    delete body.aggregations;

    const response = await elastic.search({ body });

    const options = response.body.hits.hits.slice(0, preloadOptionsLimit).map(hit => ({
      value: hit._source.sharedId,
      label: hit._source.title,
      template: hit._source.template,
      icon: hit._source.icon,
    }));

    return { count: response.body.hits.hits.length, options };
  },

  async updateTemplatesMapping() {
    const templates = await templatesModel.get();
    return updateMapping(templates);
  },

  async countPerTemplate(language) {
    const queryBuilder = documentQueryBuilder().language(language).includeUnpublished().limit(0);

    return (
      await elastic.search({ body: queryBuilder.query() })
    ).body.aggregations.all._types.buckets.reduce((map, bucket) => {
      // eslint-disable-next-line no-param-reassign
      map[bucket.key] = bucket.filtered.doc_count;
      return map;
    }, {});
  },
};

export { search };
