import { loginAction } from "./actions";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <form action={loginAction} className="w-full space-y-4 rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">Sign in to AgriAsaan</h1>
        <label className="block">
          <span className="mb-1 block text-sm">Email</span>
          <input className="w-full rounded border px-3 py-2" name="email" type="email" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Password</span>
          <input className="w-full rounded border px-3 py-2" name="password" type="password" minLength={6} required />
        </label>
        <button className="w-full rounded bg-black px-4 py-3 text-white" type="submit">Sign in</button>
        <a className="block text-center text-sm underline" href="/register">Create an account</a>
      </form>
    </main>
  );
}
