// Next.js chiama register() in tutti i runtime: il codice di avvio (migrazioni, WAL, recupero degli import, scansione dell'inbox)
// usa moduli Node e sta in instrumentation-node.ts.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerNode } = await import('./instrumentation-node')
    await registerNode()
  }
}
