import mongoose from "mongoose"

// Drop the isolated test database before each run so suites start from a clean slate.
export default async function globalSetup() {
  const uri = process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27017/commandervault_e2e"
  await mongoose.connect(uri)
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
}
