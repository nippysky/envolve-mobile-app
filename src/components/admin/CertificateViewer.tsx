/**
 * PCN certificate.
 *
 * ## Why a PDF certificate showed a blank page
 *
 * Cloudinary **blocks delivery of PDF files by default** (Settings → Security →
 * "Allow delivery of PDF and ZIP files"). A blocked request returns 401, which
 * Safari draws as a broken-image icon and an image view reports as a load
 * failure. The file was never the problem — the account wouldn't serve it in
 * its original form.
 *
 * The server sidesteps this by also returning `preview_url`: a signed
 * transformation that rasterises page one to JPEG. Image delivery isn't
 * restricted, so the preview renders regardless of what was uploaded — PDF,
 * HEIC, TIFF.
 *
 * ## Never rewrite these URLs
 *
 * Both are signed, and the signature covers the transformation string.
 * Appending `f_auto` or `pg_1` client-side invalidates them — an earlier
 * version of this component did exactly that and broke working certificates.
 * The preview transformation is built and signed server-side for that reason.
 *
 * ## Two ways to read it
 *
 * The preview renders inline so a reviewer can check the licence without
 * leaving the approve/reject buttons. "Open original" hands the untouched file
 * to the device's viewer for anyone who wants to zoom, print or save it —
 * which is also the path that still works if the preview transformation ever
 * fails.
 */

import React, { useCallback, useState } from 'react';
import { View, Linking, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Pressable } from '@/components/ui/Pressable';
import { Icon } from '@/components/ui/Icon';
import { Surface } from '@/components/ui/Surface';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { toast } from '@/lib/toast';

export interface CertificateViewerProps {
  /** The original file, exactly as stored. */
  url:         string;
  /** Signed JPEG of page one. Safe to render for any source format. */
  previewUrl?: string;
  isPdf?:      boolean;
  /** Provenance, e.g. the pharmacy name. */
  label?:      string;
}

const isHttp = (u: string) => /^https?:\/\//i.test(u);

export function CertificateViewer({ url, previewUrl, isPdf, label }: CertificateViewerProps) {
  const { width } = useWindowDimensions();

  const original = (url ?? '').trim();
  const preview  = (previewUrl ?? '').trim() || original;

  const canOpen    = isHttp(original);
  const canPreview = isHttp(preview);

  const [failed,  setFailed]  = useState(false);
  const [loading, setLoading] = useState(canPreview);
  const [opening, setOpening] = useState(false);

  const openOriginal = useCallback(async () => {
    if (!canOpen || opening) return;
    setOpening(true);

    try {
      // Untouched. Never rewrite a signed URL.
      await WebBrowser.openBrowserAsync(original, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        dismissButtonStyle: 'close',
        toolbarColor: color.bg,
        enableBarCollapsing: true,
      });
      return;
    } catch {
      // In-app browser refused — try the system one before blaming the device.
    } finally {
      setOpening(false);
    }

    try {
      await Linking.openURL(original);
    } catch {
      toast.error(
        'Neither the in-app browser nor Safari would open this file.',
        'Couldn’t open',
      );
    }
  }, [original, canOpen, opening]);

  /* ── Nothing to show ── */
  if (!canOpen && !canPreview) {
    return (
      <Surface tone="warning" level="none" padded="base" rounded="lg">
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <Icon name="alert" size={20} color={color.warning} filled />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyMedium" style={{ color: '#92400e' }}>
              Certificate link unavailable
            </Text>
            <Text variant="caption" style={{ color: '#a16207' }}>
              The record says one was uploaded, but no link came back for it.
              Check the web console before approving.
            </Text>
          </View>
        </View>
      </Surface>
    );
  }

  const previewHeight = Math.min((width - gutter * 2) * 1.25, 440);

  return (
    <Surface level="sm" padded="none" rounded="lg" style={{ overflow: 'hidden' }}>
      {/* ── Preview ── */}
      {canPreview && !failed ? (
        <Pressable
          onPress={openOriginal}
          haptic="light"
          pressScale={0.995}
          accessibilityRole="imagebutton"
          accessibilityLabel="PCN certificate. Tap to open the original full screen."
        >
          <View style={{ height: previewHeight, backgroundColor: color.surfaceSubtle }}>
            <Image
              source={{ uri: preview }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
              transition={220}
              cachePolicy="memory-disk"
              onLoadEnd={() => setLoading(false)}
              onError={() => { setFailed(true); setLoading(false); }}
            />

            {loading ? (
              <View style={{
                position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                alignItems: 'center', justifyContent: 'center', gap: space.sm,
              }}>
                <Icon name="image" size={26} color={color.textDisabled} />
                <Text variant="caption" tone="disabled">Loading certificate…</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      ) : (
        /* Preview unavailable — say so plainly rather than showing a blank box.
           The original is still openable, and that's the button below. */
        <View style={{
          paddingHorizontal: space.base,
          paddingTop: space.base,
          flexDirection: 'row', alignItems: 'center', gap: space.md,
        }}>
          <View style={{
            width: 44, height: 44, borderRadius: radius.md,
            backgroundColor: color.warningSoft,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="alert" size={20} color={color.warning} filled />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyMedium">Preview unavailable</Text>
            <Text variant="caption" tone="tertiary">
              Open the original to check it. Don’t approve a document you
              couldn’t read.
            </Text>
          </View>
        </View>
      )}

      {/* ── Footer ── */}
      <Animated.View
        entering={FadeIn.duration(240)}
        style={{
          padding: space.base,
          gap: space.md,
          borderTopWidth: canPreview && !failed ? layout.hairlineWidth : 0,
          borderTopColor: color.borderSubtle,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Icon name={isPdf ? 'document' : 'image'} size={16} color={color.textTertiary} />
          <View style={{ flex: 1 }}>
            <Text variant="callout">PCN certificate</Text>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {isPdf ? 'PDF document' : 'Image'}{label ? ` · ${label}` : ''}
            </Text>
          </View>
        </View>

        <Button
          fullWidth
          variant={canPreview && !failed ? 'secondary' : 'primary'}
          onPress={openOriginal}
          loading={opening}
          disabled={opening || !canOpen}
          haptic="medium"
          icon={
            <Icon
              name="eye"
              size={16}
              color={canPreview && !failed ? color.text : '#fff'}
            />
          }
        >
          {opening ? 'Opening…' : 'Open original'}
        </Button>
      </Animated.View>
    </Surface>
  );
}
