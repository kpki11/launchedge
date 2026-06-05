// src/components/GoldButton.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { Theme } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';

interface GoldButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'outlined' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  size?: 'sm' | 'md' | 'lg';
}

export function GoldButton({ label, onPress, variant = 'filled', loading, disabled, style, size = 'md' }: GoldButtonProps) {
  const isFilled = variant === 'filled';
  const isOutlined = variant === 'outlined';
  return (
    <TouchableOpacity
      style={[
        styles.base,
        isFilled && styles.filled,
        isOutlined && styles.outlined,
        !isFilled && !isOutlined && styles.ghost,
        size === 'sm' && styles.sm,
        size === 'lg' && styles.lg,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={isFilled ? '#fff' : Theme.primary} size="small" />
        : <Text style={[styles.text, isFilled && styles.textFilled, isOutlined && styles.textOutlined, !isFilled && !isOutlined && styles.textGhost]}>
            {label}
          </Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  filled:   { backgroundColor: Theme.primary },
  outlined: { borderWidth: 1.5, borderColor: Theme.primary, backgroundColor: 'transparent' },
  ghost:    { backgroundColor: 'transparent' },
  sm:       { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg },
  lg:       { paddingVertical: Spacing.xl, paddingHorizontal: Spacing.xxl },
  disabled: { opacity: 0.5 },
  text:         { ...Typography.label, fontSize: 14, fontFamily: 'DMSans_600SemiBold' },
  textFilled:   { color: Theme.background },
  textOutlined: { color: Theme.primary },
  textGhost:    { color: Theme.primary },
});
