export default function Loader({ message = "Уншиж байна..." }: { message?: string }) {
  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
      <div className="text-center">
        <span className="loader"></span>
        {message && <p className="mt-4 text-zinc-400">{message}</p>}
      </div>
    </div>
  );
}