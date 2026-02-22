import { InvalidateSync } from "@/utils/sync";
import { RawJSONLines, RawJSONLinesSchema } from "../types";
import { join } from "node:path";
import { readFile, readdir, stat } from "node:fs/promises";
import { logger } from "@/ui/logger";
import { startFileWatcher } from "@/modules/watcher/startFileWatcher";
import { getProjectPath } from "./path";

/**
 * Known internal Claude Code event types that should be silently skipped.
 * These are written to session JSONL files by Claude Code but are not 
 * actual conversation messages - they're internal state/tracking events.
 */
const INTERNAL_CLAUDE_EVENT_TYPES = new Set([
    'file-history-snapshot',
    'change',
    'queue-operation',
]);

export async function createSessionScanner(opts: {
    sessionId: string | null,
    workingDirectory: string
    onMessage: (message: RawJSONLines) => void
}) {

    // Resolve project directory
    const projectDir = getProjectPath(opts.workingDirectory);

    // Finished, pending finishing and current session
    let finishedSessions = new Set<string>();
    let pendingSessions = new Set<string>();
    let currentSessionId: string | null = null;
    let watchers = new Map<string, (() => void)>();
    let processedMessageKeys = new Set<string>();

    // Mark existing messages as processed and start watching the initial session
    if (opts.sessionId) {
        let messages = await readSessionLog(projectDir, opts.sessionId);
        logger.debug(`[SESSION_SCANNER] Marking ${messages.length} existing messages as processed from session ${opts.sessionId}`);
        for (let m of messages) {
            processedMessageKeys.add(messageKey(m));
        }
        // IMPORTANT: Also start watching the initial session file because Claude Code
        // may continue writing to it even after creating a new session with --resume
        // (agent tasks and other updates can still write to the original session file)
        currentSessionId = opts.sessionId;
    }

    // Main sync function
    const sync = new InvalidateSync(async () => {
        // logger.debug(`[SESSION_SCANNER] Syncing...`);

        // Collect session ids - include ALL sessions that have watchers
        // This ensures we continue processing sessions that Claude Code may still write to
        let sessions: string[] = [];
        for (let p of pendingSessions) {
            sessions.push(p);
        }
        if (currentSessionId && !pendingSessions.has(currentSessionId)) {
            sessions.push(currentSessionId);
        }
        // Also process sessions that have active watchers (they may still receive updates)
        for (let [sessionId] of watchers) {
            if (!sessions.includes(sessionId)) {
                sessions.push(sessionId);
            }
        }

        // Process sessions
        for (let session of sessions) {
            const sessionMessages = await readSessionLog(projectDir, session);
            let skipped = 0;
            let sent = 0;
            for (let file of sessionMessages) {
                let key = messageKey(file);
                if (processedMessageKeys.has(key)) {
                    skipped++;
                    continue;
                }
                processedMessageKeys.add(key);
                logger.debug(`[SESSION_SCANNER] Sending new message: type=${file.type}, uuid=${file.type === 'summary' ? file.leafUuid : file.uuid}`);
                opts.onMessage(file);
                sent++;
            }
            if (sessionMessages.length > 0) {
                logger.debug(`[SESSION_SCANNER] Session ${session}: found=${sessionMessages.length}, skipped=${skipped}, sent=${sent}`);
            }
        }

        // Move pending sessions to finished sessions (but keep processing them via watchers)
        for (let p of sessions) {
            if (pendingSessions.has(p)) {
                pendingSessions.delete(p);
                finishedSessions.add(p);
            }
        }

        // Update watchers for all sessions
        for (let p of sessions) {
            if (!watchers.has(p)) {
                logger.debug(`[SESSION_SCANNER] Starting watcher for session: ${p}`);
                watchers.set(p, startFileWatcher(join(projectDir, `${p}.jsonl`), () => { sync.invalidate(); }));
            }
        }
    });
    await sync.invalidateAndAwait();

    // Periodic sync
    const intervalId = setInterval(() => { sync.invalidate(); }, 3000);

    // Public interface
    return {
        cleanup: async () => {
            clearInterval(intervalId);
            for (let w of watchers.values()) {
                w();
            }
            watchers.clear();
            await sync.invalidateAndAwait();
            sync.stop();
        },
        onNewSession: (sessionId: string) => {
            if (currentSessionId === sessionId) {
                logger.debug(`[SESSION_SCANNER] New session: ${sessionId} is the same as the current session, skipping`);
                return;
            }
            if (finishedSessions.has(sessionId)) {
                logger.debug(`[SESSION_SCANNER] New session: ${sessionId} is already finished, skipping`);
                return;
            }
            if (pendingSessions.has(sessionId)) {
                logger.debug(`[SESSION_SCANNER] New session: ${sessionId} is already pending, skipping`);
                return;
            }
            if (currentSessionId) {
                pendingSessions.add(currentSessionId);
            }
            logger.debug(`[SESSION_SCANNER] New session: ${sessionId}`)
            currentSessionId = sessionId;
            sync.invalidate();
        },
    }
}

export type SessionScanner = ReturnType<typeof createSessionScanner>;


//
// Helpers
//

function messageKey(message: RawJSONLines): string {
    if (message.type === 'user') {
        return message.uuid;
    } else if (message.type === 'assistant') {
        return message.uuid;
    } else if (message.type === 'summary') {
        return 'summary: ' + message.leafUuid + ': ' + message.summary;
    } else if (message.type === 'system') {
        return message.uuid;
    } else {
        throw Error() // Impossible
    }
}

/**
 * Read and parse session log file
 * Returns only valid conversation messages, silently skipping internal events
 */
async function readSessionLog(projectDir: string, sessionId: string): Promise<RawJSONLines[]> {
    const sessionFiles = await listSessionLogFiles(projectDir, sessionId);
    if (sessionFiles.length === 0) {
        return [];
    }

    const parsedMessages: Array<{
        message: RawJSONLines;
        order: number;
        timestampMs: number | null;
    }> = [];

    let order = 0;
    for (const sessionFile of sessionFiles) {
        logger.debug(`[SESSION_SCANNER] Reading session file: ${sessionFile}`);
        let file: string;
        try {
            file = await readFile(sessionFile, 'utf-8');
        } catch (error) {
            logger.debug(`[SESSION_SCANNER] Session file not found: ${sessionFile}`);
            continue;
        }

        const lines = file.split('\n');
        for (const l of lines) {
            try {
                if (l.trim() === '') {
                    continue;
                }
                const message = JSON.parse(l);

                // Silently skip known internal Claude Code events
                // These are state/tracking events, not conversation messages
                if (message.type && INTERNAL_CLAUDE_EVENT_TYPES.has(message.type)) {
                    continue;
                }

                const parsed = RawJSONLinesSchema.safeParse(message);
                if (!parsed.success) {
                    // Unknown message types are silently skipped
                    // They will be tracked by processedMessageKeys to avoid reprocessing
                    continue;
                }
                parsedMessages.push({
                    message: parsed.data,
                    order: order++,
                    timestampMs: getMessageTimestampMs(parsed.data),
                });
            } catch (e) {
                logger.debug(`[SESSION_SCANNER] Error processing message: ${e}`);
                continue;
            }
        }
    }

    parsedMessages.sort((a, b) => {
        if (a.timestampMs !== null && b.timestampMs !== null && a.timestampMs !== b.timestampMs) {
            return a.timestampMs - b.timestampMs;
        }
        return a.order - b.order;
    });

    return parsedMessages.map((entry) => entry.message);
}

async function listSessionLogFiles(projectDir: string, sessionId: string): Promise<string[]> {
    const files: string[] = [];

    const topLevelSessionFile = join(projectDir, `${sessionId}.jsonl`);
    if (await pathExists(topLevelSessionFile)) {
        files.push(topLevelSessionFile);
    }

    const subagentDir = join(projectDir, sessionId, 'subagents');
    try {
        const entries = await readdir(subagentDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile()) {
                continue;
            }
            if (!entry.name.endsWith('.jsonl')) {
                continue;
            }
            files.push(join(subagentDir, entry.name));
        }
    } catch {
        // Directory does not exist in many sessions - ignore.
    }

    return files;
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
}

function getMessageTimestampMs(message: RawJSONLines): number | null {
    const raw = message as { timestamp?: unknown };
    const timestamp = raw.timestamp;
    if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
        return timestamp;
    }
    if (typeof timestamp === 'string') {
        const parsed = Date.parse(timestamp);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }
    return null;
}
