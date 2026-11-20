import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import Database from "better-sqlite3";

/** The auth database (users, sessions…), managed by better-auth. */
export const authDb = new Database("./data/oseer.db");

export const auth = betterAuth({
  database: authDb,
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
