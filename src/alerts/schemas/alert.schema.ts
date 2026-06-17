import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AlertCategory = 'human' | 'animal' | 'environment';
export type AlertSeverity = 'low' | 'medium' | 'high';

@Schema({
  collection: 'alerts',
  timestamps: true,
  versionKey: false,
})
export class Alert {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  authorId: Types.ObjectId;

  // Pilier One Health concerné.
  @Prop({ required: true, enum: ['human', 'animal', 'environment'], index: true })
  category: AlertCategory;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 140 })
  title: string;

  @Prop({ default: '', trim: true, maxlength: 2000 })
  description: string;

  @Prop({ default: '', trim: true, maxlength: 80 })
  country: string;

  @Prop({ default: '', trim: true, maxlength: 120 })
  city: string;

  // Position GPS optionnelle (pour la carte).
  @Prop({ type: Number, default: null })
  lat: number | null;

  @Prop({ type: Number, default: null })
  lng: number | null;

  @Prop({ required: true, enum: ['low', 'medium', 'high'], default: 'medium', index: true })
  severity: AlertSeverity;

  @Prop({ type: [String], default: [] })
  imageUrls: string[];

  createdAt: Date;
  updatedAt: Date;
}

export type AlertDocument = HydratedDocument<Alert>;
export const AlertSchema = SchemaFactory.createForClass(Alert);

AlertSchema.index({ createdAt: -1 });
AlertSchema.index({ category: 1, createdAt: -1 });
