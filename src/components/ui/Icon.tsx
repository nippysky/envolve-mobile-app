/**
 * Icon.
 *
 * Native symbol sets, not a bundled icon font:
 *   iOS      → SF Symbols   (what Apple's own apps use)
 *   Android  → Material Symbols
 *
 * OUTLINE / FILLED DUALITY
 * ------------------------
 * Inactive states use the outlined form, active states the filled one. This is
 * the single most recognisable "considered app" tell — it's what iOS itself
 * does in its tab bars, and what Aku does.
 *
 * On iOS this is free: SF Symbols name their filled variants `<base>.fill`, so
 * the map stores the outline name and `.fill` is appended when active. A few
 * symbols (chevrons, magnifyingglass, glyphs that are already a single stroke)
 * have no filled counterpart — those are marked `solid: true` and render the
 * same either way rather than silently falling back to a missing symbol.
 *
 * On Android, expo-symbols exposes Material Symbols by name only — the fill
 * axis isn't reachable through the `type` prop, which is iOS-only. Where
 * Material ships a genuinely distinct filled glyph the name is listed
 * explicitly; otherwise the outlined glyph is used for both and the active
 * state is carried by tint and weight instead. That's a platform limitation,
 * not an oversight.
 */

import React from 'react';
import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

export type IconName =
  // Navigation
  | 'overview' | 'orders' | 'customers' | 'profile' | 'shop' | 'cart'
  | 'deliveries' | 'products' | 'inventory' | 'team' | 'reports' | 'settings'
  | 'notifications' | 'referrals' | 'track'
  // Actions
  | 'search' | 'back' | 'close' | 'plus' | 'minus' | 'edit' | 'trash' | 'filter'
  | 'copy'
  | 'refresh' | 'logout' | 'upload' | 'download' | 'share' | 'more' | 'copy'
  // Chevrons
  | 'chevron-right' | 'chevron-left' | 'chevron-down' | 'chevron-up'
  // State
  | 'eye' | 'eye-off' | 'alert' | 'check' | 'check-circle' | 'info'
  | 'clock' | 'star' | 'lock'
  // Domain
  | 'truck' | 'product' | 'image' | 'money' | 'card' | 'clipboard'
  | 'building' | 'user-plus' | 'document' | 'shield'
  | 'bank' | 'receipt' | 'home' | 'sparkles' | 'bank' | 'receipt'
  | 'home' | 'sparkles'
  // Contact
  | 'phone' | 'email' | 'location' | 'calendar' | 'chart';

interface SymbolDef {
  /** Outlined SF Symbol — the base name. */
  ios: SFSymbol;
  /** Material Symbol name (outlined set). */
  android: string;
  /**
   * Explicit filled SF Symbol, when it isn't simply `<ios>.fill`.
   */
  iosFilled?: SFSymbol;
  /** Distinct Material glyph for the filled state, where one exists. */
  androidFilled?: string;
  /** Glyph has no filled counterpart — render identically in both states. */
  solid?: boolean;
}

const SYMBOLS: Record<IconName, SymbolDef> = {
  // ── Navigation ──────────────────────────────────────────────────────────
  overview:      { ios: 'square.grid.2x2',      android: 'grid_view' },
  orders:        { ios: 'shippingbox',          android: 'package_2' },
  customers:     { ios: 'person.2',             android: 'group' },
  profile:       { ios: 'person.crop.circle',   android: 'account_circle' },
  shop:          { ios: 'storefront',           android: 'storefront' },
  cart:          { ios: 'cart',                 android: 'shopping_cart' },
  deliveries:    { ios: 'box.truck',            android: 'local_shipping' },
  products:      { ios: 'pills',                android: 'medication' },
  inventory:     { ios: 'archivebox',           android: 'inventory_2' },
  team:          { ios: 'person.3',             android: 'groups' },
  reports:       { ios: 'chart.bar',            android: 'bar_chart' },
  settings:      { ios: 'gearshape',            android: 'settings' },
  notifications: { ios: 'bell',                 android: 'notifications' },
  referrals:     { ios: 'gift',                 android: 'redeem' },
  track:         { ios: 'location.magnifyingglass', android: 'travel_explore', solid: true },

  // ── Actions ─────────────────────────────────────────────────────────────
  search:   { ios: 'magnifyingglass',                    android: 'search',    solid: true },
  back:     { ios: 'chevron.left',                       android: 'arrow_back', solid: true },
  close:    { ios: 'xmark',                              android: 'close',     solid: true },
  plus:     { ios: 'plus',                               android: 'add',       solid: true },
  minus:    { ios: 'minus',                              android: 'remove',    solid: true },
  copy:     { ios: 'doc.on.doc',                         android: 'content_copy' },
  edit:     { ios: 'pencil',                             android: 'edit',      solid: true },
  trash:    { ios: 'trash',                              android: 'delete' },
  filter:   { ios: 'line.3.horizontal.decrease',         android: 'filter_list', solid: true },
  refresh:  { ios: 'arrow.clockwise',                    android: 'refresh',   solid: true },
  logout:   { ios: 'rectangle.portrait.and.arrow.right', android: 'logout',    solid: true },
  upload:   { ios: 'arrow.up.circle',                    android: 'upload' },
  download: { ios: 'arrow.down.circle',                  android: 'download' },
  share:    { ios: 'square.and.arrow.up',                android: 'share',     solid: true },
  more:     { ios: 'ellipsis',                           android: 'more_horiz', solid: true },

  // ── Chevrons — single-stroke, no filled form ────────────────────────────
  'chevron-right': { ios: 'chevron.right', android: 'chevron_right',       solid: true },
  'chevron-left':  { ios: 'chevron.left',  android: 'chevron_left',        solid: true },
  'chevron-down':  { ios: 'chevron.down',  android: 'keyboard_arrow_down', solid: true },
  'chevron-up':    { ios: 'chevron.up',    android: 'keyboard_arrow_up',   solid: true },

  // ── State ───────────────────────────────────────────────────────────────
  eye:            { ios: 'eye',                     android: 'visibility' },
  'eye-off':      { ios: 'eye.slash',               android: 'visibility_off' },
  alert:          { ios: 'exclamationmark.triangle', android: 'warning' },
  check:          { ios: 'checkmark',               android: 'check', solid: true },
  'check-circle': { ios: 'checkmark.circle',        android: 'check_circle' },
  info:           { ios: 'info.circle',             android: 'info' },
  clock:          { ios: 'clock',                   android: 'schedule' },
  star:           { ios: 'star',                    android: 'star' },
  lock:           { ios: 'lock',                    android: 'lock' },

  // ── Domain ──────────────────────────────────────────────────────────────
  truck:       { ios: 'box.truck',        android: 'local_shipping' },
  product:     { ios: 'pill',             android: 'medication' },
  image:       { ios: 'photo',            android: 'image' },
  money:       { ios: 'nairasign.circle', android: 'payments' },
  card:        { ios: 'creditcard',       android: 'credit_card' },
  clipboard:   { ios: 'list.clipboard',   android: 'assignment' },
  building:    { ios: 'building.2',       android: 'apartment' },
  'user-plus': { ios: 'person.badge.plus', android: 'person_add' },
  document:    { ios: 'doc.text',         android: 'description' },
  shield:      { ios: 'checkmark.shield', android: 'verified_user' },
  bank:        { ios: 'building.columns', android: 'account_balance' },
  receipt:     { ios: 'receipt',          android: 'receipt_long' },
  home:        { ios: 'house',            android: 'home' },
  sparkles:    { ios: 'sparkles',         android: 'auto_awesome', solid: true },

  // ── Contact ─────────────────────────────────────────────────────────────
  phone:    { ios: 'phone',              android: 'phone' },
  email:    { ios: 'envelope',           android: 'mail' },
  location: { ios: 'mappin.and.ellipse', android: 'location_on', solid: true },
  calendar: { ios: 'calendar',           android: 'calendar_month', solid: true },
  chart:    { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', solid: true },
};

export type IconWeight =
  | 'ultraLight' | 'thin' | 'light' | 'regular'
  | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black';

export interface IconProps {
  name:    IconName;
  size?:   number;
  color?:  ColorValue;
  /**
   * Render the filled variant. Use for active tabs and selected states;
   * leave false for everything at rest.
   */
  filled?: boolean;
  weight?: IconWeight;
}

export function Icon({
  name,
  size   = 22,
  color,
  filled = false,
  weight,
}: IconProps) {
  const def = SYMBOLS[name];

  const useFilled = filled && !def.solid;

  const ios: SFSymbol = useFilled
    ? (def.iosFilled ?? (`${def.ios}.fill` as SFSymbol))
    : def.ios;

  const android = useFilled ? (def.androidFilled ?? def.android) : def.android;

  // Android can't switch glyph fill, so nudge the stroke weight instead —
  // an active icon reads heavier even when the glyph itself is identical.
  const resolvedWeight: IconWeight =
    weight ?? (useFilled ? 'semibold' : 'regular');

  return (
    <SymbolView
      name={{ ios, android: android as never, web: android as never }}
      size={size}
      tintColor={color}
      weight={resolvedWeight}
    />
  );
}
