import { LayoutOption } from '../../components/configure/keymap/Keymap';
import { IFirmwareCodePlace, IKeyboardFeatures } from '../../store/state';
import { IDeviceInformation } from '../hid/Hid';
import { KeyboardLabelLang } from '../labellang/KeyLabelLangs';

export interface IResult {
  readonly success: boolean;
  readonly error?: string;
  readonly cause?: any;
}

export type IKeyboardDefinitionStatus =
  | 'draft'
  | 'in_review'
  | 'rejected'
  | 'approved';
export const KeyboardDefinitionStatus: {
  [p: string]: IKeyboardDefinitionStatus;
} = {
  draft: 'draft',
  in_review: 'in_review',
  rejected: 'rejected',
  approved: 'approved',
};

export interface IStore {
  name: string;
  url: string;
}

export interface IAdditionalDescription {
  title: string;
  body: string;
}

export interface ISubImage {
  thumbnail_image_url: string;
  image_url: string;
}

export interface IFirmware {
  name: string;
  created_at: Date;
  description: string;
  hash: string;
  filename: string;
}

export interface IKeyboardDefinitionDocument {
  readonly id: string;
  readonly authorUid: string;
  readonly name: string;
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  readonly status: IKeyboardDefinitionStatus;
  readonly json: string;
  readonly rejectReason: string | undefined;
  readonly githubDisplayName: string;
  readonly githubUrl: string;
  readonly firmwareCodePlace: IFirmwareCodePlace;
  readonly qmkRepositoryFirstPullRequestUrl: string;
  readonly forkedRepositoryUrl: string;
  readonly forkedRepositoryEvidence: string;
  readonly otherPlaceHowToGet: string;
  readonly otherPlaceSourceCodeEvidence: string;
  readonly otherPlacePublisherEvidence: string;
  readonly contactInformation: string;
  readonly features: IKeyboardFeatures[];
  readonly thumbnailImageUrl: string;
  readonly imageUrl: string;
  readonly subImages: ISubImage[];
  readonly description: string;
  readonly additionalDescriptions: IAdditionalDescription[];
  readonly stores: IStore[];
  readonly websiteUrl: string;
  readonly firmwares: IFirmware[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function getGitHubUserDisplayName(
  definitionDocument: IKeyboardDefinitionDocument
): string {
  return (
    definitionDocument.githubDisplayName ||
    definitionDocument.githubUrl.substring(
      definitionDocument.githubUrl.lastIndexOf('/') + 1
    )
  );
}

export function getGitHubUserName(
  definitionDocument: IKeyboardDefinitionDocument
): string {
  return definitionDocument.githubUrl.substring(
    definitionDocument.githubUrl.lastIndexOf('/') + 1
  );
}

export function isApprovedKeyboard(
  keyboardDefDocument: IKeyboardDefinitionDocument | null | undefined
) {
  if (keyboardDefDocument) {
    return keyboardDefDocument.status === 'approved';
  } else {
    return false;
  }
}

type SavedKeymapSatus = 'private' | 'shared';

export interface AbstractKeymapData {
  id?: string; // this entity's id
  author_uid: string; //  auth.uid
  author_display_name?: string; // auth.display_name
  vendor_id: number; // Definition.vendorId if registered, otherwise DeviceInformation.vendorId
  product_id: number; // Definition.productId if registered, otherwise DeviceInformation.productId
  product_name: string; // Definition.productName if registered, otherwise DeviceInformation.productName
  title: string;
  desc: string;
  label_lang: KeyboardLabelLang;
  layout_options: LayoutOption[];
  keycodes: { [pos: string]: number }[];
  created_at?: Date;
  updated_at?: Date;
}

export interface SavedKeymapData extends AbstractKeymapData {
  status: SavedKeymapSatus;
}

export interface AppliedKeymapData extends AbstractKeymapData {
  applied_uid: string;
  saved_keymap_id: string;
}

export function isAppliedKeymapDataInstance(
  arg: any
): arg is AppliedKeymapData {
  return (
    arg !== null &&
    typeof arg === 'object' &&
    typeof arg.applied_uid === 'string'
  );
}

export interface IExistsResult extends IResult {
  exists?: boolean;
}

export interface IFetchKeyboardDefinitionDocumentResult extends IExistsResult {
  document?: IKeyboardDefinitionDocument;
}

export interface IFetchMyKeyboardDefinitionDocumentsResult extends IResult {
  documents?: IKeyboardDefinitionDocument[];
}

export interface ICreateKeyboardDefinitionDocumentResult extends IResult {
  definitionId?: string;
}

export interface ISavedKeymapResult extends IResult {
  savedKeymaps: SavedKeymapData[];
}

export interface IAppliedKeymapsResult extends IResult {
  appliedKeymaps: AppliedKeymapData[];
}

export interface IFetchSharedKeymapResult extends IResult {
  sharedKeymap?: SavedKeymapData;
}

export interface IFetchFirmwareFileBlobResult extends IResult {
  blob?: any;
}

/* eslint-disable no-unused-vars */
export interface IStorage {
  fetchKeyboardDefinitionDocumentByDeviceInfo(
    vendorId: number,
    productId: number,
    productName: string
  ): Promise<IFetchKeyboardDefinitionDocumentResult>;
  fetchMyKeyboardDefinitionDocuments(): Promise<IFetchMyKeyboardDefinitionDocumentsResult>;
  createKeyboardDefinitionDocument(
    authorUid: string,
    name: string,
    vendorId: number,
    productId: number,
    productName: string,
    jsonStr: string,
    githubUid: string,
    githubDisplayName: string,
    githubEmail: string,
    githubUrl: string,
    firmwareCodePlace: IFirmwareCodePlace,
    qmkRepositoryFirstPullRequestUrl: string,
    forkedRepositoryUrl: string,
    forkedRepositoryEvidence: string,
    otherPlaceHowToGet: string,
    otherPlaceSourceCodeEvidence: string,
    otherPlacePublisherEvidence: string,
    contactInformation: string,
    status: IKeyboardDefinitionStatus
  ): Promise<ICreateKeyboardDefinitionDocumentResult>;
  fetchMyKeyboardDefinitionDocumentById(
    definitionId: string
  ): Promise<IFetchKeyboardDefinitionDocumentResult>;
  updateKeyboardDefinitionDocument(
    definitionId: string,
    name: string,
    vendorId: number,
    productId: number,
    productName: string,
    jsonStr: string,
    firmwareCodePlace: IFirmwareCodePlace,
    qmkRepositoryFirstPullRequestUrl: string,
    forkedRepositoryUrl: string,
    forkedRepositoryEvidence: string,
    otherPlaceHowToGet: string,
    otherPlaceSourceCodeEvidence: string,
    otherPlacePublisherEvidence: string,
    contactInformation: string,
    status: IKeyboardDefinitionStatus
  ): Promise<IResult>;
  updateKeyboardDefinitionJson(
    definitionId: string,
    name: string,
    jsonStr: string
  ): Promise<IResult>;
  deleteKeyboardDefinitionDocument(definitionId: string): Promise<IResult>;

  fetchMySavedKeymaps(info: IDeviceInformation): Promise<ISavedKeymapResult>;
  createSavedKeymap(keymapData: SavedKeymapData): Promise<IResult>;
  updateSavedKeymap(keymapData: SavedKeymapData): Promise<IResult>;
  deleteSavedKeymap(savedKeymapId: string): Promise<IResult>;
  fetchSharedKeymaps(
    info: IDeviceInformation,
    withoutMine: boolean
  ): Promise<ISavedKeymapResult>;
  createOrUpdateAppliedKeymap(keymapData: AbstractKeymapData): Promise<IResult>;
  fetchMyAppliedKeymaps(
    info: IDeviceInformation
  ): Promise<IAppliedKeymapsResult>;
  fetchSharedKeymap(keymapId: string): Promise<IFetchSharedKeymapResult>;

  searchKeyboardsByFeatures(
    features: IKeyboardFeatures[]
  ): Promise<IFetchMyKeyboardDefinitionDocumentsResult>;
  fetchKeyboardDefinitionDocumentById(
    definitionId: string
  ): Promise<IFetchKeyboardDefinitionDocumentResult>;
  updateKeyboardDefinitionDocumentForCatalog(
    definitionId: string,
    features: IKeyboardFeatures[],
    description: string,
    stores: IStore[],
    websiteUrl: string,
    additionalDescriptions: IAdditionalDescription[]
  ): Promise<IResult>;
  fetchKeyboardsCreatedBySameAuthor(
    authorUid: string
  ): Promise<IFetchMyKeyboardDefinitionDocumentsResult>;

  uploadKeyboardCatalogMainImage(
    definitionId: string,
    file: File,
    progress: (uploadedRate: number) => void
  ): Promise<IResult>;
  uploadKeyboardCatalogSubImage(
    definitionId: string,
    file: File,
    progress: (uploadedRate: number) => void
  ): Promise<IResult>;
  deleteKeyboardCatalogSubImage(
    definitionId: string,
    subImageIndex: number
  ): Promise<IResult>;

  uploadFirmwareFile(
    definitionId: string,
    firmwareFile: File,
    firmwareName: string,
    firmwareDescription: string,
    keyboardName: string
  ): Promise<IResult>;
  fetchFirmwareFileBlob(
    firmwareFilePath: string
  ): Promise<IFetchFirmwareFileBlobResult>;
  deleteFirmwareFile(
    definitionId: string,
    firmware: IFirmware
  ): Promise<IResult>;
}
/* eslint-enable no-unused-vars */
