// Choix d'une photo (galerie ou caméra), compression puis upload signé. Les permissions sont demandées
// au moment du geste, avec un message si elles sont refusées.

import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import type { FileRef, UploadPurpose } from '@ucolis/shared';
import { compressImage, uploadFile } from '../api/upload';
import i18n from '../i18n';

export type PickSource = 'camera' | 'library';

export async function pickImages(source: PickSource, limit = 1) {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(i18n.t(source === 'camera' ? 'common:cameraPermission' : 'common:photoPermission'));
    return [];
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: source === 'library' && limit > 1,
    selectionLimit: limit,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? [] : result.assets.slice(0, limit);
}

/** Propose galerie ou caméra, puis renvoie le choix. */
export function askSource(): Promise<PickSource | null> {
  return new Promise((resolve) => {
    Alert.alert(undefined as unknown as string, undefined, [
      { text: i18n.t('common:takePhoto'), onPress: () => resolve('camera') },
      { text: i18n.t('common:chooseFromGallery'), onPress: () => resolve('library') },
      { text: i18n.t('common:cancel'), style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

export async function pickAndUpload(
  purpose: UploadPurpose,
  onProgress?: (ratio: number) => void,
): Promise<FileRef | null> {
  const source = await askSource();
  if (!source) return null;
  const [asset] = await pickImages(source, 1);
  if (!asset) return null;
  const uri = await compressImage(asset.uri, asset.width, asset.height);
  return uploadFile(purpose, { uri }, onProgress);
}
