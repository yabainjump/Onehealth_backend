import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CertificationRequestStatus = 'pending' | 'approved' | 'rejected';

@Schema({
  collection: 'certification_requests',
  timestamps: true,
  versionKey: false,
})
export class CertificationRequest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  // URLs des justificatifs (diplômes, attestations) déjà envoyés via /upload.
  @Prop({ type: [String], default: [] })
  documents: string[];

  @Prop({ default: '', trim: true, maxlength: 1000 })
  message: string;

  @Prop({
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  })
  status: CertificationRequestStatus;

  // Motif du refus / notes internes de l'administrateur.
  @Prop({ default: '', trim: true, maxlength: 1000 })
  adminNotes: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reviewedBy: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  reviewedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export type CertificationRequestDocument = HydratedDocument<CertificationRequest>;
export const CertificationRequestSchema =
  SchemaFactory.createForClass(CertificationRequest);

CertificationRequestSchema.index({ status: 1, createdAt: -1 });
