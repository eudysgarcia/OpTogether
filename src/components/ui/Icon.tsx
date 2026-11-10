import {
  Archive, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Baby, Ban, Banknote, Bell, Briefcase, Building2, Bus,
  Calculator, Calendar, CalendarDays, Camera, Car, ChartColumn, ChartPie, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleAlert, CircleCheck, CircleDollarSign, Clock, CloudOff, Coins, Copy, CreditCard, Dog, Download, Droplets, Dumbbell,
  Ellipsis, Eye, EyeOff, FileSpreadsheet, FileText, Fingerprint, Flag, Flame, Fuel, Gauge, Gift, GraduationCap, HandCoins,
  Heart, History, House, Image, Info, KeyRound, Landmark, Layers, LayoutGrid, Lightbulb, List, Lock, LogOut, Mail, Menu,
  Monitor, Moon, Package, PartyPopper, Paperclip, Pencil, Phone, PiggyBank, Plane, Plus, Receipt, RefreshCw, Repeat, Scale,
  Search, Settings, Share2, Shield, ShieldCheck, Shirt, ShoppingCart, SlidersHorizontal, Smartphone, Sofa, Sparkles, Split,
  Stethoscope, Sun, Tag, Target, TrendingDown, TrendingUp, Trash2, TriangleAlert, Tv, Undo2, User, UserPlus, Users, Utensils,
  Wallet, Wifi, WifiOff, Wrench, X, Zap, type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import { useTheme } from '../../theme/ThemeProvider';

/** Catálogo cerrado de iconos (los nombres se guardan en la base de datos). */
export const ICONS = {
  home: House, cart: ShoppingCart, wifi: Wifi, zap: Zap, flame: Flame, wallet: Wallet, party: PartyPopper,
  'piggy-bank': PiggyBank, car: Car, plane: Plane, shield: Shield, 'shield-check': ShieldCheck, tv: Tv, droplets: Droplets,
  phone: Phone, smartphone: Smartphone, card: CreditCard, bank: Landmark, 'hand-coins': HandCoins, receipt: Receipt, tag: Tag,
  food: Utensils, heart: Heart, education: GraduationCap, health: Stethoscope, clothes: Shirt, gift: Gift, baby: Baby,
  pet: Dog, fuel: Fuel, bus: Bus, gym: Dumbbell, sofa: Sofa, tools: Wrench, work: Briefcase, 'trending-up': TrendingUp,
  'trending-down': TrendingDown, transfer: ArrowLeftRight, 'arrow-in': ArrowDownLeft, 'arrow-out': ArrowUpRight, plus: Plus,
  x: X, check: Check, 'chevron-right': ChevronRight, 'chevron-left': ChevronLeft, 'chevron-down': ChevronDown,
  calendar: Calendar, 'calendar-days': CalendarDays, bell: Bell, settings: Settings, pie: ChartPie, chart: ChartColumn,
  list: List, search: Search, filter: SlidersHorizontal, paperclip: Paperclip, camera: Camera, image: Image,
  file: FileText, download: Download, trash: Trash2, ban: Ban, history: History, eye: Eye, 'eye-off': EyeOff,
  logout: LogOut, user: User, users: Users, 'user-plus': UserPlus, lock: Lock, key: KeyRound, mail: Mail, moon: Moon,
  sun: Sun, monitor: Monitor, info: Info, alert: TriangleAlert, 'alert-circle': CircleAlert, 'check-circle': CircleCheck,
  clock: Clock, target: Target, calculator: Calculator, sparkles: Sparkles, refresh: RefreshCw, offline: WifiOff,
  copy: Copy, share: Share2, edit: Pencil, more: Ellipsis, archive: Archive, coins: Coins, cash: Banknote,
  building: Building2, idea: Lightbulb, package: Package, repeat: Repeat, 'arrow-right': ArrowRight, undo: Undo2,
  sheet: FileSpreadsheet, scale: Scale, gauge: Gauge, dollar: CircleDollarSign, flag: Flag, layers: Layers, grid: LayoutGrid,
  split: Split, 'cloud-off': CloudOff, fingerprint: Fingerprint, menu: Menu,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Iconos que el usuario puede elegir para categorías, fondos y metas. */
export const PICKABLE_ICONS: IconName[] = [
  'home', 'cart', 'food', 'wifi', 'zap', 'flame', 'droplets', 'phone', 'tv', 'wallet', 'party', 'piggy-bank', 'car', 'fuel',
  'bus', 'plane', 'shield', 'health', 'education', 'clothes', 'gift', 'baby', 'pet', 'gym', 'sofa', 'tools', 'work',
  'card', 'bank', 'hand-coins', 'receipt', 'tag', 'heart', 'coins', 'cash', 'building', 'idea', 'package', 'target', 'flag',
];

export function Icon({
  name, size = 20, color, strokeWidth = 2, accessibilityLabel,
}: { name: string; size?: number; color?: string; strokeWidth?: number; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  const Cmp = (ICONS as Record<string, LucideIcon>)[name] ?? Tag;
  return (
    <Cmp
      size={size}
      color={color ?? colors.text}
      strokeWidth={strokeWidth}
      style={{ flexShrink: 0 }}
      {...(accessibilityLabel ? { accessibilityLabel, accessible: true } : {})}
    />
  );
}
