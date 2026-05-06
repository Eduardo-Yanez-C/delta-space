import type { AuthUserPayload } from "../auth/auth.service";
import { ConversationsService } from "./conversations.service";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
export declare class ConversationsController {
    private readonly conversationsService;
    constructor(conversationsService: ConversationsService);
    listDirectoryUsers(user: AuthUserPayload): Promise<{
        users: {
            id: string;
            email: string;
            name: string;
        }[];
    }>;
    list(user: AuthUserPayload): Promise<{
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
    create(dto: CreateConversationDto, user: AuthUserPayload): Promise<{
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
    getOne(id: string, user: AuthUserPayload): Promise<{
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
    getMessages(id: string, limitStr: string | undefined, before: string | undefined, user: AuthUserPayload): Promise<{
        messages: {
            id: string;
            body: string;
            createdAt: string;
            authorId: string;
            authorName: string;
            metadata: import("./conversations.service").MessageMetadataApi | null;
        }[];
    }>;
    createMessage(id: string, dto: CreateMessageDto, user: AuthUserPayload): Promise<{
        id: string;
        body: string;
        createdAt: string;
        authorId: string;
        authorName: string;
        metadata: import("./conversations.service").MessageMetadataApi | null;
    }>;
    markRead(id: string, user: AuthUserPayload): Promise<{
        ok: true;
        lastReadAt: string;
    }>;
}
