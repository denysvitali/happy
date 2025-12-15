import * as React from 'react';
import { Text, View, Platform, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/text';
import { hapticsLight } from './haptics';

interface CollapsibleCodeViewProps {
    code: string;
    language?: string;
    /** Number of lines before collapsing. Default is 20 */
    collapsedLines?: number;
}

/**
 * A code view that auto-collapses content beyond a certain number of lines
 */
export const CollapsibleCodeView = React.memo<CollapsibleCodeViewProps>(({
    code,
    language,
    collapsedLines = 20
}) => {
    const { theme } = useUnistyles();
    const [isExpanded, setIsExpanded] = React.useState(false);

    const lines = code.split('\n');
    const totalLines = lines.length;
    const shouldCollapse = totalLines > collapsedLines;

    const displayCode = React.useMemo(() => {
        if (!shouldCollapse || isExpanded) {
            return code;
        }
        return lines.slice(0, collapsedLines).join('\n');
    }, [code, lines, shouldCollapse, isExpanded, collapsedLines]);

    const handleToggle = React.useCallback(() => {
        hapticsLight();
        setIsExpanded(prev => !prev);
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.codeBlock}>
                <Text style={styles.codeText}>{displayCode}</Text>
            </View>

            {shouldCollapse && (
                <Pressable
                    onPress={handleToggle}
                    style={({ pressed }) => [
                        styles.toggleButton,
                        { backgroundColor: theme.colors.surfaceHigh },
                        pressed && styles.toggleButtonPressed
                    ]}
                >
                    <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={theme.colors.textSecondary}
                    />
                    <Text style={[styles.toggleText, { color: theme.colors.textSecondary }]}>
                        {isExpanded
                            ? t('common.showLess')
                            : `${t('common.showMore')} (${totalLines - collapsedLines} ${totalLines - collapsedLines === 1 ? 'line' : 'lines'})`
                        }
                    </Text>
                </Pressable>
            )}
        </View>
    );
});

const styles = StyleSheet.create((theme) => ({
    container: {
        overflow: 'hidden',
    },
    codeBlock: {
        backgroundColor: theme.colors.surfaceHigh,
        borderRadius: 6,
        padding: 12,
    },
    codeText: {
        fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
        fontSize: 12,
        color: theme.colors.text,
        lineHeight: 18,
    },
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginTop: 4,
        borderRadius: 6,
        gap: 4,
    },
    toggleButtonPressed: {
        opacity: 0.7,
    },
    toggleText: {
        fontSize: 12,
        fontWeight: '500',
    },
}));
