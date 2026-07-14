import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

// 로컬 스토리지에 저장된 설정
export const getSavedFirebaseConfig = () => {
  const config = localStorage.getItem('firebase_config');
  return config ? JSON.parse(config) : null;
};

export const saveFirebaseConfig = (config) => {
  localStorage.setItem('firebase_config', JSON.stringify(config));
};

export const clearFirebaseConfig = () => {
  localStorage.removeItem('firebase_config');
};

let app = null;
let db = null;
let auth = null;
const googleProvider = new GoogleAuthProvider();

googleProvider.addScope('email');
googleProvider.addScope('profile');

// ⚡ ES 모듈의 정적 바인딩(Static Binding) 지연 평가를 해결하기 위한 실시간 getter 함수 제공
export const getDb = () => {
  return db;
};

export const getFirebaseAuth = () => {
  return auth;
};

export const initFirebase = async () => {
  if (app) return { app, db, auth };

  // 1. 로컬스토리지 config 확인
  let config = getSavedFirebaseConfig();

  // 2. 만약 호스팅 환경이라면 자동 설정 파일(/__/firebase/init.json) fetch 시도
  if (!config) {
    try {
      const response = await fetch('/__/firebase/init.json');
      if (response.ok) {
        config = await response.json();
        console.log('Firebase Config auto-loaded from Hosting init.json');
        saveFirebaseConfig(config);
      }
    } catch (e) {
      console.warn('Firebase init.json fetch failed (normal in local dev environment).', e);
    }
  }

  // 3. Config가 존재할 때 초기화 수행
  if (config && config.apiKey && config.projectId) {
    try {
      if (getApps().length === 0) {
        app = initializeApp(config);
      } else {
        app = getApp();
      }
      db = getFirestore(app);
      auth = getAuth(app);
      return { app, db, auth };
    } catch (error) {
      console.error('Failed to initialize Firebase with config:', error);
    }
  }

  return { app: null, db: null, auth: null };
};

export const reinitializeFirebase = (newConfig) => {
  try {
    saveFirebaseConfig(newConfig);
    return true;
  } catch (error) {
    console.error('Error during dynamic Firebase reinitialization:', error);
    return false;
  }
};

export { app, db, auth, googleProvider, signInWithPopup, signOut };
