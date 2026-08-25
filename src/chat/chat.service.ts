import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatMessage } from './schemas/chat-message.schema';
import { ChatRoom, ChatRoomDocument } from './schemas/chat-room.schema';
import { MediaSignatureService } from '../media-access/media-signature.service';

@Injectable()
export class ChatService {
  private static readonly MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

  constructor(
    @InjectModel(ChatRoom.name) private readonly roomModel: Model<ChatRoom>,
    @InjectModel(ChatMessage.name)
    private readonly messageModel: Model<ChatMessage>,
    private readonly usersService: UsersService,
    private readonly mediaSignature: MediaSignatureService,
  ) {}

  async createRoom(currentUserId: string, dto: CreateRoomDto) {
    if (dto.memberId === currentUserId) {
      throw new BadRequestException('Cannot create room with yourself');
    }

    const members = [currentUserId, dto.memberId].sort();
    const memberObjectIds = members.map((id) => new Types.ObjectId(id));

    let room = await this.roomModel
      .findOne({
        members: { $all: memberObjectIds },
        $expr: { $eq: [{ $size: '$members' }, 2] },
      })
      .exec();

    if (!room) {
      room = await this.roomModel.create({
        members: memberObjectIds,
        createdBy: new Types.ObjectId(currentUserId),
        unreadCounts: {
          [currentUserId]: 0,
          [dto.memberId]: 0,
        },
      });
    }

    return this.toRoomResponse(room, currentUserId);
  }

  async listRooms(currentUserId: string) {
    const rooms = await this.roomModel
      .find({ members: new Types.ObjectId(currentUserId) })
      .sort({ updatedAt: -1 })
      .limit(100)
      .exec();

    return Promise.all(
      rooms.map((room) => this.toRoomResponse(room, currentUserId)),
    );
  }

  async listMessages(
    roomId: string,
    currentUserId: string,
    query: ListMessagesDto,
  ) {
    const room = await this.assertRoomMembership(roomId, currentUserId);
    const memberIds = room.members.map((member) => member.toString());

    const limit = query.limit ?? 50;
    const messages = await this.messageModel
      .find({ roomId: new Types.ObjectId(roomId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return messages
      .reverse()
      .map((message) =>
        this.toMessageResponse(message, currentUserId, memberIds),
      );
  }

  async sendMessage(
    roomId: string,
    currentUserId: string,
    dto: SendMessageDto,
  ) {
    const room = await this.assertRoomMembership(roomId, currentUserId);

    const text = dto.text?.trim() ?? '';
    const imageUrl = dto.imageUrl?.trim() ?? '';
    const fileUrl = dto.fileUrl?.trim() ?? '';
    const fileName = dto.fileName?.trim() ?? '';
    const fileMimeType = dto.fileMimeType?.trim() ?? '';
    const fileSize = dto.fileSize ?? 0;

    if (fileSize > ChatService.MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException(
        'File too large. Please choose a lighter file (max 50 MB).',
      );
    }

    if (!text && !imageUrl && !fileUrl) {
      throw new BadRequestException('Message cannot be empty');
    }

    const message = await this.messageModel.create({
      roomId: new Types.ObjectId(roomId),
      senderId: new Types.ObjectId(currentUserId),
      text,
      imageUrl,
      fileUrl,
      fileName,
      fileMimeType,
      fileSize,
      readBy: [new Types.ObjectId(currentUserId)],
    });

    const unread = this.toPlainUnreadCounts(room.unreadCounts);
    for (const memberId of room.members.map((member) => member.toString())) {
      unread[memberId] =
        memberId === currentUserId ? 0 : (unread[memberId] ?? 0) + 1;
    }

    room.lastMessage =
      text ||
      (this.isImageMessage(message)
        ? 'Image'
        : this.formatAttachmentPreview(fileName));
    room.unreadCounts = unread;
    await room.save();

    const memberIds = room.members.map((member) => member.toString());
    return this.toMessageResponse(message, currentUserId, memberIds);
  }

  async markRead(roomId: string, currentUserId: string) {
    const room = await this.assertRoomMembership(roomId, currentUserId);
    const unread = this.toPlainUnreadCounts(room.unreadCounts);
    unread[currentUserId] = 0;
    room.unreadCounts = unread;
    await room.save();

    const currentUserObjectId = new Types.ObjectId(currentUserId);
    await this.messageModel
      .updateMany(
        {
          roomId: new Types.ObjectId(roomId),
          senderId: { $ne: currentUserObjectId },
          readBy: { $ne: currentUserObjectId },
        },
        {
          $addToSet: { readBy: currentUserObjectId },
        },
      )
      .exec();

    return { success: true };
  }

  private async assertRoomMembership(roomId: string, currentUserId: string) {
    const room = await this.roomModel.findById(roomId).exec();
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isMember = room.members.some(
      (member) => member.toString() === currentUserId,
    );
    if (!isMember) {
      throw new ForbiddenException('You are not allowed in this room');
    }

    return room;
  }

  private async toRoomResponse(room: ChatRoomDocument, currentUserId: string) {
    const otherUserId = room.members
      .map((member) => member.toString())
      .find((memberId) => memberId !== currentUserId);

    const otherUser = otherUserId
      ? await this.usersService.findById(otherUserId)
      : null;

    const unreadCounts = this.toPlainUnreadCounts(room.unreadCounts);

    return {
      id: room._id.toString(),
      members: room.members.map((member) => member.toString()),
      otherUser: otherUser ? this.usersService.toPublicUser(otherUser) : null,
      lastMessage: room.lastMessage ?? '',
      unreadCount: unreadCounts[currentUserId] ?? 0,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }

  private toPlainUnreadCounts(source: unknown): Record<string, number> {
    if (!source) {
      return {};
    }

    if (source instanceof Map) {
      return Object.fromEntries(source.entries()) as Record<string, number>;
    }

    if (typeof (source as { toJSON?: unknown }).toJSON === 'function') {
      return (source as { toJSON: () => Record<string, number> }).toJSON();
    }

    return { ...(source as Record<string, number>) };
  }

  private toMessageResponse(
    message: ChatMessage & { _id: Types.ObjectId },
    currentUserId: string,
    memberIds: string[],
  ) {
    return {
      id: message._id.toString(),
      roomId: message.roomId.toString(),
      senderId: message.senderId.toString(),
      text: message.text,
      // Pieces jointes privees : l'URL n'est lisible que signee, et seulement
      // par un membre de la conversation, qui est le seul a la recevoir.
      imageUrl: this.mediaSignature.sign(message.imageUrl ?? ''),
      fileUrl: this.mediaSignature.sign(message.fileUrl ?? ''),
      fileName: message.fileName ?? '',
      fileMimeType: message.fileMimeType ?? '',
      fileSize: message.fileSize ?? 0,
      isRead: this.isMessageReadByOthers(message, currentUserId, memberIds),
      createdAt: message.createdAt,
    };
  }

  private isMessageReadByOthers(
    message: Pick<ChatMessage, 'senderId' | 'readBy'>,
    currentUserId: string,
    memberIds: string[],
  ) {
    const senderId = message.senderId.toString();
    if (senderId !== currentUserId) {
      return false;
    }

    const otherMemberIds = memberIds.filter((id) => id !== senderId);
    if (!otherMemberIds.length) {
      return false;
    }

    const readBy = new Set(
      (message.readBy ?? []).map((item) => item.toString()),
    );
    return otherMemberIds.every((id) => readBy.has(id));
  }

  private isImageMessage(
    message: Pick<ChatMessage, 'imageUrl' | 'fileMimeType'>,
  ) {
    return (
      !!message.imageUrl ||
      (message.fileMimeType ? message.fileMimeType.startsWith('image/') : false)
    );
  }

  private formatAttachmentPreview(fileName: string) {
    if (!fileName) {
      return 'File';
    }
    return `File: ${fileName}`;
  }
}
