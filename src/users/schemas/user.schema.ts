import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum HubRole {
  VIEWER = 'hub_viewer',
  ANALYST = 'hub_analyst',
  VERIFIER = 'hub_verifier',
  ADMIN = 'hub_admin',
}

export enum UserPhotoSource {
  GOOGLE = 'google',
  USER = 'user',
}

export type CertificationStatus = 'none' | 'pending' | 'approved' | 'rejected';

@Schema({
  collection: 'users',
  timestamps: true,
  versionKey: false,
})
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  // Identifiant Google (sub du token) pour les comptes créés/liés via
  // « Se connecter avec Google ». Sparse : la plupart des comptes n'en ont pas.
  // Ce champ doit rester absent pour un compte classique. Avec un index
  // unique sparse, stocker explicitement `null` empêcherait la création d'un
  // deuxième compte sans Google ID.
  @Prop({ type: String, index: { unique: true, sparse: true } })
  googleId?: string;

  @Prop({ default: '', select: false })
  passwordResetTokenHash: string;

  @Prop({ type: Date, default: null, select: false })
  passwordResetExpiresAt: Date | null;

  @Prop({ type: Date, default: null, select: false })
  passwordResetRequestedAt: Date | null;

  // Tout jeton emis avant cette date est refuse : une reinitialisation doit
  // fermer les sessions ouvertes, y compris celle d'un voleur de jeton.
  @Prop({ type: Date, default: null })
  passwordChangedAt: Date | null;

  @Prop({ required: true, trim: true, minlength: 3, maxlength: 40 })
  username: string;

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ default: '', trim: true })
  institution: string;

  @Prop({ default: '' })
  typeMedecin: string;

  @Prop({ default: '' })
  country: string;

  @Prop({ default: '' })
  city: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  bio: string;

  @Prop({ default: '' })
  photoURL: string;

  @Prop({
    type: String,
    enum: Object.values(UserPhotoSource),
    default: null,
  })
  photoSource: UserPhotoSource | null;

  // URL Google d'origine, conservée uniquement pour détecter un changement
  // d'avatar lors d'une prochaine connexion. Elle n'est jamais exposée par API.
  @Prop({ default: '' })
  googlePhotoURL: string;

  // Champs historiques issus de l'ancienne base Firebase. Ils restent lus
  // afin que les premiers comptes conservent leurs images après migration.
  @Prop({ default: '' })
  photo: string;

  @Prop({ default: '' })
  coverPhotoURL: string;

  @Prop({ default: '' })
  coverPhoto: string;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  followers: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  following: Types.ObjectId[];

  @Prop({ type: String, enum: UserRole, default: UserRole.USER })
  role: UserRole;

  // Autorisations du Hub régional. Elles sont séparées du rôle de
  // l'application communautaire pour ne pas donner un accès institutionnel
  // aux comptes existants par défaut.
  @Prop({ type: [String], enum: Object.values(HubRole), default: [] })
  hubRoles: HubRole[];

  // Codes ISO 3166-1 alpha-2 des pays dont l'utilisateur peut consulter les
  // données. Un administrateur global ou Hub n'est pas limité par cette liste.
  @Prop({ type: [String], default: [] })
  hubCountryCodes: string[];

  // ---- Certification de profil (professionnels de santé / institutions) ----
  @Prop({ type: Boolean, default: false, index: true })
  isCertified: boolean;

  @Prop({
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none',
  })
  certificationStatus: CertificationStatus;

  @Prop({ type: Date, default: null })
  certificationRequestedAt: Date | null;

  // Compte suspendu par un administrateur : connexion refusée.
  @Prop({ type: Boolean, default: false, index: true })
  isBanned: boolean;

  @Prop({ type: Boolean, default: false })
  isOnline: boolean;

  @Prop({ type: Date, default: Date.now })
  lastSeenAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
