import * as React from 'react';
import { useSession, useSessionMessages } from "@/sync/storage";
import { FlatList, Platform, View, Pressable, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useCallback, useRef, useState } from 'react';
import { useHeaderHeight } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageView } from './MessageView';
import { Metadata, Session } from '@/sync/storageTypes';
import { ChatFooter } from './ChatFooter';
import { Message } from '@/sync/typesMessage';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { t } from '@/text';
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';

export const ChatList = React.memo((props: { session: Session }) => {
    const { messages } = useSessionMessages(props.session.id);
    return (
        <ChatListInternal
            metadata={props.session.metadata}
            sessionId={props.session.id}
            messages={messages}
        />
    )
});

const ListHeader = React.memo(() => {
    const headerHeight = useHeaderHeight();
    const safeArea = useSafeAreaInsets();
    return <View style={{ flexDirection: 'row', alignItems: 'center', height: headerHeight + safeArea.top + 32 }} />;
});

const ListFooter = React.memo((props: { sessionId: string }) => {
    const session = useSession(props.sessionId)!;
    return (
        <ChatFooter
            controlledByUser={session.agentState?.controlledByUser || false}
            thinking={session.thinking}
            thinkingAt={session.thinkingAt}
        />
    )
});

/**
 * Scroll-to-bottom FAB component
 * Shows when user scrolls up from bottom, hides when at bottom
 */
const ScrollToBottomButton = React.memo((props: {
    visible: boolean;
    onPress: () => void;
}) => {
    const { theme } = useUnistyles();
    const safeArea = useSafeAreaInsets();
    const opacity = useSharedValue(0);

    React.useEffect(() => {
        opacity.value = withTiming(props.visible ? 1 : 0, { duration: 200 });
    }, [props.visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        pointerEvents: opacity.value > 0 ? 'auto' : 'none',
    }));

    return (
        <Animated.View
            style={[
                animatedStyle,
                {
                    position: 'absolute',
                    bottom: safeArea.bottom + 16,
                    right: 16,
                }
            ]}
        >
            <Pressable
                style={({ pressed }) => [
                    styles.scrollButton,
                    pressed ? styles.scrollButtonPressed : styles.scrollButtonDefault
                ]}
                onPress={props.onPress}
                accessibilityLabel={t('common.scrollToLatest')}
            >
                <Ionicons
                    name="chevron-down"
                    size={24}
                    color={theme.colors.fab.icon}
                />
            </Pressable>
        </Animated.View>
    );
});

const ChatListInternal = React.memo((props: {
    metadata: Metadata | null,
    sessionId: string,
    messages: Message[],
}) => {
    const flatListRef = useRef<FlatList>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);

    const keyExtractor = useCallback((item: any) => item.id, []);
    const renderItem = useCallback(({ item }: { item: any }) => (
        <MessageView message={item} metadata={props.metadata} sessionId={props.sessionId} />
    ), [props.metadata, props.sessionId]);

    /**
     * Track scroll position to show/hide scroll button
     * Since list is inverted, offset > 100 means user scrolled up from bottom
     */
    const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        setShowScrollButton(offsetY > 100);
    }, []);

    /**
     * Scroll to the latest message (index 0 since list is inverted)
     */
    const scrollToLatest = useCallback(() => {
        if (props.messages.length > 0) {
            flatListRef.current?.scrollToIndex({
                index: 0,
                animated: true,
            });
        }
    }, [props.messages.length]);

    return (
        <>
            <FlatList
                ref={flatListRef}
                data={props.messages}
                inverted={true}
                keyExtractor={keyExtractor}
                maintainVisibleContentPosition={{
                    minIndexForVisible: 0,
                    autoscrollToTopThreshold: 10,
                }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
                renderItem={renderItem}
                ListHeaderComponent={<ListFooter sessionId={props.sessionId} />}
                ListFooterComponent={<ListHeader />}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onScrollToIndexFailed={(info) => {
                    setTimeout(() => {
                        flatListRef.current?.scrollToOffset({
                            offset: 0,
                            animated: true
                        });
                    }, 100);
                }}
            />
            <ScrollToBottomButton
                visible={showScrollButton}
                onPress={scrollToLatest}
            />
        </>
    )
});

const styles = StyleSheet.create((theme) => ({
    scrollButton: {
        borderRadius: 20,
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: theme.colors.shadow.color,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 3.84,
        shadowOpacity: theme.colors.shadow.opacity,
        elevation: 5,
    },
    scrollButtonDefault: {
        backgroundColor: theme.colors.fab.background,
    },
    scrollButtonPressed: {
        backgroundColor: theme.colors.fab.backgroundPressed,
    },
}));