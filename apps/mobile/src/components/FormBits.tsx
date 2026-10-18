// Petits éléments de formulaire : section, ligne clé/valeur, case à cocher, interrupteur, champ prix, date.

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../format';
import { colors, MIN_TOUCH, radii, shadow, space } from '../theme';
import { AppText } from './AppText';
import { TextField, type TextFieldProps } from './TextField';

export function SectionCard({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.card}>
      {(title || right) && (
        <View style={styles.cardHeader}>
          {title && (
            <AppText weight="bold" style={styles.flex}>
              {title}
            </AppText>
          )}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.kv}>
      <AppText size="sm" color={colors.textMuted} style={styles.flex}>
        {label}
      </AppText>
      {typeof value === 'string' || typeof value === 'number' ? (
        <AppText size="sm" weight="medium" style={styles.kvValue}>
          {value}
        </AppText>
      ) : (
        value
      )}
    </View>
  );
}

export function CheckRow({ label, checked, onChange, error }: { label: string; checked: boolean; onChange: (v: boolean) => void; error?: string }) {
  const { t } = useTranslation('errors');
  return (
    <View style={{ gap: space(1) }}>
      <Pressable
        style={styles.checkRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => onChange(!checked)}
      >
        <View style={[styles.box, checked && styles.boxOn]}>
          {checked && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </View>
        <AppText size="sm" style={styles.flex}>
          {label}
        </AppText>
      </Pressable>
      {error && (
        <AppText size="xs" color={colors.danger}>
          {t(error, { defaultValue: error })}
        </AppText>
      )}
    </View>
  );
}

export function SwitchRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex}>
        <AppText>{label}</AppText>
        {hint && (
          <AppText size="xs" color={colors.textMuted}>
            {hint}
          </AppText>
        )}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel={label} />
    </View>
  );
}

/** Montant entier en DA ; l'affichage reste en chiffres occidentaux dans les deux langues. */
export function PriceInput({
  value,
  onChange,
  ...rest
}: Omit<TextFieldProps, 'value' | 'onChangeText' | 'onChange'> & { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <TextField
      {...rest}
      value={value === null ? '' : String(value)}
      onChangeText={(v) => {
        const digits = v.replace(/\D/g, '').slice(0, 8);
        onChange(digits ? Number(digits) : null);
      }}
      keyboardType="number-pad"
    />
  );
}

export function NumberInput({
  value,
  onChange,
  decimals = true,
  ...rest
}: Omit<TextFieldProps, 'value' | 'onChangeText' | 'onChange'> & { value: number | null; onChange: (v: number | null) => void; decimals?: boolean }) {
  const [text, setText] = useState(value === null ? '' : String(value));
  return (
    <TextField
      {...rest}
      value={text}
      onChangeText={(v) => {
        const clean = v.replace(',', '.').replace(decimals ? /[^\d.]/g : /\D/g, '');
        setText(clean);
        const n = Number(clean);
        onChange(clean && Number.isFinite(n) ? n : null);
      }}
      keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
    />
  );
}

const DAY = 86_400_000;

/** Choix d'une date parmi les N prochains jours (sans dépendance native supplémentaire). */
export function DateSelect({
  label,
  value,
  onChange,
  days = 61,
  error,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date) => void;
  days?: number;
  error?: string;
}) {
  const { t } = useTranslation(['common', 'errors']);
  const [open, setOpen] = useState(false);
  const dates = useMemo(() => {
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    return Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * DAY));
  }, [days]);
  return (
    <View style={{ gap: space(1.5) }}>
      <AppText size="sm" weight="medium">
        {label}
      </AppText>
      <Pressable style={[styles.select, !!error && { borderColor: colors.danger }]} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label}>
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
        <AppText color={value ? colors.navy : colors.textSubtle} style={styles.flex}>
          {value ? formatDate(value, { weekday: 'long' }) : t('selectDate')}
        </AppText>
      </Pressable>
      {error && (
        <AppText size="xs" color={colors.danger}>
          {t(`errors:${error}`, { defaultValue: error })}
        </AppText>
      )}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <AppText size="lg" weight="bold" style={styles.flex}>
              {label}
            </AppText>
            <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('cancel')}>
              <Ionicons name="close" size={26} color={colors.navy} />
            </Pressable>
          </View>
          <FlatList
            data={dates}
            keyExtractor={(d) => d.toISOString()}
            renderItem={({ item, index }) => {
              const selected = value && item.toDateString() === value.toDateString();
              return (
                <Pressable
                  style={styles.option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !!selected }}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  <AppText weight={selected ? 'bold' : 'regular'} color={selected ? colors.primaryDark : colors.navy} style={styles.flex}>
                    {index === 0 ? t('today') : index === 1 ? t('tomorrow') : formatDate(item, { weekday: 'long', year: undefined })}
                  </AppText>
                  {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: radii.card, backgroundColor: colors.surface, padding: space(4), gap: space(3), ...shadow },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  kv: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 28 },
  kvValue: { flexShrink: 1, textAlign: 'right' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: MIN_TOUCH },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: MIN_TOUCH },
  select: {
    minHeight: MIN_TOUCH + 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    backgroundColor: colors.surface,
    paddingHorizontal: space(3),
  },
  modal: { flex: 1, backgroundColor: colors.surface },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: space(4) },
  option: {
    minHeight: MIN_TOUCH + 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
