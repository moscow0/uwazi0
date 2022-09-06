import { Field, LocalForm } from 'react-redux-form';
import { Translate } from 'app/I18N';
import { Icon } from 'UI';
import React from 'react';
import { FormGroup } from 'app/Forms';

interface WebMediaResourceFormProps {
  handleSubmit: (args: any) => void;
  dispatch?: (dispatch: Function) => void;
  url?: string | null;
  hasName?: boolean;
}

const WebMediaResourceForm = ({
  handleSubmit,
  url,
  dispatch,
  hasName = false,
}: WebMediaResourceFormProps) => {
  const validators = {
    ...(hasName && { name: { required: (val: any) => !!val && val.trim() !== '' } }),
    url: { required: (val: any) => !!val && val.trim() !== '' },
  };

  return (
    <LocalForm
      onSubmit={handleSubmit}
      getDispatch={dispatch}
      model="urlForm"
      validators={validators}
      initialState={{ url }}
      className={!hasName ? 'select-from-link' : ''}
    >
      <FormGroup className="has-feedback" model=".url">
        <Field model=".url">
          <input
            type="text"
            className="form-control web-attachment-url"
            placeholder="Paste URL here"
          />
        </Field>
      </FormGroup>
      {hasName && (
        <FormGroup className="form-group" model=".name">
          <Field model=".name" className="field">
            <input type="text" className="form-control web-attachment-name" placeholder="Title" />
          </Field>
        </FormGroup>
      )}
      <button type="submit" className="btn">
        <Icon icon="link" />
        &nbsp; <Translate>Add from URL</Translate>
      </button>
    </LocalForm>
  );
};

export { WebMediaResourceForm };
