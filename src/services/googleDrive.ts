// src/services/googleDrive.ts
// Google Drive integration — data stored in user's own Google Drive, not our servers

// NOTE: expo-google-app-auth is deprecated. Use @react-native-google-signin/google-signin for production.
// This file provides the interface. Replace with your own Google Cloud Console credentials.

export interface DriveAuth {
  accessToken: string;
  email: string;
}

const GOOGLE_CONFIG = {
  androidClientId: 'YOUR_ANDROID_CLIENT_ID',
  iosClientId: 'YOUR_IOS_CLIENT_ID',
  scopes: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
  ],
};

export async function signInWithGoogle(): Promise<DriveAuth | null> {
  try {
    // In production, use @react-native-google-signin/google-signin:
    // import { GoogleSignin } from '@react-native-google-signin/google-signin';
    // GoogleSignin.configure({ webClientId: '...', scopes: GOOGLE_CONFIG.scopes });
    // const { user } = await GoogleSignin.signIn();
    // const tokens = await GoogleSignin.getTokens();
    // return { accessToken: tokens.accessToken, email: user.email };
    console.warn('Google Sign-In not configured. Add your OAuth credentials.');
    return null;
  } catch (e) {
    console.error('Google sign-in error:', e);
    return null;
  }
}

export async function createDriveFolder(accessToken: string, folderName: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const data = await response.json();
  return data.id;
}

export async function uploadCSVToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  csvContent: string
): Promise<string> {
  const metadata = { name: fileName, parents: [folderId], mimeType: 'text/csv' };
  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', new Blob([csvContent], { type: 'text/csv' }));

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    }
  );
  const data = await response.json();
  return data.id;
}

export async function listDriveFiles(accessToken: string, folderId: string): Promise<any[]> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,modifiedTime)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await response.json();
  return data.files || [];
}
