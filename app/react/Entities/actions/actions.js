import { actions } from 'app/BasicReducer';
import api from 'app/Entities/EntitiesAPI';
import {
  removeDocument,
  removeDocuments,
  unselectAllDocuments,
  unselectDocument,
} from 'app/Library/actions/libraryActions';
import { saveEntityWithFiles } from 'app/Library/actions/saveEntityWithFiles';
import { notificationActions } from 'app/Notifications';
import { actions as relationshipActions } from 'app/Relationships';
import { RequestParams } from 'app/utils/RequestParams';
import { actions as formActions } from 'react-redux-form';

export function saveEntity(entity) {
  return async dispatch => {
    const { entity: updatedDoc, errors } = await saveEntityWithFiles(entity, dispatch);
    if (!errors.length) {
      dispatch(notificationActions.notify('Entity saved', 'success'));
    } else {
      dispatch(
        notificationActions.notify(
          `Entity saved with the following errors: ${JSON.stringify(errors, null, 2)}`,
          'warning'
        )
      );
    }
    dispatch(formActions.reset('entityView.entityForm'));
    dispatch(actions.set('entityView/entity', updatedDoc));
    dispatch(relationshipActions.reloadRelationships(updatedDoc.sharedId));
  };
}

export function resetForm() {
  return dispatch => dispatch(formActions.reset('entityView.entityForm'));
}

export function deleteEntity(entity) {
  return async dispatch => {
    await api.delete(new RequestParams({ sharedId: entity.sharedId }));
    dispatch(notificationActions.notify('Entity deleted', 'success'));
    dispatch(removeDocument(entity));
    await dispatch(unselectDocument(entity._id));
  };
}

export function deleteEntities(entities) {
  return async dispatch => {
    await api.deleteMultiple(new RequestParams({ sharedIds: entities.map(e => e.sharedId) }));
    dispatch(notificationActions.notify('Deletion success', 'success'));
    await dispatch(unselectAllDocuments());
    dispatch(removeDocuments(entities));
  };
}
