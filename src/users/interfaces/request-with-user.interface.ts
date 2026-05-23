import { Request } from 'express';
import { PublicUser } from './public-user.interface';

export interface RequestWithUser extends Request {
  user: PublicUser;
}
