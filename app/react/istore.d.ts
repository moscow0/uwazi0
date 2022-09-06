import { TaskStatus } from 'shared/tasks/tasks';
import { ClassifierModelSchema } from 'app/Thesauri/types/classifierModelType';
import { LabelCountSchema } from 'app/Thesauri/types/labelCountType';
import { IImmutable } from 'shared/types/Immutable';
import { ThesaurusSchema } from 'shared/types/thesaurusType';
import { ExtractedMetadataSchema, PropertySchema } from 'shared/types/commonTypes';
import { TemplateSchema } from 'shared/types/templateType';
import { EntitySchema } from 'shared/types/entityType';
import { UserGroupSchema } from 'shared/types/userGroupType';
import { ConnectionSchema } from 'shared/types/connectionType';
import { UserSchema } from 'shared/types/userType';
import { Settings } from 'shared/types/settingsType';
import { FileType } from 'shared/types/fileType';
import { PageType } from 'shared/types/pageType';

interface EntityDisplayState {
  documents: IImmutable<{ rows: EntitySchema[] }>;
  ui: IImmutable<{
    selectedDocuments: EntitySchema[];
    tableViewColumns: TableViewColumn[];
    zoomLevel: number;
  }>;
  sidepanel: {
    metadata: ClientEntitySchema;
    quickLabelState: IImmutable<QuickLabelState>;
    quickLabelMetadata: QuickLabelMetadata;
    quickLabelMetadataForm: any;
  };
  search: any;
  filters: IImmutable<{ documentTypes: [] }>;
}

interface RelationshipTypesType {
  _id: string;
  name: string;
}

export interface ClientPropertySchema extends PropertySchema {
  localID?: string;
  inserting?: boolean;
}
export interface TasksState {
  SyncState?: TaskStatus;
  TrainState?: TaskStatus;
}

export interface QuickLabelState {
  thesaurus?: string;
  autoSave?: boolean;
}

export interface TriStateSelectValue {
  // Thesaurus value ids that should be added to all entities.
  added: string[];
  // Thesaurus value ids that should be removed from all entities.
  removed: string[];
  // Thesaurus value ids that all entities originally had.
  originalFull: string[];
  // Thesaurus value ids that some, but not all, entities originally had.
  originalPartial: string[];
}

export interface QuickLabelMetadata {
  [k: string]: TriStateSelectValue;
}

export interface ThesaurusSuggestions {
  property?: PropertySchema;
  model?: ClassifierModelSchema;
  docsWithLabels?: LabelCountSchema;
  docsWithSuggestionsForPublish?: LabelCountSchema;
  docsWithSuggestionsForReview?: LabelCountSchema;
}

export interface OneUpState {
  loaded: boolean;
  fullEdit: boolean;
  loadConnections: boolean;
  indexInDocs: number;
  totalDocs: number;
  maxTotalDocs: number;
  requestHeaders: Object;
  reviewThesaurusName: string | null;
  reviewThesaurusId: string | null;
  reviewThesaurusValues: string[];
}

export interface TableViewColumn extends PropertySchema {
  hidden: boolean;
  translationContext?: string;
}
export interface ClientTemplateSchema extends TemplateSchema {
  _id: string;
  properties: ClientPropertySchema[];
  commonProperties?: [ClientPropertySchema, ...ClientPropertySchema[]];
}

export interface ClientFile extends FileType {
  _id: string;
  serializedFile?: string;
  fileLocalID?: string;
}

export interface ClientBlobFile extends FileType {
  data: string;
  originalFile: File;
}

export interface ClientEntitySchema extends EntitySchema {
  documents?: (ClientFile | ClientBlobFile)[];
  attachments?: ClientFile[];
  defaultDoc?: ClientFile;
}

export interface DocumentViewerUiStateReference {
  sourceRange: { text: string; selectionRectangles: [] };
  sourceFile: string;
}

export interface IStore {
  library: EntityDisplayState;
  uploads: EntityDisplayState;
  template: {
    data: TemplateSchema;
  };
  templates: IImmutable<ClientTemplateSchema[]>;
  thesauris: IImmutable<ThesaurusSchema[]>;
  thesauri: {
    thesaurus: IImmutable<ThesaurusSchema>;
    suggestInfo: IImmutable<ThesaurusSuggestions>;
    tasksState: IImmutable<TasksState>;
  };
  relationships: any;
  entityView: {
    entity: IImmutable<ClientEntitySchema>;
    entityFormState: any;
    entityForm: any;
    uiState: IImmutable<{ tab: string }>;
  };
  documentViewer: {
    references: IImmutable<ConnectionSchema[]>;
    targetDocReferences: IImmutable<ConnectionSchema[]>;
    doc: IImmutable<ClientEntitySchema>;
    targetDoc: IImmutable<ClientEntitySchema>;
    uiState: IImmutable<{
      reference: DocumentViewerUiStateReference;
      activeReference: string;
    }>;
    metadataExtraction: IImmutable<{
      selections: ExtractedMetadataSchema[];
    }>;
    sidepanel: {
      metadata: ClientEntitySchema;
    };
  };
  oneUpReview: {
    state?: IImmutable<OneUpState>;
  };
  settings: {
    collection: IImmutable<Settings>;
  };
  user: IImmutable<UserSchema>;
  users: IImmutable<UserSchema[]>;
  userGroups: IImmutable<UserGroupSchema[]>;
  page: {
    data: PageType;
    uiState: IImmutable<{ savingPage: boolean }>;
    formState: any;
  };
  pages: IImmutable<PageType>;
  relationTypes: IImmutable<RelationshipTypesType[]>;
}
