/**
 * Icon — cross-platform vector icons via expo-symbols.
 * • iOS:      SF Symbols (native, crisp, weight-aware)
 * • Android:  Material Symbols (native, filled style)
 *
 * Usage:
 *   <Icon name="orders" size={22} color={Colors.brand} />
 */

import React from 'react';
import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

export type IconName =
  | 'overview'
  | 'orders'
  | 'customers'
  | 'profile'
  | 'shop'
  | 'cart'
  | 'search'
  | 'back'
  | 'close'
  | 'plus'
  | 'chevron-right'
  | 'chevron-down'
  | 'eye'
  | 'eye-off'
  | 'alert'
  | 'check'
  | 'check-circle'
  | 'truck'
  | 'image'
  | 'refresh'
  | 'logout'
  | 'upload'
  | 'edit'
  | 'trash'
  | 'filter'
  | 'team'
  | 'product'
  | 'lock'
  | 'phone'
  | 'email'
  | 'location'
  | 'star'
  | 'clock'
  | 'info'
  | 'settings'
  | 'calendar'
  | 'chart'
  | 'money'
  | 'user-plus'
  | 'clipboard'
  | 'delivery';

type SymbolMap = {
  ios: SFSymbol;
  android: string;
};

const SYMBOLS: Record<IconName, SymbolMap> = {
  overview:       { ios: 'chart.bar.fill',                               android: 'bar_chart' },
  orders:         { ios: 'shippingbox.fill',                             android: 'package_2' },
  customers:      { ios: 'person.2.fill',                                android: 'group' },
  profile:        { ios: 'person.crop.circle.fill',                      android: 'account_circle' },
  shop:           { ios: 'storefront.fill',                              android: 'storefront' },
  cart:           { ios: 'cart.fill',                                    android: 'shopping_cart' },
  search:         { ios: 'magnifyingglass',                              android: 'search' },
  back:           { ios: 'chevron.left',                                 android: 'chevron_left' },
  close:          { ios: 'xmark',                                        android: 'close' },
  plus:           { ios: 'plus',                                         android: 'add' },
  'chevron-right':{ ios: 'chevron.right',                                android: 'chevron_right' },
  'chevron-down': { ios: 'chevron.down',                                 android: 'keyboard_arrow_down' },
  eye:            { ios: 'eye',                                          android: 'visibility' },
  'eye-off':      { ios: 'eye.slash',                                    android: 'visibility_off' },
  alert:          { ios: 'exclamationmark.triangle.fill',                 android: 'warning' },
  check:          { ios: 'checkmark',                                    android: 'check' },
  'check-circle': { ios: 'checkmark.circle.fill',                        android: 'check_circle' },
  truck:          { ios: 'truck.box.fill',                               android: 'local_shipping' },
  image:          { ios: 'photo',                                        android: 'image' },
  refresh:        { ios: 'arrow.counterclockwise',                       android: 'refresh' },
  logout:         { ios: 'rectangle.portrait.and.arrow.right',           android: 'logout' },
  upload:         { ios: 'arrow.up.to.line',                             android: 'upload' },
  edit:           { ios: 'pencil',                                       android: 'edit' },
  trash:          { ios: 'trash',                                        android: 'delete' },
  filter:         { ios: 'line.3.horizontal.decrease',                   android: 'filter_list' },
  team:           { ios: 'person.badge.plus',                            android: 'group_add' },
  product:        { ios: 'pill',                                         android: 'medication' },
  lock:           { ios: 'lock.fill',                                    android: 'lock' },
  phone:          { ios: 'phone.fill',                                   android: 'phone' },
  email:          { ios: 'envelope.fill',                                android: 'email' },
  location:       { ios: 'mappin.and.ellipse',                           android: 'location_on' },
  star:           { ios: 'star.fill',                                    android: 'star' },
  clock:          { ios: 'clock.fill',                                   android: 'schedule' },
  info:           { ios: 'info.circle.fill',                             android: 'info' },
  settings:       { ios: 'gearshape.fill',                               android: 'settings' },
  calendar:       { ios: 'calendar',                                     android: 'calendar_month' },
  chart:          { ios: 'chart.line.uptrend.xyaxis',                    android: 'trending_up' },
  money:          { ios: 'nairasign.circle.fill',                        android: 'monetization_on' },
  'user-plus':    { ios: 'person.badge.plus.fill',                       android: 'person_add' },
  clipboard:      { ios: 'clipboard.fill',                               android: 'assignment' },
  delivery:       { ios: 'box.truck.fill',                               android: 'delivery_dining' },
};

interface IconProps {
  name:    IconName;
  size?:   number;
  color?:  ColorValue;
  weight?: 'ultraLight' | 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black';
}

export function Icon({ name, size = 22, color, weight = 'regular' }: IconProps) {
  const sym = SYMBOLS[name];
  return (
    <SymbolView
      name={{ ios: sym.ios, android: sym.android as any, web: sym.android as any }}
      size={size}
      tintColor={color}
      weight={weight}
    />
  );
}
