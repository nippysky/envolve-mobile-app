/**
 * Product tile.
 *
 * Composed for a two-column grid. The things that make it read as premium
 * rather than a generic e-commerce cell:
 *
 *   • The image sits on a tinted plinth with generous padding rather than
 *     bleeding to the edges. Pharmaceutical packshots are photographed on
 *     white — edge-to-edge makes them look like clip art.
 *   • Price is the visual anchor, set in the tabular figure style so columns
 *     align down the grid.
 *   • Out-of-stock desaturates the whole tile instead of stamping a badge
 *     over it. Reading it as "dimmed" is faster than reading a label.
 *   • Discounts show the struck original beside the new price, never a
 *     percentage alone.
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text, Pressable, Icon } from '@/components/ui';
import { color, space, radius, elevation } from '@/constants/theme';
import { formatNaira } from '@/lib/format';
import type { CatalogProduct } from '@/lib/services/catalog.service';

export interface ProductCardProps {
  product:  CatalogProduct;
  onPress:  () => void;
  /** Row index — drives the entrance stagger. */
  index?:   number;
  style?:   StyleProp<ViewStyle>;
}

export function ProductCard({ product, onPress, index = 0, style }: ProductCardProps) {
  const hasDiscount =
    product.final_price != null && product.final_price < product.selling_price;

  const price = hasDiscount ? product.final_price! : product.selling_price;
  const unpriced = price <= 0;

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(360)}
      style={[{ flex: 1 }, style]}
    >
      <Pressable
        onPress={onPress}
        haptic="light"
        pressScale={0.97}
        accessibilityRole="button"
        accessibilityLabel={`${product.brand_name}, ${unpriced ? 'price on request' : formatNaira(price)}`}
        style={{
          backgroundColor: color.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: color.borderSubtle,
          overflow: 'hidden',
          ...elevation.sm,
          // Out of stock reads as dimmed rather than badged.
          opacity: product.in_stock ? 1 : 0.55,
        }}
      >
        {/* Plinth */}
        <View
          style={{
            aspectRatio: 1,
            backgroundColor: color.surfaceSubtle,
            alignItems: 'center',
            justifyContent: 'center',
            padding: space.base,
          }}
        >
          {product.primary_image ? (
            <Image
              source={{ uri: product.primary_image }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
              transition={220}
              cachePolicy="memory-disk"
              // Placeholder keeps the tile from flashing white while decoding.
              placeholder={{ blurhash: 'L6PZfSjE.AyE_3t7t7R**0o#DgR4' }}
            />
          ) : (
            <Icon name="product" size={34} color={color.textDisabled} />
          )}

          {hasDiscount ? (
            <View
              style={{
                position: 'absolute', top: space.sm, left: space.sm,
                paddingHorizontal: space.sm, paddingVertical: 3,
                borderRadius: radius.full,
                backgroundColor: color.danger,
              }}
            >
              <Text variant="caption" style={{ color: '#fff', fontWeight: '700', fontSize: 10 }}>
                −{Math.round(product.discount_percentage ?? 0)}%
              </Text>
            </View>
          ) : null}

          {!product.in_stock ? (
            <View
              style={{
                position: 'absolute', bottom: space.sm,
                paddingHorizontal: space.md, paddingVertical: 4,
                borderRadius: radius.full,
                backgroundColor: color.text,
              }}
            >
              <Text variant="caption" style={{ color: '#fff', fontWeight: '600', fontSize: 10 }}>
                Out of stock
              </Text>
            </View>
          ) : null}
        </View>

        {/* Detail */}
        <View style={{ padding: space.md, gap: 3 }}>
          <Text variant="bodyMedium" numberOfLines={2} style={{ minHeight: 40 }}>
            {product.brand_name}
          </Text>

          {product.generic_name ? (
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {product.generic_name}
              {product.product_strength ? ` · ${product.product_strength}` : ''}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs, marginTop: space.xs }}>
            {unpriced ? (
              <Text variant="callout" tone="tertiary">Price on request</Text>
            ) : (
              <>
                <Text variant="headline" style={{ color: color.text }}>
                  {formatNaira(price)}
                </Text>
                {hasDiscount ? (
                  <Text
                    variant="caption"
                    tone="disabled"
                    style={{ textDecorationLine: 'line-through' }}
                  >
                    {formatNaira(product.selling_price)}
                  </Text>
                ) : null}
              </>
            )}
          </View>

          {product.pack_size ? (
            <Text variant="caption" tone="disabled" numberOfLines={1}>
              {product.pack_size}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
