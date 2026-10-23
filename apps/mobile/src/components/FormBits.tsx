// Petits éléments de formulaire : section, ligne clé/valeur, case à cocher, interrupteur, champ prix, date, heure.

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { DESIRED_DATE_MAX_DAYS } from '@ucolis/shared';
import { atNoon, clampMonth, monthCells, sameDay, startOfDay, weekDays } from '../calendar';
import { formatDate } from '../format';
import { backIcon, colors, forwardIcon, MIN_TOUCH, radii, shadow, space } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { TextField, type TextFieldProps } from './TextField';
import { AppModal } from './AppModal';

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

/**
 * Choix d'une date entre aujourd'hui et les N prochains jours, dans un calendrier mensuel (sans dépendance native).
 * Le titre du mois ouvre la grille des années, utile pour une échéance lointaine (permis, assurance).
 */
export function DateSelect({
  label,
  value,
  onChange,
  days = DESIRED_DATE_MAX_DAYS + 1,
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
      {open && (
        <CalendarSheet
          label={label}
          value={value}
          days={days}
          onClose={() => setOpen(false)}
          onPick={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
      )}
    </View>
  );
}

function CalendarSheet({
  label,
  value,
  days,
  onClose,
  onPick,
}: {
  label: string;
  value: Date | null;
  days: number;
  onClose: () => void;
  onPick: (d: Date) => void;
}) {
  const { t } = useTranslation('common');
  const { min, max } = useMemo(() => {
    const today = startOfDay(new Date());
    return { min: today, max: new Date(today.getTime() + (days - 1) * DAY) };
  }, [days]);
  const initial = value && value >= min && value <= max ? value : min;
  const [view, setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() });
  const [pickYear, setPickYear] = useState(false);

  const cells = useMemo(() => monthCells(view.year, view.month), [view]);
  const monthIndex = view.year * 12 + view.month;
  const canPrev = monthIndex > min.getFullYear() * 12 + min.getMonth();
  const canNext = monthIndex < max.getFullYear() * 12 + max.getMonth();
  const shift = (delta: number) => {
    const m = monthIndex + delta;
    setView({ year: Math.floor(m / 12), month: m % 12 });
  };
  const years = Array.from({ length: max.getFullYear() - min.getFullYear() + 1 }, (_, i) => min.getFullYear() + i);
  const monthTitle = formatDate(atNoon(view.year, view.month, 1), { day: undefined, month: 'long', year: 'numeric' });
  // Un dimanche de référence (4 janvier 2026) pour nommer les jours de la semaine dans la langue courante.
  const weekDayName = (d: number) => formatDate(atNoon(2026, 0, 4 + d), { weekday: 'narrow', day: undefined, month: undefined, year: undefined });

  return (
    <AppModal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('cancel')} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.modalHeader}>
            <AppText size="lg" weight="bold" style={styles.flex}>
              {label}
            </AppText>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('cancel')}>
              <Ionicons name="close" size={26} color={colors.navy} />
            </Pressable>
          </View>

          <View style={styles.monthNav}>
            <Pressable
              onPress={() => shift(-1)}
              disabled={!canPrev || pickYear}
              style={styles.navButton}
              accessibilityRole="button"
              accessibilityLabel={t('calendar.previousMonth')}
            >
              <Ionicons name={backIcon()} size={22} color={canPrev && !pickYear ? colors.navy : colors.border} />
            </Pressable>
            <Pressable
              onPress={() => setPickYear((v) => !v)}
              disabled={years.length < 2}
              style={styles.monthTitle}
              accessibilityRole="button"
              accessibilityLabel={t('calendar.chooseYear')}
            >
              <AppText weight="bold">{monthTitle}</AppText>
              {years.length > 1 && <Ionicons name={pickYear ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />}
            </Pressable>
            <Pressable
              onPress={() => shift(1)}
              disabled={!canNext || pickYear}
              style={styles.navButton}
              accessibilityRole="button"
              accessibilityLabel={t('calendar.nextMonth')}
            >
              <Ionicons name={forwardIcon()} size={22} color={canNext && !pickYear ? colors.navy : colors.border} />
            </Pressable>
          </View>

          {pickYear ? (
            <View style={styles.yearGrid}>
              {years.map((y) => {
                const selected = y === view.year;
                return (
                  <Pressable
                    key={y}
                    style={[styles.yearCell, selected && styles.cellSelected]}
                    onPress={() => {
                      setView({ year: y, month: clampMonth(y, view.month, min, max) });
                      setPickYear(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <AppText weight={selected ? 'bold' : 'regular'} color={selected ? colors.surface : colors.navy}>
                      {y}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View>
              <View style={styles.week}>
                {weekDays().map((d) => (
                  <AppText key={d} size="xs" color={colors.textMuted} style={styles.weekDay}>
                    {weekDayName(d)}
                  </AppText>
                ))}
              </View>
              <View style={styles.daysGrid}>
                {cells.map((day, i) => {
                  if (!day) return <View key={`empty-${i}`} style={styles.dayCell} />;
                  const disabled = day < min || day > max;
                  const selected = !!value && sameDay(day, value);
                  const today = sameDay(day, min);
                  return (
                    <Pressable
                      key={day.toISOString()}
                      style={styles.dayCell}
                      disabled={disabled}
                      onPress={() => onPick(day)}
                      accessibilityRole="button"
                      accessibilityLabel={formatDate(day, { weekday: 'long' })}
                      accessibilityState={{ selected, disabled }}
                    >
                      <View style={[styles.dayInner, today && styles.dayToday, selected && styles.cellSelected]}>
                        <AppText
                          weight={selected || today ? 'bold' : 'regular'}
                          color={selected ? colors.surface : disabled ? colors.border : today ? colors.primaryDark : colors.navy}
                        >
                          {day.getDate()}
                        </AppText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </SafeAreaView>
      </View>
    </AppModal>
  );
}

// Minutes par pas de 5 : 00, 05, 10… 55.
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const WHEEL_ITEM = 44;
const WHEEL_ROWS = 5;

/**
 * Heure « HH:mm » choisie sur deux roues (heures, minutes par 5), comme le réveil de l'iPhone.
 * Facultative par défaut (effaçable) ; `required` pour une heure toujours renseignée (départ d'un trajet).
 */
export function TimeSelect({
  label,
  value,
  onChange,
  required = false,
  hint,
  error,
}: {
  label: string;
  value: string | null;
  onChange: (time: string | null) => void;
  required?: boolean;
  hint?: string;
  error?: string;
}) {
  const { t } = useTranslation(['common', 'errors']);
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: space(1.5) }}>
      <AppText size="sm" weight="medium">
        {label}
      </AppText>
      <View style={[styles.select, !!error && { borderColor: colors.danger }]}>
        <Pressable style={[styles.flex, styles.timeField]} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label}>
          <Ionicons name="time-outline" size={18} color={colors.textMuted} />
          <AppText color={value ? colors.navy : colors.textSubtle} style={styles.flex}>
            {value ?? t('selectTime')}
          </AppText>
        </Pressable>
        {value && !required && (
          <Pressable onPress={() => onChange(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('clear')}>
            <Ionicons name="close-circle" size={20} color={colors.textSubtle} />
          </Pressable>
        )}
      </View>
      {hint && !error && (
        <AppText size="xs" color={colors.textMuted}>
          {hint}
        </AppText>
      )}
      {error && (
        <AppText size="xs" color={colors.danger}>
          {t(`errors:${error}`, { defaultValue: error })}
        </AppText>
      )}
      {open && (
        <TimeSheet
          label={label}
          value={value}
          onClose={() => setOpen(false)}
          onPick={(time) => {
            onChange(time);
            setOpen(false);
          }}
        />
      )}
    </View>
  );
}

function TimeSheet({ label, value, onClose, onPick }: { label: string; value: string | null; onClose: () => void; onPick: (time: string) => void }) {
  const { t } = useTranslation('common');
  // Sans valeur, les roues s'ouvrent sur 09:00 ; une ancienne heure hors pas de 5 est arrondie.
  const [hour, setHour] = useState(() => (value ? Number(value.slice(0, 2)) : 9));
  const [minute, setMinute] = useState(() => (value ? Math.min(11, Math.round(Number(value.slice(3, 5)) / 5)) : 0));
  return (
    <AppModal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('cancel')} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.modalHeader}>
            <AppText size="lg" weight="bold" style={styles.flex}>
              {label}
            </AppText>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('cancel')}>
              <Ionicons name="close" size={26} color={colors.navy} />
            </Pressable>
          </View>
          {/* Heures à gauche, minutes à droite, même en arabe : une heure se lit de gauche à droite. */}
          <View style={styles.wheels}>
            <View style={styles.wheelBand} pointerEvents="none" />
            <Wheel items={HOURS} index={hour} onChange={setHour} label={t('hour')} />
            <AppText size="xl" weight="bold">
              :
            </AppText>
            <Wheel items={MINUTES} index={minute} onChange={setMinute} label={t('minutes')} />
          </View>
          <Button label={t('confirm')} onPress={() => onPick(`${HOURS[hour]}:${MINUTES[minute]}`)} />
        </SafeAreaView>
      </View>
    </AppModal>
  );
}

/** Roue verticale : la valeur au centre est la valeur choisie ; le défilement se cale sur un élément. */
function Wheel({ items, index, onChange, label }: { items: string[]; index: number; onChange: (i: number) => void; label: string }) {
  const ref = useRef<ScrollViewInstance>(null);
  const [current, setCurrent] = useState(index);
  const at = (y: number) => Math.max(0, Math.min(items.length - 1, Math.round(y / WHEEL_ITEM)));
  const select = (i: number, scroll: boolean) => {
    if (scroll) ref.current?.scrollTo({ y: i * WHEEL_ITEM, animated: true });
    setCurrent(i);
    onChange(i);
  };
  return (
    <ScrollView
      ref={ref}
      style={styles.wheel}
      contentContainerStyle={{ paddingVertical: WHEEL_ITEM * Math.floor(WHEEL_ROWS / 2) }}
      contentOffset={{ x: 0, y: index * WHEEL_ITEM }}
      onLayout={() => ref.current?.scrollTo({ y: index * WHEEL_ITEM, animated: false })}
      snapToInterval={WHEEL_ITEM}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={(e) => setCurrent(at(e.nativeEvent.contentOffset.y))}
      onMomentumScrollEnd={(e) => select(at(e.nativeEvent.contentOffset.y), false)}
      onScrollEndDrag={(e) => {
        // Relâchée sans élan : aucune fin d'inertie ne suivra.
        if (!e.nativeEvent.velocity?.y) select(at(e.nativeEvent.contentOffset.y), false);
      }}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: items[current] }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) =>
        select(Math.max(0, Math.min(items.length - 1, current + (e.nativeEvent.actionName === 'increment' ? 1 : -1))), true)
      }
    >
      {items.map((item, i) => {
        const distance = Math.abs(i - current);
        return (
          <Pressable key={item} style={styles.wheelItem} onPress={() => select(i, true)} accessible={false}>
            <AppText
              size={distance === 0 ? 'xl' : 'lg'}
              weight={distance === 0 ? 'bold' : 'regular'}
              color={distance === 0 ? colors.navy : colors.textSubtle}
              style={{ opacity: distance > 1 ? 0.5 : 1 }}
            >
              {item}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(28,28,46,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.card * 2, borderTopRightRadius: radii.card * 2, paddingHorizontal: space(4), paddingBottom: space(4) },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(4) },
  monthNav: { flexDirection: 'row', alignItems: 'center', marginBottom: space(2) },
  navButton: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { flex: 1, minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(1) },
  week: { flexDirection: 'row' },
  weekDay: { flex: 1, textAlign: 'center', paddingVertical: space(1) },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, height: MIN_TOUCH + 4, alignItems: 'center', justifyContent: 'center' },
  // Cercle borné par la colonne : sur un écran de 320 px, une colonne fait moins de MIN_TOUCH.
  dayInner: { width: '100%', maxWidth: MIN_TOUCH, aspectRatio: 1, borderRadius: MIN_TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  dayToday: { borderWidth: 1, borderColor: colors.primary },
  cellSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), paddingVertical: space(2) },
  wheels: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', justifyContent: 'center', gap: space(4), marginBottom: space(4) },
  wheel: { height: WHEEL_ITEM * WHEEL_ROWS, width: 72, flexGrow: 0 },
  wheelItem: { height: WHEEL_ITEM, alignItems: 'center', justifyContent: 'center' },
  // Bandeau derrière la ligne choisie, au centre des roues.
  wheelBand: { position: 'absolute', start: 0, end: 0, top: WHEEL_ITEM * Math.floor(WHEEL_ROWS / 2), height: WHEEL_ITEM, borderRadius: radii.input, backgroundColor: colors.background },
  timeField: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: MIN_TOUCH },
  yearCell: { width: '23%', minHeight: MIN_TOUCH, borderRadius: radii.chip, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
