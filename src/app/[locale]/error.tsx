"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-lg">Něco se pokazilo · Niečo sa pokazilo</p>
      <button onClick={reset} className="btn-primary mt-6">↻</button>
    </div>
  );
}
