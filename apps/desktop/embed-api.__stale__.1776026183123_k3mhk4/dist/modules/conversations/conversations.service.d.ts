import { PrismaService } from "../../infra/prisma/prisma.service";
import type { AuthUserPayload } from "../auth/auth.service";
import type { CreateConversationDto } from "./dto/create-conversation.dto";
import type { CreateMessageDto } from "./dto/create-message.dto";
export type QuoteRefStored = {
    quoteId: string;
    titleSnapshot: string;
    commercialNumberSnapshot: string | null;
};
export type MessageMetadataStored = {
    mentions: string[];
    quoteRefs: QuoteRefStored[];
};
export type MessageMetadataApi = {
    mentions: {
        userId: string;
        displayName: string;
    }[];
    quoteRefs: QuoteRefStored[];
};
export declare class ConversationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listDirectoryUsers(currentUserId: string): Promise<{
        users: {
            id: string;
            email: string;
            name: string;
        }[];
    }>;
    findExistingDirectConversation(userIdA: string, userIdB: string): Promise<({
        createdBy: {
            id: string;
            email: string;
            name: string | null;
            fullName: string | null;
        };
        members: ({
            user: {
                id: string;
                email: string;
                name: string | null;
                fullName: string | null;
            };
        } & {
            id: string;
            userId: string;
            leftAt: Date | null;
            conversationId: string;
            joinedAt: Date;
            lastReadAt: Date | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string | null;
        type: string;
        createdById: string;
    }) | null>;
    createConversation(dto: CreateConversationDto, createdById: string): Promise<{
        id: string;
        type: string;
        title: string;
        rawTitle: string | null;
        createdAt: string;
        updatedAt: string;
        unreadCount: number;
        members: {
            userId: string;
            joinedAt: string;
            lastReadAt: string | null;
            user: {
                id: string;
                email: string;
                name: string;
            };
        }[];
    }>;
    listForUser(userId: string): Promise<{
        conversations: {
            id: string;
            type: string;
            title: string;
            rawTitle: string | null;
            updatedAt: string;
            unreadCount: number;
            lastMessage: {
                id: string;
                body: string;
                createdAt: string;
                authorId: string;
                authorName: string;
            } | null;
        }[];
    }>;
    private displayTitle;
    private unreadCount;
    getOne(conversationId: string, userId: string): Promise<{
        id: string;
        type: string;
        title: string;
        rawTitle: string | null;
        createdAt: string;
        updatedAt: string;
        unreadCount: number;
        members: {
            userId: string;
            joinedAt: string;
            lastReadAt: string | null;
            user: {
                id: string;
                email: string;
                name: string;
            };
        }[];
    }>;
    private mapConversationDetail;
    getMessages(conversationId: string, userId: string, query: {
        limit?: number;
        before?: string;
    }): Promise<{
        messages: {
            id: string;
            body: string;
            createdAt: string;
            authorId: string;
            authorName: string;
            metadata: MessageMetadataApi | null;
        }[];
    }>;
    private storedToApi;
    private formatMessageList;
    private getMentionableMemberUserIds;
    createMessage(conversationId: string, authorId: string, dto: CreateMessageDto, authUser: AuthUserPayload): Promise<{
        id: string;
        body: string;
        createdAt: string;
        authorId: string;
        authorName: string;
        metadata: MessageMetadataApi | null;
    }>;
    markRead(conversationId: string, userId: string): Promise<{
        ok: true;
        lastReadAt: string;
    }>;
    private assertMember;
}
