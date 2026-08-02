import 'dotenv/config';
import bcrypt from 'bcrypt';
import mongoose, { Model } from 'mongoose';
import {
  HubRole,
  User,
  UserSchema,
  UserRole,
} from '../src/users/schemas/user.schema';

const MIN_PASSWORD_LENGTH = 14;
const MAX_PASSWORD_LENGTH = 128;

function readRequiredEnvironmentVariable(name: string): string {
  const value = (process.env[name] ?? '').trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function validateConfiguration(email: string, password: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('SUPER_ADMIN_EMAIL must be a valid email address');
  }
  if (
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new Error(
      `SUPER_ADMIN_PASSWORD must contain between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`,
    );
  }
}

async function main(): Promise<void> {
  const mongodbUri = readRequiredEnvironmentVariable('MONGODB_URI');
  const email =
    readRequiredEnvironmentVariable('SUPER_ADMIN_EMAIL').toLowerCase();
  const password = readRequiredEnvironmentVariable('SUPER_ADMIN_PASSWORD');
  const dbName = (process.env.MONGODB_DB_NAME ?? 'onehealth').trim();
  const username = (
    process.env.SUPER_ADMIN_USERNAME ?? 'superadmin_ceeac'
  ).trim();
  const firstName = (process.env.SUPER_ADMIN_FIRST_NAME ?? 'Super').trim();
  const lastName = (
    process.env.SUPER_ADMIN_LAST_NAME ?? 'Administrateur'
  ).trim();

  validateConfiguration(email, password);
  if (username.length < 3 || username.length > 40) {
    throw new Error(
      'SUPER_ADMIN_USERNAME must contain between 3 and 40 characters',
    );
  }

  await mongoose.connect(mongodbUri, { dbName });
  const userModel =
    (mongoose.models[User.name] as Model<User> | undefined) ??
    mongoose.model<User>(User.name, UserSchema);

  // Nettoie les anciennes valeurs null incompatibles avec l'index unique
  // sparse. Un Google ID absent doit être un champ MongoDB absent.
  await userModel
    .updateMany({ googleId: null }, { $unset: { googleId: 1 } })
    .exec();
  const passwordHash = await bcrypt.hash(password, 12);

  const existingUser = await userModel.findOne({ email }).select('_id').lean();
  const user = await userModel
    .findOneAndUpdate(
      { email },
      {
        $set: {
          passwordHash,
          username,
          firstName,
          lastName,
          institution: 'One Health Network / Hub régional CEEAC',
          role: UserRole.ADMIN,
          hubRoles: [
            HubRole.VIEWER,
            HubRole.ANALYST,
            HubRole.VERIFIER,
            HubRole.ADMIN,
          ],
          hubCountryCodes: [],
          isCertified: true,
          certificationStatus: 'approved',
          isBanned: false,
          passwordResetTokenHash: '',
          passwordResetExpiresAt: null,
          passwordResetRequestedAt: null,
        },
        $setOnInsert: {
          email,
        },
      },
      {
        returnDocument: 'after',
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    )
    .exec();

  if (!user) {
    throw new Error('The super administrator could not be created');
  }

  console.log(
    JSON.stringify(
      {
        status: existingUser ? 'updated' : 'created',
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        hubRoles: user.hubRoles,
        database: dbName,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Super administrator creation failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
