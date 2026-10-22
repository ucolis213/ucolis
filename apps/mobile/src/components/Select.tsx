// Liste de choix avec recherche, en modal plein écran (wilayas, communes).

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fontFamily, forwardIcon, MIN_TOUCH, radii, space } from '../theme';
import { AppText } from './AppText';
import { AppModal } from './AppModal';

export interface SelectOption {
  value: string;
  label: string;
}

/** Recherche sans accents ni casse. */
export const normalizeSearch = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
  error,
  disabled,
}: {
  label: string;
  value: string | undefined;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    return q ? options.filter((o) => normalizeSearch(o.label).includes(q)) : options;
  }, [options, query]);
  const message = error ? t(`errors:${error}`, { defaultValue: error }) : undefined;

  return (
    <View style={styles.wrap}>
      <AppText size="sm" weight="medium">
        {label}
      </AppText>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={selected?.label}
        style={[
          styles.box,
          !!message && { borderColor: colors.danger },
          disabled && { opacity: 0.5 },
        ]}
      >
        <AppText
          color={selected ? colors.navy : colors.textSubtle}
          style={styles.flex}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder ?? label}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      {message && (
        <AppText size="xs" color={colors.danger}>
          {message}
        </AppText>
      )}

      <AppModal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <AppText size="lg" weight="bold" style={styles.flex}>
              {label}
            </AppText>
            <Pressable
              onPress={() => setOpen(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('cancel')}
            >
              <Ionicons name="close" size={26} color={colors.navy} />
            </Pressable>
          </View>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={label}
              placeholderTextColor={colors.textSubtle}
              autoFocus
              style={[styles.flex, styles.searchInput, { fontFamily: fontFamily() }]}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            renderItem={({ item }) => (
              <Pressable
                style={styles.option}
                accessibilityRole="button"
                accessibilityState={{ selected: item.value === value }}
                onPress={() => {
                  onChange(item.value);
                  setQuery('');
                  setOpen(false);
                }}
              >
                <AppText
                  style={styles.flex}
                  weight={item.value === value ? 'semibold' : 'regular'}
                  color={item.value === value ? colors.primaryDark : colors.navy}
                >
                  {item.label}
                </AppText>
                <Ionicons name={forwardIcon()} size={16} color={colors.textSubtle} />
              </Pressable>
            )}
          />
        </SafeAreaView>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space(1.5) },
  flex: { flex: 1 },
  box: {
    minHeight: MIN_TOUCH + 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    backgroundColor: colors.surface,
    paddingHorizontal: space(3),
    gap: space(2),
  },
  modal: { flex: 1, backgroundColor: colors.surface },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: space(4) },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    marginHorizontal: space(4),
    marginBottom: space(2),
    paddingHorizontal: space(3),
    borderRadius: radii.input,
    backgroundColor: colors.background,
  },
  searchInput: { minHeight: MIN_TOUCH, color: colors.navy, textAlign: 'auto' },
  option: {
    minHeight: MIN_TOUCH + 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
