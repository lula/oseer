import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import Database from "better-sqlite3";

export const auth = betterAuth({
  database: new Database("./data/oseer.db"),
  advanced: {
    cookiePrefix: 'openseer',
    database: {
      joins: true,
    },
  },
  plugins: [admin()],
  emailAndPassword: {
    enabled: true
  },
})
