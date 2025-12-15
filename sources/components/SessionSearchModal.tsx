import * as React from 'react';
import { View, Text, TextInput, FlatList, Pressable, Modal as RNModal, TouchableWithoutFeedback, Platform, Keyboard } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/text';
import { Message } from '@/sync/typesMessage';
import { Typography } from '@/constants/Typography';

interface SessionSearchModalProps {
    visible: boolean;
    onClose: () => void;
    messages: Message[];
    onMessagePress: (messageId: string) => void;
}

interface SearchResult {
    message: Message;
    snippet: string;
    matchStart: number;
    matchEnd: number;
}

/**
 * Extract text content from a message for searching
 */
function getMessageText(message: Message): string {
    switch (message.kind) {
        case 'user-text':
            return message.text;
        case 'agent-text':
            return message.text;
        case 'tool-call':
            // Include tool name and description
            const toolText = [message.tool?.name, message.tool?.description].filter(Boolean).join(' ');
            return toolText;
        case 'agent-event':
            if (message.event.type === 'message') {
                return message.event.message;
            }
            return '';
        default:
            return '';
    }
}

/**
 * Create a snippet around the match with highlighted context
 */
function createSnippet(text: string, query: string, maxLength: number = 100): { snippet: string; matchStart: number; matchEnd: number } {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchIndex = lowerText.indexOf(lowerQuery);

    if (matchIndex === -1) {
        return { snippet: text.slice(0, maxLength), matchStart: -1, matchEnd: -1 };
    }

    // Calculate snippet bounds
    const contextSize = Math.floor((maxLength - query.length) / 2);
    let start = Math.max(0, matchIndex - contextSize);
    let end = Math.min(text.length, matchIndex + query.length + contextSize);

    // Adjust for word boundaries
    if (start > 0) {
        const spaceIndex = text.lastIndexOf(' ', start + 10);
        if (spaceIndex > start - 10) {
            start = spaceIndex + 1;
        }
    }

    let snippet = text.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    // Recalculate match position in snippet
    const snippetMatchIndex = snippet.toLowerCase().indexOf(lowerQuery);

    return {
        snippet,
        matchStart: snippetMatchIndex,
        matchEnd: snippetMatchIndex + query.length
    };
}

/**
 * Search messages for a query string
 */
function searchMessages(messages: Message[], query: string): SearchResult[] {
    if (!query.trim()) return [];

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const message of messages) {
        const text = getMessageText(message);
        if (!text) continue;

        if (text.toLowerCase().includes(lowerQuery)) {
            const { snippet, matchStart, matchEnd } = createSnippet(text, query);
            results.push({
                message,
                snippet,
                matchStart,
                matchEnd
            });
        }
    }

    return results;
}

export const SessionSearchModal = React.memo<SessionSearchModalProps>(({
    visible,
    onClose,
    messages,
    onMessagePress
}) => {
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const [query, setQuery] = React.useState('');
    const inputRef = React.useRef<TextInput>(null);

    // Search results
    const results = React.useMemo(() => {
        return searchMessages(messages, query);
    }, [messages, query]);

    // Auto-focus input when modal opens
    React.useEffect(() => {
        if (visible) {
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            setQuery('');
        }
    }, [visible]);

    const handleMessagePress = React.useCallback((messageId: string) => {
        Keyboard.dismiss();
        onMessagePress(messageId);
        onClose();
    }, [onMessagePress, onClose]);

    const renderItem = React.useCallback(({ item }: { item: SearchResult }) => {
        const { message, snippet, matchStart, matchEnd } = item;
        const messageType = message.kind === 'user-text' ? 'You' : message.kind === 'agent-text' ? 'Agent' : 'Tool';

        return (
            <Pressable
                onPress={() => handleMessagePress(message.id)}
                style={({ pressed }) => [
                    styles.resultItem,
                    { backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent' }
                ]}
            >
                <View style={styles.resultHeader}>
                    <Text style={[styles.resultType, { color: theme.colors.textSecondary }]}>
                        {messageType}
                    </Text>
                    <Text style={[styles.resultTime, { color: theme.colors.textSecondary }]}>
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
                <Text style={[styles.resultSnippet, { color: theme.colors.text }]} numberOfLines={2}>
                    {matchStart >= 0 ? (
                        <>
                            {snippet.slice(0, matchStart)}
                            <Text style={{ backgroundColor: theme.colors.warning + '40', fontWeight: '600' }}>
                                {snippet.slice(matchStart, matchEnd)}
                            </Text>
                            {snippet.slice(matchEnd)}
                        </>
                    ) : snippet}
                </Text>
            </Pressable>
        );
    }, [theme, handleMessagePress]);

    return (
        <RNModal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
                {/* Header */}
                <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 8 : insets.top + 8 }]}>
                    <View style={[styles.searchBar, { backgroundColor: theme.colors.input.background }]}>
                        <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
                        <TextInput
                            ref={inputRef}
                            style={[styles.searchInput, { color: theme.colors.text }]}
                            placeholder={t('session.searchPlaceholder')}
                            placeholderTextColor={theme.colors.textSecondary}
                            value={query}
                            onChangeText={setQuery}
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="search"
                        />
                        {query.length > 0 && (
                            <Pressable onPress={() => setQuery('')} hitSlop={10}>
                                <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
                            </Pressable>
                        )}
                    </View>
                    <Pressable onPress={onClose} style={styles.cancelButton} hitSlop={10}>
                        <Text style={[styles.cancelText, { color: theme.colors.textLink }]}>
                            {t('common.cancel')}
                        </Text>
                    </Pressable>
                </View>

                {/* Results */}
                {query.length > 0 ? (
                    results.length > 0 ? (
                        <>
                            <Text style={[styles.resultsCount, { color: theme.colors.textSecondary }]}>
                                {t('session.searchResultsCount', { count: results.length })}
                            </Text>
                            <FlatList
                                data={results}
                                renderItem={renderItem}
                                keyExtractor={(item) => item.message.id}
                                keyboardShouldPersistTaps="handled"
                                contentContainerStyle={styles.resultsList}
                            />
                        </>
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="search" size={48} color={theme.colors.textSecondary} style={{ opacity: 0.5 }} />
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                {t('session.noSearchResults')}
                            </Text>
                        </View>
                    )
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={[styles.hintText, { color: theme.colors.textSecondary }]}>
                            {t('session.searchMessages')}
                        </Text>
                    </View>
                )}
            </View>
        </RNModal>
    );
});

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 12,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: Platform.select({ ios: 10, default: 8 }),
        borderRadius: 10,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        ...Typography.default(),
        padding: 0,
    },
    cancelButton: {
        paddingVertical: 8,
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '500',
    },
    resultsCount: {
        fontSize: 13,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    resultsList: {
        paddingHorizontal: 16,
    },
    resultItem: {
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.divider,
    },
    resultHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    resultType: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    resultTime: {
        fontSize: 12,
    },
    resultSnippet: {
        fontSize: 14,
        lineHeight: 20,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        fontSize: 16,
    },
    hintText: {
        fontSize: 14,
    },
}));
