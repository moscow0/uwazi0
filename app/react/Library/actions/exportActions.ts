import superagent from 'superagent';
import { toUrlParams } from 'shared/JSONRequest';
import { actions } from 'app/BasicReducer';
import { notify } from 'app/Notifications/actions/notificationsActions';
import { t } from 'app/I18N';
import { Dispatch } from 'redux';
import { IImmutable } from 'shared/types/Immutable';
import { CaptchaValue } from 'shared/types/Captcha';
import { EntitySchema } from 'shared/types/entityType';
import { processFilters } from './libraryActions';
import { ExportStore } from '../reducers/ExportStoreType';

export function triggerLocalDownload(content: string, fileName: string) {
  const url: string = window.URL.createObjectURL(new Blob([content]));
  const link: HTMLAnchorElement = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild<HTMLAnchorElement>(link);
}

function clearState(dispatch: Dispatch<any>) {
  dispatch(actions.set('exportSearchResultsProcessing', false));
  dispatch(actions.set('exportSearchResultsContent', ''));
  dispatch(actions.set('exportSearchResultsFileName', ''));
}

export function exportEnd() {
  return (dispatch: Dispatch<any>, getState: () => ExportStore) => {
    const { exportSearchResultsContent, exportSearchResultsFileName } =
      getState().exportSearchResults;

    triggerLocalDownload(exportSearchResultsContent, exportSearchResultsFileName);

    clearState(dispatch);
  };
}

function extractFileName(contentDisposition: string) {
  const startIndex = contentDisposition.indexOf('filename="') + 10;
  const endIndex = contentDisposition.length - 1;
  return contentDisposition.substring(startIndex, endIndex);
}

const requestHandler = (params: any, dispatch: Dispatch<any>, captcha?: CaptchaValue) => {
  let request = superagent
    .get(`/api/export${toUrlParams(params)}`)
    .set('Accept', 'text/csv')
    .set('X-Requested-With', 'XMLHttpRequest');

  if (captcha) {
    request = request.set('Captcha-text', captcha.text).set('Captcha-id', captcha.id);
  }

  request
    .then(response => {
      const fileName = extractFileName(response.header['content-disposition']);
      dispatch(actions.set('exportSearchResultsContent', response.text));
      dispatch(actions.set('exportSearchResultsFileName', fileName));
      dispatch(exportEnd());
    })
    .catch(err => {
      clearState(dispatch);
      if (err.status === 403) {
        dispatch(notify(t('System', 'Invalid captcha'), 'danger'));
      } else {
        dispatch(notify(t('System', 'An error has occured during data export'), 'danger'));
      }
      return err;
    });
};

export function exportDocuments(storeKey: string, captcha?: CaptchaValue) {
  return async (dispatch: Dispatch<any>, getState: any) => {
    const state = getState()[storeKey];
    const { search, filters } = state;
    const exportFilters = filters.toJS();

    const finalSearchParams = processFilters(search, exportFilters, 10000);
    finalSearchParams.searchTerm = state.search.searchTerm;

    if (state.ui.get('selectedDocuments').size) {
      finalSearchParams.ids = state.ui
        .get('selectedDocuments')
        .map((entity: IImmutable<EntitySchema>) => entity.get('sharedId'));
    }

    if (storeKey === 'uploads') finalSearchParams.unpublished = true;

    dispatch(actions.set('exportSearchResultsProcessing', true));

    requestHandler(finalSearchParams, dispatch, captcha);
  };
}
