import React from 'react';
import { Helmet } from 'react-helmet';
import RouteHandler from 'app/App/RouteHandler';
import { actions } from 'app/BasicReducer';
import { I18NApi, t } from 'app/I18N';
import api from 'app/Search/SearchAPI';
import TemplatesAPI from 'app/Templates/TemplatesAPI';
import ThesauriAPI from 'app/Thesauri/ThesauriAPI';
import UsersAPI from 'app/Users/UsersAPI';
import { resolveTemplateProp } from 'app/Settings/utils/resolveProperty';
import { getReadyToReviewSuggestionsQuery } from 'app/Settings/utils/suggestions';

import { SettingsNavigation } from './components/SettingsNavigation';
import SettingsAPI from './SettingsAPI';

export class Settings extends RouteHandler {
  static async requestState(requestParams) {
    const request = requestParams.onlyHeaders();
    const [user, thesauri, translations, collection, templates] = await Promise.all([
      UsersAPI.currentUser(request),
      ThesauriAPI.getThesauri(request),
      I18NApi.get(request),
      SettingsAPI.get(request),
      TemplatesAPI.get(requestParams.onlyHeaders()),
    ]);

    // This builds and queries elasticsearch for suggestion counts per thesaurus
    const props = thesauri
      .filter(thesaurus => thesaurus.enable_classification)
      .map(thesaurus => resolveTemplateProp(thesaurus, templates));
    const allDocsWithSuggestions = await Promise.all(
      [].concat(
        ...props.map(p =>
          templates.map(template => {
            const reqParams = requestParams.set(getReadyToReviewSuggestionsQuery(template._id, p));
            return api.search(reqParams);
          })
        )
      )
    );

    // This processes the search results per thesaurus and stores the aggregate  number of documents to review
    const propToAgg = props.map(p =>
      templates.map(template => [p, [template, allDocsWithSuggestions.shift()]])
    );
    propToAgg.forEach(tup => {
      tup.forEach(perm => {
        const prop = perm[0];
        const results = perm[1][1];
        const uniqueDocs = results.totalRows;

        const thesaurus = thesauri.find(th => th._id === prop.content);
        if (!thesaurus.hasOwnProperty('suggestions')) {
          thesaurus.suggestions = 0;
        }
        thesaurus.suggestions += uniqueDocs;
      });
    });

    return [
      actions.set('auth/user', user),
      actions.set('dictionaries', thesauri),
      actions.set('translations', translations),
      actions.set('settings/collection', collection),
    ];
  }

  render() {
    return (
      <div className="row settings">
        <Helmet>
          <title>{t('System', 'Settings', null, false)}</title>
        </Helmet>
        <div className="settings-navigation">
          <SettingsNavigation />
        </div>
        {this.props.children}
      </div>
    );
  }
}

export default Settings;
