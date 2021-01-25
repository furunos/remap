import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import {
  IFetchKeyboardDefinitionResult,
  IFetchMyKeyboardDefinitionDocumentsResult,
  IKeyboardDefinitionDocument,
  IStorage,
} from '../storage/Storage';
import { IAuth } from '../auth/Auth';

const config = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGE_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

export class FirebaseProvider implements IStorage, IAuth {
  private db: firebase.firestore.Firestore;
  private auth: firebase.auth.Auth;
  private unsubscribeAuthStateChanged?: firebase.Unsubscribe;

  constructor() {
    firebase.initializeApp(config);
    const app = firebase.app();
    this.db = app.firestore();
    this.auth = app.auth();
  }

  createResult(
    querySnapshot: firebase.firestore.QuerySnapshot
  ): IFetchKeyboardDefinitionResult {
    return {
      success: true,
      exists: true,
      document: this.createKeyboardDefinitionDocument(querySnapshot.docs[0]),
    };
  }

  createKeyboardDefinitionDocument(
    queryDocumentSnapshot: firebase.firestore.QueryDocumentSnapshot
  ): IKeyboardDefinitionDocument {
    return {
      id: queryDocumentSnapshot.id,
      name: queryDocumentSnapshot.data().name,
      vendorId: queryDocumentSnapshot.data().vendor_id,
      productId: queryDocumentSnapshot.data().product_id,
      json: queryDocumentSnapshot.data().json,
    };
  }

  async fetchMyKeyboardDefinitionDocuments(): Promise<IFetchMyKeyboardDefinitionDocumentsResult> {
    try {
      const querySnapshot = await this.db
        .collection('keyboards')
        .doc('v2')
        .collection('definitions')
        .where('author_uid', '==', this.auth.currentUser!.uid)
        .get();
      return {
        success: true,
        documents: querySnapshot.docs.map((queryDocumentSnapshot) =>
          this.createKeyboardDefinitionDocument(queryDocumentSnapshot)
        ),
      };
    } catch (error) {
      console.error(error);
      return {
        success: false,
        error: 'Fetching the keyboard definition document failed',
        cause: error,
      };
    }
  }

  async fetchKeyboardDefinition(
    vendorId: number,
    productId: number,
    productName: string
  ): Promise<IFetchKeyboardDefinitionResult> {
    try {
      const querySnapshotByVidAndPid = await this.db
        .collection('keyboards')
        .doc('v1')
        .collection('definitions')
        .where('vendor_id', '==', vendorId)
        .where('product_id', '==', productId)
        .get();
      if (querySnapshotByVidAndPid.empty || querySnapshotByVidAndPid.size > 1) {
        const querySnapshotByProductName = await this.db
          .collection('keyboards')
          .doc('v1')
          .collection('definitions')
          .where('product_name', 'array-contains', productName)
          .get();
        if (querySnapshotByProductName.empty) {
          console.warn(
            `Keyboard definition not found: ${vendorId}:${productId}:${productName}`
          );
          return {
            success: true,
            exists: false,
          };
        } else if (querySnapshotByProductName.size !== 1) {
          throw new Error(
            `There are duplicate keyboard definition documents: ${vendorId}:${productId}:${productName}`
          );
        } else {
          console.log(
            `Keyboard definition found by product_name: ${vendorId}:${productId}:${productName}`
          );
          return this.createResult(querySnapshotByProductName);
        }
      } else {
        console.log(
          `Keyboard definition found by vendor_id and product_id: ${vendorId}:${productId}:${productName}`
        );
        return this.createResult(querySnapshotByVidAndPid);
      }
    } catch (error) {
      console.error(error);
      return {
        success: false,
        error: 'Fetching the keyboard definition document failed',
        cause: error,
      };
    }
  }

  async fetchClosedBetaUsers(): Promise<string[]> {
    const documentSnapshot = await this.db
      .collection('configurations')
      .doc('closedbeta')
      .get();
    if (documentSnapshot.exists) {
      return documentSnapshot.data()!.users;
    } else {
      return [];
    }
  }

  signInWithGitHub(): Promise<void> {
    const provider = new firebase.auth.GithubAuthProvider();
    return this.auth.signInWithRedirect(provider);
  }

  // eslint-disable-next-line no-unused-vars
  subscribeAuthStatus(callback: (user: firebase.User | null) => void): void {
    this.unsubscribeAuthStateChanged && this.unsubscribeAuthStateChanged();
    this.unsubscribeAuthStateChanged = this.auth.onAuthStateChanged(
      (user: firebase.User | null) => {
        callback(user);
      }
    );
  }
}
