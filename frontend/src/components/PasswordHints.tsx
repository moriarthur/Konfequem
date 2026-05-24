interface PasswordHintsProps {
  password: string;
  username?: string;
}

interface Requirement {
  label: string;
  met: boolean;
}

function getRequirements(password: string, username: string): Requirement[] {
  const p = password;
  return [
    { label: "At least 8 characters", met: p.length >= 8 },
    { label: "Not entirely numeric", met: p.length === 0 || !/^\d+$/.test(p) },
    {
      label: "Not too similar to username",
      met: !username || p.length === 0 || p.toLowerCase() !== username.toLowerCase(),
    },
  ];
}

export default function PasswordHints({ password, username = "" }: PasswordHintsProps) {
  if (!password) return null;

  const reqs = getRequirements(password, username);
  const allMet = reqs.every((r) => r.met);

  return (
    <ul className={`mt-2 space-y-0.5 transition-colors ${allMet ? "text-status-success-text" : "text-accent-secondary/40"}`}>
      {reqs.map((req) => (
        <li key={req.label} className="text-xs flex items-center gap-1.5">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              req.met ? "bg-status-success" : "bg-accent-secondary/30"
            }`}
          />
          {req.label}
        </li>
      ))}
    </ul>
  );
}
