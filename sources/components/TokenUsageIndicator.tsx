import * as React from 'react';
import { View, Text, Pressable, Modal as RNModal, TouchableWithoutFeedback, Platform } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/text';
import { hapticsLight } from './haptics';

interface TokenUsageData {
    inputTokens: number;
    outputTokens: number;
    cacheCreation: number;
    cacheRead: number;
    contextSize: number;
}

interface TokenUsageIndicatorProps {
    usageData: TokenUsageData | undefined;
}

/**
 * Format large numbers with K/M suffixes for compact display
 */
function formatCompactNumber(num: number): string {
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
}

/**
 * Format numbers with thousand separators for detail view
 */
function formatNumber(num: number): string {
    return num.toLocaleString();
}

export const TokenUsageIndicator = React.memo<TokenUsageIndicatorProps>(({ usageData }) => {
    const { theme } = useUnistyles();
    const [showDetails, setShowDetails] = React.useState(false);

    if (!usageData) {
        return null;
    }

    const totalTokens = usageData.inputTokens + usageData.outputTokens;
    const cacheEfficiency = usageData.inputTokens > 0
        ? Math.round((usageData.cacheRead / usageData.inputTokens) * 100)
        : 0;

    const handlePress = React.useCallback(() => {
        hapticsLight();
        setShowDetails(true);
    }, []);

    const handleClose = React.useCallback(() => {
        setShowDetails(false);
    }, []);

    return (
        <>
            {/* Compact indicator - tappable */}
            <Pressable
                onPress={handlePress}
                style={({ pressed }) => [
                    styles.indicator,
                    pressed && styles.indicatorPressed
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Ionicons
                    name="analytics-outline"
                    size={12}
                    color={theme.colors.textSecondary}
                    style={{ marginRight: 4 }}
                />
                <Text style={[styles.indicatorText, { color: theme.colors.textSecondary }]}>
                    {formatCompactNumber(totalTokens)}
                </Text>
            </Pressable>

            {/* Detail popup */}
            <RNModal
                visible={showDetails}
                transparent
                animationType="fade"
                onRequestClose={handleClose}
            >
                <TouchableWithoutFeedback onPress={handleClose}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={[styles.modalContent, { backgroundColor: theme.colors.surfaceHighest }]}>
                                {/* Header */}
                                <View style={styles.modalHeader}>
                                    <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                                        {t('usage.tokenUsage')}
                                    </Text>
                                    <Pressable onPress={handleClose} hitSlop={10}>
                                        <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                                    </Pressable>
                                </View>

                                {/* Usage rows */}
                                <View style={styles.usageRows}>
                                    <UsageRow
                                        label={t('usage.inputTokens')}
                                        value={formatNumber(usageData.inputTokens)}
                                        theme={theme}
                                    />
                                    <UsageRow
                                        label={t('usage.outputTokens')}
                                        value={formatNumber(usageData.outputTokens)}
                                        theme={theme}
                                    />
                                    <View style={[styles.divider, { backgroundColor: theme.colors.divider }]} />
                                    <UsageRow
                                        label={t('usage.cacheCreation')}
                                        value={formatNumber(usageData.cacheCreation)}
                                        theme={theme}
                                    />
                                    <UsageRow
                                        label={t('usage.cacheRead')}
                                        value={formatNumber(usageData.cacheRead)}
                                        subtitle={cacheEfficiency > 0 ? `${cacheEfficiency}% ${t('usage.saved')}` : undefined}
                                        subtitleColor={theme.colors.success}
                                        theme={theme}
                                    />
                                    <View style={[styles.divider, { backgroundColor: theme.colors.divider }]} />
                                    <UsageRow
                                        label={t('usage.contextSize')}
                                        value={formatNumber(usageData.contextSize)}
                                        theme={theme}
                                    />
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </RNModal>
        </>
    );
});

interface UsageRowProps {
    label: string;
    value: string;
    subtitle?: string;
    subtitleColor?: string;
    theme: any;
}

const UsageRow = React.memo<UsageRowProps>(({ label, value, subtitle, subtitleColor, theme }) => (
    <View style={styles.usageRow}>
        <Text style={[styles.usageLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
        <View style={styles.usageValueContainer}>
            <Text style={[styles.usageValue, { color: theme.colors.text }]}>{value}</Text>
            {subtitle && (
                <Text style={[styles.usageSubtitle, { color: subtitleColor || theme.colors.textSecondary }]}>
                    {subtitle}
                </Text>
            )}
        </View>
    </View>
));

const styles = StyleSheet.create((theme) => ({
    indicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    indicatorPressed: {
        opacity: 0.6,
    },
    indicatorText: {
        fontSize: 11,
        ...Typography.default(),
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 320,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        ...Typography.default('semiBold'),
    },
    usageRows: {
        gap: 12,
    },
    usageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    usageLabel: {
        fontSize: 14,
        ...Typography.default(),
    },
    usageValueContainer: {
        alignItems: 'flex-end',
    },
    usageValue: {
        fontSize: 14,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
        ...Typography.default('semiBold'),
    },
    usageSubtitle: {
        fontSize: 11,
        marginTop: 2,
        ...Typography.default(),
    },
    divider: {
        height: 1,
        marginVertical: 4,
    },
}));
