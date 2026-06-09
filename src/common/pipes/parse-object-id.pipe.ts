import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

/**
 * Valide qu'un parametre de route est un ObjectId Mongo bien forme.
 * Evite qu'un id malforme provoque une CastError -> 500 ; renvoie un 400 propre.
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid identifier format');
    }
    return value;
  }
}
