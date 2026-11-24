import { withLocale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/dictionary";

export default async function CheckEmailPage() {
  const locale = await getLocale();
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <section className="w-full space-y-4 rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">Verify your email</h1>
        <p>Check your inbox and follow the link to verify your email address.</p>
        <p>
          After verification, an organization administrator must invite you before you can access
          AgriAsaan.
        </p>
        <a className="inline-block underline" href={withLocale(locale, "/login")}>
          Return to sign in
        </a>
      </section>
    </main>
  );
}
