import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted p-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-accent-primary mb-4">404</h1>
        <p className="text-xl text-accent-secondary mb-2">Page not found</p>
        <p className="text-accent-secondary/60 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-block bg-accent-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-accent-primary/90 transition"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
