import * as React from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import { Typography } from '@/constants/Typography';
import { Ionicons } from '@expo/vector-icons';
import { useUnistyles } from 'react-native-unistyles';
import { t } from '@/text';

interface ChatFooterProps {
    controlledByUser?: boolean;
    thinking?: boolean;
    thinkingAt?: number;
}

/**
 * Formats elapsed seconds into a human-readable duration string
 * Examples: "5s", "1m 5s", "1h 2m 5s"
 */
function formatDuration(seconds: number): string {
    if (seconds < 0) {
        return '0s';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

/**
 * Hook to track elapsed time from a given timestamp
 */
function useElapsedTime(startTimestamp: number | null | undefined): number {
    const [elapsed, setElapsed] = React.useState(0);

    React.useEffect(() => {
        if (!startTimestamp) {
            setElapsed(0);
            return;
        }

        const updateElapsed = () => {
            const now = Date.now();
            const elapsedSeconds = Math.floor((now - startTimestamp) / 1000);
            setElapsed(Math.max(0, elapsedSeconds));
        };

        updateElapsed();
        const interval = setInterval(updateElapsed, 1000);

        return () => clearInterval(interval);
    }, [startTimestamp]);

    return elapsed;
}

export const ChatFooter = React.memo((props: ChatFooterProps) => {
    const { theme } = useUnistyles();
    const elapsedSeconds = useElapsedTime(props.thinking ? props.thinkingAt : null);

    const containerStyle: ViewStyle = {
        alignItems: 'center',
        paddingTop: 4,
        paddingBottom: 2,
    };
    const warningContainerStyle: ViewStyle = {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: theme.colors.box.warning.background,
        borderRadius: 8,
        marginHorizontal: 32,
        marginTop: 4,
    };
    const warningTextStyle: TextStyle = {
        fontSize: 12,
        color: theme.colors.box.warning.text,
        marginLeft: 6,
        ...Typography.default()
    };
    const thinkingContainerStyle: ViewStyle = {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
        marginHorizontal: 32,
        marginTop: 4,
    };
    const thinkingTextStyle: TextStyle = {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginLeft: 6,
        ...Typography.default()
    };
    return (
        <View style={containerStyle}>
            {props.controlledByUser && (
                <View style={warningContainerStyle}>
                    <Ionicons
                        name="information-circle"
                        size={16}
                        color={theme.colors.box.warning.text}
                    />
                    <Text style={warningTextStyle}>
                        Permissions shown in terminal only. Reset or send a message to control from app.
                    </Text>
                </View>
            )}
            {props.thinking && props.thinkingAt && (
                <View style={thinkingContainerStyle}>
                    <Ionicons
                        name="time-outline"
                        size={16}
                        color={theme.colors.textSecondary}
                    />
                    <Text style={thinkingTextStyle}>
                        {t('status.thinking', { duration: formatDuration(elapsedSeconds) })}
                    </Text>
                </View>
            )}
        </View>
    );
});