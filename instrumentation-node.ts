import { isAPIError } from "better-auth/api";

export async function registerNode() {
  // better-sqlite3 is a native Node addon: keep it out of the Edge bundle.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getMigrations } = await import("better-auth/db/migration");
    const { auth } = await import("./lib/auth");

    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();

    // Imported tables, and the record of who created them (_table_imports).
    const { initTablesDb } = await import("./lib/user-tables");
    initTablesDb();

    try {
      await auth.api.createUser({
        body: {
          email: process.env.ADMIN_EMAIL!,
          password: process.env.ADMIN_PASSWORD!,
          name: process.env.ADMIN_NAME!,
          role: "admin"
        }
      })
      console.log(`- Admin user ${process.env.ADMIN_EMAIL} created`);
    } catch (error: unknown) {
      if (isAPIError(error) && error.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
        console.log(`- Admin user ${process.env.ADMIN_EMAIL} already created`);
      }
    }
  }
}
