import React from 'react';
import SelectFilter from 'app/Library/components/SelectFilter';
import FormGroup from 'app/DocumentForm/components/FormGroup';
import { Aggregations } from 'shared/types/aggregations';
import { NeedAuthorization } from 'app/Auth';
import { Translate } from 'app/I18N';
import { Icon } from 'app/UI';

export interface PublishedFiltersProps {
  onChange: () => void;
  aggregations: Aggregations;
}

const filteredAggregation = (aggregations: Aggregations, key: string) =>
  (
    (aggregations?.all?._published?.buckets || []).find(a => a.key === key) || {
      filtered: { doc_count: 0 },
    }
  ).filtered.doc_count || 0;

const generateOptions = (aggregations: Aggregations) => [
  {
    label: (
      <>
        <Icon icon="globe-africa" />
        &nbsp;
        <Translate>Published</Translate>
      </>
    ),
    title: 'Published',
    value: 'published',
    results: filteredAggregation(aggregations, 'true'),
  },
  {
    label: (
      <>
        <Icon icon="lock" />
        &nbsp;
        <Translate>Restricted</Translate>
      </>
    ),
    title: 'Restricted',
    value: 'restricted',
    results: filteredAggregation(aggregations, 'false'),
  },
];

export const PublishedFilters = ({ onChange, aggregations }: PublishedFiltersProps) => {
  const options = generateOptions(aggregations);
  const totalAggs = options.reduce((total, o) => total + o.results, 0);
  if (totalAggs === 0) {
    return null;
  }
  return (
    <NeedAuthorization roles={['admin', 'editor', 'collaborator']}>
      <FormGroup key="publishedStatus" className="admin-filter">
        <SelectFilter
          model=".publishedStatus"
          prefix="publishedStatus"
          onChange={onChange}
          options={options}
          showBoolSwitch={false}
        />
      </FormGroup>
    </NeedAuthorization>
  );
};
