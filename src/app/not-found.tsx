import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="text-5xl">🗺️</div>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-ink-muted">
        We couldn&apos;t find what you were looking for. It may have ended or
        moved.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-2xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-brand-600"
      >
        Back to home
      </Link>
    </div>
  );
}
