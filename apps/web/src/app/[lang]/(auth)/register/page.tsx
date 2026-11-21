import { withLocale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/dictionary";

import { registerAction } from "./actions";

export default async function RegisterPage() {
  const locale = await getLocale();
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <form action={registerAction} className="w-full space-y-4 rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">Create AgriAsaan account</h1>
        <label className="block">
          <span className="mb-1 block text-sm">Full name</span>
          <input className="w-full rounded border px-3 py-2" name="fullName" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Email</span>
          <input className="w-full rounded border px-3 py-2" name="email" type="email" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Password</span>
          <input
            className="w-full rounded border px-3 py-2"
            name="password"
            type="password"
            minLength={6}
            required
          />
        </label>
        <button className="w-full rounded bg-black px-4 py-3 text-white" type="submit">
          Register
        </button>
        <a className="block text-center text-sm underline" href={withLocale(locale, "/login")}>
          Already have an account?
        </a>
      </form>
    </main>
  );
}
