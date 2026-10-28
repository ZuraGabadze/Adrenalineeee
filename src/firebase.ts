import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { SiteSettings, StoreProduct } from './types/store';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export async function signInFirebaseAdmin(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Firebase Google Sign-In failed:', error);
    return null;
  }
}

/**
 * Syncs SiteSettings to Firestore `/site_settings/main` enforcing blueprint volumetric constraints.
 */
export async function syncSiteSettingsToFirestore(settings: SiteSettings): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const path = 'site_settings/main';
  try {
    await setDoc(doc(db, 'site_settings', 'main'), {
      serverName: settings.serverName.slice(0, 64),
      serverIp: settings.serverIp.slice(0, 128),
      discordInviteCode: settings.discordInviteCode.slice(0, 64),
      discordInviteUrl: settings.discordInviteUrl.slice(0, 256),
      maintenanceMode: Boolean(settings.maintenanceMode),
      announcementKa: (settings.announcement.ka || '').slice(0, 500),
      announcementEn: (settings.announcement.en || '').slice(0, 500),
      updatedAt: serverTimestamp(),
      authorId: user.uid.slice(0, 128),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Syncs a StoreProduct to Firestore `/products/{productId}` enforcing blueprint volumetric constraints.
 */
export async function syncProductToFirestore(product: StoreProduct): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const cleanId = product.id.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 128);
  const path = `products/${cleanId}`;
  try {
    await setDoc(doc(db, 'products', cleanId), {
      id: cleanId,
      type: product.type === 'key' ? 'key' : 'rank',
      gamemode: ['smp', 'oneblock', 'global'].includes(product.gamemode)
        ? product.gamemode
        : 'global',
      name: product.name.slice(0, 64),
      color: /^#[0-9A-Fa-f]{6}$/.test(product.color) ? product.color : '#8A00FF',
      price: Math.min(10000, Math.max(0, Number(product.price) || 0)),
      visible: Boolean(product.visible),
      sortOrder: Math.min(10000, Math.max(0, Number(product.sortOrder) || 0)),
      authorId: user.uid.slice(0, 128),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteProductFromFirestore(productId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const cleanId = productId.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 128);
  const path = `products/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'products', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function writeAuditLogToFirestore(action: string, details: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const logId = `log_${Date.now()}`;
  const path = `audit_logs/${logId}`;
  try {
    await setDoc(doc(db, 'audit_logs', logId), {
      id: logId,
      actorId: user.uid.slice(0, 128),
      action: action.slice(0, 128),
      details: details.slice(0, 1000),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeFirestoreRealtime(
  onSettingsSnapshot: (partial: Partial<SiteSettings>) => void
): () => void {
  let unsubSettings: (() => void) | null = null;
  let unsubProducts: (() => void) | null = null;

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    if (unsubSettings) {
      unsubSettings();
      unsubSettings = null;
    }
    if (unsubProducts) {
      unsubProducts();
      unsubProducts = null;
    }

    if (user && user.emailVerified) {
      const settingsPath = 'site_settings/main';
      unsubSettings = onSnapshot(
        doc(db, 'site_settings', 'main'),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            onSettingsSnapshot({
              serverName: d.serverName,
              serverIp: d.serverIp,
              discordInviteCode: d.discordInviteCode,
              discordInviteUrl: d.discordInviteUrl,
              maintenanceMode: d.maintenanceMode,
            });
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, settingsPath);
        }
      );

      const productsPath = 'products';
      unsubProducts = onSnapshot(
        collection(db, productsPath),
        () => {
          // Product changes also trigger realtime SSE sync
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, productsPath);
        }
      );
    }
  });

  return () => {
    unsubAuth();
    if (unsubSettings) unsubSettings();
    if (unsubProducts) unsubProducts();
  };
}
