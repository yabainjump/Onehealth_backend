import { ForbiddenException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { ChatService } from './chat.service';
import { ChatRoom } from './schemas/chat-room.schema';
import { ChatMessage } from './schemas/chat-message.schema';
import { UsersService } from '../users/users.service';
import { MediaSignatureService } from '../media-access/media-signature.service';
import { UploadService } from '../upload/upload.service';

describe('ChatService bounded room participants', () => {
  const me = new Types.ObjectId();
  const other = new Types.ObjectId();
  const outsider = new Types.ObjectId();
  const room = {
    _id: new Types.ObjectId(),
    members: [me, other],
    unreadCounts: {},
    lastMessage: '',
  };
  const query = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };
  const rooms = { find: jest.fn(() => query), findById: jest.fn(() => query) };
  const messages = {
    find: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  };
  const users = {
    findByIds: jest.fn(),
    findById: jest.fn(),
    toPublicUser: UsersService.prototype.toPublicUser.bind(
      UsersService.prototype,
    ),
  };
  const signer = { sign: jest.fn() };
  const uploads = { verifyPrivateUpload: jest.fn() };
  const service = new ChatService(
    rooms as unknown as Model<ChatRoom>,
    messages as unknown as Model<ChatMessage>,
    users as unknown as UsersService,
    signer as unknown as MediaSignatureService,
    uploads as unknown as UploadService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    query.exec.mockResolvedValue([
      room,
      { ...room, _id: new Types.ObjectId() },
    ]);
    users.findByIds.mockResolvedValue([
      {
        _id: other,
        username: 'Participant',
        email: 'private',
        phone: 'private',
        passwordHash: 'never-return',
        hubCountryCodes: ['CM'],
        hubRoles: ['hub_admin'],
      },
    ]);
  });

  it('filters rooms by identity and loads unique participants once with public projection', async () => {
    const result = await service.listRooms(me.toString());
    expect(rooms.find).toHaveBeenCalledWith({ members: me });
    expect(query.limit).toHaveBeenCalledWith(100);
    expect(users.findByIds).toHaveBeenCalledTimes(1);
    expect(users.findByIds).toHaveBeenCalledWith([other.toString()]);
    expect(users.findById).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0].otherUser).toMatchObject({
      username: 'Participant',
      email: '',
      phone: '',
      hubRoles: [],
      hubCountryCodes: [],
    });
    expect(result[0].otherUser).not.toHaveProperty('passwordHash');
  });

  it('does not query users for an empty authorized list', async () => {
    query.exec.mockResolvedValue([]);
    expect(await service.listRooms(me.toString())).toEqual([]);
    expect(users.findByIds).not.toHaveBeenCalled();
  });

  it('keeps a deleted participant null without another database lookup', async () => {
    users.findByIds.mockResolvedValue([]);
    expect((await service.listRooms(me.toString()))[0].otherUser).toBeNull();
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('denies non-member reads, writes and read receipts before touching messages or signatures', async () => {
    query.exec.mockResolvedValue(room);
    await expect(
      service.listMessages(room._id.toString(), outsider.toString(), {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.markRead(room._id.toString(), outsider.toString()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.sendMessage(room._id.toString(), outsider.toString(), {
        text: 'test',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messages.find).not.toHaveBeenCalled();
    expect(messages.updateMany).not.toHaveBeenCalled();
    expect(messages.create).not.toHaveBeenCalled();
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it('rejects an attachment from another uploader before creating a message', async () => {
    query.exec.mockResolvedValue(room);
    uploads.verifyPrivateUpload.mockReturnValue(null);
    await expect(
      service.sendMessage(room._id.toString(), me.toString(), {
        fileUrl: 'https://api.test/uploads/message/stolen.pdf?exp=1&sig=stolen',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messages.create).not.toHaveBeenCalled();
  });

  it('stores only the canonical URL after a valid sender-bound upload claim', async () => {
    query.exec.mockResolvedValue({ ...room, save: jest.fn() });
    uploads.verifyPrivateUpload.mockReturnValue(
      'https://api.test/uploads/message/own.pdf',
    );
    const message = {
      _id: new Types.ObjectId(),
      roomId: room._id,
      senderId: me,
      fileUrl: 'https://api.test/uploads/message/own.pdf',
      fileName: 'own.pdf',
      readBy: [me],
      createdAt: new Date(),
    };
    messages.create.mockResolvedValue(message);
    signer.sign.mockImplementation((url: string) => url);
    await service.sendMessage(room._id.toString(), me.toString(), {
      fileUrl: 'https://api.test/uploads/message/own.pdf?claim=valid',
      fileName: 'own.pdf',
    });
    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fileUrl: 'https://api.test/uploads/message/own.pdf',
      }),
    );
    expect(uploads.verifyPrivateUpload).toHaveBeenCalledWith(
      'https://api.test/uploads/message/own.pdf?claim=valid',
      me.toString(),
      'message',
    );
  });
});
