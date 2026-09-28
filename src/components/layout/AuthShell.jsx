export default function AuthShell({ children, maxWidth = 400 }) {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background px-4 py-7 font-sans">
      <div className="my-auto w-full" style={{ maxWidth }}>{children}</div>
    </div>
  );
}
