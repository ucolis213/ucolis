// Visionneuse plein écran : photos en carrousel, affichées entières (sans recadrage).
// Zoom par pincement sur iOS, assuré nativement par la ScrollView.

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { FileRef } from '@ucolis/shared';
import { MIN_TOUCH, space } from '../theme';
import { AppText } from './AppText';
import { cdn } from './Avatar';

const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

/** Ouverte quand `index` n'est pas null, sur la photo d'indice `index`. */
export function PhotoViewer({ photos, index, onClose }: { photos: FileRef[]; index: number | null; onClose: () => void }) {
  const { t } = useTranslation('common');
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(0);
  // Compteur tiré des éléments visibles plutôt que du décalage : reste juste en RTL.
  // Fonction stable : FlatList refuse qu'onViewableItemsChanged change entre deux rendus.
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<FileRef>[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setCurrent(first.index);
  }, []);

  return (
    <Modal visible={index !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={['portrait']}>
      <View style={styles.root}>
        {index !== null && (
          <FlatList
            data={photos}
            keyExtractor={(p) => p.publicId}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={index}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={VIEWABILITY}
            renderItem={({ item }) => (
              <ScrollView
                style={{ width, height }}
                contentContainerStyle={styles.center}
                minimumZoomScale={1}
                maximumZoomScale={3}
                centerContent
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              >
                <Image source={{ uri: cdn(item.url, 1600) }} style={{ width, height }} contentFit="contain" accessibilityIgnoresInvertColors />
              </ScrollView>
            )}
          />
        )}
        <View style={[styles.top, { paddingTop: insets.top + space(2) }]} pointerEvents="box-none">
          <AppText weight="medium" color="#FFFFFF">
            {photos.length > 1 ? t('photoCounter', { current: current + 1, total: photos.length }) : ''}
          </AppText>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel={t('close')}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  top: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(4),
  },
  close: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
});
