import { ConnectionForm } from './_components/ConnectionForm';

export default function Home() {
  return (
    <main style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>
          DBDiff
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          Compare database schemas — detect drift between a reference and target database.
        </p>
      </header>

      <ConnectionForm />
    </main>
  );
}
