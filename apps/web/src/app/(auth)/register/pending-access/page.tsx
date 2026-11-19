export default function PendingAccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <section className="w-full space-y-4 rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">Access pending</h1>
        <p>
          Your account is ready, but it is not connected to an organization.
          Ask an organization administrator to invite you.
        </p>
        <a className="inline-block underline" href="/login">Return to sign in</a>
      </section>
    </main>
  );
}