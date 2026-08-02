import 'dotenv/config';
import mongoose, { Model } from 'mongoose';
import { HubRole, User, UserSchema } from '../src/users/schemas/user.schema';

function readRequiredEnvironmentVariable(name: string): string {
  const value = (process.env[name] ?? '').trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function main(): Promise<void> {
  const mongodbUri = readRequiredEnvironmentVariable('MONGODB_URI');
  const email =
    readRequiredEnvironmentVariable('HUB_ADMIN_EMAIL').toLowerCase();
  const dbName = (process.env.MONGODB_DB_NAME ?? 'onehealth').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('HUB_ADMIN_EMAIL must be a valid email address');
  }

  await mongoose.connect(mongodbUri, { dbName });
  const userModel =
    (mongoose.models[User.name] as Model<User> | undefined) ??
    mongoose.model<User>(User.name, UserSchema);

  const user = await userModel
    .findOneAndUpdate(
      { email },
      {
        $addToSet: { hubRoles: HubRole.ADMIN },
        $set: { hubCountryCodes: [] },
      },
      { returnDocument: 'after', runValidators: true },
    )
    .exec();

  if (!user) {
    throw new Error(`No user found for ${email}`);
  }

  console.log(
    JSON.stringify(
      {
        status: 'hub-admin-granted',
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        hubRoles: user.hubRoles,
        hubCountryCodes: user.hubCountryCodes,
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
    console.error(`Hub administrator grant failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
