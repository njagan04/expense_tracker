import { Alert } from 'react-native';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import type { Entry, EntryType } from './api';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// Dark fintech palette: near-black surfaces, one violet accent, bright category colours.
export const colors = {
  bg: '#07070B',
  card: '#12121A',
  glass: 'rgba(16,16,26,0.34)', // see-through card surface: whatever passes behind shows through, dimmed
  elevated: '#1C1C28',
  pressed: '#242432',
  border: 'rgba(255,255,255,0.07)', // thin light edge that gives cards a glass-like lift
  text: '#F4F4F7',
  muted: '#A9A9B8', // secondary text; kept light enough to read on dark glass
  faint: '#4B4B5A',
  separator: 'rgba(255,255,255,0.06)',
  fill: 'rgba(255,255,255,0.07)',
  accent: '#8F7CFF',
  onAccent: '#FFFFFF',
  violet: '#B9A8FF',
  green: '#3EE089',
  red: '#FF5D6C',
  orange: '#FFA94D',
  yellow: '#FFD43B',
  purple: '#B57CFF',
  indigo: '#7C83FF',
  blue: '#4DA3FF',
  teal: '#2DD4BF',
  pink: '#FF6FB1',
  brown: '#C8A27A',
  gray: '#8B8B9A',
};

export const heroGradient = ['#8E78FF', '#5B3FE0', '#2B1C80'] as const;
export const peopleGradient = ['#3A3360', '#221D3D'] as const;
export const ACCOUNT_COLORS = [colors.blue, colors.violet, colors.orange, colors.teal, colors.pink, colors.green, colors.yellow];
export const accountColor = (id: number) => ACCOUNT_COLORS[(id - 1) % ACCOUNT_COLORS.length];

const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export const inr = (n: number) => fmt.format(n).replace(/\.00$/, ''); // whole rupees show without ".00"

// Local date -> "YYYY-MM-DD" (toISOString would use UTC and shift the day in IST).
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const monthKey = (d: Date) => ymd(d).slice(0, 7);
export const monthLabel = (d: Date) => d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
export const longToday = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
export const dayLabel = (s: string) => {
  const today = ymd(new Date());
  const yest = ymd(new Date(Date.now() - 86_400_000));
  return s === today ? 'Today' : s === yest ? 'Yesterday'
    : new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const TYPE_LABEL: Record<EntryType, string> = {
  expense: 'Expense', income: 'Income', transfer: 'Transfer', lend: 'Lent', repay: 'Got back',
};

export const TYPE_STYLE: Record<EntryType, { icon: IconName; color: string }> = {
  expense: { icon: 'arrow-up', color: colors.red },
  income: { icon: 'arrow-down', color: colors.green },
  transfer: { icon: 'swap-horizontal', color: colors.blue },
  lend: { icon: 'person', color: colors.orange },
  repay: { icon: 'checkmark', color: colors.teal },
};

// Picks an icon + colour from the category name; anything unknown gets a grey tag.
const CATEGORY_STYLES: [RegExp, IconName, string][] = [
  [/bever|drink|juice|tea|coffee|chai/i, 'cafe', colors.brown],
  [/food|eat|restaurant|lunch|dinner|snack|biriyani/i, 'restaurant', colors.orange],
  [/grocer|vegetable|market|milk/i, 'cart', colors.green],
  [/fuel|petrol|diesel/i, 'flame', colors.red],
  [/travel|trip|flight|holiday/i, 'airplane', colors.teal],
  [/transport|cab|uber|auto|bus|train|metro/i, 'car', colors.blue],
  [/subscri|netflix|ott|spotify|prime/i, 'repeat', colors.purple],
  [/bill|electric|water|phone|recharge|internet|wifi/i, 'receipt', colors.yellow],
  [/rent|house|home/i, 'home', colors.indigo],
  [/shop|cloth/i, 'bag-handle', colors.pink],
  [/personal|salon|hair|groom|care/i, 'cut', colors.violet],
  [/health|medic|doctor|hospital|gym|pharma/i, 'medkit', colors.red],
  [/entertain|movie|film|fun|game/i, 'film', colors.purple],
  [/salary|income|bonus/i, 'cash', colors.green],
  [/gift/i, 'gift', colors.pink],
  [/family|mom|dad|parent/i, 'heart', colors.pink],
  [/emi|loan|credit/i, 'card', colors.orange],
  [/educat|book|course|school|college/i, 'school', colors.teal],
  [/invest|stock|mutual|sip|fd/i, 'trending-up', colors.green],
  [/other|misc/i, 'ellipsis-horizontal', colors.gray],
];
export const categoryStyle = (name: string | null): { icon: IconName; color: string } => {
  const hit = CATEGORY_STYLES.find(([re]) => name && re.test(name));
  return hit ? { icon: hit[1], color: hit[2] } : { icon: 'pricetag', color: colors.brown };
};

export const entryStyle = (e: Entry): { icon: IconName; color: string } =>
  (e.type === 'expense' || e.type === 'income') && e.category ? categoryStyle(e.category)
  : e.type === 'expense' && e.person ? { icon: 'paper-plane', color: colors.violet } // "Sent to <person>"
  : TYPE_STYLE[e.type];

// +1 money in, -1 money out, 0 moved between own accounts.
export const direction = (e: Entry) => (e.type === 'income' || e.type === 'repay' ? 1 : e.type === 'transfer' ? 0 : -1);

export const showError = (e: unknown) => Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));



// Single-user app: shown in the Home greeting and Settings.

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
