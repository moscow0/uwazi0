/* eslint-disable import/exports-last */
import React from 'react';
import PropTypes from 'prop-types';
import { flattenDeep } from 'lodash';
import { t } from 'app/I18N';
import MarkdownViewer from 'app/Markdown';
import { GroupedGeolocationViewer } from 'app/Metadata/components/GroupedGeolocationViewer';
import GeolocationViewer from './GeolocationViewer';
import { RelationshipLink } from './RelationshipLink';
import ValueList from './ValueList';

const renderRelationshipLinks = (linksProp, compact) => {
  const formattedLinkValues = Array.isArray(linksProp.value) ? linksProp.value : [linksProp.value];
  const hydratedValues = formattedLinkValues.map(linkValue => ({
    value: <RelationshipLink propValue={linkValue} />,
  }));
  const hydratedProp = { ...linksProp, value: hydratedValues };
  return <ValueList compact={compact} property={hydratedProp} />;
};

export const showByType = (prop, compact, templateId) => {
  let result = prop.value;

  switch (prop.type) {
    case null:
      result = t('System', 'No property');
      break;
    case 'markdown':
      result = <MarkdownViewer html markdown={prop.value} />;
      break;
    case 'link':
      result = (
        <a href={prop.value.url} target="_blank" rel="noopener noreferrer">
          {prop.value.label ? prop.value.label : prop.value.url}
        </a>
      );
      break;
    case 'image':
      result = prop.value && (
        <img
          key={prop.value}
          className={`multimedia-img ${prop.style}`}
          src={prop.value}
          alt={prop.label}
        />
      );
      break;
    case 'media': {
      result = prop.value && <MarkdownViewer markdown={`{media}(${prop.value})`} compact />;
      break;
    }
    case 'geolocation':
      result = (
        <GeolocationViewer
          points={prop.value}
          onlyForCards={Boolean(prop.onlyForCards || compact)}
        />
      );
      break;
    case 'select':
      result = prop.parent ? `${prop.parent}: ${prop.value}` : result;
      break;
    case 'geolocation_group':
      result = <GroupedGeolocationViewer members={prop.members} templateId={templateId} />;
      break;
    case 'relationship':
      result = renderRelationshipLinks(prop, compact);
      break;
    default:
      if (prop.value && prop.value.map) {
        const propValue = flattenDeep(
          prop.value.map(_value =>
            _value.parent && Array.isArray(_value.value)
              ? flattenDeep(
                  _value.value.map(v => ({ ...v, value: `${_value.parent}: ${v.value}` }))
                )
              : _value
          )
        );

        // eslint-disable-next-line no-param-reassign
        prop.value = propValue.map(_value => {
          const value = showByType(_value, compact, templateId);
          return value && value.value
            ? value
            : { value, ...(_value.icon !== undefined ? { icon: _value.icon } : {}) };
        });
        result = <ValueList compact={compact} property={prop} />;
      }
      break;
  }

  return result;
};

const computeGroup = (metadata, startIndex) => {
  const members = [];
  let index = startIndex;
  let lastIndexInTemplate = metadata[index].indexInTemplate - 1;

  while (
    index < metadata.length &&
    metadata[index].type === 'geolocation' &&
    metadata[index].indexInTemplate === lastIndexInTemplate + 1
  ) {
    members.push(metadata[index]);
    lastIndexInTemplate = metadata[index].indexInTemplate;
    index += 1;
  }

  return [members, index];
};

const getNewGroupedGeolocationField = members => {
  if (members.length === 1) {
    return {
      type: 'geolocation_group',
      name: 'geolocation_group',
      label: members[0].label,
      translateContext: members[0].translateContext,
      members,
    };
  }

  return {
    type: 'geolocation_group',
    label: 'Combined geolocations',
    members,
  };
};

const groupAdjacentGeolocations = metadata => {
  const groupedMetadata = [];
  let index = 0;

  while (index < metadata.length) {
    if (metadata[index].type !== 'geolocation') {
      groupedMetadata.push(metadata[index]);
      index += 1;
    } else {
      const [members, i] = computeGroup(metadata, index);

      index = i;
      groupedMetadata.push(getNewGroupedGeolocationField(members));
    }
  }

  return groupedMetadata;
};

function filterProps(showSubset) {
  return p => {
    if (showSubset && !showSubset.includes(p.name)) {
      return false;
    }
    if (Array.isArray(p.value)) {
      return p.value.length;
    }
    return p.value || p.type === null || (p.type === 'numeric' && p.value === 0);
  };
}

const flattenInherittedRelationships = metadata =>
  metadata.map(property => {
    if (property.type === 'inherit' && property.inheritedType === 'relationship') {
      // eslint-disable-next-line no-param-reassign
      property.value = property.value.reduce(
        (flattenedValues, v) => flattenedValues.concat(v.value || []),
        []
      );
    }
    return property;
  });

const Metadata = ({
  metadata,
  compact,
  renderLabel,
  showSubset,
  highlight,
  groupGeolocations,
  templateId,
}) => {
  const filteredMetadata = metadata.filter(filterProps(showSubset));
  const flattenedMetadata = flattenInherittedRelationships(filteredMetadata);
  const groupedMetadata = groupGeolocations
    ? groupAdjacentGeolocations(flattenedMetadata)
    : flattenedMetadata;

  return (
    <>
      {groupedMetadata.map((prop, index) => {
        let type = prop.type ? prop.type : 'default';
        type = type === 'image' || type === 'media' ? 'multimedia' : type;
        const highlightClass = highlight.includes(prop.name) ? 'highlight' : '';
        const fullWidthClass = prop.fullWidth ? 'full-width' : '';

        return (
          <dl
            className={`metadata-type-${type} metadata-name-${prop.name} ${fullWidthClass} ${highlightClass}`}
            key={`${prop.name}_${index}`}
          >
            {renderLabel(prop, <dt>{t(prop.translateContext || 'System', prop.label)}</dt>)}
            <dd className={prop.sortedBy ? 'item-current-sort' : ''}>
              {showByType(prop, compact, templateId)}
            </dd>
          </dl>
        );
      })}
    </>
  );
};

Metadata.defaultProps = {
  compact: false,
  showSubset: undefined,
  renderLabel: (_prop, label) => label,
  highlight: [],
  groupGeolocations: false,
};

Metadata.propTypes = {
  metadata: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.string,
      label: PropTypes.string,
      value: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number,
        PropTypes.instanceOf(Object),
        PropTypes.arrayOf(PropTypes.string),
        PropTypes.arrayOf(
          PropTypes.shape({
            value: PropTypes.string,
          })
        ),
      ]),
    })
  ).isRequired,
  templateId: PropTypes.string,
  highlight: PropTypes.arrayOf(PropTypes.string),
  compact: PropTypes.bool,
  renderLabel: PropTypes.func,
  showSubset: PropTypes.arrayOf(PropTypes.string),
  groupGeolocations: PropTypes.bool,
};

export default Metadata;
