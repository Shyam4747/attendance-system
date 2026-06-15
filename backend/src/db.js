import mongoose from "mongoose";

function getMongoUri(uri) {
  if (uri?.startsWith("mongodb://") || uri?.startsWith("mongodb+srv://")) {
    return uri;
  }

  if (process.env.MONGO_PASSWORD) {
    const password = encodeURIComponent(process.env.MONGO_PASSWORD);
    return `mongodb+srv://shyam2353050_db_user:${password}@cluster0.hdzmfgq.mongodb.net/attendance?retryWrites=true&w=majority&appName=Cluster0`;
  }

  return uri;
}

export async function connectDatabase(uri) {
  const mongoUri = getMongoUri(uri);

  if (!mongoUri) {
    throw new Error("MONGODB_URI or MONGO_PASSWORD is required.");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri);
}
